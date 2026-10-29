// 2026-10-15 标准产品演示 v3：客户级气泡散点 + 两条象限参考线
Chart.from(query.from("订单新老客标记"))
  .metric("利润率", "SUM([利润])/SUM([销售额])")
  .x(point(sum("销售额")))
  .y(point(metric("利润率")).encode("granularity", dim("客户 ID")).encode("size", sum("利润")).encode("tooltip", dim("客户名称")).style("opacity", 0.4))
  .referenceLine(sum("销售额"), SummaryType.AVERAGE, "#8C8C8C", "客户平均销售额")
  .referenceLine(metric("利润率"), 0.1336, "#DC2626", "整体利润率")
  .numberFormat(metric("利润率"), NumberFormatConfig.percentage(1))
  .build()
