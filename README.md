# 🏪 Herbal Cabinet (百斗柜)

> **A local-first memory container for humans and AI agents — structured, searchable, and yours to own.**
> _人机共用的本地记忆容器 | 零外部依赖 · 纯 Node.js · BYOK_

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Dependencies](https://img.shields.io/badge/dependencies-0-blue)

**Inspired by traditional Chinese apothecary cabinets** — a wall of wooden drawers, each holding one herb. The shopkeeper knows where everything is, and when a customer comes with a prescription, they find it in seconds.

Herbal Cabinet brings this logic to the AI world: **Cabinet → Drawer → Entry**, structured, searchable, and fully under your control.

---

## 🎥 Demo

```bash
# Store a memory with AI classification
$ node src/cli.js store "Discussed switching from Stripe to PayPal" -D "Business > Payments" -T "decision,payment"

🧑💼 掌柜收到: "Discussed switching from Stripe to PayPal"
  📂 Dashboard > Payments
  📝 Classified as: decision
  💾 Saved ✅

# Recall it later — no need to remember the exact words
$ node src/cli.js recall "payment method change"

  [1] 📁 Business > Payments
      时间: 2026-06-28
      摘要: Decided to switch payment provider from Stripe to PayPal
      标签: decision, payment
```

---

## 📦 Core Philosophy

| Not This | This |
|:---------|:-----|
| ❌ "AI auto-tags everything for you" | ✅ **A well-designed container, managed by AI** |
| ❌ Cloud lock-in / vendor dependency | ✅ **BYOK (Bring Your Own Key), data stays local** |
| ❌ Black-box vector search | ✅ **Path-based classification — walk to the right drawer** |
| ❌ Unlimited stuffing | ✅ **Drawers auto-split at capacity limits** |

---

## ✨ Features

- **🏛️ Container System**: Cabinet → Drawer → Entry, three-layer hierarchy
- **📂 Auto-splitting Drawers**: Soft limit 30, hard limit 50 — auto-splits when full
- **🔍 Inverted Index**: Fast keyword search, no full-text scanning
- **🏷️ Multi-tag System**: Flexible filtering and categorization
- **⚡ Weighted Ranking**: Time decay + access frequency + importance
- **👥 Multi-cabinet**: Organize different projects into separate cabinets
- **🌐 HTTP API**: RESTful API for frontend and Agent integration
- **💻 Full CLI**: All operations from the command line
- **📤 Portable Data**: JSON export/import — your data is always yours
- **🔌 Zero External Dependencies**: Built-in Node.js modules only
- **🔒 Concurrent-safe**: File-lock mechanism for multi-agent writes

---

## 🚀 Quick Start

```bash
# 1. Clone (or just download, no install needed)
git clone https://github.com/tinghu966-Hut/herbal-cabinet.git
cd herbal-cabinet

# 2. Set your API key (DeepSeek has a free tier)
export DEEPSEEK_API_KEY=sk-your-key

# 3. Try it:
node src/cli.js status
```

That's it. Zero dependencies. No `npm install`, no Docker, no database.

### Full Example

```bash
# Initialize with sample data to explore
node src/cli.js init

# Store a memory — AI auto-classifies it into the right drawer
node src/cli.js store "Discussed product direction" -D "Project > Product"

# Search — keyword match + time decay ranking
node src/cli.js recall "product"

# System status
node src/cli.js status
```

> **No API key?** DeepSeek offers a free tier with enough credits to start. Or use any OpenAI-compatible API.

**Output example:**
```
🏪 百斗柜 · 系统状态

📦 柜子: 1 个
  📦 default: 38 个活跃抽屉, 125 条记录

📊 倒排索引: 1240 个关键词, 4783 条引用

🏷️  热门标签:
  百斗柜 — 3条
  产品重构 — 1条
  定价 — 1条
  💻 服务:
  CLI:  node src/cli.js
  API:  node src/server.js [port]
```

### Other Environments

```bash
# PowerShell / Windows
export $env:DEEPSEEK_API_KEY="sk-your-key"

# English output
set HERBAL_LANG=en

# Custom API endpoint (e.g., local proxy)
set OPENAI_BASE_URL=http://localhost:15721
```

---

## 📖 CLI Reference

### `store` — Store a memory

```bash
node src/cli.js store <content> [options]

Options:
  -D, --drawer "path"         Drawer path (required: "Category > Subcategory")
  -T, --tags "tag1,tag2"      Tags
  -S, --source source         Source (default: conversation)
  -R, --reason reason         Reason for storing
  -O, --owner owner           Owner/user ID
  -I, --importance 1-5        Importance level
  -C, --cabinet name          Cabinet name

Example:
  node src/cli.js store "Fixed birth chart calculation bug" -D "Project > Destiny > Fixes" -T "bug,bazi"
```

### `recall` — Search memories

```bash
node src/cli.js recall <query> [options]

Options:
  -C, --cabinet name    Limit to cabinet
  -T, --tag tag         Filter by tag
  -L, --limit N         Result limit (default 10)
  --type type           Filter by type (discussion|decision|tech_note|idea)

Example:
  node src/cli.js recall "birth chart" -L 5
```

### `rc` — Cross-drawer search

```bash
node src/cli.js rc <query> [options]
```

### `status` — System status

```bash
node src/cli.js status
```

### `reindex` — Rebuild inverted index

```bash
node src/cli.js reindex
```

### `init` — Initialize with sample data

```bash
node src/cli.js init
```

### `export / import` — Data migration

```bash
node src/cli.js export
node src/cli.js import ./file.json
```

### `split / merge` — Drawer management

```bash
node src/cli.js split "Project > Cabinet"
node src/cli.js merge "source/path" "target/path"
```

### `detail` — Drawer details

```bash
node src/cli.js detail "Project > Cabinet"
```

### Language

Add `--lang=en` to any command for English output, or set `export HERBAL_LANG=en`.

---

## 🌐 HTTP API Server

```bash
# Start server (default port 5432)
node src/server.js

# Custom port + optional auth token
HERBAL_AUTH_TOKEN=my-secret-token node src/server.js 8080
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | System status |
| POST | `/api/store` | Store memory `{ content, cabinet?, drawer?, tags? }` |
| POST | `/api/recall` | Search `{ query, cabinet?, limit? }` |
| POST | `/api/recall-cross` | Cross-cabinet search `{ query, limit? }` |
| GET | `/api/drawers` | List all drawers |
| GET | `/api/drawers/:path` | Drawer details |
| POST | `/api/export` | Export all data |
| POST | `/api/import` | Import data `{ data: ... }` |
| POST | `/api/reindex` | Rebuild index |
| POST | `/api/split` | Split drawer `{ drawer, cabinet? }` |
| POST | `/api/merge` | Merge drawers `{ child, parent, cabinet? }` |
| GET | `/api/cabinets` | List cabinets |

### Auth (optional)

Set `HERBAL_AUTH_TOKEN` env var to require bearer token authentication:

```bash
export HERBAL_AUTH_TOKEN=your-secret
curl -X POST http://localhost:5432/api/status \
  -H 'Authorization: Bearer your-secret'
```

### Examples (curl)

```bash
# Store
curl -X POST http://localhost:5432/api/store \
  -H 'Content-Type: application/json' \
  -d '{"content": "Test memory entry", "drawer": "General", "tags": ["test"]}'

# Search
curl -X POST http://localhost:5432/api/recall \
  -H 'Content-Type: application/json' \
  -d '{"query": "test", "limit": 5}'
```

---

## 📁 Data Structure

```
data/
├── cabinets/                    # Cabinet system (v2)
│   └── default/                 # Default cabinet
│       ├── .meta.json           # Cabinet config (soft/hard limits, etc.)
│       ├── index.idx             # Inverted index
│       └── drawers/             # Drawer data
│           ├── Project/
│           │   └── Product/
│           │       └── entries.json
│           └── Tech/
│               └── AI-Models/
│                   └── entries.json
├── drawers/                     # Legacy data (v1, auto-migrated)
├── index/                       # Legacy index
├── locks/                       # Lock files (concurrency control)
└── config/                      # Legacy config
```

### Entry Structure

```json
{
  "id": "uuid",
  "cabinet": "default",
  "drawerPath": ["Project", "Product"],
  "drawerId": "Project›Product",
  "content": "Memory content in Chinese",
  "originalContent": "Original text (any language)",
  "summary": "One-line summary",
  "keywords": ["keyword1", "keyword2"],
  "tags": ["tag1"],
  "type": "discussion",
  "source": "conversation",
  "reason": "Why this was stored",
  "owner": "local",
  "lastAccessed": "ISO timestamp",
  "accessCount": 5,
  "time": "ISO timestamp",
  "timestamp": "ISO timestamp",
  "importance": 3,
  "archived": false
}
```

---

## 🧠 Glossary

> For English-speaking users who find the Chinese-inspired naming confusing.

| Term | Chinese | Meaning |
|:-----|:--------|:--------|
| **Cabinet** | 柜子 (guìzi) | A project-level container holding related drawers. Like a filing cabinet for one project. |
| **Drawer** | 抽屉 (chōuti) | A topic-specific container holding entries. Like one drawer in an apothecary cabinet. Soft limit: 30 entries, hard limit: 50. |
| **Entry** | 条目 (tiáomù) | A single memory record with content, summary, keywords, and metadata. |
| **Shopkeeper** | 掌柜 (zhǎngguì) | The AI orchestrator — translates, classifies, summarizes, and routes content to the right drawer. |
| **Clerk** | 伙计 (huǒjì) | A worker agent assigned to manage a subset of drawers within a team/category. |
| **Inverted Index** | 倒排索引 | A keyword → entry mapping for fast search, stored as JSON. |
| **BYOK** | — | Bring Your Own Key. You configure your own AI API key and keep all data locally. |
| **Lock** | 锁 | File-based mutex preventing data corruption from concurrent multi-agent writes. |

---

## 🏗️ Architecture

```
User / AI Agent
      │
      ▼
┌──────────────────────────────────────────┐
│         Shopkeeper (orchestrator)         │
│  Translate → Classify → Summarize → I/O   │
└──────┬───────────────────────┬───────────┘
       │                       │
       ▼                       ▼
┌──────────────┐     ┌──────────────────┐
│  Clerk(s)     │     │  Inverted Index   │
│  Drawer I/O   │     │  Keyword Search   │
│  Split/Merge  │     │  Incremental      │
└──────┬───────┘     └──────────────────┘
       │
       ▼
┌──────────────┐
│  File System  │
│  JSON Storage │
│  BYOK ready   │
└──────────────┘
```

### Multi-Agent Safety

Herbal Cabinet uses file-based locks (`data/locks/`) to prevent data corruption when multiple agents write concurrently:
- **Write lock**: Exclusive, timeout after 3 seconds
- **Stale lock detection**: Locks older than 10 seconds are automatically cleared
- **Read safety**: Reads are not blocked by concurrent writes (via atomic file reads)

---

## 🔮 Roadmap

- ✅ **Phase 2**: Container system + inverted index + HTTP API
- 🚧 **Phase 3**: Web UI (single-file HTML dashboard)
- 📝 **Phase 4**: MCP Server for AI agent integration
- 📝 **Phase 5**: Local embedding-based semantic search
- 📝 **Phase 6**: Multi-user / team collaboration

---

## 📄 License

MIT — Use it, modify it, sell it. Your data is yours.

---

## 🤝 Contributing

PRs welcome! Please keep the zero-dependency philosophy.
