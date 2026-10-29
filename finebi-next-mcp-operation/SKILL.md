---
name: finebi-next-mcp-operation
description: 用 FineBI Next MCP（finebi-next 工具）建项目、导数据、写分析表/图表/看板/故事板并回读与目视核验。提到 FineBI Next MCP、在 FineBI Next 里建表建图做看板、接到新的分析或看板需求（加板块、加图、加指标）、要美化或改版看板视觉，或沉淀 MCP 操作规范时使用；新需求先出计划态结构图，用户确认后再开发。
---

# FineBI Next MCP 操作规范

把“在 FineBI Next 里做出一个正确的分析资产”拆成可核验的步骤。MCP 写入成功只代表“已保存”，不代表“对”：数据要回读、图形要目视，二者都过才算完成。

本 Skill 只管平台操作。演示故事、五问剧本和 Demo 数据设计用 `data-story-generation`，本 Skill 负责把它们落成 FineBI Next 资产。

## 三层：业务设计 → 建模设计 → DSL 写法（D-043）

| 层 | 回答什么 | 去哪看 |
|---|---|---|
| 业务设计 | 看什么指标、凭什么判断好坏、往哪拆、怎么归因 | `references/business-design.md` |
| 建模设计 | 数据怎么组织才撑得住这些判断 | `references/dashboard-architecture.md`、`references/modeling-method.md` |
| DSL 写法 | 当前工具里具体怎么写 | 现查 MCP Help；Skill 只记谬误：`references/known-issues.md`、`references/chart-dsl.md`、lint |

前两层不随工具变，是本 Skill 的核心；DSL 层随 MCP 版本和工具更换而变，所以只记录 Help 与实际不一致、平台缺陷和容易犯的错。动手按这个顺序：先业务、再建模、最后写 DSL。

## 底线

1. **命名**：产品与 MCP 一律称 FineBI Next；工具返回文本里的“九数云BI”在对话、日志和文档中改写为 FineBI Next。
2. **只做当前一步**：用户逐步下达时，只执行点名的那一步，不自行设计案例、不提前建表建图。口径有歧义（分类如何界定、时间粒度、统计范围）先问再写。
3. **当前步骤的正确性缺陷直接修**：图表读错、堆叠顺序漂移、系列重名、颜色撞到无法区分这类问题不推给用户“可选”，修好再交付；只有纯审美偏好才列出来让用户选。
4. **Ref 不外露**：`spaceRef / projectRef / assetRef / operationRef` 只用于继续调用；展示资源一律 `[name](openUrl)`，openUrl 为空只写名称。
5. **数字只认 READY**：最终业务数字只能来自 `calculationStatus=READY` 的分析表或图表；样例、Profile 只用于理解结构。
6. **不绕过授权**：遇到 401 / invalid_token / Auth required 立即停，请用户重新授权，不重试写入、不改用本地计算。

## 新需求：先出结构图，确认后再开发（D-032）

接到新的分析或看板需求（新板块、新图、新指标、新数据源）时主动使用本 Skill，开发前先给用户一张计划态结构图：

1. **读现状**：`list_project_assets` + `get_project_asset_definitions` 反读相关分析表和图表，不凭记忆。
2. **业务设计**：按 `references/business-design.md` 的推导链（指标 → 判断逻辑 → 时间切片 → 维度切分 → 历史趋势 → 业务归因）说清每个组件回答什么、为什么这样拆；链上答不上来的地方先问用户。
3. **建模设计**：按 `references/dashboard-architecture.md` 决定数据放哪层（主宽表 / 分支 / 独立分析表）、计算放哪层（原子字段 / 分支 / 指标）、交互用什么（天然联动 / 跨表联动 / 筛选器 / 参数）。经营类看板（多事实、目标、组织层级、同环比）再按 `references/modeling-method.md` 定骨架粒度、目标摊法、指标链和时间对比方案。
4. **画计划态结构图**：按 `references/structure-map.md` 画五层导图，已有节点中性色，新增、改动、删除分别标出；图下列出需要用户拍板的口径问题。
5. **等用户确认**（业务设计 + 结构图）：确认前不写入任何资产；确认后按图逐步开发，仍遵守「只做当前一步」。

## 分工

- **MCP 负责写，浏览器负责看**：建表、建图、改排序和颜色都走 MCP，DSL 进日志；浏览器只核对 MCP 看不到的图形与样式，不在界面里改配置。登录、删除、移动由用户在界面完成。
- **数据是什么放分析表，图怎么呈现放图表**：打标签、窗口、关联、复用口径放分析表；时间粒度、聚合、系列、堆叠、排序、颜色、标签、显示名放图表。
- **原子字段在数据集，汇总指标在指标**：分析表只放原子字段与行级处理；图表分支（高级模式步骤）做该图专用的数据处理，包括按图表粒度“聚合计算”和汇总后的“聚合后计算”；合计、比率等可在图上直接聚合的业务指标用 `.metric("<指标名>", "<聚合公式>")` 维护。指标写不出的对象级口径（条件聚合、距基准日天数）放到图表分支里算（D-019）。
- 做看板前先读 `references/dashboard-architecture.md`：宽表 → 分支（子业务宽表 / 过程处理）→ 图表 → 指标 → 交互的分层与判断规则（D-029）。各层怎么搭（骨架宽表、目标摊到日、原子量入表 + 比率按链重算、区间与趋势两类时间对比、子表一致维度、看板说明书）见 `references/modeling-method.md`（D-039 ~ D-042）。
- 逐项归属与验证状态见 `references/division-of-work.md`；新步骤验证后更新其中的“待验证”行。
- 看板视觉按 `references/visual-style.md`：先判断是扩展（沿用项目视觉档案）还是新建；新建时写场景评估（受众与场合、一个问题、一个发现、业务对象），从 `references/visual-directions.md` 自己选定一个方向直接做，不把选项摆给用户，除非用户明确要求比稿；任何方向都守底线，交付前自评“换个行业还能直接用吗”（D-037）。
- 需要说明项目整体结构（复盘、交接、讲建模逻辑）时，按 `references/structure-map.md` 从 MCP 读定义，画“源表 → 分析表 → 分支 → 图表 → 指标”五层思维导图（D-030）。

## 标准链路

```
list_spaces → list_projects → list_project_assets
  → get_project_asset_details(maxRows≈5)        # 真实字段名与类型
  → [profile_project_tables]                    # 值域、空值；不是最终数字
  → get_analysis_authoring_help(topic)          # 每个 topic 本会话只读一次
  → upsert_tables → 轮询 operation 到 SUCCEEDED（数据更新完成）→ details 回读 READY
  → upsert_charts → details 回读 → 浏览器目视（Chrome 插件优先）
  → prepare_dashboard → 核对 interactionReview → upsert_dashboards → details 回读 → 目视（见 references/dashboard.md）
  → 追加操作日志，按「每步沉淀」更新本 Skill
```

- 新会话先 `list_spaces`；同一对话未切换项目时一直复用同一个 projectRef。
- 导入的原始表标“数据源表·不可直接建图”：必须先 `upsert_tables` 建一张加工分析表，图表挂在加工表下。
- 跨表 join/union 只能在分析表里做，图表 query 里禁止。
- 每次写入用新的 `idempotencyKey`（如 `<项目>-<资产>-v<n>`）；`retryable:false` 的错误先按诊断改 DSL，再换新键提交，不原样重试。
- 工具细节、轮询与错误处理见 `references/tool-chain.md`。

## 写 DSL 前

DSL 是最后一层：写法以当次 MCP 返回的 Help 为准，下面只记录查 Help 的方法和已踩过的坑。

- Help 主题很大（edit/query ≈30KB，edit/chart ≈98KB）。超出返回上限时，用 jq 取出 `.data.content` 存到 scratchpad，先 grep 标题建索引，再按节读取，不要整篇反复读。
- 字段名只抄 `get_project_asset_details` 返回的，原样保留空格、括号和后缀。
- Help 与实际校验可能不一致，以校验报错为准，并把差异记入 `references/known-issues.md`。
- Help 没写的能力（如指标定义），请用户在界面做一个最小样例，再用 `get_project_asset_definitions` 反读出 DSL 写法；不猜语法。全量重写资产前同样先反读，把用户在界面做的改动原样带上。改已有图表优先 `Chart.edit` 增量编辑：`Chart.from` 全量重写会重置界面里调过、DSL 表达不了的设置（K-19），确需重写时先问用户、写后目视（D-031）。
- 图表 DSL 提交前运行校验器：

```bash
node scripts/lint_chart_dsl.mjs <脚本文件>
```

  它检查已沉淀的确定性规则（同字段同聚合多系列、堆积颜色维度未固定顺序、裸 count()、图表 query 内 join/union、图表分支里造指标、size 映射被固定大小覆盖、图表级透明度、窗口求分区极值、万级单位后缀重复、条件格式挂在指标上、指标公式引用参数、公式里用相对日期、回写反读的数字格式）。图表踩坑与正确写法见 `references/chart-dsl.md`。

## 核验：回读 + 目视，缺一不可

- **回读**（`get_project_asset_details`）证明：资产存在、READY、字段与排序配置、聚合数字。
- **回读证明不了**：图形结构、系列是否被拆、颜色与样式。图表“预览数据”是按全部维度最细粒度（x 轴 × 颜色维度 × …）出的查询结果，不代表渲染。
- **目视**默认用 Chrome 插件，当前会话没有 Chrome 插件工具或连不上时才用内置浏览器；在自己开的标签页里只看不存；看板的最终效果用编辑器右上角「预览」看，等动画结束（约 20 秒）再截图（D-003、K-26）。
- 目视细则（等首帧、只看不改、避免“未保存”状态）见 `references/verification.md`。
- 标签页：只看效果时开预览页，并在同一个标签页里复用；编辑器用完就关；不为绕开“离开此网站”而新开标签页；每轮核验结束关掉自己开的多余标签页（D-045）。

## 每步沉淀（维护模式）

仅当用户要求“沉淀规范 / 更新本 Skill”时执行；普通建表建图任务只需在工作目录记操作日志。每完成用户的一步：

1. 在当前工作目录的 `MCP操作日志.md` 追加：调用、结果、发现（含失败与修正）。
2. 从“发现”里挑出可泛化的规则：问“换三种输入它还成立吗”，只沉淀成立的。规则正文用占位符和通用表述，具体场景（字段名、业务口径、配色）只进 `evals/`，不进 SKILL.md 和 references（D-011）。
3. 按 `skill-governance` 写入：失败场景先进 `evals/anchors.md` → 非显然规则进 `DECISIONS.md` → 能机器判断的进 `scripts/`，否则进对应 reference → `CHANGELOG.md` 记版本。
4. 平台缺陷与环境限制进 `references/known-issues.md`，不写成操作规则。
5. 新用例的场景词追加到 `evals/scenario-terms.txt`；跑 `scripts/test_lint_chart_dsl.mjs`、`scripts/check_generic.mjs` 与治理校验器，向用户汇报本步新增了哪些规范。
