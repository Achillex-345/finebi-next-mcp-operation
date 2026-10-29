// 构造反例：裸 count() 与图表 query 内 join
Chart.from(query.from("订单明细").join("客户").left().on("客户 ID"))
  .x(dim("区域"))
  .y(bar(count().as("订单数")))
  .build()
