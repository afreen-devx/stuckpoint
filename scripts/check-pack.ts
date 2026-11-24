/**
 * npm run pack:check
 * Validates packs/KIN-01.json and prints every error and warning.
 * Exits with code 1 if the pack is invalid, so it can run in CI.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { validatePack } from "../lib/pack.ts";

const packId = process.argv[2] ?? "KIN-01";
const file = path.join(process.cwd(), "packs", `${packId}.json`);
const { pack, errors, warnings } = validatePack(JSON.parse(readFileSync(file, "utf8")));

for (const warning of warnings) console.log(`warning  ${warning}`);
for (const error of errors) console.log(`error    ${error}`);

if (!pack || errors.length > 0) {
  console.log(`\n${packId}: INVALID (${errors.length} errors)`);
  process.exit(1);
}
console.log(
  `\n${packId}: OK. ${Object.keys(pack.questions).length} questions, ${Object.keys(pack.misconceptions).length} misconceptions, ${warnings.length} warnings.`,
);
