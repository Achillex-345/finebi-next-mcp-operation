// 2026-10-15 标准产品演示 v6：分支聚合计算 + 聚合后计算，交叉表透传
Chart.cross(
  query.from("订单新老客标记")
    .groupBy("客户 ID", "客户名称")
    .agg(
      max("订单日期").as("最近下单日期"),
      sum("销售额").filter("[订单日期] >= TODATE('2023-01-01') && [订单日期] <= TODATE('2023-12-31')").as("近一年销售额"),
      sum("销售额").as("总销售额"),
      countDistinct("订单 ID").as("订单数")
    ).label("按客户汇总")
    .formula("DATESUBDATE(TODATE('2023-12-31'), [最近下单日期], 'D')").as("距今天数").label("算距今天数")
)
  .row(dim("客户 ID"), dim("客户名称"))
  .indicator(max("最近下单日期"), sum("距今天数"), sum("近一年销售额"), sum("总销售额"), sum("订单数"))
  .sort(dim("客户 ID"), dependOn(sum("总销售额")), SortOrder.DESC)
  .build()
