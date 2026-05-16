import { expect } from 'chai';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import {
    sendPowerShellCommand,
    terminatePowerShellSession,
    CommandContext,
} from '../../lib/commands/powershell';

// ---------------------------------------------------------------------------
// Fake ChildProcess that we can drive from the test
// ---------------------------------------------------------------------------

class FakeStdin extends Writable {
    chunks: string[] = [];
    constructor() {
        super({ decodeStrings: false });
    }
    _write(chunk: any, _enc: any, cb: any) {
        this.chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
        cb();
    }
    text(): string {
        return this.chunks.join('');
    }
}

class FakeReadable extends EventEmitter {
    setEncoding(_: string) { return this; }
    push(text: string) { this.emit('data', text); }
}

class FakePowerShell extends EventEmitter {
    pid: number | undefined = 99999;
    exitCode: number | null = null;
    killed = false;
    stdin = new FakeStdin();
    stdout = new FakeReadable();
    stderr = new FakeReadable();

    kill(_signal?: any): boolean {
        this.killed = true;
        return true;
    }
    close(code: number | null = 0) {
        this.exitCode = code;
        this.emit('close', code);
    }
}

// ---------------------------------------------------------------------------
// Fake driver that mimics the parts of NovaWindows2Driver our code touches.
// We also install the same stdout/stderr listeners that startPowerShellSession
// would install, so the per-command-context dispatch path is exercised.
// ---------------------------------------------------------------------------

function makeDriver(ps: FakePowerShell): any {
    const driver: any = {
        log: {
            info: (_: string) => {},
            warn: (_: string) => {},
            error: (_: string) => {},
            debug: (_: string) => {},
        },
        powerShell: ps,
        powerShellCommandContext: undefined as CommandContext | undefined,
        commandQueue: Promise.resolve(),
        powerShellRestartPromise: undefined,
        powerShellTerminating: false,
        caps: {},
    };

    ps.stdout.on('data', (chunk: any) => {
        const text = chunk.toString();
        const ctx = driver.powerShellCommandContext as CommandContext | undefined;
        if (ctx) {
            ctx.stdout += text;
            ctx.check();
        }
    });
    ps.stderr.on('data', (chunk: any) => {
        const text = chunk.toString();
        const ctx = driver.powerShellCommandContext as CommandContext | undefined;
        if (ctx) {
            ctx.stderr += text;
            ctx.check();
        }
    });

    return driver;
}

/**
 * Wait until stdin contains a framing marker that isn't `prevMarker`, then
 * return it. Used to wait for the NEXT command's marker when multiple
 * commands have been written through the same stdin.
 */
async function awaitMarker(
    ps: FakePowerShell,
    prevMarker: string | null = null,
    attempts = 50
): Promise<string> {
    for (let i = 0; i < attempts; i++) {
        const matches = [...ps.stdin.text().matchAll(/Write-Output "(___NOVA_END_[a-f0-9]+___)"/g)];
        const last = matches[matches.length - 1]?.[1];
        if (last && last !== prevMarker) return last;
        await new Promise(r => setImmediate(r));
    }
    throw new Error(`marker never written to stdin: ${ps.stdin.text()}`);
}

describe('PowerShell Runtime', () => {

    // -----------------------------------------------------------------------
    // Phase 2: framing protocol
    // -----------------------------------------------------------------------

    describe('command framing', () => {
        it('sends the user command raw and writes stdout + stderr markers', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, 'Get-Process');
            const marker = await awaitMarker(ps);

            const written = ps.stdin.text();
            // Command is NOT wrapped in & { } — that wrap broke `using namespace`
            // and variable persistence across calls. See powershell.ts framing
            // comment for the trade-off.
            expect(written).to.contain('Get-Process');
            expect(written).to.not.contain('& { Get-Process }');
            expect(written).to.contain(`Write-Output "${marker}"`);
            expect(written).to.contain(`[Console]::Error.WriteLine("${marker}")`);

            ps.stdout.push(`some output\n${marker}\n`);
            ps.stderr.push(`${marker}\n`);

            const result = await promise;
            expect(result).to.equal('some output');
        });

        it('resolves once BOTH stdout and stderr markers arrive', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, 'noop');
            const marker = await awaitMarker(ps);

            ps.stdout.push(`${marker}\n`);
            // Race the verdict: poll twice — promise must NOT resolve until
            // stderr marker arrives, even though stdout marker is already in.
            let settled = false;
            promise.then(() => { settled = true; }, () => { settled = true; });
            await new Promise(r => setImmediate(r));
            await new Promise(r => setImmediate(r));
            expect(settled).to.equal(false);

            ps.stderr.push(`${marker}\n`);
            await promise;
        });

        it('uses a fresh nonce marker per command so prior output cannot trigger completion', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const p1 = sendPowerShellCommand.call(driver, 'cmd-A');
            const marker1 = await awaitMarker(ps);
            ps.stdout.push(`${marker1}\n`);
            ps.stderr.push(`${marker1}\n`);
            await p1;

            const p2 = sendPowerShellCommand.call(driver, 'cmd-B');
            const marker2 = await awaitMarker(ps, marker1);
            expect(marker2).to.not.equal(marker1);

            // User output echoes the previous marker on stdout. cmd-B is
            // listening for marker2 — the stale marker1 must NOT complete it.
            ps.stdout.push(`echo containing ${marker1} in the middle of output\n`);
            let settled = false;
            p2.then(() => { settled = true; }, () => { settled = true; });
            await new Promise(r => setImmediate(r));
            await new Promise(r => setImmediate(r));
            expect(settled).to.equal(false, 'cmd-B must not complete on a stale marker');

            // Real completion — only marker2 ends the command.
            ps.stdout.push(`${marker2}\n`);
            ps.stderr.push(`${marker2}\n`);
            const result = await p2;
            expect(result).to.contain('echo containing');
            expect(result).to.contain(marker1);
        });

        it('detects marker even when arriving split across chunks', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, 'noop');
            const marker = await awaitMarker(ps);

            const mid = Math.floor(marker.length / 2);
            ps.stdout.push(`output\n${marker.slice(0, mid)}`);
            ps.stdout.push(`${marker.slice(mid)}\n`);
            ps.stderr.push(marker.slice(0, 5));
            ps.stderr.push(marker.slice(5));

            const result = await promise;
            expect(result).to.equal('output');
        });

        it('rejects with stderr content when the command writes to stderr', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, 'Write-Error boom');
            const marker = await awaitMarker(ps);

            ps.stderr.push(`boom: something exploded\n${marker}\n`);
            ps.stdout.push(`${marker}\n`);

            let err: any;
            try { await promise; } catch (e) { err = e; }
            expect(err, 'expected rejection').to.exist;
            expect(String(err)).to.contain('boom: something exploded');
        });

        it('emits $LASTEXITCODE injection lines so native-exe failures are observable', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, '& "some.exe"');
            await awaitMarker(ps);

            const written = ps.stdin.text();
            expect(written).to.contain('$LASTEXITCODE = 0');
            expect(written).to.match(/if \(\$LASTEXITCODE -and \$LASTEXITCODE -ne 0\)/);
            expect(written).to.contain('[NativeExit]');

            // Avoid leaving the promise dangling.
            const marker = await awaitMarker(ps);
            ps.stdout.push(`${marker}\n`);
            ps.stderr.push(`${marker}\n`);
            await promise;
        });

        it('rejects with native exit code when [NativeExit] marker appears in stderr', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, '& "fail.exe"');
            const marker = await awaitMarker(ps);

            // Simulate: native exe wrote nothing to stderr, but $LASTEXITCODE
            // injection emitted [NativeExit] 1 before the marker.
            ps.stderr.push(`[NativeExit] 1\n${marker}\n`);
            ps.stdout.push(`${marker}\n`);

            let err: any;
            try { await promise; } catch (e) { err = e; }
            expect(err, 'expected rejection').to.exist;
            expect(String(err)).to.match(/Native command exited with code 1/);
        });

        it('rejects with native exit code AND other stderr when both present', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, '& "fail.exe"');
            const marker = await awaitMarker(ps);

            ps.stderr.push(`fail.exe: not found\n[NativeExit] 127\n${marker}\n`);
            ps.stdout.push(`${marker}\n`);

            let err: any;
            try { await promise; } catch (e) { err = e; }
            expect(err).to.exist;
            expect(String(err)).to.contain('Native command exited with code 127');
            expect(String(err)).to.contain('fail.exe: not found');
        });

        it('treatStderrAsError=false lets stderr-only output succeed (but still catches native exits)', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);
            driver.caps.treatStderrAsError = false;

            // Stderr informational ("banner"), no NativeExit → should resolve.
            const p1 = sendPowerShellCommand.call(driver, 'noop1');
            const m1 = await awaitMarker(ps);
            ps.stderr.push(`% Progress: 50%\n${m1}\n`);
            ps.stdout.push(`useful output\n${m1}\n`);
            const r1 = await p1;
            expect(r1).to.equal('useful output');

            // But native exit must still reject even with treatStderrAsError=false.
            const p2 = sendPowerShellCommand.call(driver, 'noop2');
            const m2 = await awaitMarker(ps, m1);
            ps.stderr.push(`[NativeExit] 2\n${m2}\n`);
            ps.stdout.push(`${m2}\n`);
            let err: any;
            try { await p2; } catch (e) { err = e; }
            expect(err, 'native exit must still reject').to.exist;
            expect(String(err)).to.contain('Native command exited with code 2');
        });
    });

    // -----------------------------------------------------------------------
    // Phase 1 + lifecycle
    // -----------------------------------------------------------------------

    describe('lifecycle', () => {
        it('rejects in-flight command with NoSuchDriverError during intentional teardown', async () => {
            // Per 1.1.14: in-flight commands now reject with NoSuchDriverError
            // when PS closes during teardown (was previously resolve(''), which
            // surfaced misleadingly as NoSuchElementError downstream). The
            // error path must still be quiet — no error log.
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);
            let errorLogged = false;
            driver.log.error = () => { errorLogged = true; };

            const inflight = sendPowerShellCommand.call(driver, 'long-running');
            await awaitMarker(ps);

            // Simulate teardown: terminatePowerShellSession sets the flag, then
            // the process is killed by SIGKILL, then 'close' fires.
            driver.powerShellTerminating = true;
            ps.close(null);

            let err: any;
            try { await inflight; } catch (e) { err = e; }
            expect(err, 'must reject during teardown').to.exist;
            expect(err.name || String(err)).to.match(/NoSuchDriver/);
            expect(errorLogged).to.equal(false,
                'teardown rejection should not log at error level');
        });

        it('reports an error when PS dies unexpectedly (not during teardown)', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const inflight = sendPowerShellCommand.call(driver, 'something');
            await awaitMarker(ps);

            ps.close(1);
            let err: any;
            try { await inflight; } catch (e) { err = e; }
            expect(err).to.exist;
            expect(String(err)).to.contain('Exited with code 1');
        });

        it('terminatePowerShellSession resolves on graceful close', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = terminatePowerShellSession.call(driver);

            // Simulate PS reading EOF on stdin and exiting cleanly.
            await new Promise(r => setImmediate(r));
            ps.close(0);

            await promise;
            expect(driver.powerShell).to.equal(undefined);
            expect(driver.powerShellTerminating).to.equal(true);
        });

        it('terminatePowerShellSession returns immediately if no session is alive', async () => {
            const driver: any = {
                log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
                powerShell: undefined,
            };
            await terminatePowerShellSession.call(driver);
            // No throw, no hang
        });
    });

    // -----------------------------------------------------------------------
    // Phase 3: per-command buffer isolation
    // -----------------------------------------------------------------------

    describe('per-command buffer isolation', () => {
        it('serializes concurrent sendPowerShellCommand calls through the queue', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const results: string[] = [];
            const p1 = sendPowerShellCommand.call(driver, 'A')
                .then(r => results.push(`A:${r}`));
            const p2 = sendPowerShellCommand.call(driver, 'B')
                .then(r => results.push(`B:${r}`));

            // Only the first command should have written to stdin so far.
            const marker1 = await awaitMarker(ps);
            // Command lines are written as plain "$cmd\n", surrounded by the
            // $LASTEXITCODE reset and marker lines.
            const writtenForA = ps.stdin.text();
            expect(writtenForA).to.match(/\nA\n/);
            expect(writtenForA).to.not.match(/\nB\n/);

            // Finish A
            ps.stdout.push(`A-out\n${marker1}\n`);
            ps.stderr.push(`${marker1}\n`);
            await p1;

            // Now B should start. Its marker is different.
            const marker2 = await awaitMarker(ps, marker1);
            expect(marker2).to.not.equal(marker1);
            expect(ps.stdin.text()).to.match(/\nB\n/);

            ps.stdout.push(`B-out\n${marker2}\n`);
            ps.stderr.push(`${marker2}\n`);
            await p2;

            expect(results).to.deep.equal(['A:A-out', 'B:B-out']);
        });

        it('fast-fails queued commands when teardown is signalled mid-queue', async () => {
            // Reproduces the production scenario: many commands piled up in
            // the queue, DELETE arrives, terminatePowerShellSession runs.
            // Queued commands must NOT auto-restart PowerShell — they should
            // surface NoSuchDriverError so the caller stops.
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const p1 = sendPowerShellCommand.call(driver, 'A');
            const p2 = sendPowerShellCommand.call(driver, 'B');
            const p3 = sendPowerShellCommand.call(driver, 'C');

            // First command starts; signal teardown while it's running.
            const marker1 = await awaitMarker(ps);
            driver.powerShellTerminating = true;
            driver.powerShell = undefined;
            ps.close(null);

            // In-flight command rejects with NoSuchDriverError (1.1.14).
            // Queued commands also reject with NoSuchDriverError and must NOT
            // spawn a fresh PowerShell. The fake stdin should not see any new
            // command writes after teardown.
            const stdinBefore = ps.stdin.text();

            let err1: any, err2: any, err3: any;
            try { await p1; } catch (e) { err1 = e; }
            try { await p2; } catch (e) { err2 = e; }
            try { await p3; } catch (e) { err3 = e; }
            expect(err1, 'A (in-flight) must reject').to.exist;
            expect(err2, 'B (queued) must reject').to.exist;
            expect(err3, 'C (queued) must reject').to.exist;
            expect(err1.name || String(err1)).to.match(/NoSuchDriver/);
            expect(err2.name || String(err2)).to.match(/NoSuchDriver/);
            expect(err3.name || String(err3)).to.match(/NoSuchDriver/);

            expect(ps.stdin.text()).to.equal(stdinBefore,
                'no new commands should be written to a dead PS after teardown');
            void marker1;
        });

        it('rejects new sendPowerShellCommand calls after teardown is signalled', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);
            driver.powerShellTerminating = true;

            let err: any;
            try { await sendPowerShellCommand.call(driver, 'late'); }
            catch (e) { err = e; }
            expect(err).to.exist;
            expect(err.name || String(err)).to.match(/NoSuchDriver/);
            expect(ps.stdin.text()).to.equal('',
                'nothing should be written after teardown');
        });

        it('clears the per-command context after completion so the driver retains no buffer state', async () => {
            const ps = new FakePowerShell();
            const driver = makeDriver(ps);

            const promise = sendPowerShellCommand.call(driver, 'noop');
            const marker = await awaitMarker(ps);
            expect(driver.powerShellCommandContext).to.not.equal(undefined);

            ps.stdout.push(`${marker}\n`);
            ps.stderr.push(`${marker}\n`);
            await promise;

            expect(driver.powerShellCommandContext).to.equal(undefined,
                'context must be cleared after the command settles');
        });
    });
});
