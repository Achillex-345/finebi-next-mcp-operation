# 工具链路与调用细节

## 资源层级与发现

- 层级固定：业务空间 → 普通分析项目 → 项目资产。`list_spaces` 只列空间，`list_projects` 只列项目，`list_project_assets` 只列资产树。
- `list_project_assets` 返回树形文本：`.table` 分析表（原始导入表带“数据源表·不可直接建图”）、`.chart` 挂在父表下、`.dashboard`、`.storyboard`、`.complex-report`、`.param`。
- 项目列表可能包含 UI 已删除的项目（见 known-issues K-01）。用户说“只剩一个”时，以用户界面为准，用名称确认目标项目。

## 读取类工具怎么选

| 要什么 | 用什么 | 注意 |
|---|---|---|
| 字段名、类型、少量样例、READY 状态 | `get_project_asset_details` | `maxRows` 只看结构传 0，探查传 5；表行数 ≤ maxRows 时会返回全表 |
| 完整 DSL / 故事板 Markdown 底稿 | `get_project_asset_definitions` | 修改已有资产前读；不返回数据 |
| 值域、空值、Top 值 | `profile_project_tables` | 只用于方案；`keyColumns` 目前不返回唯一性结论（K-04） |
| join 匹配率、扇出 | `join_probe` | 仅多线程计算引擎可用；不可用时降级见下 |
| 看板现有组件结果 | `dashboard_view` | 只读已有配置，先读 `view` Help |

## 写入与异步

- `upsert_tables`：返回 `calculationStatus=PENDING_VERIFICATION` 和 `operation.operationRef`。按 `retryAfterMs` 轮询 `get_analysis_operation_status`，直到 `operation.status=SUCCEEDED`；`callStatus=SUCCEEDED` 只代表查询本身成功。随后 `get_project_asset_details` 回读到 READY。READY 和单图回读有数只说明能算出来，不代表数据更新已完成；看板取数要等更新完成，所以 operation 到 SUCCEEDED 前不建图、不进看板。长时间停在「更新状态尚未生成」时，见 K-28（D-038）。
- `upsert_charts`：同步返回，无 operation；直接回读。参数只有 `name` + `script`，**没有 path**：父表由 `Chart.from(query.from("<表名>"))` 决定，返回路径形如 `/<表名>.table/<图名>.chart`，不带所在文件夹。
- 图表 `openUrl` 为空，展示时用父分析表的 openUrl 并写明图名。
- 同名 `name` 再次 upsert 即覆盖更新（`created:false`），可用于迭代修正。
- 一次 `upsert_tables` 可批量提交多张表，按依赖顺序排列（来源在前）。

## join 关系核验（join_probe 不可用时）

1. 关联写在分析表里，左表选“定义粒度”的那张（如目标表）。
2. 追加匹配标记：`.formula("IF(NOTNULL([右表独有且原本非空的字段]), '已匹配', '未匹配')").as("匹配状态")`。
3. 回读时看匹配状态分布；行数小于 100 时可用 `maxRows` 取全表核对。

## Ref 的有效范围（D-012）

- `spaceRef / projectRef / assetRef` 绑定当前授权主体。MCP 重新授权或换了会话后，旧 Ref 全部失效，调用返回 `REFERENCE_SUBJECT_MISMATCH`（AUTH 类、不可重试）。
- 遇到该错误或开始新会话时，从 `list_spaces → list_projects` 重新定位，用名称匹配回原项目；不要复用对话历史或日志里的旧 Ref。
- 重新定位后先 `list_project_assets` 确认资产现状，用户可能在间隔期间在界面改过。

## 错误处理

- 错误体含 `code / category / retryable` 与“业务诊断”。`WORKSPACE_DSL_REJECTED`（DSL 类）按诊断改写；`WORKSPACE_JOIN_PROBE_FAILED` 且“无需重试”说明能力不可用，换方案。
- 同一输入、无新诊断时不重复提交。
- 校验一次只报**第一个**失败字段；诊断里的“可用列”只说明字段名被识别，不代表已通过校验。多个未验证写法要逐个加入（先提交已验证部分，再一次只加一个），否则无法定位（D-018）。
- 同一个未验证写法换写法失败两次，就停止猜测，按 D-010 请用户在界面做样例后反读。
- 用户明确要求或同一环节按建议恢复后仍反复失败时，才可用 `report_analysis_issue` 反馈；提交前把描述原文给用户确认，每次都要重新确认。

## Help 主题

- `get_analysis_authoring_help()` 返回主题索引；常用：`edit/query`、`edit/table`、`edit/chart`、`edit/chart/table`、`edit/chart/extend`、`edit/dashboard/markup-authoring`、`edit/storyboard`、`shared_caliber`、`view`。
- Help 正文会出现 MCP 未开放的主题名和内部工具名（`put_table`、`put_chart`、`row_count`、`dsl()` 等），按下表映射，不要尝试调用：

| Help 里的说法 | MCP 实际做法 |
|---|---|
| `put_table` | `upsert_tables`（path + query） |
| `put_chart` / “put change，path …” / `intent` 参数 | `upsert_charts`（name + script，无 path、无 intent） |
| `detail` / `row_count` | `get_project_asset_details` |
| `dsl()` | `get_project_asset_definitions` |
| `help("edit/param")` 等未列出主题 | 当前不可用 |
