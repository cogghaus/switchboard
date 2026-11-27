// Validate gate: runs `claude plugin validate <dir> --json` for every plugin in the repo and fails on
// any error, any warning the allow-list does not name, any allow entry whose count is off, and (root
// target) any agent or skill the validator does not report. Read-only.
//
//   node .github/drift/validate-gate.mjs [<dir>...]     default: "." and the other local marketplace sources
//
// Exit 0: pass. Exit 1: at least one finding. Exit 2: the gate could not run (claude missing, a file
// it needs is unreadable).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const slash = (s) => String(s).replace(/\\/g, "/");

/** The plugin directory of a report: the manifest file's path without `.claude-plugin/<name>.json`. */
function pluginDir(report) {
  const f = slash(report?.manifest?.file ?? report?.target ?? "");
  const m = /^(.*?)\/?\.claude-plugin\/[^/]+\.json$/.exec(f);
  if (m) return m[1];
  const i = f.lastIndexOf("/");
  return i === -1 ? "" : f.slice(0, i);
}

function relativeTo(dir, file) {
  const f = slash(file);
  return dir !== "" && f.startsWith(dir + "/") ? f.slice(dir.length + 1) : f;
}

/** Entries (manifest and contents) of a report as { file, errors, warnings }, file relative to the plugin dir. */
function entries(report) {
  const dir = pluginDir(report);
  const list = [];
  if (report?.manifest) list.push({ file: relativeTo(dir, report.manifest.file ?? ""), e: report.manifest });
  for (const c of report?.contents ?? []) list.push({ file: relativeTo(dir, c.file ?? ""), e: c });
  return list;
}

/** Distinct warnings, once per (file, path, message). */
export function collectWarnings(report) {
  const seen = new Map();
  for (const { file, e } of entries(report)) {
    for (const w of e.warnings ?? []) {
      const key = JSON.stringify([file, w.path ?? "", w.message ?? ""]);
      if (!seen.has(key)) seen.set(key, { file, path: w.path ?? "", message: w.message ?? "" });
    }
  }
  return [...seen.values()];
}

/** Each distinct warning with the index of the allow entry (of this target) that matches it, or -1. */
export function classifyWarnings(report, allowList, target) {
  const mine = allowList.map((a, i) => ({ a, i })).filter(({ a }) => a.target === target);
  return collectWarnings(report).map((w) => {
    const hit = mine.find(({ a }) => a.file === w.file && w.message.includes(a.contains));
    return { ...w, allowIndex: hit ? hit.i : -1 };
  });
}

const sameSet = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  return {
    missing: [...B].filter((x) => !A.has(x)).sort(),
    extra: [...A].filter((x) => !B.has(x)).sort(),
  };
};

/**
 * @param {object} report parsed `claude plugin validate --json` output
 * @param {object[]} allowList entries from validate-allow.json
 * @param {string} target the validated target ("." or "crew")
 * @param {{agents: string[], skills: string[]}} expected coverage expectations for the root target
 * @returns {object[]} findings; [] means the gate passes
 */
export function gateReport(report, allowList, target, expected) {
  const out = [];
  const gate = (rule, message, extra = {}) => out.push({ kind: "GATE", rule, target, ...extra, message: `GATE ${rule} target=${target}: ${message}` });

  if (!report || typeof report !== "object" || report.success !== true) {
    gate("FAILED", "the validator reported success: false (or no usable report)");
  }

  for (const { file, e } of entries(report)) {
    for (const err of e.errors ?? []) {
      gate("ERROR", `${file}: ${err.message}${err.path ? ` (${err.path})` : ""}`, { file, text: err.message, path: err.path });
    }
  }

  const mine = allowList.map((a, i) => ({ a, i })).filter(({ a }) => a.target === target);
  const counts = new Map();
  for (const w of classifyWarnings(report, allowList, target)) {
    if (w.allowIndex === -1) {
      gate("NEW-WARNING", `${w.file}: ${w.message}${w.path ? ` (${w.path})` : ""}. Fix the cause; or, if it is accepted, add an entry with a reason to .github/drift/validate-allow.json (CI config, owner review).`, { file: w.file, path: w.path, text: w.message });
    } else {
      counts.set(w.allowIndex, (counts.get(w.allowIndex) ?? 0) + 1);
    }
  }
  for (const { a, i } of mine) {
    const matched = counts.get(i) ?? 0;
    if (matched === 0) {
      gate("UNUSED-ALLOW", `the allow entry for ${a.file} containing "${a.contains}" matched nothing; remove it from .github/drift/validate-allow.json`, { file: a.file, contains: a.contains });
    } else if (matched !== a.count) {
      const hint = matched < a.count ? " The warning count went down: lower the count in .github/drift/validate-allow.json." : " A new warning of an allowed kind appeared: fix it, do not raise the count without owner review.";
      gate("COUNT-MISMATCH", `${a.file} containing "${a.contains}": matched ${matched}, allowed ${a.count}.${hint}`, { matched, allowed: a.count, file: a.file, contains: a.contains });
    }
  }

  if (target === "." && expected) {
    if (!report?.provides) {
      if (report?.success === true) {
        gate("COVERAGE", "the report has no provides list, so agent and skill coverage cannot be checked", { what: "provides", missing: [], extra: [] });
      }
    } else {
      for (const what of ["agents", "skills"]) {
        const { missing, extra } = sameSet(report.provides[what] ?? [], expected[what] ?? []);
        if (missing.length || extra.length) {
          gate("COVERAGE", `provides.${what} differs from the files in the repo: missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)}`, { what, missing, extra });
        }
      }
    }
  }
  return out;
}

// ---------- CLI ----------

class GateError extends Error {}

function runClaude(args, cwd) {
  const opts = { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  let r = spawnSync("claude", args, opts);
  // On Windows `claude` can be a .cmd shim that only a shell finds; the arguments here are fixed words and
  // a marketplace folder name, so retrying with a shell is acceptable for that case only.
  if (r.error && r.error.code === "ENOENT" && process.platform === "win32") {
    r = spawnSync("claude", args, { ...opts, shell: true });
  }
  if (r.error) throw new GateError(`cannot run claude: ${r.error.message}`);
  return r;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new GateError(`cannot read ${file}: ${e.message}`);
  }
}

function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const allow = readJson(path.join(root, ".github", "drift", "validate-allow.json"));
  const market = readJson(path.join(root, ".claude-plugin", "marketplace.json"));

  let targets = argv;
  if (targets.length === 0) {
    targets = ["."];
    for (const p of market.plugins ?? []) {
      if (typeof p.source !== "string" || !p.source.startsWith(".")) continue;
      const t = path.posix.normalize(slash(p.source)).replace(/\/$/, "");
      if (t !== "." && !targets.includes(t)) targets.push(t);
    }
  }

  const pluginName = readJson(path.join(root, ".claude-plugin", "plugin.json")).name ?? "switchboard";
  const list = (dir, test) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(test).sort() : []);
  const expected = {
    agents: list(path.join(root, "agents"), (n) => n.endsWith(".md")).map((n) => `${pluginName}:${n.slice(0, -3)}`),
    skills: list(path.join(root, "skills"), (n) => fs.existsSync(path.join(root, "skills", n, "SKILL.md"))).map((n) => `${pluginName}:${n}`),
  };

  const version = runClaude(["--version"], root);
  console.log(`validate-gate: claude ${String(version.stdout).trim() || "(version unknown)"}`);

  let failed = 0;
  for (const target of targets) {
    const r = runClaude(["plugin", "validate", target, "--json"], root);
    let report;
    try {
      report = JSON.parse(r.stdout);
    } catch {
      console.error(`GATE BAD-OUTPUT target=${target}: claude plugin validate did not print valid JSON (exit ${r.status}).\n${String(r.stderr).slice(0, 500)}`);
      failed++;
      continue;
    }
    const findings = gateReport(report, allow, target, expected);
    const warnings = classifyWarnings(report, allow, target);
    const newCount = warnings.filter((w) => w.allowIndex === -1).length;
    console.log(`validate-gate: target ${target}: success=${report.success}, ${warnings.length} warnings (${warnings.length - newCount} allowed, ${newCount} NEW), ${findings.length} findings`);
    for (const w of warnings) console.log(`  ${w.allowIndex === -1 ? "NEW    " : "allowed"} ${w.file}: ${w.message.split("\n")[0].slice(0, 100)}`);
    for (const f of findings) console.error(f.message + "\n");
    if (findings.length) failed++;
  }
  console.log(`validate-gate: ${failed === 0 ? "pass" : `${failed} of ${targets.length} targets failed`}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    if (e instanceof GateError) {
      console.error(`validate-gate: cannot run: ${e.message}`);
      process.exit(2);
    }
    throw e;
  }
}
