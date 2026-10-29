# 看板（Dashboard）实战规范

只记录实际跑通过的写法；完整契约以 `edit/dashboard/markup-authoring` Help 为准。占位符同 chart-dsl.md。

## 目录

- 链路
- 联动优先于筛选器
- 跨表联动与筛选器绑定
- 参数驱动的同环比指标卡
- 界面编辑的代价
- 指标卡
- 版式骨架
- 刊物风版式
- 编译诊断
- 核验

## 链路（D-020）

```
help(edit/dashboard/markup-authoring)
  → 先建好全部图表与指标卡并回读 READY
  → prepare_dashboard(intent=create, html=完整文档)        # 编译，未落盘
  → 按返回的 interactionReview 逐项确认（filters、charts 的联动 / 钻取）
  → upsert_dashboards(preparedArtifactId, interactionReview)   # 一次性落盘
  → get_project_asset_details 回读组件与像素布局
  → 用返回的看板 openUrl（/fvs/…）在浏览器目视（Chrome 插件优先，见 verification.md）
```

- 看板路径 `/<目录>/<看板名>.dashboard`，根节点 `name` 必须等于路径末段。
- 修改已有看板先 `get_dashboard_markup`，用 `intent=edit` + `edits` 局部替换，沿用节点 id。
- **每次保存后重读再改**：保存后平台会规范化文档（补布局盒、改 padding、拆分节点），沿用旧文档的 `edits` 会整批不生效（K-21）。
- 所有文本显式写 `font-weight`：未写的文本保存后会变粗体（K-21）。
- 整篇改版（`html`）沿用全部节点 id 时，文档里看不到的交互配置（筛选器控制范围、参数绑定、跨表联动）按 id 保留；提交前对照 interactionReview 确认。
- 主题目录主题（`edit/dashboard/markup-style`）当前未开放（K-12）：没有用户指定时用 Help 示例中的 `light.blue.柔彩蓝`，不猜其他 ID。

## 联动优先于筛选器（D-023）

- 同一看板里来自**同一张分析表**的组件默认开启“天然联动”（回读显示 `天然联动: 开启`）：点击任一图上的数据块（某年、某分类、某区域），其余指标卡、图表、表格按该条件联动。
- 所以设计看板时让组件尽量挂同一张分析表；用户要“看某一年 / 某类对象”时，先告诉他点击联动即可，不要默认加筛选器。
- 筛选器只在这些情况加：需要默认筛选或常驻条件；要筛的字段不在任何图的维度里；跨表组件需要统一过滤。
- 联动下固定值参考线、固定口径文字不会跟着变（如整体比率固定线）：要么改成随数据变化的写法，要么在说明里标注“全量口径”。

## 跨表联动与筛选器绑定（D-034，2026-10-24 修订）

- 来自不同分析表的组件**不会天然联动**。Markup 不表达联动，但 `prepare_dashboard` 之后可以用 `enhance_dashboard_interactions` 配置：组件的跨表联动、筛选器的绑定范围（整体重设或清空），再随 `upsert_dashboards` 落盘。写法以当时的 Help 为准。界面配置（组件 → 交互 → 设置联动对象）仍可用。
- 限制（K-30）：同一组件的多条跨表联动不能重名；交叉表作联动源时只能传第一级行维度，下钻出来的层级不能传；选项来源为“组件字段”的筛选器不能做级联。
- 筛选器里有失效绑定时，平台要求改绑定范围前先问用户；确认后整体重设绑定范围，失效项随之清除。
- 新表要被全局筛选器控制，表里必须有同名字段（modeling-method.md 七）。
- 配置是传值：源组件的维度逐一映射到目标分析表的字段（同名自动匹配，异名手选），再勾选联动图表。
- 可勾选的只有**直接挂在目标表上的图**；挂在分支上的图在目标表下拉里显示为独立数据表，不在列表中，也不受这条联动影响。参数驱动的指标卡通常不应被跨期联动影响，正好保持不联动。
- 源组件有下钻时，点击会弹出「联动 / 图表内钻取」选择菜单，两者可以共存。
- 只改交互配置的界面保存不会破坏 Markup（K-17 只在其他界面编辑后出现），之后仍可用 MCP 改版。
- 核验以界面点击为准：`dashboard_view` 模拟跨表联动时，作用范围会比界面实际更大（K-20）。

## 参数驱动的同环比指标卡（D-025）

一个年月筛选器同时做两件事：**绑定参数**驱动指标卡，**绑定字段**控制其余图表。

1. 参数（年月类型，如 `<参数>`）在界面“参数”入口创建；MCP 能读不能写，反读写法为 `Param.yearMonth().defaultValues("<yyyy-MM>")`。
2. 分析表加原子字段 `.formula("COMBINE([<日期>], 'YM')").as("<年月>")`（YearMonth）。
3. 指标卡分支用参数按期汇总，指标里算同环比：

```
Chart.from(query.from("<表>").agg(
    sum("<度量>").filter("[<年月>] = @<参数>").as("本期<度量>"),
    sum("<度量>").filter("[<年月>] = COMBINEDELTA(@<参数>, -1, 'M')").as("上期<度量>"),
    sum("<度量>").filter("[<年月>] = COMBINEDELTA(@<参数>, -12, 'M')").as("去年同期<度量>")
  ).label("<步骤名>"))
  .metric("<环比名>", "SUM([本期<度量>])/SUM([上期<度量>])-1")
  .metric("<同比名>", "SUM([本期<度量>])/SUM([去年同期<度量>])-1")
  .encode("text", sum("本期<度量>"), metric("<环比名>"), metric("<同比名>"))
  .style("textLayout", TextLayout.PRIMARY_SECONDARY_3_1)
  .numberFormat(metric("<环比名>"), NumberFormatConfig.percentage(1)) …
```

   计数用 `countDistinct("<ID>").filter(...)`；比率指标的“较上期”用百分点差 `Σa/Σb − Σa'/Σb'`。
4. 看板筛选器（界面操作）：绑定参数 → 绑定字段时只勾选要受控的图表（指标卡、趋势图不勾）→ 默认值选“自动继承”跟随参数默认值。回读详情只显示字段绑定，不显示参数绑定；日期区间控件的参数绑定和快捷区间在 Markup 里可见（`bind-start-param` / `bind-end-param` / `date-range-shortcuts`），改版式时原样保留即可。
5. 核验：`dashboard_view` 的临时控件值能验证字段绑定（回执“查询条件已应用”），**不能证明参数传递**（K-18）；参数效果在编辑器里把控件默认值临时改成无数据的月份，指标卡归零即证明参数生效，再改回“自动继承”。
6. 同组指标卡做一致性检查：比率卡的本期值 = 分子卡本期值 ÷ 分母卡本期值。

## 界面编辑的代价（D-026、D-028）

**恢复路径**：看板在界面保存后不可读时，请用户让平台 AI 生成该看板的副本；副本可被 `get_dashboard_markup` 正常读写，之后在副本上用 MCP 持续修改（已验证：整篇改版 + 局部 edits 保存后仍可读）。改副本时**沿用原节点 id**，文档里看不到的配置（如筛选器的参数绑定）按 id 保留。

筛选器的 Markup 写法（反读所得，绑字段；参数绑定不在文档中显示）：

```html
<fx-filter id="<id>" label="<标题>" type="date_picker" multi-select="false" source-ref="<分析表>" field="<年月字段>"
  data-type="yearmonth" date-granularity="year_month" date-shortcut="none" style="width:280px;height:52px;align-self:center"></fx-filter>
```

- 控件皮肤由 `fx-theme` 的 `filter-style` JSON 决定（backgroundColor、borderColor、radiusValue 等）。换主题不会重置它：从深色副本改成浅色时必须显式写浅色 `filter-style`，否则控件仍是深色块。
- 内置预设主题 ID 已见：`light.blue.柔彩蓝`、`默认暗黑`。


- 在界面编辑并保存看板后（只改交互配置时除外），平台可能写入移动端组件样式覆盖，`get_dashboard_markup` 报 `DASHBOARD_MARKUP_READ_FAILED`，看板**不能再用 Markup 修改**，只能继续界面操作。
- 所以：版式、组件、说明文字全部先用 MCP 定稿；必须界面操作的（参数绑定、筛选器）放在最后一步，做完不再回到 Markup。
- 界面操作时控件会落在画布中间；用“外观 → 位置布局”填写 X/Y/W/H 精确摆放。

## 指标卡（D-021）

看板上的业务数字一律取数。优先做成单值 KPI 图再用 `fx-chart` 引用，而不是 `fx-value`：KPI 图能回读到 READY 数字，且能引用指标做比率。

```
Chart.from(query.from("<表>")).encode("text", sum("<度量>").as("<卡片标签>"))
  .numberFormat(sum("<度量>"), NumberFormatConfig.number(1, NumLevel.TEN_THOUSAND, "元")).legend(false).build()
Chart.from(query.from("<表>")).metric("<比率名>", "SUM([<分子>])/SUM([<分母>])")
  .encode("text", metric("<比率名>")).numberFormat(metric("<比率名>"), NumberFormatConfig.percentage(1)).legend(false).build()
Chart.from(query.from("<表>")).encode("text", countDistinct("<ID>").as("<对象数>")).legend(false).build()
```

- 卡片标签来自 `.as()` 或指标名；KPI 图自带“标签 + 数字”，外层容器不再加同名标题。
- 回读预览里万级单位显示为英文 “Ten Thousand”，看板上渲染为“万”（K-13）。

## 版式骨架（D-020）

视觉方向按 `visual-style.md` 的场景评估从 `visual-directions.md` 选定（D-037）；下面是早期的深色页头骨架，只作 Markup 写法参考。

```html
<main id="<看板名>" data-fx-dashboard name="<看板名>" width="1440" height="1400" background="#F3F5F9"
      style="display:flex;flex-direction:column;gap:16px;padding:24px 32px">
  <fx-theme theme-spec="light.blue.柔彩蓝" chart-font-size="16" table-font-size="14"></fx-theme>   <!-- 必设图内字号，默认偏小 -->
  <div id="页头" data-fx-container="true" style="height:108px;display:flex;flex-direction:column;gap:6px;padding:20px 28px;background:#1E3A5F;border-radius:12px">
    <fx-text id="页标题" style="height:36px;font-size:26px;font-weight:700;color:#FFFFFF">…</fx-text>
    <fx-text id="页副标题" style="height:22px;font-size:14px;color:#B9C8DE">…</fx-text>
  </div>
  <div data-fx-layout="row" style="display:flex;gap:16px;height:120px">            <!-- 指标卡行 -->
    <div id="卡片X" data-fx-container="true" style="flex:1;display:flex;flex-direction:column;padding:8px 12px;background:#FFFFFF;border-radius:10px;border-left:4px solid #2F6BFF">
      <fx-chart id="指标X" component-ref="<指标卡图名>" style="flex:1"></fx-chart>
    </div>
  </div>
  <div data-fx-layout="row" style="display:flex;gap:16px;height:440px">            <!-- 主图 3 : 辅图 2 -->
    <div id="区块A" data-fx-container="true" style="flex:3;display:flex;flex-direction:column;gap:4px;padding:16px 20px;background:#FFFFFF;border-radius:12px">
      <fx-text id="A标题" style="height:26px;font-size:17px;font-weight:700;color:#1F2937">…</fx-text>
      <fx-text id="A说明" style="height:20px;font-size:13px;color:#6B7280">…</fx-text>
      <fx-chart id="图A" component-ref="<图名>" style="flex:1"></fx-chart>
    </div>
  </div>
</main>
```

- 深色块只放文字（页头），承载图表、KPI 的区块用浅色，保证组件文字可读；页头右侧预留约 300px 给后加的筛选器。
- 1440 宽页面必设 `chart-font-size`（16 左右）与 `table-font-size`（14 左右），否则图内文字偏小（D-027）。
- 指标卡行高度建议 ≥160px；KPI 图用 `.style("fit", false).style("size", <0.5~0.7>)` 统一字号，先调一张卡目视确认不重叠再批量（0.9 会挤掉标签）。
- 目标路径已有同名看板时，create 会被自动改名为“<名>1”；需要新名称时显式改路径和根 name。
- 说明文字里出现日期、阈值等固定数字时加 `data-fx-static-number="<理由>"`。
- 单侧边框（`border-left`）会被编译成同位置的装饰细条，效果可用。

## 刊物风版式（D-035）

方向库中“刊物风”的版式细则（选择条件见 `visual-directions.md`）：

- 纸色页面底；承载图表、指标卡的容器底色与页面同色、`border:none`，组件像直接印在页面上。
- 指标卡之间用 `border-left:1px solid <细线色>` 分隔，不用卡片。
- 分节：编号小字（如“01 / <节名>”）+ 节标题 + 右侧一句注释（说明是否受筛选器控制）+ 1px 细线。
- 强调色只取一个，并同步到：节编号、引言竖线、表格 `table.primaryColor`、筛选器 `filter-style.highlightColor`；图表系列用 `colorMapping` 固定为同一色系的低饱和色，折线用中性深色。
- 解读文字只写定性结论，标注“全量数据”，不写死数字。
- 参照别的看板改版时只借视觉语言，沿用原 id 整篇改版，不复制其主题与结构。

## 编译诊断

- 容器高度包含上下 padding：`height ≥ padding-top + padding-bottom + Σ子项高度 + gap×(n-1)`，不满足时报 “纵向内容至少需要 Npx”。
- 诊断是整批未生效（NONE_APPLIED），按提示改完整份重新 prepare。

## 核验

- 回读给出组件 → 图表映射、联动开关和每个区块的像素矩形，用来核对没有漏图、没有错位。
- **看板主题会覆盖图表在分析页里的配色**，系列颜色、撞色问题必须在看板视图里重新目视（D-022）。
- 看板 openUrl 打开的是编辑态，只截图不改动、不点保存。编辑态会给每个组件画虚线框，透明背景、融合效果要点右上角「预览」再看。
