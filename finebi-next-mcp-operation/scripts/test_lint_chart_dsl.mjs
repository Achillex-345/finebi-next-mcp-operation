#!/usr/bin/env node
// 按 evals/fixtures/expectations.json 回归 lint_chart_dsl.mjs；新增用例只改 evals，不改本脚本
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lint } from "./lint_chart_dsl.mjs";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "evals", "fixtures");
const expectations = JSON.parse(readFileSync(join(fixtures, "expectations.json"), "utf8"));
const cases = Object.entries(expectations).map(([file, expect]) => ({ file, expect }));

let failed = 0;
for (const { file, expect } of cases) {
  const rules = lint(readFileSync(join(fixtures, file), "utf8")).map((e) => e.match(/^R\d+/)[0]).sort();
  const ok = JSON.stringify(rules) === JSON.stringify([...expect].sort());
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${file} → [${rules.join(", ")}]，期望 [${expect.join(", ")}]`);
}
process.exit(failed ? 1 : 0);
