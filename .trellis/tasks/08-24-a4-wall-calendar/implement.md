# A4 竖版中国月历生成器：实施计划

## 1. Baseline and Data Correctness

- [x] 审查当前原型与 `chinese-days` 实际 API，确认支持年份和字段语义。
- [x] 将日期计算中的可验证规则整理为纯函数或稳定接口。
- [x] 修正普通工作日、放假、调休补班、节气重叠等状态判定。
- [x] 增加关键日期和月份网格的自动化检查，至少覆盖元旦、春节、清明、劳动节、端午、中秋和国庆。

## 2. Generator Interaction

- [x] 年份选择器只列出放假数据完整的年份。
- [x] URL 年份参数合法时可复现选择；非法或越界时安全回退。
- [x] 年份切换后完整重绘 12 个月且所有辅助信息同步。
- [x] 打印按钮调用浏览器原生打印，打印模式隐藏工具栏。

## 3. A4 Visual and Print Layout

- [x] 校准 A4 物理尺寸、安全边距、页眉、星期栏、日期网格与页脚比例。
- [x] 检查 4、5、6 行月份，保证格子不裁切且书写空间尽可能大。
- [x] 校准放假淡红、节气淡紫、双色重叠、补班徽标和图例。
- [x] 提升农历、节气、假期标签与格线的打印可读性。
- [x] 确认普通日期不出现多余状态标记。

## 4. Local Delivery

- [x] 完善本地开发、构建、预览和浏览器打印说明。
- [x] 保留可选 CLI PDF 导出，支持 `CHROME_PATH` 覆盖并改善错误提示。
- [x] 不增加 GitHub Pages、GitHub Actions 或公网部署配置。

## 5. Validation

按顺序执行：

```bash
npm install
npm run build
npm test
npm audit
npm run pdf -- 2026
pdfinfo output/wallcal-2026.pdf
```

验收检查：

- [x] PDF 为 12 页，每页 A4 Portrait，无附加空白页。
- [x] 用 PDF 转图或打印预览抽查 4、5、6 行月份。
- [x] 自动化检查验证全年 24 节气、补班数量及关键假期日期。
- [x] 手工抽查农历初一、除夕及随机日期。
- [x] 最终执行 Trellis check，核对 PRD 每条验收标准。

## Risky Files and Rollback Points

- `src/main.js`：日期状态误判会造成全年系统性错误；先用数据检查锁定规则再调整渲染。
- `src/style.css`：毫米尺寸或分页规则变化可能产生裁切/空白页；每次关键改动后重新导出 PDF。
- `package.json` / `package-lock.json`：升级日历依赖可能改变数据；升级前后执行固定日期回归。
- `scripts/export-pdf.js`：只影响辅助导出，不应阻断浏览器打印主路径。
