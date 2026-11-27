// Stage 0 skeleton: no behaviour yet. The code stage implements gateReport and the CLI.
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {object} report parsed `claude plugin validate --json` output
 * @param {object[]} allowList entries from validate-allow.json
 * @param {string} target the validated target ("." or "crew")
 * @param {object} expected coverage expectations for the root target
 * @returns {object[]} findings
 */
export function gateReport(report, allowList, target, expected) {
  return [];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(0);
}
