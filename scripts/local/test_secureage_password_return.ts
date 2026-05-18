/**
 * Smoke test for {RETURN} after password on the real SecureAge password form.
 *
 * Pre-condition: VM 192.168.196.129 has the SecureAge Password dialog
 * currently displayed on screen, and Appium 1.1.19 is running on :4723.
 *
 * What we want to learn: on the actual (slow-UIA) SecureAge form, does
 * `setValue('<password>')` submit the form (= RETURN fires), or does
 * the password type but Enter get lost (= F2 race manifests)?
 *
 * Password contains no `{` or `}` so F1 cannot trigger here. This is a
 * pure F2 reproduction attempt.
 *
 * Run:
 *   APPIUM_URL=http://192.168.196.129:4723 \
 *     npx ts-node scripts/local/test_secureage_password_return.ts
 */

import { remote } from 'webdriverio';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://192.168.196.129:4723';
const PASSWORD = '1_Abc_123';
const KEY_RETURN = '';

async function main() {
    const url = new URL(APPIUM_URL);
    const driver = await remote({
        hostname: url.hostname,
        port: Number(url.port || 4723),
        path: url.pathname && url.pathname !== '/' ? url.pathname : '/',
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        logLevel: 'info',
        capabilities: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'Root',
            'appium:powerShellCommandTimeout': 120_000,
        } as WebdriverIO.Capabilities,
    });

    try {
        // Try both known locators for the SecureAge Password dialog edit.
        const locators = [
            "//Window[@Name='SecureAge Password']/Edit[1]",
            "//Window[@Name='SecureAge' and ./Text[contains(@Name,'Password')]]//Edit[1]",
        ];

        let el: any = null;
        let usedLocator = '';
        for (const xp of locators) {
            console.log(`Trying locator: ${xp}`);
            const candidate = await driver.$(xp);
            if (await candidate.isExisting()) {
                el = candidate;
                usedLocator = xp;
                break;
            }
        }

        if (!el) {
            // Last-resort: any window whose Name contains "Password" + Edit
            console.log('No exact match — trying generic //Window[contains(@Name,"Password")]//Edit');
            el = await driver.$('//Window[contains(@Name,"Password")]//Edit');
            if (await el.isExisting()) {
                usedLocator = 'generic //Window[contains(@Name,"Password")]//Edit';
            }
        }

        if (!el || !(await el.isExisting())) {
            console.error('FAIL: no password edit control found. Is the SecureAge Password dialog actually visible?');
            return;
        }

        console.log(`Found password edit via: ${usedLocator}`);
        console.log(`Element id: ${el.elementId}`);

        const dialogXpathBefore = '//Window[contains(@Name,"Password") or contains(@Name,"SecureAge")][.//Edit]';
        const dialogBefore = await driver.$(dialogXpathBefore);
        const dialogVisibleBefore = await dialogBefore.isExisting();
        console.log(`Password dialog visible before typing: ${dialogVisibleBefore}`);

        // WebDriverIO v9 strips Selenium Keys.* private-use chars from
        // setValue/addValue. Bypass via direct HTTP POST to the W3C
        // elementSendKeys endpoint — same path Python selenium uses.
        console.log(`Typing via raw HTTP: '${PASSWORD}' + {RETURN} (\\uE006)`);
        const sessionId = (driver as any).sessionId;
        const baseUrl = `${url.protocol}//${url.host}${url.pathname.endsWith('/') ? url.pathname : url.pathname + '/'}`;
        const sendKeysUrl = `${baseUrl}session/${sessionId}/element/${el.elementId}/value`;
        const t0 = Date.now();
        const payload = JSON.stringify({ text: `${PASSWORD}${KEY_RETURN}` });
        console.log(`  POST ${sendKeysUrl}`);
        console.log(`  body bytes: ${[...payload].map(c => c.charCodeAt(0).toString(16).padStart(4,'0')).join(' ')}`);
        const resp = await fetch(sendKeysUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        });
        const t1 = Date.now();
        console.log(`elementSendKeys HTTP ${resp.status} in ${t1 - t0}ms`);
        const respJson = await resp.json().catch(() => null);
        if (respJson && (respJson as any).value?.error) {
            console.log(`  driver returned error: ${JSON.stringify((respJson as any).value)}`);
        }

        // Give the form 5s to close after a successful submit.
        let dialogStillVisible = true;
        for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
                const dlg = await driver.$(dialogXpathBefore);
                dialogStillVisible = await dlg.isExisting();
            } catch {
                dialogStillVisible = false;
            }
            if (!dialogStillVisible) {
                console.log(`OK: Password dialog disappeared at ${(i + 1) * 500}ms — {RETURN} submitted the form.`);
                break;
            }
        }

        if (dialogStillVisible) {
            console.log('SUSPECT: Password dialog STILL visible 5s after setValue. {RETURN} did not submit.');
            console.log('   This is the F2 manifestation pattern.');

            // Diagnostic: check if password was actually typed
            try {
                const pwEdit = await driver.$(usedLocator);
                if (await pwEdit.isExisting()) {
                    const val = await driver.execute('windows: getValue', pwEdit);
                    console.log(`   Password field value (via ValuePattern): ${JSON.stringify(val)}`);
                }
            } catch (e: any) {
                console.log(`   Could not read password field value: ${e.message}`);
            }
        }

    } finally {
        try {
            await driver.deleteSession();
        } catch { /* noop */ }
    }
}

main().catch((e) => {
    console.error('Error:', e?.message ?? e);
    process.exitCode = 1;
});
