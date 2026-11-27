// Drift check for the shared agent blocks (stage A). Read-only: it never writes a file.
// Stage B adds checkModels and checkSources; they return [] until then.
//
// Normalising: every file read is decoded as UTF-8 and has CRLF replaced by LF. Nothing else.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DRIFT_DIR = [".github", "drift"];
const MANIFEST_REL = ".github/drift/shared-blocks.json";
const BLOCKS_REL = ".github/drift/blocks";

/** Thrown when the check cannot run at all (missing file, JSON that does not parse). CLI exit 2. */
export class CheckError extends Error {}

const lf = (s) => s.replace(/\r\n/g, "\n");

function readText(file, what) {
  try {
    return lf(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new CheckError(`cannot read ${what} (${file}): ${e.message}`);
  }
}

// ---------- sections ----------

/** Lines of the file with, per line, whether it sits inside a fenced code block. */
function scanFences(lines) {
  const inFence = [];
  let open = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence.push(true); // the fence lines themselves belong to the fence
      open = !open;
    } else {
      inFence.push(open);
    }
  }
  return inFence;
}

/** All `## ` headings outside fences: [{ heading, start, end }] with body line range [start+1, end). */
function findSections(text) {
  const lines = text.split("\n");
  const inFence = scanFences(lines);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (!inFence[i] && /^#{1,2} /.test(lines[i])) starts.push(i);
  }
  const sections = [];
  for (let k = 0; k < starts.length; k++) {
    const i = starts[k];
    if (!lines[i].startsWith("## ")) continue;
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    let a = i + 1;
    let b = end;
    while (a < b && lines[a] === "") a++;
    while (b > a && lines[b - 1] === "") b--;
    sections.push({ heading: lines[i].slice(3), body: lines.slice(a, b) });
  }
  return sections;
}

// ---------- manifest ----------

function loadManifest(root) {
  const file = path.join(root, ...DRIFT_DIR, "shared-blocks.json");
  const raw = readText(file, "the manifest");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new CheckError(`the manifest is not valid JSON (${MANIFEST_REL}): ${e.message}`);
  }
}

function listBlockIds(root) {
  const dir = path.join(root, ...DRIFT_DIR, "blocks");
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    throw new CheckError(`cannot read the blocks folder (${dir}): ${e.message}`);
  }
  return names.filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3)).sort();
}

function listAgents(root) {
  const dir = path.join(root, "agents");
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    throw new CheckError(`cannot read the agents folder (${dir}): ${e.message}`);
  }
  return names.filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3)).sort();
}

// ---------- messages ----------

function snippet(line, col) {
  const from = Math.max(0, col - 1 - 20);
  const to = Math.min(line.length, col - 1 + 40);
  return `${from > 0 ? "..." : ""}${line.slice(from, to)}${to < line.length ? "..." : ""}`;
}

function usersOf(manifest, heading, blockId) {
  const sec = manifest.sections.find((s) => s.heading === heading);
  if (!sec) return [];
  return Object.entries(sec.agents)
    .filter(([, v]) => Array.isArray(v) && v.includes(blockId))
    .map(([slug]) => slug);
}

function fixForBlock(manifest, heading, blockId) {
  const users = blockId ? usersOf(manifest, heading, blockId) : [];
  const file = `${BLOCKS_REL}/${blockId}.md`;
  return (
    `the canonical text is ${file}.\n` +
    `       Not intended: restore this section from that file.\n` +
    `       Intended: change that file, then paste it into every agent that uses it` +
    `${users.length ? ` (${users.join(", ")})` : ""}.\n` +
    `       A change under .github/drift/ is CI config and goes to the owner for review.`
  );
}

function bad(message, extra = {}) {
  const f = { kind: "BAD-MANIFEST", agent: null, section: null, block: null, ...extra };
  f.fix = extra.fix ?? `fix ${MANIFEST_REL} (or the files it names), then run the check again.`;
  f.message = `BAD-MANIFEST ${message}\n  fix: ${f.fix}`;
  return f;
}

// ---------- the check ----------

function analyze(root) {
  const manifest = loadManifest(root);
  const findings = [];
  const stats = { composed: 0, variants: 0, agents: 0 };

  // Manifest shape.
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.sections)) {
    findings.push(bad(`${MANIFEST_REL}: top level must be an object with a "sections" array`));
    return { findings, stats };
  }
  const shapeOk = [];
  for (const s of manifest.sections) {
    const name = s && typeof s.heading === "string" ? s.heading : null;
    const where = `section ${JSON.stringify(name)}`;
    let ok = true;
    if (!s || typeof s !== "object" || Array.isArray(s) || name === null || name === "") {
      findings.push(bad(`a manifest section has no "heading" string`));
      ok = false;
    } else {
      const unknown = Object.keys(s).filter((k) => k !== "heading" && k !== "agents");
      if (unknown.length) {
        findings.push(bad(`${where}: unknown key ${unknown.map((k) => JSON.stringify(k)).join(", ")}`, { section: name }));
        ok = false;
      }
      if (!s.agents || typeof s.agents !== "object" || Array.isArray(s.agents)) {
        findings.push(bad(`${where}: "agents" must be an object`, { section: name }));
        ok = false;
      }
    }
    shapeOk.push(ok);
  }

  const blockIds = listBlockIds(root);
  const blockSet = new Set(blockIds);
  const agentSlugs = listAgents(root);
  const agentSet = new Set(agentSlugs);
  stats.agents = agentSlugs.length;
  const used = new Set();
  const blockCache = new Map();
  const blockLinesOf = (id) => {
    if (!blockCache.has(id)) {
      const text = readText(path.join(root, ...DRIFT_DIR, "blocks", `${id}.md`), `block ${id}`);
      blockCache.set(id, text.replace(/\n+$/, "").split("\n"));
    }
    return blockCache.get(id);
  };

  const agentSections = new Map(); // slug -> [{heading, body}]
  const sectionsOf = (slug) => {
    if (!agentSections.has(slug)) {
      agentSections.set(slug, findSections(readText(path.join(root, "agents", `${slug}.md`), `agent ${slug}`)));
    }
    return agentSections.get(slug);
  };

  // A section with a bad shape must not make its blocks look unused.
  for (const s of manifest.sections) {
    if (!s || typeof s.agents !== "object" || !s.agents) continue;
    for (const spec of Object.values(s.agents)) {
      if (Array.isArray(spec)) for (const p of spec) if (typeof p === "string" && p !== "") used.add(p);
    }
  }

  const checkedHeadings = new Set();
  manifest.sections.forEach((s, idx) => {
    if (shapeOk[idx]) checkedHeadings.add(s.heading);
  });

  manifest.sections.forEach((sec, idx) => {
    if (!shapeOk[idx]) return;
    const heading = sec.heading;

    for (const [slug, spec] of Object.entries(sec.agents)) {
      // Count block usage first so one bad entry does not also make its blocks look unused.
      if (Array.isArray(spec)) for (const p of spec) if (typeof p === "string" && p !== "") used.add(p);

      let entryOk = true;
      if (!agentSet.has(slug)) {
        findings.push(bad(`section ${JSON.stringify(heading)} lists agent ${slug}, but agents/${slug}.md does not exist`, { agent: slug, section: heading }));
        continue;
      }
      if (Array.isArray(spec)) {
        for (const p of spec) {
          if (typeof p !== "string") {
            findings.push(bad(`section ${JSON.stringify(heading)}, agent ${slug}: a part is not a string`, { agent: slug, section: heading }));
            entryOk = false;
          } else if (p !== "" && !blockSet.has(p)) {
            findings.push(bad(`section ${JSON.stringify(heading)}, agent ${slug}: block ${p} has no file ${BLOCKS_REL}/${p}.md`, { agent: slug, section: heading, block: p }));
            entryOk = false;
          }
        }
        if (spec.length === 0) {
          findings.push(bad(`section ${JSON.stringify(heading)}, agent ${slug}: the parts list is empty`, { agent: slug, section: heading }));
          entryOk = false;
        }
      } else if (spec && typeof spec === "object") {
        const keys = Object.keys(spec);
        if (keys.length !== 1 || keys[0] !== "variant") {
          findings.push(bad(`section ${JSON.stringify(heading)}, agent ${slug}: a variant entry holds only "variant" (got ${keys.join(", ") || "nothing"})`, { agent: slug, section: heading }));
          entryOk = false;
        } else if (typeof spec.variant !== "string" || spec.variant.trim() === "") {
          findings.push(bad(`section ${JSON.stringify(heading)}, agent ${slug}: a variant needs a non-empty reason ("why")`, { agent: slug, section: heading }));
          entryOk = false;
        }
      } else {
        findings.push(bad(`section ${JSON.stringify(heading)}, agent ${slug}: the entry is neither a parts list nor a variant`, { agent: slug, section: heading }));
        entryOk = false;
      }
      if (!entryOk) continue;

      // Rule 1: the heading exactly once.
      const matches = sectionsOf(slug).filter((x) => x.heading === heading);
      if (matches.length === 0) {
        findings.push({
          kind: "MISSING-SECTION", agent: slug, section: heading, block: null,
          fix: `restore the "## ${heading}" section in agents/${slug}.md, or remove the entry from ${MANIFEST_REL}.`,
          message: `MISSING-SECTION agent=agents/${slug}.md section="## ${heading}"\n  expected: exactly one "## ${heading}" heading\n  actual:   none\n  fix: restore the "## ${heading}" section in agents/${slug}.md, or remove the entry from ${MANIFEST_REL}.`,
        });
        continue;
      }
      if (matches.length > 1) {
        findings.push({
          kind: "DUPLICATE-SECTION", agent: slug, section: heading, block: null,
          fix: `keep one "## ${heading}" section in agents/${slug}.md.`,
          message: `DUPLICATE-SECTION agent=agents/${slug}.md section="## ${heading}"\n  expected: exactly one "## ${heading}" heading\n  actual:   ${matches.length}\n  fix: keep one "## ${heading}" section in agents/${slug}.md.`,
        });
        continue;
      }

      if (!Array.isArray(spec)) {
        stats.variants++;
        continue;
      }
      stats.composed++;

      // Compose the expected body and remember which block each line came from.
      const expected = [];
      const owner = [];
      for (const p of spec) {
        if (p === "") {
          expected.push("");
          owner.push(null);
        } else {
          blockLinesOf(p).forEach((line, i) => {
            expected.push(line);
            owner.push({ id: p, line: i + 1 });
          });
        }
      }
      const actual = matches[0].body;
      const n = Math.min(expected.length, actual.length);
      let found = null;
      for (let i = 0; i < n; i++) {
        if (expected[i] === actual[i]) continue;
        let c = 0;
        while (c < expected[i].length && c < actual[i].length && expected[i][c] === actual[i][c]) c++;
        const column = c + 1;
        const o = owner[i];
        const blockId = o ? o.id : null;
        const where = o ? `section line ${i + 1}, column ${column} (block ${o.id}, line ${o.line})` : `section line ${i + 1}, column ${column} (blank line between blocks)`;
        const fix = o ? fixForBlock(manifest, heading, o.id) : `the blank line comes from the manifest in ${MANIFEST_REL}; restore it in agents/${slug}.md.`;
        found = {
          kind: "DRIFT", agent: slug, section: heading, block: blockId,
          line: i + 1, column, blockLine: o ? o.line : null,
          expected: expected[i], actual: actual[i], reason: "line differs", fix,
          message:
            `DRIFT agent=agents/${slug}.md section="## ${heading}"\n` +
            `  first difference: ${where}\n` +
            `  expected: ${snippet(expected[i], column)}\n` +
            `  actual:   ${snippet(actual[i], column)}\n` +
            `  fix: ${fix}`,
        };
        break;
      }
      if (!found && actual.length > expected.length) {
        const i = expected.length;
        const reason = "unexpected line after the end of the composed text";
        const fix = `remove the extra text from agents/${slug}.md, or add it to a block file under ${BLOCKS_REL}/ and list that block for this agent in ${MANIFEST_REL}.\n       A change under .github/drift/ is CI config and goes to the owner for review.`;
        found = {
          kind: "DRIFT", agent: slug, section: heading, block: null, line: i + 1, reason, fix,
          expected: null, actual: actual[i],
          message:
            `DRIFT agent=agents/${slug}.md section="## ${heading}"\n` +
            `  first difference: section line ${i + 1}: ${reason}\n` +
            `  expected: (end of section)\n` +
            `  actual:   ${snippet(actual[i], 1)}\n` +
            `  fix: ${fix}`,
        };
      }
      if (!found && actual.length < expected.length) {
        const i = actual.length;
        const o = owner[i];
        const reason = o ? `section ends before block ${o.id} line ${o.line}` : "section ends before the blank line between blocks";
        const blockId = o ? o.id : null;
        const fix = o ? fixForBlock(manifest, heading, o.id) : `restore the missing text in agents/${slug}.md.`;
        found = {
          kind: "DRIFT", agent: slug, section: heading, block: blockId, line: i + 1, reason, fix,
          expected: expected[i], actual: null,
          message:
            `DRIFT agent=agents/${slug}.md section="## ${heading}"\n` +
            `  first difference: section line ${i + 1}: ${reason}\n` +
            `  expected: ${snippet(expected[i], 1)}\n` +
            `  actual:   (end of section)\n` +
            `  fix: ${fix}`,
        };
      }
      if (found) findings.push(found);
    }
  });

  // Rule 2: every agent with a checked heading must be listed under it.
  for (const slug of agentSlugs) {
    for (const heading of checkedHeadings) {
      const sec = manifest.sections.find((s) => s.heading === heading);
      if (Object.prototype.hasOwnProperty.call(sec.agents, slug)) continue;
      if (sectionsOf(slug).some((x) => x.heading === heading)) {
        findings.push({
          kind: "UNCLASSIFIED", agent: slug, section: heading, block: null,
          fix: `list agents/${slug}.md under "${heading}" in ${MANIFEST_REL}: either with the block parts it should carry, or as a variant with a reason.`,
          message:
            `UNCLASSIFIED agent=agents/${slug}.md section="## ${heading}"\n` +
            `  expected: the agent listed under "${heading}" in ${MANIFEST_REL}\n` +
            `  actual:   the agent has the heading but is not listed\n` +
            `  fix: list agents/${slug}.md under "${heading}" in ${MANIFEST_REL}: either with the block parts it should carry, or as a variant with a reason.`,
        });
      }
    }
  }

  // Rule 3 (rest): every block file is used by at least one part.
  for (const id of blockIds) {
    if (!used.has(id)) {
      findings.push(bad(`block file ${BLOCKS_REL}/${id}.md is not used by any part`, {
        block: id,
        fix: `use block ${id} in ${MANIFEST_REL}, or delete ${BLOCKS_REL}/${id}.md.`,
      }));
    }
  }

  return { findings, stats };
}

export function checkBlocks(root) {
  return analyze(root).findings;
}

export function checkModels(root) {
  return [];
}

export function checkSources(root) {
  return [];
}

// ---------- CLI ----------

function main(argv) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const i = argv.indexOf("--root");
  if (i !== -1 && argv[i + 1]) root = path.resolve(argv[i + 1]);

  let result;
  try {
    result = analyze(root);
    result.findings.push(...checkModels(root), ...checkSources(root));
  } catch (e) {
    if (e instanceof CheckError) {
      console.error(`drift-check: cannot run: ${e.message}`);
      return 2;
    }
    throw e;
  }
  const { findings, stats } = result;
  for (const f of findings) console.error(f.message + "\n");
  console.log(
    `drift-check: ${findings.length} findings (${stats.composed} composed sections, ${stats.variants} variant sections, ${stats.agents} agents)`,
  );
  if (findings.some((f) => f.kind === "BAD-MANIFEST")) return 2;
  return findings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
