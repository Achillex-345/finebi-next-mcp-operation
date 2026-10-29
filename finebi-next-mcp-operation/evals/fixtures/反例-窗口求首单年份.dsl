// 2026-10-10 标准产品演示：window min 求首单年份，保存后被补 orderBy(行 ID) 变成累计最小值
query.from("示例 - 订单数据_客户订单明细")
  .formula("YEAR([订单日期])").as("订单年份")
  .window().partitionBy("客户 ID").min("订单年份").as("首单年份")
  .formula("IF([订单年份] = [首单年份], '新客', '老客')").as("客户类型")
