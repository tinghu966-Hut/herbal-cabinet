# Codex 百斗柜代码审查

> 审查时间：2026-06-16
> 审查人：Codex CLI (openai/gpt-5-chat via CC Switch)

---

## 总体评价

百斗柜 Phase 1 已经超过了"能用"的阶段，进入"日常好用"的门槛。当前不需要大改，主要是清理和加固。

| 维度 | 评分 | 说明 |
|:----|:---:|:-----|
| 架构设计 | ⭐⭐⭐⭐ | 掌柜-小伙计-分类树角色清晰 |
| 代码质量 | ⭐⭐⭐ | 整体良好，有些可清理的地方 |
| 扩展性 | ⭐⭐⭐ | JSON存储适合当前规模，未来可升级 |
| 安全性 | ⭐⭐⭐ | 本地使用无鉴权问题，但API Key暴露在代码中 |

---

## 具体建议

### P0：统一环境变量名

`shopkeeper.js` 中读取 `OPENAI_BASE_URL` 和 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。目前兼容了多种来源，但命名不够语义化。

建议：
- 统一为 `HERBAL_API_URL` 和 `HERBAL_API_KEY`
- 同时保留对 `OPENAI_BASE_URL` 的 fallback（向后兼容）

### P0：移除未使用的依赖

`package.json` 中：
- `dotenv` — 没有被任何源文件 import
- `uuid` — 没有被使用（`clerk.js` 使用了 Node.js 内置的 `randomUUID`，不需要外部包）

建议：
```bash
npm uninstall dotenv uuid
```

### P1：拆分 shopkeeper.js（~700行）

当前 `shopkeeper.js` 混合了以下职责：
1. API 调用 + 重试逻辑
2. 同义词扩展
3. 翻译、分类、摘要生成
4. 主流程 orchestration
5. 状态查询

建议拆成：
- `api-client.js` — API 调用、错误重试、同义词映射
- `classifier.js` — 翻译、分类路径判断、摘要生成
- `orchestrator.js` — process/recall 主流程

### P1：清理动态 import

`shopkeeper.js:658` 的 `checkBackupStatus()` 方法中，对 `node:fs`、`node:path` 等做了动态 import（`await import(...)`），而文件顶部已经有静态 import：

```javascript
// 顶部已静态 import
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
```

建议移除动态 import，复用顶部的静态 import。

### P2：备份计数器优化

`backup.js` 的 `totalEntryCount()` 每次都遍历整个 `data/drawers` 目录树来数条目数。目前数据量小（~55条）没问题，但如果未来增长到上千条，这个操作会越来越慢。

建议：
- 维护一个全局计数器文件 `data/stats.json`
- 每次 store/delete 时更新计数器
- 备份时直接读计数器，不用遍历

### P3：考虑的功能扩展

1. **标签系统** — 除了树形分类，加一层扁平标签（tags），方便跨类别检索
2. **归档抽屉的导出** — 存档的抽屉数据能否导出为 JSON 或 CSV？
3. **记忆链接** — 支持条目间的引用关系（类似笔记软件的 [[wikilink]]）
4. **定期自动分裂** — 当前只在插入时触发分裂检查；可以加一个定时任务周期性检查

---

## 总结

```
当前架构: ✅ 设计合理，可以继续使用
代码质量: ✅ 整体良好，无需大改
优先级:   🔴 清理依赖 → 🟡 拆分模块 → 🟢 功能扩展
```
