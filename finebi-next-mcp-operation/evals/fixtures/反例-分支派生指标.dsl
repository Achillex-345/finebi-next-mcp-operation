// 2026-10-10 标准产品演示 v5：图表分支复制销售额造“总销售额”，用户要求改为指标（D-009）
Chart.from(query.from("订单新老客标记").formula("[销售额]").as("总销售额").label("派生总销售额"))
  .x(dim("订单日期").year())
  .y(bar(sum("销售额")).encode("color", dim("客户类型")).style("stacked", true).style("cornerRadius", 4))
  .y(line(sum("总销售额")).style("color", "#F97316").style("curve", true).style("marker", true).encode("label", sum("总销售额")).style("labelPosition", LabelPosition.TOP))
  .sort(dim("订单日期").year(), SortOrder.ASC)
  .sort(dim("客户类型"), "老客", "新客")
  .build()
