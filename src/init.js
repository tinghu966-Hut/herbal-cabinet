#!/usr/bin/env node
/**
 * 百斗柜 — 初始化命令
 * 
 * 创建 seed data 和示例抽屉，让新用户能立刻看到效果
 * node src/cli.js init
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CABINET_ROOT = path.resolve(__dirname, '..', 'data', 'cabinets', 'default', 'drawers')

const SEED_DATA = {
  '通用/入门指南': [
    {
      id: 'seed-001',
      content: '百斗柜（Herbal Cabinet）是一个本地记忆容器系统。数据存在本地 JSON 文件中，完全由你控制。',
      summary: '百斗柜简介',
      keywords: ['百斗柜', '记忆', '本地'],
      tags: ['入门', '概念'],
      type: 'record',
      time: new Date().toISOString(),
      importance: 3
    },
    {
      id: 'seed-002',
      content: '使用百斗柜只需三步：1) 配置 API Key 2) node src/cli.js store "内容" -D "分类" 存入记忆 3) node src/cli.js recall "关键词" 检索记忆',
      summary: '百斗柜使用三步',
      keywords: ['使用', '入门', 'store', 'recall'],
      tags: ['入门', '教程'],
      type: 'record',
      time: new Date().toISOString(),
      importance: 4
    }
  ],
  '通用/示例': [
    {
      id: 'seed-003',
      content: '今天研究了倒排索引的优化策略。核心思路：跨条目重复出现的关键词才有意义，单次出现的滑窗 bigram 应被视为噪音修剪掉。优化后索引缩小了 74%，搜索准确率反而提升了。',
      summary: '索引优化研究',
      keywords: ['索引', '优化', '倒排索引', '噪声'],
      tags: ['技术'],
      type: 'tech_note',
      time: new Date().toISOString(),
      importance: 3
    },
    {
      id: 'seed-004',
      content: '项目里程碑：CLI 版本完成了容器系统重构、倒排索引引擎、HTTP API 服务器、抽屉自动分裂。待做：Web UI、MCP Server 集成。',
      summary: '项目里程碑记录',
      keywords: ['里程碑', '容器', 'API', '重构'],
      tags: ['项目'],
      type: 'decision',
      time: new Date().toISOString(),
      importance: 4
    }
  ]
}

async function createSeedData() {
  // 创建 .meta.json 文件
  const metaPath = path.resolve(CABINET_ROOT, '..', '..', '.meta.json')
  const meta = {
    name: 'default',
    version: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drawerSoftLimit: 30,
    drawerHardLimit: 50,
    drawerMaxDepth: 3
  }
  await mkdir(path.dirname(metaPath), { recursive: true })
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  let total = 0
  for (const [drawerPath, entries] of Object.entries(SEED_DATA)) {
    const parts = drawerPath.split('/')
    const filePath = path.join(CABINET_ROOT, ...parts, 'entries.json')
    await mkdir(path.dirname(filePath), { recursive: true })
    const drawerData = {
      metadata: { created: new Date().toISOString(), path: parts },
      entries: entries.map(e => ({
        ...e,
        drawerPath: parts,
        drawer: parts.join(' > '),
        timestamp: e.time,
        drawerId: parts.join('›')
      }))
    }
    await writeFile(filePath, JSON.stringify(drawerData, null, 2), 'utf-8')
    total += entries.length
  }

  return { drawers: Object.keys(SEED_DATA), total }
}

export async function init() {
  console.log('\n  🌱 正在初始化百斗柜...')

  // 检查是否已有数据
  try {
    const { readdir } = await import('node:fs/promises')
    const dirs = await readdir(CABINET_ROOT).catch(() => [])
    if (dirs.length > 0) {
      console.log('  ⚠️  已有数据目录，跳过 seed data 创建')
      return { skipped: true }
    }
  } catch { /* 目录不存在就继续 */ }

  const result = await createSeedData()
  console.log(`  ✅ 已创建 ${result.drawers.length} 个示例抽屉，${result.total} 条示例记忆`)
  console.log('\n  💡 试试看：')
  console.log('     node src/cli.js status')
  console.log('     node src/cli.js recall "百斗柜"')
  console.log('     node src/cli.js store "你好，百斗柜！" -D "通用"')
  console.log()

  return result
}

// 直接运行时执行
if (process.argv[1] && process.argv[1].endsWith('init.js')) {
  init().catch(err => {
    console.error('❌ 错误:', err)
    process.exit(1)
  })
}
