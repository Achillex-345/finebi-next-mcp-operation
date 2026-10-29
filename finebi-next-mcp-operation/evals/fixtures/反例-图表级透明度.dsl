// 2026-10-15 标准产品演示 v1：图表级 opacity 未被保存，气泡糊成一团
Chart.from(query.from("订单新老客标记"))
  .metric("利润率", "SUM([利润])/SUM([销售额])")
  .encode("granularity", dim("客户 ID"))
  .x(point(sum("销售额")))
  .y(point(metric("利润率")))
  .encode("size", sum("利润"))
  .style("opacity", 0.6)
  .build()
