// Tests for validate-gate.mjs: the warning allow-list and coverage rules (T25 to T29 of the spec).
// They call gateReport on small hand-written reports shaped like `claude plugin validate --json`
// output (sampled with CLI 2.1.332 on 2026-11-27). They never run the CLI and touch no file.
//
// gateReport(report, allowList, target, expected) -> finding[]   ([] means the gate passes)
//
//   report     the parsed `--json` object: { success, strict, target, manifest: {file, type, errors,
//              warnings}, contents: [{file, type, errors, warnings}], provides: {agents, skills, ...},
//              directory: {findings} }. A warning or error is { path, message, code }; every `file`
//              is absolute, in Windows or POSIX form.
//   allowList  the entries of validate-allow.json: { target, file, contains, count, why }.
//              gateReport only looks at entries whose `target` equals the `target` argument; an
//              entry of another target is neither applied nor reported as unused.
//   target     '.' or a relative plugin folder such as 'crew'.
//   expected   { agents: string[], skills: string[] }: the names the root run must provide, spelled
//              as they appear in report.provides ('switchboard:<slug>' and 'switchboard:<skill>').
//              Compared as sets with provides.agents and provides.skills. The coverage check runs
//              only when target is '.'; for any other target `expected` is ignored.
//
// Relative file (settled where the spec was silent): the plugin directory is the manifest file's
// path with its trailing '.claude-plugin/<name>.json' removed; a warning's file is the part of its
// absolute path after that directory, with backslashes turned into '/'. Root run: 'CLAUDE.md',
// 'crew/hooks/hooks.json'. Crew run: 'hooks/crew.test.tsx', '.claude-plugin/plugin.json'.
//
// Warnings are collected from manifest.warnings (file = manifest.file) and from every contents[]
// entry (file = that entry's file), and counted once per distinct (file, path, message).
// directory.findings is ignored.
//
// Finding object shape:
//   kind     'GATE'
//   rule     'FAILED'         report.success is false (or the report is not an object)
//            'ERROR'          one per entry in manifest.errors or a contents[].errors; fields file, text
//            'NEW-WARNING'    a warning no allow entry of this target matches; fields file, path, text
//            'COUNT-MISMATCH' an allow entry matched a different number of warnings than its count (at
//                             least one matched); fields matched, allowed, file, contains. When
//                             matched < allowed the message says "lower the count".
//            'UNUSED-ALLOW'   an allow entry of this target matched nothing; fields file, contains
//            'COVERAGE'       target is '.', and provides is absent, or provides.agents or
//                             provides.skills differs from `expected` as a set; fields what ('agents'
//                             or 'skills' or 'provides'), missing[], extra[]
//   target   the target argument
//   message  non-empty string; for NEW-WARNING it contains the warning text; for COUNT-MISMATCH it
//            contains both numbers

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { gateReport } from "./validate-gate.mjs";
import * as gate from "./validate-gate.mjs";

// Review fixes R2 and R3 add three exports to validate-gate.mjs (tests below):
//   GateError                 class; thrown for "the gate cannot run"; the CLI maps it to exit 2
//   checkTarget(t)            returns t unchanged when it is a safe relative plugin folder
//                             ('.', 'crew', 'a/b-c_d.e': segments of letters, digits, '.', '_', '-';
//                             no leading '-', no '..' segment, no space, no absolute path, not empty);
//                             throws GateError for anything else (also for a non-string)
//   runResult(result, target) result = { status, signal, stdout } of the validator process;
//                             returns { report, findings }: report is the parsed stdout JSON (null when
//                             it does not parse); findings are GATE findings (kind, rule, target,
//                             message): rule 'EXIT' when status is not 0 or signal is not null (even
//                             when the report says success: true), rule 'BAD-OUTPUT' when stdout is not
//                             valid JSON. target defaults to '.'.

// ---------- fixtures ----------

const SLUGS = [
  "architect",
  "business-analyst",
  "designer",
  "developer-backend",
  "developer-frontend",
  "loki",
  "release-manager",
  "reviewer-code",
  "reviewer-security",
  "reviewer-ux",
  "testing-pentester",
  "testing-qa",
  "testing-red-team",
  "writer-technical",
];
const SKILLS = ["model-routing", "orchestrator-loop", "spec-review", "theme", "wireup"];
const AGENT_NAMES = SLUGS.map((s) => `switchboard:${s}`);
const SKILL_NAMES = SKILLS.map((s) => `switchboard:${s}`);
const EXPECTED = { agents: AGENT_NAMES, skills: SKILL_NAMES };

const ALLOW = [
  {
    target: ".",
    file: "CLAUDE.md",
    contains: "CLAUDE.md at the plugin root is not loaded as project context",
    count: 1,
    why: "Owner file; moving it is a #15 item and an open decision in NEXT-UP.md",
  },
  {
    target: "crew",
    file: "hooks/crew.test.tsx",
    contains: "error TS",
    count: 7,
    why: "Test-file type gaps against the CLI's testing types; cleanup tracked in #15 follow-ups",
  },
];

const STYLES = {
  win: { sep: "\\", base: "C:\\x\\switchboard" },
  posix: { sep: "/", base: "/home/runner/work/switchboard/switchboard" },
};

const abs = (style, ...segs) => [STYLES[style].base, ...segs].join(STYLES[style].sep);
const absIn = (style, dir, ...segs) => abs(style, ...(dir ? [dir] : []), ...segs);

const CLAUDE_MD_WARNING = {
  path: "root",
  message:
    "CLAUDE.md at the plugin root is not loaded as project context. To ship context with your plugin, use a skill (skills/<name>/SKILL.md) instead.",
  code: null,
};

const ICON_FINDING = {
  code: "ICON_MISSING",
  title: "No icon",
  severity: "warning",
  blocking: false,
  hold: false,
  file: ".claude-plugin/plugin.json",
  field: "icon",
  message: "No icon found in the plugin.",
  fix: "Add a square PNG to the plugin folder.",
};

/** The report of `claude plugin validate .` on today's repo. */
function rootReport(style = "win") {
  return {
    success: true,
    strict: false,
    target: abs(style, ".claude-plugin", "marketplace.json"),
    manifest: {
      file: abs(style, ".claude-plugin", "marketplace.json"),
      type: "marketplace",
      errors: [],
      warnings: [],
      notes: [],
    },
    contents: [
      {
        file: abs(style, "CLAUDE.md"),
        type: "plugin",
        errors: [],
        warnings: [{ ...CLAUDE_MD_WARNING }],
        notes: [],
      },
      {
        file: abs(style, "crew", "hooks", "hooks.json"),
        type: "hooks",
        errors: [],
        warnings: [],
        notes: ["./register.tsx hooks: session.start"],
      },
    ],
    provides: {
      modules: [],
      hooks: [],
      skills: [...SKILL_NAMES],
      commands: [],
      agents: [...AGENT_NAMES],
      outputStyles: [],
    },
    advice: [],
    directory: { profile: null, findings: [{ ...ICON_FINDING }], undecided: [], incomplete: false, failure: null },
  };
}

const crewWarning = (n) => ({
  path: `line ${200 + n}, column ${10 + n}`,
  message: `error TS27${30 + n}: Type 'X${n}' is missing the following properties from type 'Y': a, b, c`,
  code: null,
});

/** The report of `claude plugin validate crew` with n type warnings in the crew test file. */
function crewReport(style = "win", n = 7) {
  return {
    success: true,
    strict: false,
    target: abs(style, "crew", ".claude-plugin", "plugin.json"),
    manifest: {
      file: abs(style, "crew", ".claude-plugin", "plugin.json"),
      type: "plugin",
      errors: [],
      warnings: [],
      notes: [],
    },
    contents: [
      { file: abs(style, "crew", "hooks", "hooks.json"), type: "hooks", errors: [], warnings: [], notes: [] },
      {
        file: abs(style, "crew", "hooks", "crew.test.tsx"),
        type: "hooks",
        errors: [],
        warnings: Array.from({ length: n }, (_, i) => crewWarning(i + 1)),
        notes: [],
      },
    ],
    provides: { modules: [], hooks: [], skills: [], commands: [], agents: [], outputStyles: [] },
    advice: [],
    directory: { profile: null, findings: [{ ...ICON_FINDING }], undecided: [], incomplete: false, failure: null },
  };
}

const gateRoot = (report) => gateReport(report, ALLOW, ".", EXPECTED);
const gateCrew = (report) => gateReport(report, ALLOW, "crew", EXPECTED);

function only(findings, want) {
  assert.equal(findings.length, 1, `expected exactly 1 finding, got ${findings.length}: ${JSON.stringify(findings)}`);
  const f = findings[0];
  assert.equal(f.kind, "GATE");
  for (const [k, v] of Object.entries(want)) {
    assert.deepEqual(f[k], v, `finding.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(f[k])} (finding ${JSON.stringify(f)})`);
  }
  assert.equal(typeof f.message, "string");
  assert.ok(f.message.length > 0, "finding.message must be non-empty");
  return f;
}

const hasRule = (findings, rule) => findings.some((f) => f.kind === "GATE" && f.rule === rule);

// ---------- T25: success, errors, allowed warnings ----------

test("T25: a report with success false fails", () => {
  const r = rootReport();
  r.success = false;
  const f = gateRoot(r);
  assert.ok(hasRule(f, "FAILED"), `expected a FAILED finding, got ${JSON.stringify(f)}`);
});

test("T25: an error in a contents entry fails with an ERROR finding naming the file", () => {
  const r = rootReport();
  r.success = false;
  r.contents.push({
    file: abs("win", "agents", "loki.md"),
    type: "agent",
    errors: [{ path: "frontmatter", message: "YAML frontmatter failed to parse", code: null }],
    warnings: [],
    notes: [],
  });
  const f = gateRoot(r);
  const err = f.find((x) => x.rule === "ERROR");
  assert.ok(err, `expected an ERROR finding, got ${JSON.stringify(f)}`);
  assert.equal(err.file, "agents/loki.md");
  assert.match(err.message, /YAML frontmatter failed to parse/);
});

test("T25: an error in the manifest fails even when success says true", () => {
  const r = rootReport();
  r.manifest.errors = [{ path: "plugins[0] plugin.json -> homepage", message: "Invalid URL", code: null }];
  assert.ok(hasRule(gateRoot(r), "ERROR"));
});

test("T25: the root report with only the allowed warning at its exact count passes (icon finding ignored)", () => {
  assert.deepEqual(gateRoot(rootReport("win")), []);
});

test("T25: the crew report with 7 allowed type warnings passes, and the root allow entry is not reported as unused", () => {
  assert.deepEqual(gateCrew(crewReport("win", 7)), []);
});

// ---------- T26: new warnings and count drift ----------

test("T26: one new warning in another file fails naming the warning", () => {
  const r = rootReport();
  r.contents.push({
    file: abs("win", "skills", "theme", "SKILL.md"),
    type: "skill",
    errors: [],
    warnings: [{ path: "frontmatter", message: "Unknown field 'bogusField'", code: null }],
    notes: [],
  });
  const f = only(gateRoot(r), { rule: "NEW-WARNING", target: ".", file: "skills/theme/SKILL.md" });
  assert.match(f.message, /Unknown field 'bogusField'/);
});

test("T26: a warning reported only under manifest.warnings is also checked", () => {
  const r = rootReport();
  r.manifest.warnings = [{ path: "plugins[0]", message: "Unknown field 'bogusField'", code: null }];
  only(gateRoot(r), { rule: "NEW-WARNING", target: "." });
});

test("T26: an eighth 'error TS' warning in hooks/crew.test.tsx fails with count 8 against allowed 7", () => {
  const f = only(gateCrew(crewReport("win", 8)), {
    rule: "COUNT-MISMATCH",
    target: "crew",
    file: "hooks/crew.test.tsx",
    matched: 8,
    allowed: 7,
  });
  assert.match(f.message, /8/);
  assert.match(f.message, /7/);
});

test("T26: six warnings instead of seven fails and says to lower the count", () => {
  const f = only(gateCrew(crewReport("win", 6)), {
    rule: "COUNT-MISMATCH",
    target: "crew",
    matched: 6,
    allowed: 7,
  });
  assert.match(f.message, /lower the count/);
});

test("T26: an allow entry that matches nothing fails naming the entry", () => {
  const r = rootReport();
  r.contents[0].warnings = [];
  const f = only(gateRoot(r), { rule: "UNUSED-ALLOW", target: ".", file: "CLAUDE.md" });
  assert.match(f.message, /CLAUDE\.md at the plugin root is not loaded as project context/);
});

// ---------- T27: the same warning reported twice counts once ----------

test("T27: the same warning under manifest and under a contents entry counts once", () => {
  const dup = { path: "root", message: "Unknown field 'bogusField'", code: null };
  const r = crewReport("win", 7);
  const pluginJson = r.manifest.file;
  r.manifest.warnings = [{ ...dup }];
  r.contents.push({ file: pluginJson, type: "plugin", errors: [], warnings: [{ ...dup }], notes: [] });
  const allow = [
    ...ALLOW,
    { target: "crew", file: ".claude-plugin/plugin.json", contains: "Unknown field", count: 1, why: "test fixture" },
  ];
  assert.deepEqual(gateReport(r, allow, "crew", EXPECTED), []);
});

test("T27: without the dedupe the count would be 2: two distinct warnings still count twice", () => {
  const r = crewReport("win", 7);
  const pluginJson = r.manifest.file;
  r.manifest.warnings = [{ path: "root", message: "Unknown field 'a'", code: null }];
  r.contents.push({
    file: pluginJson,
    type: "plugin",
    errors: [],
    warnings: [{ path: "root", message: "Unknown field 'b'", code: null }],
    notes: [],
  });
  const allow = [
    ...ALLOW,
    { target: "crew", file: ".claude-plugin/plugin.json", contains: "Unknown field", count: 1, why: "test fixture" },
  ];
  only(gateReport(r, allow, "crew", EXPECTED), { rule: "COUNT-MISMATCH", matched: 2, allowed: 1 });
});

// ---------- T28: Windows and POSIX absolute paths ----------

for (const style of ["win", "posix"]) {
  test(`T28: an absolute ${style} path in file matches the relative allow entry (root run)`, () => {
    assert.deepEqual(gateRoot(rootReport(style)), []);
  });
  test(`T28: an absolute ${style} path in file matches the relative allow entry (crew run)`, () => {
    assert.deepEqual(gateCrew(crewReport(style, 7)), []);
  });
}

// ---------- T29: coverage of the root run ----------

test("T29: provides.agents with 13 names fails with a COVERAGE finding naming the missing agent", () => {
  const r = rootReport();
  r.provides.agents = r.provides.agents.filter((a) => a !== "switchboard:loki");
  assert.equal(r.provides.agents.length, 13);
  const f = only(gateRoot(r), { rule: "COVERAGE", target: ".", what: "agents" });
  assert.deepEqual(f.missing, ["switchboard:loki"]);
});

test("T29: provides absent on an otherwise passing report fails with a COVERAGE finding", () => {
  const r = rootReport();
  delete r.provides;
  only(gateRoot(r), { rule: "COVERAGE", target: ".", what: "provides" });
});

test("T29: provides.skills with 4 names fails with a COVERAGE finding", () => {
  const r = rootReport();
  r.provides.skills = r.provides.skills.slice(1);
  only(gateRoot(r), { rule: "COVERAGE", target: ".", what: "skills" });
});

test("T29: the right number of agents but one wrong name fails with missing and extra", () => {
  const r = rootReport();
  r.provides.agents = r.provides.agents.map((a) => (a === "switchboard:loki" ? "switchboard:locki" : a));
  const f = only(gateRoot(r), { rule: "COVERAGE", target: ".", what: "agents" });
  assert.deepEqual(f.missing, ["switchboard:loki"]);
  assert.deepEqual(f.extra, ["switchboard:locki"]);
});

test("T29: the coverage check applies to the root target only (crew report with empty provides passes)", () => {
  assert.deepEqual(gateCrew(crewReport("win", 7)), []);
});

// ---------- R2: target validation and no shell ----------

const needs = (name) => assert.equal(typeof gate[name], "function", `validate-gate.mjs must export ${name}`);
const GOOD_TARGETS = [".", "crew", "a/b-c_d.e"];
const BAD_TARGETS = [
  ["a shell metacharacter string", "x&echo hi&rem"],
  ["a leading dash", "-x"],
  ["a parent directory", "../up"],
  ["a space", "a b"],
  ["the empty string", ""],
  ["a POSIX absolute path", "/etc"],
  ["a Windows absolute path", "C:\\x"],
  ["a non-string", undefined],
];

for (const t of GOOD_TARGETS) {
  test(`R2: checkTarget accepts ${JSON.stringify(t)} and returns it unchanged`, () => {
    needs("checkTarget");
    assert.equal(gate.checkTarget(t), t);
  });
}

for (const [name, t] of BAD_TARGETS) {
  test(`R2: checkTarget rejects ${name} with a GateError`, () => {
    needs("checkTarget");
    needs("GateError");
    assert.throws(() => gate.checkTarget(t), (e) => e instanceof gate.GateError);
  });
}

test("R2: the module source no longer contains 'shell: true'", () => {
  const src = fs.readFileSync(fileURLToPath(new URL("./validate-gate.mjs", import.meta.url)), "utf8");
  assert.equal(src.includes("shell: true"), false, "the Windows shell fallback must be removed");
});

/** A copy of the gate CLI with its own marketplace, run with a PATH that has no claude. */
function runGateCopy(marketplaceSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-test-"));
  const emptyBin = path.join(root, "empty-bin");
  try {
    const drift = path.join(root, ".github", "drift");
    fs.mkdirSync(drift, { recursive: true });
    fs.mkdirSync(emptyBin);
    fs.mkdirSync(path.join(root, ".claude-plugin"));
    const here = path.dirname(fileURLToPath(import.meta.url));
    fs.copyFileSync(path.join(here, "validate-gate.mjs"), path.join(drift, "validate-gate.mjs"));
    fs.copyFileSync(path.join(here, "validate-allow.json"), path.join(drift, "validate-allow.json"));
    fs.writeFileSync(path.join(root, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "switchboard" }));
    fs.writeFileSync(
      path.join(root, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ name: "m", plugins: [{ name: "p", source: marketplaceSource }] }),
    );
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (k.toLowerCase() === "path") delete env[k];
    env.PATH = emptyBin;
    return spawnSync(process.execPath, [path.join(drift, "validate-gate.mjs")], { encoding: "utf8", env, cwd: root });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("R2: a marketplace source that fails target validation stops the gate with exit 2 naming the source", () => {
  const r = runGateCopy("./x&echo hi&rem");
  assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stderr: ${r.stderr}`);
  assert.ok(r.stderr.includes("x&echo hi&rem"), `stderr should name the rejected target, got: ${r.stderr}`);
});

test("R2: when claude is not found the gate exits 2 and hints at the native CLI", () => {
  const r = runGateCopy("./crew");
  assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stdout: ${r.stdout}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /claude/i);
  assert.match(r.stderr, /native/i);
});

// ---------- R3: the validator's own exit status counts ----------

const okReport = () => JSON.stringify({ success: true, manifest: { errors: [], warnings: [] }, contents: [] });

test("R3: status 0 with a valid report gives the parsed report and no findings", () => {
  needs("runResult");
  const res = gate.runResult({ status: 0, signal: null, stdout: okReport() }, ".");
  assert.deepEqual(res.findings, []);
  assert.equal(res.report.success, true);
});

test("R3: status 1 with a report that says success: true gives an EXIT finding", () => {
  needs("runResult");
  const res = gate.runResult({ status: 1, signal: null, stdout: okReport() }, "crew");
  const f = res.findings.find((x) => x.rule === "EXIT");
  assert.ok(f, `expected an EXIT finding, got ${JSON.stringify(res.findings)}`);
  assert.equal(f.kind, "GATE");
  assert.equal(f.target, "crew");
  assert.match(f.message, /1/);
});

test("R3: a non-null signal gives an EXIT finding", () => {
  needs("runResult");
  const res = gate.runResult({ status: null, signal: "SIGKILL", stdout: okReport() }, ".");
  const f = res.findings.find((x) => x.rule === "EXIT");
  assert.ok(f, `expected an EXIT finding, got ${JSON.stringify(res.findings)}`);
  assert.match(f.message, /SIGKILL/);
});

test("R3: stdout that is not JSON gives a BAD-OUTPUT finding and a null report", () => {
  needs("runResult");
  const res = gate.runResult({ status: 0, signal: null, stdout: "not json" }, ".");
  assert.equal(res.report, null);
  assert.ok(res.findings.some((x) => x.rule === "BAD-OUTPUT"), `got ${JSON.stringify(res.findings)}`);
});
