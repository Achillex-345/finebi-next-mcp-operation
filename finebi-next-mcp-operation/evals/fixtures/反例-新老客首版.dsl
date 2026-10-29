// 2026-10-10 标准产品演示 v1：柱子也被命名“总销售额”；各年堆叠顺序不一致
Chart.from(query.from("订单新老客标记"))
  .x(dim("订单日期").year())
  .y(bar(sum("销售额")).encode("color", dim("客户类型")).style("stacked", true).style("cornerRadius", 4))
  .y(line(sum("销售额").as("总销售额")).style("curve", true).style("marker", true).encode("label", sum("销售额")).style("labelPosition", LabelPosition.TOP))
  .sort(dim("订单日期").year(), SortOrder.ASC)
  .build()
