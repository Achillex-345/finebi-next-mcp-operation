# 图表 DSL 实战规范

只记录经过实际调用验证的写法和坑；完整语法以 `edit/chart` Help 为准。每条注明来源决策。占位符：`<表>` 分析表名，`<度量>` 数值字段，`<维度>` 分类字段，`<日期>` 日期字段，`<指标名>` 自定义指标名。具体验证用例见 `evals/fixtures/`。

## 目录

- 计算分层
- 指标写法（D-009）
- 同字段同聚合只有一个名字（D-004）
- 模式：拆分的堆积柱 + 不拆分的合计折线（D-004, D-005）
- 堆积顺序必须固定（D-005）
- 模式：对象级气泡散点 + 象限参考线（D-015, D-016）
- 模式：对象级汇总交叉表（D-017, D-019）
- 模式：带对比与状态的指标卡（D-025, D-036）
- 模式：迷你趋势（D-036）
- 模式：灰作背景、主色高亮、RAG 参考线（D-036）
- 数字格式（D-036）
- 模式：按对象的目标缺口条（D-037）
- 其他已验证约束

## 计算分层

- 三层分工见 `division-of-work.md`：分析表放原子字段与行级处理，图表分支只做该图专用的数据处理，汇总性指标放指标（D-009）。
- 日期分组写在编码侧：`.x(dim("<日期>").year())`（或 `.yearMonth()` 等），不要在 query 里预先 groupBy 日期粒度再透传。
- 图表 query 里的步骤会在分析表步骤面板显示为该图表专属的分支，不改分析表本身。

## 指标写法（D-009）

```
.metric("<指标名>", "SUM([<度量>])")         // chart 级：名称 + 聚合公式
.y(line(metric("<指标名>")))                  // 系列引用
.encode("label", metric("<指标名>"))          // 标签等通道同样引用
```

- 指标显示在图表编辑页左下“指标”面板，类型“聚合”。
- 全量重写图表时，未写进 DSL 的指标会被删除；用户在界面建的指标要先用 `get_project_asset_definitions` 读出来并原样带上。
- Help 只提到 `metric("名字")` 引用，没有定义语法；本写法是从用户在界面建的样例反读出来的（见 SKILL.md「写 DSL 前」）。

## 同字段同聚合只有一个名字（D-004）

同一图表里 `sum("<度量>")` 出现在两个系列时，它们是同一个度量对象：`.as` 别名后写覆盖前写，两个系列显示同名。

```
// ✗ 两个系列显示同一个名字
.y(bar(sum("<度量>").as("名称A")))
.y(line(sum("<度量>").as("名称B")))

// ✗ 在图表分支里复制字段造“指标”（lint R5）
Chart.from(query.from("<表>").formula("[<度量>]").as("<指标名>"))

// ✓ 第二个系列用指标
.metric("<指标名>", "SUM([<度量>])")
.y(bar(sum("<度量>")) ...)
.y(line(metric("<指标名>")) ...)
```

## 模式：拆分的堆积柱 + 不拆分的合计折线（D-004, D-005）

- 颜色维度写在**被拆分的系列上**（`bar(...).encode("color", dim("<维度>"))`），合计折线不写 color，即为按 x 汇总的合计。
- 同量纲共用一轴，不加 `.rightAxis()`；量纲不同（金额 vs 比率）时折线加 `.rightAxis()`。
- 叠加在多色柱上的折线用中性深色（如 `#374151`）（D-013）：折线默认取主色会撞到颜色维度的第一个值，换成任何彩色又可能撞到调色板里的其他分类，标签压在柱上也看不清。改完目视确认。

```
Chart.from(query.from("<表>"))
  .metric("<指标名>", "SUM([<度量>])")
  .x(dim("<日期>").year())
  .y(bar(sum("<度量>")).encode("color", dim("<维度>")).style("stacked", true))
  .y(line(metric("<指标名>")).style("color", "#374151").encode("label", metric("<指标名>")))
  .sort(dim("<日期>").year(), SortOrder.ASC)
  .sort(dim("<维度>"), "<底层值>", "<上层值>")
  .build()
```

## 堆积顺序必须固定（D-005）

颜色维度不排序时，每个 x 位置的堆叠顺序跟随数据返回顺序漂移（同一分类在某个 x 位于底部、另一个 x 位于顶部），跨 x 无法比较。堆积图必须对颜色维度写自定义顺序：

```
.sort(dim("<维度>"), "<底层值>", "<上层值>")   // 先写的在底部；取值逐字取自数据
```

一般把“基数/存量”放底部、“增量/新增”放上层。调色板按排序先后分配，改顺序后颜色也会跟着换，改完要重新目视。

## 模式：对象级气泡散点 + 象限参考线（D-015, D-016）

```
Chart.from(query.from("<表>"))
  .metric("<比率名>", "SUM([<分子>])/SUM([<分母>])")
  .x(point(sum("<度量X>")))
  .y(point(metric("<比率名>"))
      .encode("granularity", dim("<对象ID>"))       // 每个对象一个点；用唯一 ID，不用可能重名的名称
      .encode("size", sum("<度量Z>"))
      .encode("tooltip", dim("<对象名称>"))
      .style("opacity", 0.4))                        // 透明度写在系列上
  .referenceLine(sum("<度量X>"), SummaryType.AVERAGE, "#8C8C8C", "<对象平均X>")
  .referenceLine(metric("<比率名>"), <整体比率固定值>, "#DC2626", "<整体比率>")
  .numberFormat(metric("<比率名>"), NumberFormatConfig.percentage(1))
  .build()
```

- 粒度、大小、提示、透明度都写在系列上；图表级 `.style("opacity")` 不会被保存（lint R7）。
- 同一系列不要同时写 `encode("size", …)` 和 `style("size", …)`：固定大小会吞掉映射（lint R6）。气泡大小范围目前没有 DSL 写法（K-10）。
- `SummaryType.AVERAGE` 参考线按图上的点（对象）取平均，已用 总量 ÷ 对象数 核对。
- 动态参考线只支持 SUM / AVERAGE / MAX / MIN / DISTINCT / COUNT，**算不出“Σ分子 ÷ Σ分母”的整体比率**：只能用固定值，值取自 READY 图表或分析表的回读结果，并告知用户数据刷新后需更新。注意“对象比率的平均值”≠“整体比率”，不要用 AVERAGE 代替。固定值线在看板联动、筛选后不会变化（已在看板中观察到：联动后整体比率 12.5%，线仍停在 13.4%），需在说明里标注“全量口径”或告知用户。
- 回读后用对象维度的基数核对 ID 与名称一一对应（两列基数相同）。

## 模式：对象级汇总交叉表（D-017, D-019）

在图表分支（界面“高级模式”）里先按对象聚合，再在聚合结果上算派生字段，交叉表只透传：

```
Chart.cross(
  query.from("<表>")
    .groupBy("<对象ID>", "<对象名称>")
    .agg(
      max("<日期>").as("<最近日期>"),
      sum("<度量>").filter("[<日期>] >= TODATE('<起>') && [<日期>] <= TODATE('<止>')").as("<近期合计>"),
      sum("<度量>").as("<合计>"),
      countDistinct("<单据ID>").as("<单据数>")
    ).label("<聚合步骤名>")                                   // 界面显示为分支“分类汇总”步骤
    .formula("DATESUBDATE(TODATE('<基准日>'), [<最近日期>], 'D')").as("<距基准日天数>").label("<步骤名>")
)
  .row(dim("<对象ID>"), dim("<对象名称>"))
  .indicator(max("<最近日期>"), sum("<距基准日天数>"), sum("<近期合计>"), sum("<合计>"), sum("<单据数>"))
  .sort(dim("<对象ID>"), dependOn(sum("<合计>")), SortOrder.DESC)
  .build()
```

- 每个对象一行，`sum()/max()` 只是透传；交叉表指标即使已聚合也要包一层聚合。
- 度量过滤里的 `TODATE('…')` 保存后会被规范化为字符串比较，结果正确。
- 指标面板（`.metric`）能用的只有 `SUM`、`COUNTD`、二者的比值等；日期型指标、`SUM(IF(…))`、聚合结果上的日期差都会被拒（K-11），这类口径改放分支。
- 全量重写成分支版后，原来挂在图上的指标会被删除，需告知用户。
- 回读预览不按 `.sort` 排序；排序用目视或 `get_page_text` 读表格单元格核对（页面文字按 DOM 顺序，可能倒序）。

## 模式：带对比与状态的指标卡（D-025, D-036）

对比值在分支里按参数算成字段，条件格式挂在字段上：

```
Chart.from(Query.from("<表>")
    .groupBy().agg(
        sum("<度量>").filter("([<年月>] = @<参数>)").as("本期<度量>"),
        sum("<度量>").filter("([<年月>] = COMBINEDELTA(@<参数>, -1, \"M\"))").as("上期<度量>"),
        sum("<度量>").filter("([<年月>] = COMBINEDELTA(@<参数>, -12, \"M\"))").as("同期<度量>")).label("按参数汇总")
    .formula("[本期<度量>]/[上期<度量>]-1").as("<度量>环比").label("环比")
    .formula("[本期<度量>]/[同期<度量>]-1").as("<度量>同比").label("同比"))
  .mark(MarkType.TEXT)
  .encode("text", sum("本期<度量>"), sum("<度量>环比"), sum("<度量>同比"))
  .style("textLayout", TextLayout.PRIMARY_SECONDARY_1_1).style("fit", false).style("size", 0.6)
  .legend(false)
  .numberFormat(sum("本期<度量>"), NumberFormatConfig.number(1, NumLevel.TEN_THOUSAND, "元"))
  .numberFormat(sum("<度量>环比"), NumberFormatConfig.percentage(1))
  .numberFormat(sum("<度量>同比"), NumberFormatConfig.percentage(1))
  .build()
```

建图 READY 后，再用 `Chart.edit` 追加条件格式（每个对比字段两条）：

```
.conditionalFormat(sum("<度量>环比"), "[<度量>环比] < 0",  "<差色>", IconShape.ARROWS_DOWN, "<差色>")
.conditionalFormat(sum("<度量>环比"), "[<度量>环比] >= 0", "<好色>", IconShape.ARROWS_UP,   "<好色>")
```

- 条件格式只能挂在分支字段上；挂在 `metric(...)` 上报 “Not supported yet. Agg”（lint R10，K-22）。
- 与分支字段在同一次 `Chart.from` 里写条件格式会校验失败；先建图，再 `Chart.edit` 追加（K-22）。
- 比率类卡片的对比写差值：`[本期分子]/[本期分母]-[上期分子]/[上期分母]`。
- “越低越好”的度量（成本、退货率）把好色和差色对调。

## 模式：迷你趋势（D-036）

指标卡下方的近 N 期走势，用参数相对过滤，隐藏坐标轴：

```
Chart.from(Query.from("<表>")
    .filter("([<年月>] <= @<参数>) && ([<年月>] > COMBINEDELTA(@<参数>, -12, 'M'))").label("近12期"))
  .x(dim("<年月>"))
  .y(line(sum("<度量>")).style("curve", true).style("color", "<主色>"))
  .sort(dim("<年月>"), SortOrder.ASC)
  .legend(false).showXLabel(false).showYLabel(false)
  .build()
```

- 回读核对末期值与同参数的指标卡一致。
- 迷你趋势只表达走向；结论性数字留在指标卡上。

## 模式：灰作背景、主色高亮、RAG 参考线（D-036）

```
// 背景信息灰色，比率用主色折线
.y(bar(sum("<规模度量>")).style("color", "<背景灰>").style("strokeColor", ""))
.y(line(metric("<比率名>")).style("color", "<主色>").style("marker", true).style("label", true).rightAxis())

// 实际 vs 目标：实际主色宽柱，目标灰色窄柱叠放
.y(bar(sum("<实际>")).style("color", "<主色>"))
.y(bar(sum("<目标>")).style("color", "<目标灰>").style("size", 0.3))
.geomRelation(GeomRelation.OVERLAP)
.referenceLine(metric("<达成率>"), 1,   "<达标绿>", "目标 100%")
.referenceLine(metric("<达成率>"), 0.9, "<预警黄>", "预警 90%")

// 类别：重点类别主色，其余灰
.colorMapping(dim("<类别>"), {"<重点值>": "<主色>", "<其他值>": "<背景灰>"})
```

- `colorMapping` 优先于看板主题配色，适合固定“主色 + 灰”；改完仍在看板视图目视（D-022）。
- 不写 `cornerRadius`（柱为直角）；系列 `strokeColor` 置空。

## 模式：按对象的目标缺口条（D-037）

目标表上每个对象一行时，分支里算差额与状态，状态映射为“缺口色 / 灰”：

```
Chart.from(Query.from("<目标分析表>")
    .filter("([<年份>] = <年度>)").label("<年度>")
    .formula("[<实际>]-[<目标>]").as("较目标差额").label("算差额")
    .formula("IF([<实际>] < [<目标>], \"未达成\", \"达成\")").as("达成状态").label("标状态"))
  .y(dim("<对象>"))
  .x(bar(sum("较目标差额")).encode("color", dim("达成状态")).style("strokeColor", ""))
  .sort(dim("<对象>"), dependOn(sum("较目标差额")), SortOrder.ASC)
  .sort(dim("达成状态"), "未达成", "达成")
  .colorMapping(dim("达成状态"), {"未达成": "<缺口色>", "达成": "<背景灰>"})
  .legend(false)
  .build()
```

- 差额是行级处理（每行一个对象 × 年度），不违反 R5；对象粒度比目标粗时先 groupBy 再算。
- 年份过滤不能用 `YEAR(@<年月参数>)`（K-27），需要随参数变化时另想写法，否则固定年度并在标题写明。

## 数字格式（D-036）

- 万级单位：`NumberFormatConfig.number(<小数位>, NumLevel.TEN_THOUSAND, "元")`。后缀写“万”会显示成“万万”（lint R9，K-23）。
- `Chart.edit` 里 `numberFormat` 是列表通道：只写一条会清掉其余字段的格式（比率变小数），增量编辑时要把全部 numberFormat 一起重述（K-24）。
- 系列上用 `encode("label", metric(...))` 显示的数据标签可能不套用该指标的百分比格式，显示为小数（K-25）：写后目视；仍是小数时去掉标签、靠 tooltip 与参考线读数，或在读图说明里注明。

## 其他已验证约束

- 比率字段不要 sum；用指标按口径先聚合分子分母再相除：

```
.metric("<比率名>", "SUM([<分子>])/SUM([<分母>])")
.y(line(metric("<比率名>")).rightAxis())
.numberFormat(metric("<比率名>"), NumberFormatConfig.percentage(1))   // numberFormat 可直接引用指标
```

  指标按系列自身的粒度计算：折线不写 color 时按 x 汇总后再相除，不会被颜色维度拆开。
- 计数必须带字段：`count("<字段>")`，不写裸 `count()`。
- 排序、numberFormat、referenceLine 引用原始字段名，不引用 `.as` 别名。
- 动态指标（D-044）：`query.from("<表>").dynamicField(DataType.NUMBER).options("<度量1>", "<度量2>").using("<默认度量>").as("<对象>动态数值")`，图上用 `sum("<对象>动态数值")`。每张图的动态字段名字要不同：界面绑定列表只显示字段名（K-36）。切换控件只能在界面加（K-35）；没加控件时表头显示的是 `.as` 别名，交付前确认用户知道当前不能切换。
