// Tests for drift-check.mjs, stage B: model pins and plugin sources (T13 to T24 of the spec).
//
// Finding object shapes (the code stage implements exactly these; the block kinds are in
// drift-check.test.mjs):
//
//   Model checks M1 to M9 (returned by checkModels):
//     kind      'MODEL'
//     check     'M1' | 'M2' | ... | 'M9'
//     agent     agent slug where one applies (M2, M4 per-agent row, M5, M6, M7, M1: the slug that is
//               in only one of the two sets); absent otherwise
//     where     'file' or 'file:line' relative to the root, with forward slashes
//               (M2: 'agents/<slug>.md:5'; M8: 'README.md:<line>'; M9: 'theme.json')
//     expected  string, what the source of truth says (M8: absent)
//     actual    string, what the place says (M8: the offending token, e.g. 'claude-opus-4-1')
//     message   non-empty string, the full text printed to stderr
//     fix       non-empty string
//
//   Display rule failure (returned by checkModels, from M5 or M6):
//     kind      'UNRENDERABLE'
//     check     'M5' | 'M6'
//     agent     agent slug
//     id        the model ID that cannot be rendered, e.g. 'claude-opus-5-5-20261101'
//     where     file (and line when known), e.g. 'site/index.html:223'
//     message, fix  non-empty strings
//
//   Plugin source (P1, returned by checkSources):
//     kind      'SOURCE'
//     check     'P1'
//     plugin    the marketplace entry's name, e.g. 'switchboard-crew'
//     where     the file that should exist, relative, e.g. 'nope/.claude-plugin/plugin.json'
//     message, fix  non-empty strings
//
// Settled where the spec left room (the code stage follows these):
//   - checkModels returns M1 to M9 and UNRENDERABLE findings; checkSources returns P1 only.
//   - The CLI summary counts checks: 'M1 to M9 and P1' = 10 'model and source checks'.
//   - The CLI prints findings in the form 'MODEL check=M2 agent=architect where=agents/architect.md:5'
//     (spec 4.3) and 'DRIFT agent=agents/testing-qa.md section="## Working Rules"' (spec 4.2).
//
// Every test works on a throwaway copy under os.tmpdir() and removes it afterwards.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { checkModels, checkSources } from "./drift-check.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const CLI = path.join(HERE, "drift-check.mjs");

// ---------- helpers ----------

const lf = (s) => s.replace(/\r\n/g, "\n");
const read = (p) => lf(fs.readFileSync(p, "utf8"));

function makeCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drift-models-test-"));
  for (const d of ["agents", "skills", "docs", ".claude-plugin"]) {
    fs.cpSync(path.join(REPO, d), path.join(root, d), { recursive: true });
  }
  fs.cpSync(path.join(REPO, "crew"), path.join(root, "crew"), {
    recursive: true,
    filter: (src) => !src.split(path.sep).includes("node_modules"),
  });
  fs.mkdirSync(path.join(root, "site"), { recursive: true });
  fs.copyFileSync(path.join(REPO, "site", "index.html"), path.join(root, "site", "index.html"));
  fs.copyFileSync(path.join(REPO, "README.md"), path.join(root, "README.md"));
  const drift = path.join(root, ".github", "drift");
  fs.mkdirSync(drift, { recursive: true });
  fs.cpSync(path.join(REPO, ".github", "drift", "blocks"), path.join(drift, "blocks"), { recursive: true });
  fs.copyFileSync(path.join(REPO, ".github", "drift", "shared-blocks.json"), path.join(drift, "shared-blocks.json"));
  return root;
}

function withCopy(fn) {
  const root = makeCopy();
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function replaceOnce(text, from, to) {
  const n = text.split(from).length - 1;
  assert.equal(n, 1, `test setup: expected exactly 1 occurrence of ${JSON.stringify(from.slice(0, 70))}, found ${n}`);
  return text.replace(from, () => to);
}

function edit(root, rel, fn) {
  const p = path.join(root, ...rel.split("/"));
  const before = read(p);
  const after = fn(before);
  assert.notEqual(after, before, `test setup: edit of ${rel} changed nothing`);
  fs.writeFileSync(p, after);
}

function editJson(root, rel, fn) {
  const p = path.join(root, ...rel.split("/"));
  const o = JSON.parse(read(p));
  fn(o);
  fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n");
}

function assertOne(findings, want) {
  assert.equal(findings.length, 1, `expected exactly 1 finding, got ${findings.length}: ${JSON.stringify(findings)}`);
  const f = findings[0];
  for (const [k, v] of Object.entries(want)) {
    assert.deepEqual(f[k], v, `finding.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(f[k])} (finding ${JSON.stringify(f)})`);
  }
  assert.equal(typeof f.message, "string");
  assert.ok(f.message.length > 0, "finding.message must be non-empty");
  assert.equal(typeof f.fix, "string");
  assert.ok(f.fix.length > 0, "finding.fix must be non-empty");
  return f;
}

const lineOf = (text, needle) => {
  const i = text.split("\n").findIndex((l) => l.includes(needle));
  assert.notEqual(i, -1, `test setup: ${needle} not found`);
  return i + 1;
};

const runCli = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

// ---------- T13: model: line ----------

test("T13: model: changed in one agent copy gives exactly one M2 finding", () => {
  withCopy((root) => {
    assert.deepEqual(checkModels(root), []); // control
    edit(root, "agents/architect.md", (t) => replaceOnce(t, "\nmodel: fable\n", "\nmodel: opus\n"));
    assertOne(checkModels(root), {
      kind: "MODEL",
      check: "M2",
      agent: "architect",
      where: "agents/architect.md:5",
      expected: "fable",
      actual: "opus",
    });
  });
});

// ---------- T14: M1, agent file set vs matrix rows ----------

test("T14: an agent file added without a matrix row gives one M1 finding naming it", () => {
  withCopy((root) => {
    fs.copyFileSync(path.join(root, "agents", "architect.md"), path.join(root, "agents", "extra-agent.md"));
    const m1 = checkModels(root).filter((f) => f.check === "M1");
    assert.equal(m1.length, 1, `expected 1 M1 finding, got ${JSON.stringify(m1)}`);
    assert.equal(m1[0].kind, "MODEL");
    assert.equal(m1[0].agent, "extra-agent");
  });
});

test("T14: a matrix row without an agent file gives one M1 finding naming it", () => {
  withCopy((root) => {
    fs.rmSync(path.join(root, "agents", "loki.md"));
    const m1 = checkModels(root).filter((f) => f.check === "M1");
    assert.equal(m1.length, 1, `expected 1 M1 finding, got ${JSON.stringify(m1)}`);
    assert.equal(m1[0].kind, "MODEL");
    assert.equal(m1[0].agent, "loki");
  });
});

// ---------- T15: model-matrix.md tables ----------

const MD = "skills/model-routing/model-matrix.md";
const T15 = [
  {
    name: "per-agent defaults table",
    from: "| developer-backend  | Backend Developer  | claude-sonnet-5-5 | sonnet          |",
    to: "| developer-backend  | Backend Developer  | claude-haiku-5-5  | sonnet          |",
  },
  {
    name: "task-tier routing table",
    from: "| design/architecture/spec                   | claude-fable-5-2  | fable  |",
    to: "| design/architecture/spec                   | claude-fable-5-2  | opus   |",
  },
  {
    name: "config table",
    from: "| version       | 2               |",
    to: "| version       | 3               |",
  },
  {
    name: "aliases table",
    from: "| haiku  | claude-haiku-5-5  |",
    to: "| haiku  | claude-haiku-5-4  |",
  },
];

for (const c of T15) {
  test(`T15: one cell changed in the matrix ${c.name} gives exactly one M4 finding`, () => {
    withCopy((root) => {
      edit(root, MD, (t) => replaceOnce(t, c.from, c.to));
      const f = assertOne(checkModels(root), { kind: "MODEL", check: "M4" });
      assert.ok(f.where.startsWith(MD), `where should name ${MD}, got ${f.where}`);
    });
  });
}

// ---------- T16: docs/agents.md ----------

const DOC = "docs/agents.md";

test("T16: docs code span changed (sonnet to opus) gives one M5 finding", () => {
  withCopy((root) => {
    edit(root, DOC, (t) => replaceOnce(t, "| `developer-backend` | `sonnet` (Sonnet 5.5) |", "| `developer-backend` | `opus` (Sonnet 5.5) |"));
    assertOne(checkModels(root), { kind: "MODEL", check: "M5", agent: "developer-backend", expected: "sonnet", actual: "opus" });
  });
});

test("T16: docs model name changed ((Sonnet 5.5) to (Fable 5.2)) gives one M5 finding", () => {
  withCopy((root) => {
    edit(root, DOC, (t) => replaceOnce(t, "| `developer-backend` | `sonnet` (Sonnet 5.5) |", "| `developer-backend` | `sonnet` (Fable 5.2) |"));
    assertOne(checkModels(root), { kind: "MODEL", check: "M5", agent: "developer-backend" });
  });
});

test("T16: a docs row deleted gives one M5 finding naming the agent", () => {
  withCopy((root) => {
    edit(root, DOC, (t) => {
      const lines = t.split("\n");
      const keep = lines.filter((l) => !(l.startsWith("|") && l.includes("`loki`")));
      assert.equal(lines.length - keep.length, 1, "test setup: exactly one loki table row");
      return keep.join("\n");
    });
    assertOne(checkModels(root), { kind: "MODEL", check: "M5", agent: "loki" });
  });
});

test("T16: '(pinned)' reworded to '(full ID)' gives no finding", () => {
  withCopy((root) => {
    edit(root, DOC, (t) => replaceOnce(t, "| `reviewer-code` | `claude-opus-5-5` (pinned) |", "| `reviewer-code` | `claude-opus-5-5` (full ID) |"));
    assert.deepEqual(checkModels(root), []);
  });
});

// ---------- T17: site/index.html ----------

const SITE = "site/index.html";
const CODE_REVIEWER_SPANS = '<span class="role">⚖️ Code Reviewer</span><span class="model">opus&nbsp;5.5</span>';

test("T17: site span changed (opus&nbsp;5.5 to opus&nbsp;4.8) gives one M6 finding", () => {
  withCopy((root) => {
    edit(root, SITE, (t) => replaceOnce(t, CODE_REVIEWER_SPANS, CODE_REVIEWER_SPANS.replace("opus&nbsp;5.5", "opus&nbsp;4.8")));
    const f = assertOne(checkModels(root), { kind: "MODEL", check: "M6", agent: "reviewer-code" });
    assert.ok(f.where.startsWith(SITE), `where should name ${SITE}, got ${f.where}`);
  });
});

test("T17: a site <li> deleted gives one M6 finding naming the agent", () => {
  withCopy((root) => {
    edit(root, SITE, (t) => {
      const lines = t.split("\n");
      const keep = lines.filter((l) => !l.includes('<span class="role">🎭 Loki</span>'));
      assert.equal(lines.length - keep.length, 1, "test setup: exactly one Loki <li>");
      return keep.join("\n");
    });
    assertOne(checkModels(root), { kind: "MODEL", check: "M6", agent: "loki" });
  });
});

test("T17: a class added to the span and the two spans split by a newline gives no finding", () => {
  withCopy((root) => {
    edit(root, SITE, (t) =>
      replaceOnce(t, CODE_REVIEWER_SPANS, '<span class="role">⚖️ Code Reviewer</span>\n            <span class="model pinned">opus&nbsp;5.5</span>'),
    );
    assert.deepEqual(checkModels(root), []);
  });
});

// ---------- T18: crew PINS ----------

const ROSTER = "crew/hooks/roster.ts";

test("T18: a PINS entry changed gives one M7 finding", () => {
  withCopy((root) => {
    edit(root, ROSTER, (t) => replaceOnce(t, "  'reviewer-code': 'claude-opus-5-5',\n", "  'reviewer-code': 'claude-opus-4-8',\n"));
    const f = assertOne(checkModels(root), { kind: "MODEL", check: "M7", agent: "reviewer-code" });
    assert.ok(f.where.startsWith(ROSTER), `where should name ${ROSTER}, got ${f.where}`);
  });
});

test("T18: a PINS entry removed gives one M7 finding", () => {
  withCopy((root) => {
    edit(root, ROSTER, (t) => replaceOnce(t, "  'reviewer-ux': 'claude-opus-5-5',\n", ""));
    assertOne(checkModels(root), { kind: "MODEL", check: "M7", agent: "reviewer-ux" });
  });
});

// ---------- T19: unknown model in prose (M8) ----------

test("T19: claude-opus-4-1 added to README.md gives one M8 finding with file and line", () => {
  withCopy((root) => {
    edit(root, "README.md", (t) => t.replace(/\n*$/, "\n\nSee claude-opus-4-1 for details.\n"));
    const n = lineOf(read(path.join(root, "README.md")), "claude-opus-4-1");
    assertOne(checkModels(root), { kind: "MODEL", check: "M8", where: `README.md:${n}`, actual: "claude-opus-4-1" });
  });
});

test("T19: 'Sonnet 4' added to a doc gives one M8 finding with file and line", () => {
  withCopy((root) => {
    edit(root, "docs/usage.md", (t) => t.replace(/\n*$/, "\n\nUse Sonnet 4 for this.\n"));
    const n = lineOf(read(path.join(root, "docs", "usage.md")), "Sonnet 4");
    assertOne(checkModels(root), { kind: "MODEL", check: "M8", where: `docs/usage.md:${n}` });
  });
});

test("T19: claude-opus-5-5-20261101 added to a skill gives one M8 finding with file and line", () => {
  withCopy((root) => {
    const rel = "skills/orchestrator-loop/SKILL.md";
    edit(root, rel, (t) => t.replace(/\n*$/, "\n\nPin claude-opus-5-5-20261101 here.\n"));
    const n = lineOf(read(path.join(root, ...rel.split("/"))), "claude-opus-5-5-20261101");
    assertOne(checkModels(root), { kind: "MODEL", check: "M8", where: `${rel}:${n}`, actual: "claude-opus-5-5-20261101" });
  });
});

// ---------- T20 and T21: the display rule ----------

/**
 * Re-pin reviewer-code to newId in every place that holds it: matrix json and md, the agent file, the
 * docs cell, the site span and crew PINS. docCell is the new text of the docs "Default model" cell,
 * siteSpan the new text of the site model span (or null to leave it).
 */
function repin(root, newId, docCell, siteSpan) {
  editJson(root, "skills/model-routing/model-matrix.json", (m) => {
    const row = m.agent_defaults.find((r) => r.agent_id === "reviewer-code");
    row.default_model = newId;
    row.frontmatter = newId;
  });
  edit(root, MD, (t) =>
    replaceOnce(
      t,
      "| reviewer-code      | Code Reviewer      | claude-opus-5-5   | claude-opus-5-5 |",
      `| reviewer-code      | Code Reviewer      | ${newId} | ${newId} |`,
    ),
  );
  edit(root, "agents/reviewer-code.md", (t) => replaceOnce(t, "\nmodel: claude-opus-5-5\n", `\nmodel: ${newId}\n`));
  edit(root, DOC, (t) => replaceOnce(t, "| `reviewer-code` | `claude-opus-5-5` (pinned) |", `| \`reviewer-code\` | ${docCell} |`));
  edit(root, ROSTER, (t) => replaceOnce(t, "  'reviewer-code': 'claude-opus-5-5',\n", `  'reviewer-code': '${newId}',\n`));
  if (siteSpan !== null) {
    edit(root, SITE, (t) => replaceOnce(t, CODE_REVIEWER_SPANS, CODE_REVIEWER_SPANS.replace("opus&nbsp;5.5", siteSpan)));
  }
}

const DATED = "claude-opus-5-5-20261101";

test("T20: a date-suffixed pin with the site span left as opus 5.5 gives one UNRENDERABLE from M6", () => {
  withCopy((root) => {
    repin(root, DATED, `\`${DATED}\` (pinned)`, null);
    const f = assertOne(checkModels(root), { kind: "UNRENDERABLE", check: "M6", agent: "reviewer-code", id: DATED });
    assert.ok(f.where.startsWith(SITE), `where should name ${SITE}, got ${f.where}`);
  });
});

test("T20: a date-suffixed pin with the site span changed to the full ID gives no finding", () => {
  withCopy((root) => {
    repin(root, DATED, `\`${DATED}\` (pinned)`, DATED);
    assert.deepEqual(checkModels(root), []);
  });
});

test("T20: a model name added to the doc cell of a date-suffixed pin gives one UNRENDERABLE from M5", () => {
  withCopy((root) => {
    repin(root, DATED, `\`${DATED}\` (Opus 5.5, pinned)`, DATED);
    const f = assertOne(checkModels(root), { kind: "UNRENDERABLE", check: "M5", agent: "reviewer-code", id: DATED });
    assert.ok(f.where.startsWith(DOC), `where should name ${DOC}, got ${f.where}`);
  });
});

test("T21: a single-number ID (claude-opus-6) updated everywhere gives no M5 or M6 finding", () => {
  withCopy((root) => {
    repin(root, "claude-opus-6", "`claude-opus-6` (pinned)", "opus 6");
    const f = checkModels(root).filter((x) => x.check === "M5" || x.check === "M6");
    assert.deepEqual(f, []);
  });
});

// ---------- T22: theme.json ----------

test("T22: a theme.json at the root gives one M9 finding", () => {
  withCopy((root) => {
    fs.writeFileSync(path.join(root, "theme.json"), "{}\n");
    assertOne(checkModels(root), { kind: "MODEL", check: "M9", where: "theme.json" });
  });
});

// ---------- T23: marketplace sources (P1) ----------

test("T23: the unmodified marketplace has no P1 finding (control)", () => {
  withCopy((root) => {
    assert.deepEqual(checkSources(root), []);
  });
});

test("T23: a marketplace source folder that does not exist gives one P1 finding", () => {
  withCopy((root) => {
    edit(root, ".claude-plugin/marketplace.json", (t) => replaceOnce(t, '"source": "./crew"', '"source": "./nope"'));
    assertOne(checkSources(root), {
      kind: "SOURCE",
      check: "P1",
      plugin: "switchboard-crew",
      where: "nope/.claude-plugin/plugin.json",
    });
  });
});

test("T23: a marketplace source folder with no .claude-plugin/plugin.json gives one P1 finding", () => {
  withCopy((root) => {
    edit(root, ".claude-plugin/marketplace.json", (t) => replaceOnce(t, '"source": "./crew"', '"source": "./skills"'));
    assertOne(checkSources(root), {
      kind: "SOURCE",
      check: "P1",
      plugin: "switchboard-crew",
      where: "skills/.claude-plugin/plugin.json",
    });
  });
});

// ---------- T24: CLI ----------

test("T24: CLI on a clean copy exits 0 and prints the summary line from spec 4.5", () => {
  withCopy((root) => {
    const r = runCli(["--root", root]);
    assert.equal(r.status, 0, `exit status: expected 0, got ${r.status}; stderr: ${r.stderr}`);
    assert.match(
      r.stdout,
      /^drift-check: 0 findings \(22 composed sections, 2 variant sections, 14 agents, 10 model and source checks\)$/m,
    );
    assert.equal(r.stderr, "", "a clean run prints nothing to stderr");
  });
});

test("T24: CLI on a drifted copy exits 1 and prints every finding to stderr", () => {
  withCopy((root) => {
    edit(root, "agents/architect.md", (t) => replaceOnce(t, "\nmodel: fable\n", "\nmodel: opus\n"));
    edit(root, "agents/testing-qa.md", (t) => replaceOnce(t, "Exit codes are evidence. Do not pipe", "Exit codes are evidence, Do not pipe"));
    const r = runCli(["--root", root]);
    assert.equal(r.status, 1, `exit status: expected 1, got ${r.status}; stderr: ${r.stderr}`);
    assert.match(r.stderr, /MODEL check=M2 agent=architect where=agents\/architect\.md:5/);
    assert.match(r.stderr, /DRIFT agent=agents\/testing-qa\.md section="## Working Rules"/);
    assert.match(r.stdout, /^drift-check: 2 findings /m);
  });
});

test("T24: CLI with a root that does not exist exits 2", () => {
  const missing = path.join(os.tmpdir(), `drift-no-such-root-${process.pid}-${Date.now()}`);
  assert.equal(fs.existsSync(missing), false);
  const r = runCli(["--root", missing]);
  assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stderr: ${r.stderr}`);
});

test("T24: CLI exits 2 when a file the model checks need is missing", () => {
  withCopy((root) => {
    fs.rmSync(path.join(root, "skills", "model-routing", "model-matrix.json"));
    const r = runCli(["--root", root]);
    assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stderr: ${r.stderr}`);
  });
});

// ---------- R1: M7 must see every key form in PINS, and fail closed on syntax it does not know ----------

const LAST_PIN = "  'testing-pentester': 'claude-opus-4-8',\n";

test("R1: an unquoted extra key in PINS (loki: 'claude-opus-5-5',) gives exactly one M7 finding for loki", () => {
  withCopy((root) => {
    edit(root, ROSTER, (t) => replaceOnce(t, LAST_PIN, `${LAST_PIN}  loki: 'claude-opus-5-5',\n`));
    assertOne(checkModels(root), { kind: "MODEL", check: "M7", agent: "loki" });
  });
});

test("R1: a PINS line that is not blank, a comment or an entry (...OTHER,) gives an M7 finding", () => {
  withCopy((root) => {
    edit(root, ROSTER, (t) => replaceOnce(t, LAST_PIN, `${LAST_PIN}  ...OTHER,\n`));
    const m7 = checkModels(root).filter((f) => f.check === "M7");
    assert.ok(m7.length >= 1, `expected an M7 finding for unknown syntax, got ${JSON.stringify(m7)}`);
    assert.ok(m7.every((f) => f.kind === "MODEL" && f.message.length > 0));
  });
});

test("R1: a backtick-quoted value counts as an entry (no finding)", () => {
  withCopy((root) => {
    edit(root, ROSTER, (t) => replaceOnce(t, "  'reviewer-code': 'claude-opus-5-5',\n", "  'reviewer-code': `claude-opus-5-5`,\n"));
    assert.deepEqual(checkModels(root), []);
  });
});

test("R1: blank lines and comment lines inside PINS are ignored (no finding)", () => {
  withCopy((root) => {
    edit(root, ROSTER, (t) => replaceOnce(t, LAST_PIN, `${LAST_PIN}\n  // a note\n`));
    assert.deepEqual(checkModels(root), []);
  });
});

// ---------- R4: a malformed matrix row is a clean exit 2, not a stack trace ----------

for (const [name, mutate] of [
  ["without frontmatter", (row) => delete row.frontmatter],
  ["with a non-string frontmatter", (row) => (row.frontmatter = 5)],
]) {
  test(`R4: a matrix row ${name} makes the CLI exit 2 with a message and no TypeError`, () => {
    withCopy((root) => {
      editJson(root, "skills/model-routing/model-matrix.json", (m) => mutate(m.agent_defaults.find((r) => r.agent_id === "architect")));
      const r = runCli(["--root", root]);
      assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stderr: ${r.stderr.slice(0, 300)}`);
      assert.doesNotMatch(r.stderr, /TypeError/);
      assert.ok(r.stderr.trim().length > 0, "a message must be printed to stderr");
    });
  });
}

// ---------- R5: CLI arguments ----------

test("R5: --root with no value exits 2", () => {
  const r = runCli(["--root"]);
  assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stdout: ${r.stdout.slice(0, 200)}`);
  assert.ok(r.stderr.trim().length > 0, "a message must be printed to stderr");
});

test("R5: an unknown option exits 2", () => {
  const r = runCli(["--bogus"]);
  assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stdout: ${r.stdout.slice(0, 200)}`);
  assert.ok(r.stderr.trim().length > 0, "a message must be printed to stderr");
});

test("R5: a stray positional argument exits 2", () => {
  withCopy((root) => {
    const r = runCli(["--root", root, "extra"]);
    assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stdout: ${r.stdout.slice(0, 200)}`);
  });
});
