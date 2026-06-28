# 百斗柜（Herbal Cabinet）产品开发任务

## 定位
"百斗柜：人机共用的本地记忆容器"  
"Herbal Cabinet is a local-first memory container for humans and AI — structured, searchable, and yours to own."

## 当前架构（保留并重构）
已有代码在 C:\Users\admin\.openclaw\workspace\herbal-cabinet\
- src/ 下: cli.js, shopkeeper.js, clerk.js, classifier.js, api-client.js, taxonomy.js, integration.js, index.js, backup.js
- 数据在: data/drawers/ 下（抽屉按目录结构存储）
- 每个抽屉: data/drawers/xx/yy/entries.json
- 伙计配置: data/config/clerks.json
- 分类法: data/config/taxonomy.json

## 产品化要求（请实现以下全部）

### 1. 容器系统重构（核心）
按以下层次重构：
- **Cabinet（柜子）**：一个用户/项目多个柜子
- **Drawer（抽屉）**：一个主题的记忆，软上限 30 条，硬上限 50 条
- **Entry（条目）**：一条记忆

#### 新 Record 结构：
```js
{
  id: string (UUID),
  cabinet: string,        // 所属柜子（原项目名）
  drawerPath: string[],    // 抽屉路径
  drawerId: string,        // 抽屉唯一 ID
  content: string,          // 中文内容
  originalContent: string,  // 原始语言内容
  summary: string,          // 摘要
  keywords: string[],       // 关键词
  tags: string[],           // 多标签
  type: string,             // decision | discussion | record | idea | todo
  source: string,           // 来源
  reason: string,           // 记录理由
  owner: string,            // 所有者用户 ID
  agent: string,            // 操作者 Agent ID
  relations: string[],      // 关联条目 ID
  lastAccessed: string,     // 最后访问时间
  accessCount: number,      // 访问次数
  time: string,             // 创建时间
  timestamp: string,
  importance: number,       // 1-5 重要性（可选）
  archived: boolean
}
```

### 2. 倒排索引系统
建立关键词倒排索引，避免全文扫描：
- 索引文件：data/index/inverted.idx （JSON 格式）
- 增量更新：新增记录时同步写入索引
- 重建命令：node src/cli.js reindex
- 索引结构：{ keyword: [entryId1, entryId2, ...] }
- 支持同义词扩展查询

### 3. 抽屉自动分裂（已含部分逻辑，需完善）
- 软上限 30 条 → 触发分裂建议（store 时记录警告）
- 硬上限 50 条 → 自动分裂
- 分裂逻辑：用 LLM 分析现有条目，建议子抽屉名称
- 分裂结果：父抽屉归档（archived=true），子抽屉创建
- 分裂后可手动合并

### 4. 多用户支持
- 一个用户可以有多个柜子
- 每个柜子独立的 config（drawer limits、主题等）
- 柜子元数据：data/cabinets/{cabinetName}/.meta.json
- 不实现用户认证（BYOK，用户自己控制）

### 5. HTTP API 服务器
用 Node.js 内置 http 模块（零依赖）启动 REST API：

| Method | Endpoint | 功能 |
|--------|----------|------|
| GET    | /api/status | 系统状态 |
| POST   | /api/store  | 存入记忆 { content, cabinet, drawer?, tags? } |
| POST   | /api/recall | 检索记忆 { query, cabinet?, limit? } |
| POST   | /api/recall-cross | 跨柜检索 { query, limit? } |
| GET    | /api/drawers | 列出所有抽屉 |
| GET    | /api/drawers/:path | 查看抽屉内容 |
| POST   | /api/export | 导出 JSON |
| POST   | /api/import | 导入 JSON |
| POST   | /api/reindex | 重建索引 |

服务器启动：node src/server.js [port]（默认 5432）
支持 CORS 头，方便前端对接

### 6. CLI 增强
完整命令集：
```
node src/cli.js store <内容> -D "分类" [-T "标签1,标签2"] [-S 来源] [-R 理由] [-O 用户] [-I 重要性]
node src/cli.js recall <查询> [-C 柜子] [-T 标签] [-L 限制] [-type 类型]
node src/cli.js rc <查询>         # 跨抽屉聚合检索
node src/cli.js status            # 完整状态（含索引信息）
node src/cli.js reindex           # 重建索引
node src/cli.js export [-O 导出路径]  # 导出 JSON
node src/cli.js import [-I 导入路径]  # 导入 JSON
node src/cli.js info <抽屉路径>    # 查看抽屉详情
node src/cli.js split <抽屉路径>   # 手动触发分裂
node src/cli.js merge <源> <目标>  # 合并抽屉
```

交互模式下新增命令：
- ?query — 检索
- !info — 看状态
- /export — 导出
- /split — 分裂

### 7. 频率加权检索增强
在当前加权排序基础上：
- 时间衰减：30天线性衰减（已实现）
- 访问频率加权：accessCount * 0.1
- 最近访问加权：lastAccessed 近 7 天额外 +0.5
- 重要性加权：importance * 0.5

### 8. npm 包结构
package.json 完善：
- name: @herbal-cabinet/core（或 herbal-cabinet）
- bin: 添加 cli 入口
- exports: 导出 API 供其他模块使用
- 零外部依赖

### 9. 数据迁移
- export: 导出为单个 JSON 文件（包含所有柜子/抽屉/索引）
- import: 从 JSON 文件恢复
- JSON 结构可读，方便用户自行编辑

### 10. 文档
- README.md：安装方式、命令文档、API 文档
- CONCEPT.md：产品概念（保留原有但更新）
- 每个配置文件的注释说明

## 约束
- 零外部 npm 依赖（只用 Node.js built-in）
- ES Module（type: module）
- 所有中文提示和输出
- 兼容现有 data/drawers/ 结构（不要丢数据！）
- 代码清晰，每个文件职责单一

## 优先级
P0（必须实现）：
1. 容器系统重构 + 新 record 结构
2. 倒排索引
3. 抽屉自动分裂完善
4. CLI 增强
5. 文档更新

P1（重要）：
6. HTTP API 服务器
7. 多用户 / 多柜子
8. npm package.json 完善

P2（锦上添花）：
9. 数据导入导出
10. 频率加权增强

开始干吧！先读懂现有代码，然后一步一步重构和扩写。
