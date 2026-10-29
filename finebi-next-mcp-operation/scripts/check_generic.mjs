#!/usr/bin/env node
// 检查规则正文是否混入测试用例的场景词（D-011）。用法：node check_generic.mjs  退出码 0 = 通过
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const terms = readFileSync(join(skillDir, "evals", "scenario-terms.txt"), "utf8")
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

export function findTerms(text) {
  return terms.filter((t) => text.includes(t));
}

const files = [join(skillDir, "SKILL.md")];
for (const sub of ["references", "scripts"]) {
  for (const f of readdirSync(join(skillDir, sub))) files.push(join(skillDir, sub, f));
}
const hits = [];
for (const f of files) {
  const found = findTerms(readFileSync(f, "utf8").replace(/^.*scenario-terms.*$/gm, ""));
  if (found.length) hits.push(`${relative(skillDir, f)}: ${found.join("、")}`);
}
// 反例自检：场景词必须能被识别
if (terms.length && findTerms(`前缀${terms[0]}后缀`).length === 0) hits.push("自检失败：场景词未被识别");
console.log(hits.length ? `FAIL\n${hits.join("\n")}` : `PASS 规则正文未混入 ${terms.length} 个场景词`);
process.exit(hits.length ? 1 : 0);
