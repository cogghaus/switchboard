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

// ---------- model checks (M1 to M9) and plugin sources (P1) ----------

const MATRIX_JSON = "skills/model-routing/model-matrix.json";
const MATRIX_MD = "skills/model-routing/model-matrix.md";
const DOCS_AGENTS = "docs/agents.md";
const SITE = "site/index.html";
const ROSTER = "crew/hooks/roster.ts";
const MODEL_FIX =
  `${MATRIX_JSON} is the source. If the matrix is right, change this place to match it.\n` +
  `       If the pin itself should change, that is the owner's decision: change the JSON first,\n` +
  `       then the agent file, model-matrix.md, docs/agents.md, site/index.html and crew/hooks/roster.ts.`;

/** Model ID to display form: claude-sonnet-5-5 -> "Sonnet 5.5", claude-opus-6 -> "Opus 6", else null. */
function displayOf(id) {
  const m = /^claude-(opus|sonnet|haiku|fable)-(\d{1,2})(?:-(\d{1,2}))?$/.exec(id);
  if (!m) return null;
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] !== undefined ? "." + m[3] : ""}`;
}

function modelFinding(check, o) {
  const f = { kind: "MODEL", check, ...o };
  f.fix = o.fix ?? MODEL_FIX;
  const head = `MODEL check=${check}${o.agent ? ` agent=${o.agent}` : ""} where=${o.where}`;
  f.message =
    `${head}\n` +
    (o.expected !== undefined ? `  expected: ${o.expected}\n` : "") +
    (o.actual !== undefined ? `  actual:   ${o.actual}\n` : "") +
    `  fix: ${f.fix}`;
  return f;
}

function unrenderable(check, agent, id, where) {
  const fix = "extend the display rule and its test in drift-check.mjs before using this ID";
  return {
    kind: "UNRENDERABLE", check, agent, id, where, fix,
    message: `UNRENDERABLE check=${check} agent=${agent} where=${where}\n  the display form of ${id} cannot be derived\n  fix: ${fix}`,
  };
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function readJson(root, rel) {
  const raw = readText(path.join(root, ...rel.split("/")), rel);
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new CheckError(`${rel} is not valid JSON: ${e.message}`);
  }
}

const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/** The first table at or after line index `from` (stops at the next "## " heading): { header, rows:[{cells, line}] } or null. */
function tableFrom(lines, from) {
  let i = from;
  while (i < lines.length && !lines[i].startsWith("|")) {
    if (i > from && lines[i].startsWith("## ")) return null;
    i++;
  }
  if (i >= lines.length) return null;
  const header = splitRow(lines[i]).map((h) => h.toLowerCase());
  const rows = [];
  for (i++; i < lines.length && lines[i].startsWith("|"); i++) {
    const cells = splitRow(lines[i]);
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    const o = {};
    header.forEach((h, k) => (o[h] = cells[k] ?? ""));
    rows.push({ cells: o, line: i + 1 });
  }
  return { header, rows };
}

function* walk(dir) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  ents.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const rel = (root, p) => path.relative(root, p).split(path.sep).join("/");

export function checkModels(root) {
  const matrix = readJson(root, MATRIX_JSON);
  const out = [];
  const jsonText = readText(path.join(root, ...MATRIX_JSON.split("/")), MATRIX_JSON);
  const jsonLine = (needle) => {
    const i = jsonText.indexOf(needle);
    return i === -1 ? MATRIX_JSON : `${MATRIX_JSON}:${lineAt(jsonText, i)}`;
  };

  // Row shapes are validated up front so a malformed matrix is a clean exit 2, not a stack trace.
  const need = (cond, what) => {
    if (!cond) throw new CheckError(`${MATRIX_JSON}: ${what}`);
  };
  need(Array.isArray(matrix.agent_defaults), '"agent_defaults" must be an array');
  need(Array.isArray(matrix.task_tier_rules), '"task_tier_rules" must be an array');
  const isStr = (v) => typeof v === "string";
  matrix.agent_defaults.forEach((a, i) => {
    need(a && typeof a === "object", `agent_defaults[${i}] must be an object`);
    for (const k of ["agent_id", "emoji", "display_name", "default_model", "default_alias", "frontmatter"]) {
      need(isStr(a[k]), `agent_defaults[${i}] (${isStr(a.agent_id) ? a.agent_id : "no agent_id"}): "${k}" must be a string`);
    }
  });
  matrix.task_tier_rules.forEach((t, i) => {
    need(t && typeof t === "object", `task_tier_rules[${i}] must be an object`);
    for (const k of ["task_tier", "default_model", "agent_tool_alias"]) {
      need(isStr(t[k]), `task_tier_rules[${i}] (${isStr(t.task_tier) ? t.task_tier : "no task_tier"}): "${k}" must be a string`);
    }
  });
  need(matrix.config && typeof matrix.config === "object" && isStr(matrix.config.trigger_model), '"config.trigger_model" must be a string');

  const agents = matrix.agent_defaults;
  const tiers = matrix.task_tier_rules;
  const byId = new Map(agents.map((a) => [a.agent_id, a]));

  // Alias map: alias -> model, one model per alias (M3).
  const aliasMap = new Map();
  for (const t of tiers) {
    if (!t.agent_tool_alias || t.agent_tool_alias === "n/a") continue;
    if (aliasMap.has(t.agent_tool_alias) && aliasMap.get(t.agent_tool_alias) !== t.default_model) {
      out.push(modelFinding("M3", {
        where: jsonLine(`"task_tier": ${JSON.stringify(t.task_tier)}`),
        expected: `alias ${t.agent_tool_alias} maps to ${aliasMap.get(t.agent_tool_alias)}`,
        actual: `${t.default_model} (tier ${t.task_tier})`,
      }));
    } else {
      aliasMap.set(t.agent_tool_alias, t.default_model);
    }
  }

  // M1: agent files vs matrix rows.
  const files = listAgents(root);
  const fileSet = new Set(files);
  for (const slug of files) {
    if (!byId.has(slug)) {
      out.push(modelFinding("M1", { agent: slug, where: `agents/${slug}.md`, expected: `a row for ${slug} in agent_defaults of ${MATRIX_JSON}`, actual: "no row" }));
    }
  }
  for (const a of agents) {
    if (!fileSet.has(a.agent_id)) {
      out.push(modelFinding("M1", { agent: a.agent_id, where: jsonLine(`"agent_id": "${a.agent_id}"`), expected: `agents/${a.agent_id}.md`, actual: "no such file" }));
    }
  }

  // M3: each matrix row is consistent with itself.
  for (const a of agents) {
    const where = jsonLine(`"agent_id": "${a.agent_id}"`);
    if (typeof a.frontmatter === "string" && a.frontmatter.startsWith("claude-")) {
      if (a.default_model !== a.frontmatter) {
        out.push(modelFinding("M3", { agent: a.agent_id, where, expected: `default_model ${a.frontmatter} (equal to frontmatter)`, actual: String(a.default_model) }));
      }
      if (a.default_alias !== "n/a") {
        out.push(modelFinding("M3", { agent: a.agent_id, where, expected: "default_alias n/a (a full ID is pinned)", actual: String(a.default_alias) }));
      }
    } else {
      if (a.default_alias !== a.frontmatter) {
        out.push(modelFinding("M3", { agent: a.agent_id, where, expected: `default_alias ${a.frontmatter} (equal to frontmatter)`, actual: String(a.default_alias) }));
      }
      if (!aliasMap.has(a.frontmatter)) {
        out.push(modelFinding("M3", { agent: a.agent_id, where, expected: `an alias ${a.frontmatter} in task_tier_rules`, actual: "no tier row maps it" }));
      } else if (a.default_model !== aliasMap.get(a.frontmatter)) {
        out.push(modelFinding("M3", { agent: a.agent_id, where, expected: `default_model ${aliasMap.get(a.frontmatter)} (what ${a.frontmatter} resolves to)`, actual: String(a.default_model) }));
      }
    }
  }

  // M2: the model: line of each agent file.
  for (const a of agents) {
    if (!fileSet.has(a.agent_id)) continue;
    const where0 = `agents/${a.agent_id}.md`;
    const lines = readText(path.join(root, "agents", `${a.agent_id}.md`), where0).split("\n");
    let end = -1;
    if (lines[0] === "---") end = lines.indexOf("---", 1);
    const fm = end === -1 ? [] : lines.slice(1, end);
    const hits = [];
    fm.forEach((l, i) => {
      const m = /^model:\s*(.*?)\s*$/.exec(l);
      if (m) hits.push({ value: m[1], line: i + 2 });
    });
    if (hits.length !== 1) {
      out.push(modelFinding("M2", { agent: a.agent_id, where: where0, expected: `exactly one model: line, ${a.frontmatter}`, actual: `${hits.length} model: lines in the front matter` }));
    } else if (hits[0].value !== a.frontmatter) {
      out.push(modelFinding("M2", { agent: a.agent_id, where: `${where0}:${hits[0].line}`, expected: a.frontmatter, actual: hits[0].value }));
    }
  }

  // M4: model-matrix.md tables.
  {
    const mdText = readText(path.join(root, ...MATRIX_MD.split("/")), MATRIX_MD);
    const mdLines = mdText.split("\n");
    const table = (prefix) => {
      const i = mdLines.findIndex((l) => l.startsWith("## ") && l.slice(3).startsWith(prefix));
      if (i === -1) {
        out.push(modelFinding("M4", { where: MATRIX_MD, expected: `a "## ${prefix}" section with a table`, actual: "section missing" }));
        return null;
      }
      const t = tableFrom(mdLines, i + 1);
      if (!t) {
        out.push(modelFinding("M4", { where: `${MATRIX_MD}:${i + 1}`, expected: `a table under "## ${prefix}"`, actual: "no table" }));
      }
      return t;
    };
    const cmp = (agent, row, col, want) => {
      const got = row.cells[col];
      if (got !== String(want)) {
        out.push(modelFinding("M4", { agent, where: `${MATRIX_MD}:${row.line}`, expected: `${col} = ${want}`, actual: `${col} = ${got}` }));
      }
    };
    const keyed = (t, keyCol, label, wanted) => {
      const seen = new Set();
      for (const r of t.rows) {
        const k = r.cells[keyCol];
        if (!wanted.has(k) || seen.has(k)) {
          out.push(modelFinding("M4", { where: `${MATRIX_MD}:${r.line}`, expected: wanted.has(k) ? `one ${label} row for ${k}` : `a ${label} that exists in ${MATRIX_JSON}`, actual: `${wanted.has(k) ? "a second row for" : "unknown"} ${k}` }));
        }
        seen.add(k);
      }
      for (const k of wanted) {
        if (!seen.has(k)) out.push(modelFinding("M4", { where: MATRIX_MD, expected: `a ${label} row for ${k}`, actual: "row missing" }));
      }
      return seen;
    };

    const pa = table("Per-agent defaults");
    if (pa) {
      keyed(pa, "agent_id", "agent", new Set(agents.map((a) => a.agent_id)));
      for (const a of agents) {
        const row = pa.rows.find((r) => r.cells["agent_id"] === a.agent_id);
        if (!row) continue;
        cmp(a.agent_id, row, "emoji", a.emoji);
        cmp(a.agent_id, row, "display_name", a.display_name);
        cmp(a.agent_id, row, "resolves to", a.default_model);
        cmp(a.agent_id, row, "frontmatter", a.frontmatter);
      }
    }
    const tt = table("Task-tier routing");
    if (tt) {
      keyed(tt, "task_tier", "tier", new Set(tiers.map((t) => t.task_tier)));
      for (const t of tiers) {
        const row = tt.rows.find((r) => r.cells["task_tier"] === t.task_tier);
        if (!row) continue;
        cmp(undefined, row, "default_model", t.default_model);
        cmp(undefined, row, "alias", t.agent_tool_alias);
      }
    }
    const cf = table("Config");
    if (cf) {
      for (const key of ["trigger_model", "version"]) {
        const row = cf.rows.find((r) => r.cells["key"] === key);
        if (!row) out.push(modelFinding("M4", { where: MATRIX_MD, expected: `a Config row for ${key}`, actual: "row missing" }));
        else cmp(undefined, row, "value", matrix.config?.[key] ?? matrix[key]);
      }
    }
    const al = table("Aliases");
    if (al) {
      keyed(al, "alias", "alias", new Set(aliasMap.keys()));
      for (const [alias, model] of aliasMap) {
        const row = al.rows.find((r) => r.cells["alias"] === alias);
        if (row) cmp(undefined, row, "current model", model);
      }
    }
  }

  // Display forms.
  const display = (id) => displayOf(id);
  const NAME_RE = /\b(Opus|Sonnet|Haiku|Fable)(?: |&nbsp;)(\d+(?:\.\d+)?)/g;

  // M5: docs/agents.md reference table.
  {
    const rel5 = DOCS_AGENTS;
    const lines = readText(path.join(root, ...rel5.split("/")), rel5).split("\n");
    let t = null;
    for (let i = 0; i < lines.length && !t; i++) {
      if (!lines[i].startsWith("|")) continue;
      const cand = tableFrom(lines, i);
      if (cand && cand.header.includes("slug") && cand.header.includes("default model")) t = cand;
      else while (i + 1 < lines.length && lines[i + 1].startsWith("|")) i++;
    }
    if (!t) {
      out.push(modelFinding("M5", { where: rel5, expected: 'a table with "slug" and "Default model" columns', actual: "none found" }));
    } else {
      const seen = new Map();
      for (const r of t.rows) {
        const slug = /`([^`]+)`/.exec(r.cells["slug"])?.[1];
        if (!slug) continue;
        const a = byId.get(slug);
        const where = `${rel5}:${r.line}`;
        if (!a) {
          out.push(modelFinding("M5", { agent: slug, where, expected: `a slug that exists in ${MATRIX_JSON}`, actual: slug }));
          continue;
        }
        if (seen.has(slug)) {
          out.push(modelFinding("M5", { agent: slug, where, expected: "one row per agent", actual: `a second row for ${slug}` }));
          continue;
        }
        seen.set(slug, true);
        const cell = r.cells["default model"];
        const span = /`([^`]+)`/.exec(cell)?.[1];
        if (span !== a.frontmatter) {
          out.push(modelFinding("M5", { agent: slug, where, expected: a.frontmatter, actual: span ?? "(no code span)" }));
        }
        const names = [...cell.matchAll(NAME_RE)].map((m) => `${m[1]} ${m[2]}`);
        if (names.length) {
          const want = display(a.default_model);
          if (want === null) out.push(unrenderable("M5", slug, a.default_model, where));
          else for (const n of names) if (n !== want) out.push(modelFinding("M5", { agent: slug, where, expected: want, actual: n }));
        }
      }
      for (const a of agents) {
        if (!seen.has(a.agent_id)) out.push(modelFinding("M5", { agent: a.agent_id, where: rel5, expected: `a row for ${a.agent_id}`, actual: "row missing" }));
      }
    }
  }

  // M6: site/index.html agent lines.
  {
    const html = readText(path.join(root, ...SITE.split("/")), SITE);
    const classOf = (name) => new RegExp(`<(\\w+)\\b[^>]*\\bclass="(?:[^"]*\\s)?${name}(?:\\s[^"]*)?"[^>]*>([\\s\\S]*?)</\\1>`);
    const strip = (s) => s.replace(/<[^>]*>/g, "");
    const norm = (s) => strip(s).replace(/&nbsp;| /g, " ").replace(/\s+/g, " ").trim();
    const seen = new Map();
    for (const m of html.matchAll(/<li\b[\s\S]*?<\/li>/g)) {
      const role = classOf("role").exec(m[0]);
      const model = classOf("model").exec(m[0]);
      if (!role || !model) continue;
      const where = `${SITE}:${lineAt(html, m.index)}`;
      const roleText = norm(role[2]);
      const hit = agents.filter((a) => roleText.includes(a.display_name));
      if (hit.length !== 1) {
        out.push(modelFinding("M6", { where, expected: "a role text holding exactly one agent display name", actual: roleText }));
        continue;
      }
      const a = hit[0];
      if (seen.has(a.agent_id)) {
        out.push(modelFinding("M6", { agent: a.agent_id, where, expected: "one line per agent", actual: `a second line for ${a.display_name}` }));
        continue;
      }
      seen.set(a.agent_id, true);
      const text = norm(model[2]).toLowerCase();
      if (a.frontmatter.startsWith("claude-")) {
        if (text === a.frontmatter.toLowerCase()) continue;
        const d = display(a.default_model);
        if (d === null) {
          out.push(unrenderable("M6", a.agent_id, a.default_model, where));
        } else if (text !== d.toLowerCase()) {
          out.push(modelFinding("M6", { agent: a.agent_id, where, expected: d.toLowerCase(), actual: text }));
        }
      } else if (text !== a.frontmatter.toLowerCase()) {
        out.push(modelFinding("M6", { agent: a.agent_id, where, expected: a.frontmatter, actual: text }));
      }
    }
    for (const a of agents) {
      if (!seen.has(a.agent_id)) out.push(modelFinding("M6", { agent: a.agent_id, where: SITE, expected: `a line for ${a.display_name}`, actual: "line missing" }));
    }
  }

  // M7: crew PINS.
  {
    const src = readText(path.join(root, ...ROSTER.split("/")), ROSTER);
    const decl = /export const PINS\b[^=]*=\s*\{([\s\S]*?)\n\}/.exec(src);
    const want = new Map(agents.filter((a) => a.frontmatter.startsWith("claude-")).map((a) => [a.agent_id, a.frontmatter]));
    if (!decl) {
      out.push(modelFinding("M7", { where: ROSTER, expected: "an exported PINS object", actual: "not found" }));
    } else {
      const base = lineAt(src, decl.index);
      const have = new Map();
      // One entry per line: key quoted ('', "", ``) or a bare identifier, value quoted, optional comma and
      // trailing // comment. Blank lines and // comment lines are ignored. Any other line fails closed.
      const ENTRY = /^(?:'([^']+)'|"([^"]+)"|`([^`]+)`|([A-Za-z_$][\w$]*))\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*,?\s*(?:\/\/.*)?$/;
      const bodyStart = decl.index + decl[0].indexOf(decl[1]);
      let offset = 0;
      for (const raw of decl[1].split("\n")) {
        const line = lineAt(src, bodyStart + offset);
        offset += raw.length + 1;
        const t = raw.trim();
        if (t === "" || t.startsWith("//")) continue;
        const m = ENTRY.exec(t);
        if (!m) {
          out.push(modelFinding("M7", { where: `${ROSTER}:${line}`, expected: "an entry like 'slug': 'claude-model-id',", actual: t, fix: `${ROSTER}: PINS may hold only blank lines, // comments and 'slug': 'model-id' entries, so the check can read it. Rewrite the line, or extend the reader in drift-check.mjs.` }));
          continue;
        }
        have.set(m[1] ?? m[2] ?? m[3] ?? m[4], { value: m[5] ?? m[6] ?? m[7], line });
      }
      for (const [slug, id] of want) {
        const h = have.get(slug);
        if (!h) out.push(modelFinding("M7", { agent: slug, where: `${ROSTER}:${base}`, expected: id, actual: "no entry" }));
        else if (h.value !== id) out.push(modelFinding("M7", { agent: slug, where: `${ROSTER}:${h.line}`, expected: id, actual: h.value }));
      }
      for (const [slug, h] of have) {
        if (!want.has(slug)) out.push(modelFinding("M7", { agent: slug, where: `${ROSTER}:${h.line}`, expected: "no entry (not a full-ID agent)", actual: h.value }));
      }
    }
  }

  // M8: no unknown model in prose.
  {
    const ids = new Set([matrix.config?.trigger_model]);
    for (const t of tiers) ids.add(t.default_model);
    for (const a of agents) {
      ids.add(a.default_model);
      if (a.frontmatter?.startsWith("claude-")) ids.add(a.frontmatter);
    }
    ids.delete(undefined);
    const names = new Set([...ids].map(display).filter(Boolean));
    const targets = [path.join(root, "README.md"), path.join(root, "site", "index.html"), path.join(root, "crew", "README.md")];
    for (const dir of ["docs", "agents", "skills"]) {
      for (const p of walk(path.join(root, dir))) if (p.endsWith(".md")) targets.push(p);
    }
    for (const p of targets) {
      const r = rel(root, p);
      if (r === MATRIX_MD || !fs.existsSync(p)) continue;
      const text = readText(p, r);
      text.split("\n").forEach((line, i) => {
        const where = `${r}:${i + 1}`;
        for (const m of line.matchAll(/claude-(?:opus|sonnet|haiku|fable)[A-Za-z0-9.-]*/g)) {
          const tok = m[0].replace(/[.-]+$/, "");
          if (!ids.has(tok)) out.push(modelFinding("M8", { where, actual: tok, fix: `${tok} is not a model the matrix uses (${MATRIX_JSON}). Remove it, or change the matrix first if the pin moved.` }));
        }
        for (const m of line.matchAll(NAME_RE)) {
          const name = `${m[1]} ${m[2]}`;
          if (!names.has(name)) out.push(modelFinding("M8", { where, actual: name, fix: `${name} is not a model the matrix uses (${MATRIX_JSON}). Remove it, or change the matrix first if the pin moved.` }));
        }
      });
    }
  }

  // M9: no theme.json at the repo root.
  if (fs.existsSync(path.join(root, "theme.json"))) {
    out.push(modelFinding("M9", {
      where: "theme.json", expected: "no theme.json (the repo ships the default roster)", actual: "theme.json exists",
      fix: "remove theme.json from the repo; a themed roster belongs in a user's own install.",
    }));
  }

  return out;
}

export function checkSources(root) {
  const file = ".claude-plugin/marketplace.json";
  const market = readJson(root, file);
  const out = [];
  for (const p of market.plugins ?? []) {
    if (typeof p.source !== "string" || !p.source.startsWith(".")) continue;
    const where = path.posix.join(path.posix.normalize(p.source), ".claude-plugin", "plugin.json");
    if (!fs.existsSync(path.join(root, ...where.split("/")))) {
      const fix = `make source ${JSON.stringify(p.source)} of plugin ${p.name} in ${file} name a folder that holds .claude-plugin/plugin.json.`;
      out.push({
        kind: "SOURCE", check: "P1", plugin: p.name, where, fix,
        message: `SOURCE check=P1 plugin=${p.name} where=${where}\n  expected: the file exists\n  actual:   missing\n  fix: ${fix}`,
      });
    }
  }
  return out;
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
    `drift-check: ${findings.length} findings (${stats.composed} composed sections, ${stats.variants} variant sections, ${stats.agents} agents, 10 model and source checks)`,
  );
  if (findings.some((f) => f.kind === "BAD-MANIFEST")) return 2;
  return findings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
