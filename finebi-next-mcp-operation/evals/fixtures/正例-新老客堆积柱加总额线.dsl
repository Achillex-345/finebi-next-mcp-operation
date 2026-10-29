// 2026-10-10 标准产品演示 v6：总销售额改为指标，内置浏览器目视通过
Chart.from(query.from("订单新老客标记"))
  .metric("总销售额", "SUM([销售额])")
  .x(dim("订单日期").year())
  .y(bar(sum("销售额")).encode("color", dim("客户类型")).style("stacked", true).style("cornerRadius", 4))
  .y(line(metric("总销售额")).style("color", "#F97316").style("curve", true).style("marker", true).encode("label", metric("总销售额")).style("labelPosition", LabelPosition.TOP))
  .sort(dim("订单日期").year(), SortOrder.ASC)
  .sort(dim("客户类型"), "老客", "新客")
  .build()
