// Tests for drift-check.mjs, stage A: shared agent blocks (T1 to T12 of the spec).
//
// Finding object shape (the code stage implements exactly this):
//   kind        'DRIFT' | 'MISSING-SECTION' | 'DUPLICATE-SECTION' | 'UNCLASSIFIED' | 'BAD-MANIFEST'
//   agent       agent slug, e.g. 'testing-qa'              (BAD-MANIFEST: the slug the manifest names, if any)
//   section     the heading text without "## ", e.g. 'Working Rules'
//   block       DRIFT: id of the block file the first difference falls in, or null when the actual
//               section has an extra line after the composed text; BAD-MANIFEST: the block id named, if any
//   line        DRIFT: 1-based line within the section body (leading and trailing blank lines removed)
//   column      DRIFT: 1-based column of the first differing character; present for "line differs"
//   blockLine   DRIFT: 1-based line within the block file; present for "line differs"
//   expected    DRIFT "line differs": the expected line; actual: the line found
//   actual
//   reason      DRIFT only: 'line differs' | 'unexpected line after the end of the composed text'
//               | 'section ends before block <id> line <n>'
//   message     string, the full text printed to stderr (non-empty on every finding)
//   fix         string, the fix text; on DRIFT it names `.github/drift/blocks/<block>.md`
//
// Every test works on a throwaway copy under os.tmpdir() and removes it afterwards.
// No test changes a tracked file; no test depends on timing.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { checkBlocks, checkModels, checkSources } from "./drift-check.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const CLI = path.join(HERE, "drift-check.mjs");

// ---------- helpers ----------

const lf = (s) => s.replace(/\r\n/g, "\n");
const read = (p) => lf(fs.readFileSync(p, "utf8"));

/** Canonical block text (trailing newlines dropped, as the spec says). */
const blockText = (id) => read(path.join(REPO, ".github", "drift", "blocks", `${id}.md`)).replace(/\n+$/, "");
const blockLines = (id) => blockText(id).split("\n");

function makeCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drift-test-"));
  fs.cpSync(path.join(REPO, "agents"), path.join(root, "agents"), { recursive: true });
  const drift = path.join(root, ".github", "drift");
  fs.mkdirSync(drift, { recursive: true });
  fs.cpSync(path.join(REPO, ".github", "drift", "blocks"), path.join(drift, "blocks"), { recursive: true });
  fs.copyFileSync(path.join(REPO, ".github", "drift", "shared-blocks.json"), path.join(drift, "shared-blocks.json"));
  return root;
}

/** Run fn(root) on a fresh copy and always remove the copy. */
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
  assert.equal(n, 1, `test setup: expected exactly 1 occurrence of ${JSON.stringify(from.slice(0, 60))}, found ${n}`);
  return text.replace(from, () => to);
}

const agentFile = (root, slug) => path.join(root, "agents", `${slug}.md`);

function editAgent(root, slug, fn) {
  const p = agentFile(root, slug);
  const before = read(p);
  const after = fn(before);
  assert.notEqual(after, before, `test setup: edit of ${slug} changed nothing`);
  fs.writeFileSync(p, after);
}

const manifestFile = (root) => path.join(root, ".github", "drift", "shared-blocks.json");

function editManifest(root, fn) {
  const m = JSON.parse(read(manifestFile(root)));
  fn(m);
  fs.writeFileSync(manifestFile(root), JSON.stringify(m, null, 2) + "\n");
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}

function assertOne(findings, want) {
  assert.equal(findings.length, 1, `expected exactly 1 finding, got ${findings.length}: ${JSON.stringify(findings)}`);
  const f = findings[0];
  for (const [k, v] of Object.entries(want)) {
    assert.deepEqual(f[k], v, `finding.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(f[k])} (finding ${JSON.stringify(f)})`);
  }
  assert.equal(typeof f.message, "string");
  assert.ok(f.message.length > 0, "finding.message must be non-empty");
  return f;
}

const runCli = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

// ---------- T1: real repo, unchanged ----------

test("T1: the real repo has no findings from checkBlocks, checkModels, checkSources", () => {
  assert.deepEqual(checkBlocks(REPO), []);
  assert.deepEqual(checkModels(REPO), []);
  assert.deepEqual(checkSources(REPO), []);
});

test("T1: the shipped manifest only names block files that exist, and every block file exists once", () => {
  const manifest = JSON.parse(read(path.join(REPO, ".github", "drift", "shared-blocks.json")));
  const used = new Set();
  let composed = 0;
  for (const s of manifest.sections) {
    for (const [slug, parts] of Object.entries(s.agents)) {
      assert.ok(fs.existsSync(path.join(REPO, "agents", `${slug}.md`)), `agent file for ${slug}`);
      if (Array.isArray(parts)) {
        composed++;
        for (const p of parts) if (p !== "") used.add(p);
      }
    }
  }
  assert.equal(composed, 22);
  const files = fs.readdirSync(path.join(REPO, ".github", "drift", "blocks")).map((f) => f.replace(/\.md$/, ""));
  assert.deepEqual([...used].sort(), files.sort());
});

// ---------- T2: negative control, one byte ----------

test("T2: one byte changed in testing-qa Working Rules gives exactly one DRIFT with line and column", () => {
  withCopy((root) => {
    // control: the untouched copy is clean, so the finding below comes from the edit
    assert.deepEqual(checkBlocks(root), []);

    const expectedLine = blockLines("working-rules")[2];
    const from = "Exit codes are evidence. Do not pipe";
    const to = "Exit codes are evidence, Do not pipe";
    assert.ok(expectedLine.includes(from), "test setup: line 3 of working-rules holds the sentence");
    const actualLine = expectedLine.replace(from, to);
    editAgent(root, "testing-qa", (t) => replaceOnce(t, from, to));

    assertOne(checkBlocks(root), {
      kind: "DRIFT",
      agent: "testing-qa",
      section: "Working Rules",
      block: "working-rules",
      line: 3,
      blockLine: 3,
      column: firstDiff(expectedLine, actualLine) + 1,
      expected: expectedLine,
      actual: actualLine,
      reason: "line differs",
    });
  });
});

test("T2: the DRIFT fix text names the canonical block file", () => {
  withCopy((root) => {
    editAgent(root, "testing-qa", (t) => replaceOnce(t, "Exit codes are evidence. Do not pipe", "Exit codes are evidence, Do not pipe"));
    const f = assertOne(checkBlocks(root), { kind: "DRIFT" });
    assert.match(f.fix, /\.github\/drift\/blocks\/working-rules\.md/);
  });
});

// ---------- T3: one byte in other blocks ----------

const T3 = [
  {
    name: "loki Trust Boundary",
    agent: "loki",
    section: "Trust Boundary",
    block: "trust-boundary",
    from: "this definition and the orchestrator's brief",
    to: "the definition and the orchestrator's brief",
  },
  {
    name: "reviewer-code Probe Files",
    agent: "reviewer-code",
    section: "Probe Files",
    block: "probe-files",
    from: "write it again in full",
    to: "write it once in full",
  },
  {
    name: "testing-pentester Authorization bullet",
    agent: "testing-pentester",
    section: "Engagement Scope",
    block: "scope-authorization",
    from: "Authorization is given before the engagement",
    to: "Authorisation is given before the engagement",
  },
  {
    name: "testing-red-team Secrets bullet (per-role block)",
    agent: "testing-red-team",
    section: "Engagement Scope",
    block: "scope-network-and-secrets-red-team",
    from: "when probing for exposed secrets",
    to: "when probing for exposes secrets",
  },
];

for (const c of T3) {
  test(`T3: one byte in ${c.name} gives one DRIFT naming agent, section and block`, () => {
    withCopy((root) => {
      editAgent(root, c.agent, (t) => replaceOnce(t, c.from, c.to));
      assertOne(checkBlocks(root), { kind: "DRIFT", agent: c.agent, section: c.section, block: c.block, reason: "line differs" });
    });
  });
}

// ---------- T4: paragraph added to designer Trust Boundary ----------

test("T4: a paragraph added at the end of designer's Trust Boundary gives one DRIFT (unexpected line)", () => {
  withCopy((root) => {
    const tb = blockText("trust-boundary");
    editAgent(root, "designer", (t) => replaceOnce(t, tb, `${tb}\n\nAn extra paragraph that no block file accounts for.`));
    const f = assertOne(checkBlocks(root), {
      kind: "DRIFT",
      agent: "designer",
      section: "Trust Boundary",
      block: null,
      line: 2, // the blank line after the composed text is the first extra line
    });
    assert.match(f.reason, /unexpected line after the end of the composed text/);
  });
});

// ---------- T5: release-manager second paragraph; red-team third paragraph ----------

test("T5: a sentence appended to release-manager's second Trust Boundary paragraph gives one DRIFT", () => {
  withCopy((root) => {
    assert.deepEqual(checkBlocks(root), []); // control
    const second = blockText("trust-boundary-release-manager");
    editAgent(root, "release-manager", (t) => replaceOnce(t, second, `${second} An extra sentence.`));
    assertOne(checkBlocks(root), {
      kind: "DRIFT",
      agent: "release-manager",
      section: "Trust Boundary",
      block: "trust-boundary-release-manager",
      line: 3,
      reason: "line differs",
    });
  });
});

test("T5: a third paragraph at the end of testing-red-team's Trust Boundary (end of file) gives one DRIFT", () => {
  withCopy((root) => {
    editAgent(root, "testing-red-team", (t) => t.replace(/\n+$/, "") + "\n\nA third paragraph.\n");
    const f = assertOne(checkBlocks(root), {
      kind: "DRIFT",
      agent: "testing-red-team",
      section: "Trust Boundary",
      block: null,
      line: 4,
    });
    assert.match(f.reason, /unexpected line after the end of the composed text/);
  });
});

// ---------- T6: two bullets swapped ----------

test("T6: two bullets swapped in testing-pentester's Engagement Scope give one DRIFT at the first swapped line", () => {
  withCopy((root) => {
    const auth = blockText("scope-authorization");
    const net = blockText("scope-network-pentester");
    // The first swapped line is where the authorization bullet sits in the section body today,
    // worked out from the agent file so the test survives a change to the lines above it.
    const lines = read(agentFile(root, "testing-pentester")).split("\n");
    const heading = lines.indexOf("## Engagement Scope");
    let bodyStart = heading + 1;
    while (lines[bodyStart] === "") bodyStart++;
    const expectedLine = lines.indexOf(auth.split("\n")[0], bodyStart) - bodyStart + 1;
    editAgent(root, "testing-pentester", (t) => replaceOnce(t, `${auth}\n${net}`, `${net}\n${auth}`));
    assertOne(checkBlocks(root), {
      kind: "DRIFT",
      agent: "testing-pentester",
      section: "Engagement Scope",
      line: expectedLine,
      reason: "line differs",
    });
  });
});

// ---------- T7: CRLF ----------

test("T7: a copy converted to CRLF (agents and blocks) gives no finding", () => {
  withCopy((root) => {
    const dirs = [path.join(root, "agents"), path.join(root, ".github", "drift", "blocks")];
    for (const d of dirs) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        fs.writeFileSync(p, read(p).replace(/\n/g, "\r\n"));
      }
    }
    // sanity: the conversion really happened
    assert.ok(fs.readFileSync(agentFile(root, "architect"), "utf8").includes("\r\n"));
    assert.deepEqual(checkBlocks(root), []);
  });
});

// ---------- T8: unclassified section ----------

test("T8: '## Working Rules' added to architect (not in the manifest) gives one UNCLASSIFIED", () => {
  withCopy((root) => {
    editAgent(root, "architect", (t) => replaceOnce(t, "## Completion\n", "## Working Rules\n\n- A rule.\n\n## Completion\n"));
    assertOne(checkBlocks(root), { kind: "UNCLASSIFIED", agent: "architect", section: "Working Rules" });
  });
});

// ---------- T9: variants are pinned ----------

test("T9: the shipped manifest's variants are exactly release-manager and writer-technical Working Rules, each with a why", () => {
  const manifest = JSON.parse(read(path.join(REPO, ".github", "drift", "shared-blocks.json")));
  const variants = [];
  for (const s of manifest.sections) {
    for (const [slug, v] of Object.entries(s.agents)) {
      if (!Array.isArray(v)) {
        variants.push({ heading: s.heading, agent: slug });
        assert.equal(typeof v.variant, "string", `${slug}: variant must carry a string why`);
        assert.ok(v.variant.trim().length > 0, `${slug}: why must not be empty`);
      }
    }
  }
  variants.sort((a, b) => a.agent.localeCompare(b.agent));
  assert.deepEqual(variants, [
    { heading: "Working Rules", agent: "release-manager" },
    { heading: "Working Rules", agent: "writer-technical" },
  ]);
});

test("T9: a variant with an empty why gives one BAD-MANIFEST", () => {
  withCopy((root) => {
    editManifest(root, (m) => {
      const wr = m.sections.find((s) => s.heading === "Working Rules");
      wr.agents["release-manager"] = { variant: "" };
    });
    assertOne(checkBlocks(root), { kind: "BAD-MANIFEST", agent: "release-manager", section: "Working Rules" });
  });
});

// ---------- T10: missing and duplicated heading ----------

test("T10: '## Probe Files' removed from reviewer-code gives one MISSING-SECTION", () => {
  withCopy((root) => {
    editAgent(root, "reviewer-code", (t) => replaceOnce(t, "## Probe Files\n\n", ""));
    assertOne(checkBlocks(root), { kind: "MISSING-SECTION", agent: "reviewer-code", section: "Probe Files" });
  });
});

test("T10: '## Probe Files' duplicated in reviewer-code gives one DUPLICATE-SECTION", () => {
  withCopy((root) => {
    editAgent(root, "reviewer-code", (t) => t.replace(/\n+$/, "") + "\n\n## Probe Files\n\nAn extra copy.\n");
    assertOne(checkBlocks(root), { kind: "DUPLICATE-SECTION", agent: "reviewer-code", section: "Probe Files" });
  });
});

// ---------- T11: headings inside a fenced code block ----------

test("T11: '## Trust Boundary' and '## Working Rules' lines inside a fenced block are not section starts", () => {
  withCopy((root) => {
    editAgent(root, "designer", (t) =>
      replaceOnce(t, "## Completion\n", "## Completion\n\n```\n## Trust Boundary\n## Working Rules\n# Title\n```\n"),
    );
    assert.deepEqual(checkBlocks(root), []);
  });
});

// ---------- T12: bad manifest ----------

test("T12: a manifest that names an agent with no file gives one BAD-MANIFEST", () => {
  withCopy((root) => {
    editManifest(root, (m) => {
      m.sections.find((s) => s.heading === "Trust Boundary").agents["ghost-agent"] = ["trust-boundary"];
    });
    assertOne(checkBlocks(root), { kind: "BAD-MANIFEST", agent: "ghost-agent", section: "Trust Boundary" });
  });
});

test("T12: a part that names a block file that does not exist gives a BAD-MANIFEST naming the block", () => {
  withCopy((root) => {
    editManifest(root, (m) => {
      m.sections.find((s) => s.heading === "Trust Boundary").agents["architect"] = ["no-such-block"];
    });
    const bad = checkBlocks(root).filter((f) => f.kind === "BAD-MANIFEST");
    assert.equal(bad.length, 1, `expected 1 BAD-MANIFEST, got ${bad.length}`);
    assert.equal(bad[0].block, "no-such-block");
  });
});

test("T12: a block file that no part uses gives one BAD-MANIFEST", () => {
  withCopy((root) => {
    fs.writeFileSync(path.join(root, ".github", "drift", "blocks", "unused.md"), "Nobody uses this.\n");
    assertOne(checkBlocks(root), { kind: "BAD-MANIFEST", block: "unused" });
  });
});

test("T12: an unknown key in a manifest section gives one BAD-MANIFEST", () => {
  withCopy((root) => {
    editManifest(root, (m) => {
      m.sections[0].bogus = true;
    });
    assertOne(checkBlocks(root), { kind: "BAD-MANIFEST", section: "Trust Boundary" });
  });
});

test("T12: CLI exits 2 when the manifest names an agent with no file", () => {
  withCopy((root) => {
    editManifest(root, (m) => {
      m.sections.find((s) => s.heading === "Trust Boundary").agents["ghost-agent"] = ["trust-boundary"];
    });
    const r = runCli(["--root", root]);
    assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stderr: ${r.stderr}`);
  });
});

test("T12: CLI exits 2 when the manifest is not valid JSON", () => {
  withCopy((root) => {
    fs.writeFileSync(manifestFile(root), "{ not json");
    const r = runCli(["--root", root]);
    assert.equal(r.status, 2, `exit status: expected 2, got ${r.status}; stderr: ${r.stderr}`);
  });
});
