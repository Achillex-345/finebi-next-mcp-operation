#!/usr/bin/env node
// FineBI Next 图表 DSL 静态校验：只检查已沉淀、可机器判断的规则（见 DECISIONS.md）。
// 用法：node lint_chart_dsl.mjs <脚本文件>   退出码 0 = 通过，1 = 有错误
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MARKS = "bar|line|area|point|arc|rect";
const AGGS = "sum|avg|count|countDistinct|max|min|median|first|last|stdDev|variance";

export function lint(source) {
  const code = source
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\/\/.*$/, ""))
    .join("\n");
  const errors = [];

  // R1 (D-004)：同一字段同一聚合出现在多个系列 → 共用一个度量对象，别名互相覆盖
  const seen = new Map();
  const seriesRe = new RegExp(`\\b(${MARKS})\\(\\s*(${AGGS})\\(\\s*"([^"]+)"`, "g");
  for (const m of code.matchAll(seriesRe)) {
    const key = `${m[2]}("${m[3]}")`;
    seen.set(key, [...(seen.get(key) || []), m[1]]);
  }
  for (const [key, marks] of seen) {
    if (marks.length > 1) {
      errors.push(`R1 同字段同聚合 ${key} 出现在 ${marks.length} 个系列（${marks.join("、")}）：别名会互相覆盖。请把其中一个系列改为指标：.metric("名称", "SUM([字段])") + metric("名称")。`);
    }
  }

  // R2 (D-005)：柱图的颜色维度必须显式排序，否则各 x 位置堆叠顺序漂移
  if (/\bbar\(/.test(code)) {
    for (const m of code.matchAll(/encode\(\s*"color"\s*,\s*dim\(\s*"([^"]+)"\s*\)/g)) {
      const field = m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`\\.sort\\(\\s*dim\\(\\s*"${field}"\\s*\\)`).test(code)) {
        errors.push(`R2 柱图颜色维度 "${m[1]}" 未写 .sort(dim("${m[1]}"), ...)：堆叠顺序会随数据漂移。请写自定义顺序，先写的在底部。`);
      }
    }
  }

  // R3：禁止裸 count()
  if (/\bcount\(\s*\)/.test(code)) {
    errors.push(`R3 出现裸 count()：计数必须带字段，如 count("<字段>")。`);
  }

  // R4：图表 query 内禁止 join / union（跨表放分析表）
  const entry = code.search(/Chart\.(from|detail|cross)\(/);
  if (entry >= 0) {
    const open = code.indexOf("(", entry);
    let depth = 0;
    let end = open;
    let inString = false;
    for (let i = open; i < code.length; i++) {
      const ch = code[i];
      if (ch === '"' && code[i - 1] !== "\\") inString = !inString;
      if (inString) continue;
      if (ch === "(") depth++;
      if (ch === ")" && --depth === 0) { end = i; break; }
    }
    const chartQuery = code.slice(open, end);
    if (/\.(join|union)\(/.test(chartQuery)) {
      errors.push(`R4 图表 query 内出现 join/union：跨表合并必须先在分析表里完成。`);
    }

    // R5 (D-009)：图表分支只做数据处理；复制字段或聚合公式属于指标
    for (const m of chartQuery.matchAll(/\.formula\(\s*"([^"]*)"/g)) {
      const expr = m[1].trim();
      if (/^\[[^\]]+\]$/.test(expr) || new RegExp(`^(${AGGS})\\s*\\(`, "i").test(expr)) {
        errors.push(`R5 图表分支 formula("${expr}") 是在造指标：汇总性指标改用 .metric("名称", "SUM([字段])")，分支只做该图专用的数据处理。`);
      }
    }
  }

  // R6 (D-015)：同一系列同时 encode("size") 与 style("size")，固定大小会吞掉映射
  for (const m of code.matchAll(new RegExp(`\\b(${MARKS})\\(`, "g"))) {
    const start = m.index + m[0].length - 1;
    let depth = 0, end = start, inStr = false;
    for (let i = start; i < code.length; i++) {
      const ch = code[i];
      if (ch === '"' && code[i - 1] !== "\\") inStr = !inStr;
      if (inStr) continue;
      if (ch === "(") depth++;
      if (ch === ")" && --depth === 0) {
        // 系列链：mark(...) 之后紧跟的 .xxx(...) 调用，直到外层括号闭合
        let j = i + 1, d = 0, s = false;
        for (; j < code.length; j++) {
          const c = code[j];
          if (c === '"' && code[j - 1] !== "\\") s = !s;
          if (s) continue;
          if (c === "(") d++;
          if (c === ")") { if (d === 0) break; d--; }
        }
        end = j; break;
      }
    }
    const series = code.slice(m.index, end);
    if (/encode\(\s*"size"/.test(series) && /style\(\s*"size"/.test(series)) {
      errors.push(`R6 ${m[1]} 系列同时写了 encode("size", …) 与 style("size", …)：固定大小会覆盖按字段映射的大小。二选一。`);
    }
  }

  // R7 (D-015)：图表级 .style("opacity") 不会被保存，写到系列上
  if (entry >= 0) {
    let depth = 0, inStr = false;
    for (let i = code.indexOf("(", entry); i < code.length; i++) {
      const ch = code[i];
      if (ch === '"' && code[i - 1] !== "\\") inStr = !inStr;
      if (inStr) continue;
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth === 0 && code.startsWith('.style("opacity"', i)) {
        errors.push(`R7 图表级 .style("opacity") 不会被保存：写到系列上，如 point(...).style("opacity", 0.4)。`);
        break;
      }
    }
  }

  // R8 (D-024)：窗口 min/max 求分区极值会被平台补上 orderBy 变成累计值；用 groupBy 子查询 + join
  if (/\.window\(\)(?:(?!\.window\(\))[\s\S])*?\.(min|max)\(/.test(code) && !/frameRows\(\s*unboundedPreceding\(\)\s*,\s*unboundedFollowing\(\)\s*\)/.test(code)) {
    errors.push(`R8 窗口 min/max 求分区极值：平台会自动补 orderBy，结果变成累计极值。改用子查询 groupBy(<对象>).agg(min/max(...)) 后 join 回来。`);
  }

  // R9 (D-036)：万级单位后缀写“万”会显示“万万”
  if (/NumLevel\.TEN_THOUSAND\s*,\s*"万/.test(code)) {
    errors.push(`R9 NumLevel.TEN_THOUSAND 的后缀写了“万”：平台已加“万”，会显示成“万万”。后缀改写为单位本身，如 "元"。`);
  }

  // R10 (D-036)：条件格式不能挂在指标上
  if (/\.conditionalFormat\(\s*metric\(/.test(code)) {
    errors.push(`R10 conditionalFormat 挂在 metric(...) 上：平台不支持（Not supported yet. Agg）。在分支里把对比值算成字段，先建图，再用 Chart.edit 对 sum("<字段>") 追加条件格式。`);
  }

  // R11 (K-32)：反读得到的 FormatType 构造写法不能回写
  if (/new\s+NumberFormatConfig\(\s*FormatType\./.test(code)) {
    errors.push(`R11 new NumberFormatConfig(FormatType...) 是反读格式，回写报 FormatType is not defined。改用 NumberFormatConfig.number(...) / percentage(...)。`);
  }

  // R12 (K-29)：指标公式不能引用参数
  if (/\.metric\(\s*"[^"]*"\s*,\s*"[^"]*@/.test(code)) {
    errors.push(`R12 .metric 公式里引用了 @参数：平台不支持。在分支步骤里按参数取值，指标只引用取值后的字段。`);
  }

  // R13 (K-31)：RELATIVE_DATE 只能用在 filter
  if (/\.formula\(\s*"[^"]*RELATIVE_DATE/.test(code)) {
    errors.push(`R13 .formula 里用了 RELATIVE_DATE：只能用在 filter。公式里用 TODAY()、MONTHDELTA 等拼出日期边界。`);
  }

  return errors;
}

// 中文路径下 import.meta.url 会被百分号编码，按真实路径比较
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("用法：node lint_chart_dsl.mjs <脚本文件>");
    process.exit(2);
  }
  const errors = lint(readFileSync(file, "utf8"));
  console.log(JSON.stringify({ file, ok: errors.length === 0, errors }, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
}
