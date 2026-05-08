#!/usr/bin/env node
// Analyze a Claude Code session .jsonl from ~/.claude/projects/<project>/
//
// Usage:
//   node analyze/analyze-session.mjs                 # latest session for this project
//   node analyze/analyze-session.mjs <session-uuid>  # specific session
//   node analyze/analyze-session.mjs --list          # list sessions (newest first)
//
// Writes: analyze/<session-uuid>.md

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROJECT_DIR = path.resolve('.');
// Claude Code stores sessions at ~/.claude/projects/<encoded-path>/<session>.jsonl
// The encoded path replaces drive colons and slashes with dashes: "C:\Users\LENOVO\Documents\projects\frontend" -> "C--Users-LENOVO-Documents-projects-frontend"
function encodeProjectPath(p) {
  // Replace every colon and slash with a dash (so "C:\X" -> "C--X")
  return p.replace(/[:\\/]/g, '-');
}

const sessionsDir = path.join(os.homedir(), '.claude', 'projects', encodeProjectPath(PROJECT_DIR));
if (!fs.existsSync(sessionsDir)) {
  console.error('Sessions dir not found:', sessionsDir);
  process.exit(1);
}

function listSessions() {
  return fs
    .readdirSync(sessionsDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const full = path.join(sessionsDir, f);
      const st = fs.statSync(full);
      return { file: f, path: full, size: st.size, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

const arg = process.argv[2];
if (arg === '--list') {
  const sessions = listSessions();
  for (const s of sessions) {
    console.log(
      `${new Date(s.mtime).toISOString()}  ${(s.size / 1024).toFixed(1).padStart(8)} KB  ${s.file}`,
    );
  }
  process.exit(0);
}

let target;
if (arg) {
  target = listSessions().find((s) => s.file.startsWith(arg));
  if (!target) {
    console.error('Session not found matching:', arg);
    process.exit(1);
  }
} else {
  target = listSessions()[0];
}
console.log('Analyzing:', target.file);

const raw = fs.readFileSync(target.path, 'utf8');
const lines = raw.split('\n').filter(Boolean);

const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch {
    /* skip malformed */
  }
}

// ---------- aggregation ----------
const totals = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};
const byTool = new Map(); // toolName -> { count, resultBytes, inputBytes }
const turns = []; // { kind, text, tools, usage, sidechain, uuid, parent, ts }
const userPrompts = [];
let firstTs = null;
let lastTs = null;
let modelSeen = null;
let sidechainCount = 0;

const toolUseById = new Map(); // tool_use_id -> toolName (to attribute results)
const seenMsgIds = new Set(); // dedupe usage (Claude Code emits one JSONL per content block sharing msg.id)
const msgIdToTurn = new Map(); // msg.id -> first turn object (merge subsequent blocks into it)

function stringify(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function contentLen(content) {
  if (content == null) return 0;
  if (typeof content === 'string') return content.length;
  if (Array.isArray(content)) {
    return content.reduce((acc, b) => {
      if (typeof b === 'string') return acc + b.length;
      if (b?.type === 'text') return acc + (b.text?.length || 0);
      if (b?.type === 'tool_result') return acc + contentLen(b.content);
      if (b?.type === 'image') return acc + 2000; // rough placeholder
      return acc + stringify(b).length;
    }, 0);
  }
  return stringify(content).length;
}

for (const e of events) {
  const ts = e.timestamp ? Date.parse(e.timestamp) : null;
  if (ts) {
    firstTs ??= ts;
    lastTs = ts;
  }

  if (e.type === 'assistant' && e.message) {
    const msgId = e.message.id;
    const isNewMsg = msgId && !seenMsgIds.has(msgId);
    if (isNewMsg) {
      seenMsgIds.add(msgId);
      const u = e.message.usage || {};
      totals.input_tokens += u.input_tokens || 0;
      totals.output_tokens += u.output_tokens || 0;
      totals.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
      totals.cache_read_input_tokens += u.cache_read_input_tokens || 0;
      if (e.isSidechain) sidechainCount += 1;
    }
    if (e.message.model) modelSeen = e.message.model;

    let turn = msgId ? msgIdToTurn.get(msgId) : null;
    if (!turn) {
      turn = {
        kind: 'assistant',
        text: '',
        tools: [],
        usage: e.message.usage || {},
        sidechain: !!e.isSidechain,
        uuid: e.uuid,
        parent: e.parentUuid,
        ts,
        msgId,
      };
      turns.push(turn);
      if (msgId) msgIdToTurn.set(msgId, turn);
    }
    const textBits = [];
    for (const block of e.message.content || []) {
      if (block.type === 'text') textBits.push(block.text || '');
      else if (block.type === 'tool_use') {
        // Avoid double-adding the same tool_use across duplicate records
        if (!turn.tools.some((tu) => tu.id === block.id)) {
          turn.tools.push({ name: block.name, input: block.input, id: block.id });
          toolUseById.set(block.id, block.name);
          const rec = byTool.get(block.name) || { count: 0, resultBytes: 0, inputBytes: 0 };
          rec.count += 1;
          rec.inputBytes += stringify(block.input).length;
          byTool.set(block.name, rec);
        }
      }
    }
    if (textBits.length) {
      const joined = textBits.join('\n').trim();
      if (joined && !turn.text.includes(joined)) {
        turn.text = (turn.text ? turn.text + '\n' : '') + joined;
      }
    }
  } else if (e.type === 'user' && e.message) {
    const c = e.message.content;
    // User content can be a string (real prompt) or an array of blocks (tool_result replies, attachments)
    if (typeof c === 'string') {
      const text = c.trim();
      if (text && !e.isMeta) {
        userPrompts.push({ text, sidechain: !!e.isSidechain, ts });
      }
      turns.push({
        kind: 'user',
        text,
        sidechain: !!e.isSidechain,
        uuid: e.uuid,
        parent: e.parentUuid,
        ts,
      });
    } else if (Array.isArray(c)) {
      let isToolResult = false;
      for (const block of c) {
        if (block?.type === 'tool_result') {
          isToolResult = true;
          const toolName = toolUseById.get(block.tool_use_id) || 'unknown';
          const rec = byTool.get(toolName) || { count: 0, resultBytes: 0, inputBytes: 0 };
          rec.resultBytes += contentLen(block.content);
          byTool.set(toolName, rec);
        } else if (block?.type === 'text') {
          const text = (block.text || '').trim();
          if (text && !e.isMeta) userPrompts.push({ text, sidechain: !!e.isSidechain, ts });
        }
      }
      turns.push({
        kind: isToolResult ? 'tool_result' : 'user',
        text: '',
        sidechain: !!e.isSidechain,
        uuid: e.uuid,
        parent: e.parentUuid,
        ts,
      });
    }
  }
}

// ---------- derived stats ----------
const durationMs = firstTs && lastTs ? lastTs - firstTs : 0;
const totalAllTokens =
  totals.input_tokens +
  totals.output_tokens +
  totals.cache_creation_input_tokens +
  totals.cache_read_input_tokens;

const toolRows = [...byTool.entries()]
  .map(([name, r]) => ({ name, ...r }))
  .sort((a, b) => b.count - a.count);

const assistantTurns = turns.filter((t) => t.kind === 'assistant');

// ---------- cost attribution per turn ----------
// Each assistant turn is bucketed by INTENT (not tool-name combo). A turn that
// crosses intents is classified by its "heaviest" bucket (precedence order below).
// This collapses noisy combos like "Grep+Bash" / "Bash+Grep" / "Read+Grep" into
// coherent categories the reader can act on.
function turnCostUSD(u) {
  if (!u) return 0;
  return (
    ((u.input_tokens || 0) * 15 +
      (u.output_tokens || 0) * 75 +
      (u.cache_creation_input_tokens || 0) * 18.75 +
      (u.cache_read_input_tokens || 0) * 1.5) /
    1_000_000
  );
}
const INTENT_OF_TOOL = {
  Edit: 'Edit/Write',
  Write: 'Edit/Write',
  NotebookEdit: 'Edit/Write',
  Agent: 'Delegate',
  AskUserQuestion: 'Ask user',
  TaskCreate: 'Plan/Track',
  TaskUpdate: 'Plan/Track',
  TaskList: 'Plan/Track',
  TaskGet: 'Plan/Track',
  TaskStop: 'Plan/Track',
  TaskOutput: 'Plan/Track',
  ExitPlanMode: 'Plan/Track',
  EnterPlanMode: 'Plan/Track',
  Bash: 'Execute',
  PowerShell: 'Execute',
  Read: 'Explore',
  Grep: 'Explore',
  Glob: 'Explore',
  ToolSearch: 'Explore',
  WebFetch: 'Explore',
  WebSearch: 'Explore',
  ReadMcpResourceTool: 'Explore',
  ListMcpResourcesTool: 'Explore',
};
// Precedence — earlier wins when a turn crosses intents.
const INTENT_RANK = [
  'Edit/Write',
  'Delegate',
  'Ask user',
  'Plan/Track',
  'Execute',
  'Explore',
  'Other',
  'Text (reply/explain)',
];
function turnCategory(t) {
  if (!t.tools || t.tools.length === 0) return 'Text (reply/explain)';
  const intents = new Set(t.tools.map((x) => INTENT_OF_TOOL[x.name] || 'Other'));
  for (const bucket of INTENT_RANK) if (intents.has(bucket)) return bucket;
  return 'Other';
}
const byAction = new Map();
for (const t of assistantTurns) {
  const cat = turnCategory(t);
  const rec = byAction.get(cat) || {
    turns: 0,
    toolCalls: 0,
    toolBreakdown: new Map(),
    output: 0,
    input: 0,
    cacheR: 0,
    cacheW: 0,
    cost: 0,
  };
  rec.turns += 1;
  rec.toolCalls += t.tools?.length || 0;
  for (const tu of t.tools || []) {
    rec.toolBreakdown.set(tu.name, (rec.toolBreakdown.get(tu.name) || 0) + 1);
  }
  rec.output += t.usage?.output_tokens || 0;
  rec.input += t.usage?.input_tokens || 0;
  rec.cacheR += t.usage?.cache_read_input_tokens || 0;
  rec.cacheW += t.usage?.cache_creation_input_tokens || 0;
  rec.cost += turnCostUSD(t.usage);
  byAction.set(cat, rec);
}
const actionRows = [...byAction.entries()]
  .map(([name, r]) => ({
    name,
    ...r,
    topTools: [...r.toolBreakdown.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n}×${c}`)
      .join(', '),
  }))
  .sort((a, b) => b.cost - a.cost);
const topTurns = [...assistantTurns]
  .map((t) => ({ ...t, _cat: turnCategory(t), _cost: turnCostUSD(t.usage) }))
  .sort((a, b) => b._cost - a._cost)
  .slice(0, 10);
const biggestTurns = [...assistantTurns]
  .sort((a, b) => (b.usage?.output_tokens || 0) - (a.usage?.output_tokens || 0))
  .slice(0, 5);

// ---------- cost estimate (rough, Opus pricing as of 2025) ----------
// input $15/Mtok, output $75/Mtok, cache write $18.75/Mtok, cache read $1.50/Mtok
const cost =
  (totals.input_tokens * 15 +
    totals.output_tokens * 75 +
    totals.cache_creation_input_tokens * 18.75 +
    totals.cache_read_input_tokens * 1.5) /
  1_000_000;

// ---------- markdown report ----------
function fmt(n) {
  return n.toLocaleString('en-US');
}
function preview(s, n = 140) {
  if (!s) return '';
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
}

const md = [];
md.push(`# Session analysis — \`${target.file}\``);
md.push('');
md.push(`- **Model:** ${modelSeen || 'unknown'}`);
md.push(`- **File size:** ${(target.size / 1024).toFixed(1)} KB`);
md.push(`- **Events:** ${fmt(events.length)} lines`);
md.push(`- **Duration:** ${durationMs ? (durationMs / 60000).toFixed(1) + ' min' : 'n/a'}`);
if (firstTs) md.push(`- **Started:** ${new Date(firstTs).toISOString()}`);
if (lastTs) md.push(`- **Ended:** ${new Date(lastTs).toISOString()}`);
md.push('');
md.push('## Tokens');
md.push('');
md.push('| Category | Tokens | Share |');
md.push('|---|---:|---:|');
const pct = (n) => (totalAllTokens ? ((n / totalAllTokens) * 100).toFixed(1) + '%' : '0%');
md.push(`| Input (fresh) | ${fmt(totals.input_tokens)} | ${pct(totals.input_tokens)} |`);
md.push(`| Output | ${fmt(totals.output_tokens)} | ${pct(totals.output_tokens)} |`);
md.push(
  `| Cache write | ${fmt(totals.cache_creation_input_tokens)} | ${pct(totals.cache_creation_input_tokens)} |`,
);
md.push(
  `| Cache read | ${fmt(totals.cache_read_input_tokens)} | ${pct(totals.cache_read_input_tokens)} |`,
);
md.push(`| **Total** | **${fmt(totalAllTokens)}** | 100% |`);
md.push('');
md.push(`**Estimated cost (Opus 4.x rates):** $${cost.toFixed(2)}`);
md.push('');
md.push('## Tool usage');
md.push('');
md.push('| Tool | Calls | Input size (chars) | Result size (chars) |');
md.push('|---|---:|---:|---:|');
for (const r of toolRows) {
  md.push(`| ${r.name} | ${fmt(r.count)} | ${fmt(r.inputBytes)} | ${fmt(r.resultBytes)} |`);
}
md.push('');
md.push('## Cost by action category');
md.push('');
md.push(
  'Each assistant turn is placed in **one intent bucket** (Edit/Write → Delegate → Ask → Plan → Execute → Explore → Text, heaviest wins when a turn mixes tools). The "Tools used" column shows the underlying tool-call breakdown within each bucket.',
);
md.push('');
md.push('| Bucket | Turns | Tool calls | Tools used | Output tok | Cache-read tok | Cost (USD) | Share |');
md.push('|---|---:|---:|---|---:|---:|---:|---:|');
const totalActionCost = actionRows.reduce((a, r) => a + r.cost, 0) || 1;
for (const r of actionRows) {
  md.push(
    `| ${r.name} | ${fmt(r.turns)} | ${fmt(r.toolCalls)} | ${r.topTools || '—'} | ${fmt(r.output)} | ${fmt(r.cacheR)} | $${r.cost.toFixed(2)} | ${((r.cost / totalActionCost) * 100).toFixed(1)}% |`,
  );
}
md.push('');
md.push('## Top 10 most expensive individual turns');
md.push('');
md.push('| # | Action | Output | Cache-read | Cost | Preview |');
md.push('|---:|---|---:|---:|---:|---|');
topTurns.forEach((t, i) => {
  md.push(
    `| ${i + 1} | ${t._cat} | ${fmt(t.usage?.output_tokens || 0)} | ${fmt(t.usage?.cache_read_input_tokens || 0)} | $${t._cost.toFixed(2)} | ${preview(t.text || (t.tools[0] ? stringify(t.tools[0].input) : ''), 90)} |`,
  );
});
md.push('');

md.push('## Conversation overview');
md.push('');
md.push(`- **User prompts:** ${userPrompts.length}`);
md.push(`- **Assistant turns:** ${assistantTurns.length}`);
md.push(`- **Sidechain (subagent) assistant turns:** ${sidechainCount}`);
md.push(
  `- **Total tool calls:** ${toolRows.reduce((a, r) => a + r.count, 0)}`,
);
md.push('');

md.push('## Top 5 largest assistant turns (by output tokens)');
md.push('');
md.push('| # | Output tok | Tools called | Text preview |');
md.push('|---:|---:|---|---|');
biggestTurns.forEach((t, i) => {
  const toolList = t.tools.map((x) => x.name).join(', ') || '—';
  md.push(
    `| ${i + 1} | ${fmt(t.usage?.output_tokens || 0)} | ${toolList} | ${preview(t.text, 100)} |`,
  );
});
md.push('');

md.push('## User prompts');
md.push('');
userPrompts.forEach((p, i) => {
  md.push(`${i + 1}. ${p.sidechain ? '*(subagent)* ' : ''}${preview(p.text, 200)}`);
});
md.push('');

md.push('## Timeline (compact)');
md.push('');
md.push('Legend: `U` user, `A` assistant, `T` tool_result. Sidechain turns indented.');
md.push('');
md.push('```');
for (const t of turns) {
  const indent = t.sidechain ? '    ' : '';
  if (t.kind === 'user') {
    if (t.text) md.push(`${indent}U  ${preview(t.text, 140)}`);
  } else if (t.kind === 'tool_result') {
    md.push(`${indent}T  (tool result)`);
  } else if (t.kind === 'assistant') {
    const toolList = t.tools.map((x) => x.name).join(',');
    const textBit = preview(t.text, 100);
    const out = t.usage?.output_tokens || 0;
    md.push(
      `${indent}A  [${out} out]${toolList ? ' tools=' + toolList : ''}${textBit ? ' :: ' + textBit : ''}`,
    );
    // detailed tool inputs (truncated)
    for (const tu of t.tools) {
      const inp = preview(stringify(tu.input), 180);
      md.push(`${indent}   └─ ${tu.name}: ${inp}`);
    }
  }
}
md.push('```');
md.push('');

const outPath = path.join(PROJECT_DIR, 'analyze', target.file.replace(/\.jsonl$/, '.md'));
fs.writeFileSync(outPath, md.join('\n'), 'utf8');
console.log('Report written:', outPath);
console.log(
  `Totals: total=${fmt(totalAllTokens)} in=${fmt(totals.input_tokens)} out=${fmt(totals.output_tokens)} cacheR=${fmt(totals.cache_read_input_tokens)} cacheW=${fmt(totals.cache_creation_input_tokens)} cost≈$${cost.toFixed(2)}`,
);
