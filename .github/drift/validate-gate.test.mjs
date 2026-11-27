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

import { gateReport } from "./validate-gate.mjs";

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
