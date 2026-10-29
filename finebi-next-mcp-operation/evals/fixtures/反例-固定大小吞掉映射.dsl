// 2026-10-15 标准产品演示 v2：style("size") 覆盖 encode("size")，大小映射丢失
Chart.from(query.from("订单新老客标记"))
  .metric("利润率", "SUM([利润])/SUM([销售额])")
  .x(point(sum("销售额")))
  .y(point(metric("利润率")).encode("granularity", dim("客户 ID")).encode("size", sum("利润")).style("opacity", 0.4).style("size", 0.2))
  .build()
