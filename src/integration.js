/**
 * 百斗柜 — AI Agent 自动集成层
 * 
 * 一次性设置后，AI 自动调用百斗柜存/取记忆。
 * 
 * 工作方式：
 *   对话结束时 → AI 自动调用 store() 存关键内容
 *   收到话题时 → AI 自动调用 recall() 检索相关记忆
 *   完全透明，不需要用户手动触发
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = path.resolve(__dirname, '..', 'data', 'config', 'integration.json')

const DEFAULT_CONFIG = {
  version: 1,
  linked: false,
  linkedAt: null,
  aiName: 'main',
  autoStore: true,
  autoRecall: true,
  sessionTracking: true,
  lastSync: null
}

/**
 * 设置页 — 显示集成配置状态
 */
export async function setupPage() {
  const config = await loadConfig()
  const cabinet = await getCabinetStats()

  if (config.linked) {
    return {
      status: 'linked',
      message: `✅ 百斗柜已与 ${config.aiName} 集成`,
      linkedAt: config.linkedAt,
      stats: cabinet,
      settings: {
        autoStore: config.autoStore,
        autoRecall: config.autoRecall,
        sessionTracking: config.sessionTracking
      }
    }
  }

  return {
    status: 'unlinked',
    message: '百斗柜还未与 AI 建立链接',
    setupStep: '执行 node src/setup.js 完成一次性设置'
  }
}

/**
 * 执行一次性集成设置
 */
export async function linkAI(options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    linked: true,
    linkedAt: new Date().toISOString(),
    aiName: options.aiName || 'main',
    autoStore: options.autoStore !== false,
    autoRecall: options.autoRecall !== false,
    sessionTracking: options.sessionTracking !== false,
    lastSync: new Date().toISOString()
  }

  await saveConfig(config)

  // 创建集成标记文件，让 AI 在启动时检测到
  const markerPath = path.resolve(__dirname, '..', '.cabinet-linked')
  await writeFile(markerPath, `linked at ${config.linkedAt} for ${config.aiName}`, 'utf-8')

  return {
    status: 'linked',
    message: `✅ 百斗柜已与 ${config.aiName} 链接成功！`,
    config
  }
}

/**
 * 设置自动模式参数
 */
export async function configureAuto(options = {}) {
  const config = await loadConfig()
  if (!config.linked) {
    throw new Error('请先运行 setup.js 完成集成设置')
  }

  if (options.autoStore !== undefined) config.autoStore = options.autoStore
  if (options.autoRecall !== undefined) config.autoRecall = options.autoRecall
  if (options.sessionTracking !== undefined) config.sessionTracking = options.sessionTracking
  
  config.lastSync = new Date().toISOString()
  await saveConfig(config)

  return { status: 'configured', config }
}

/**
 * 检查百斗柜是否已集成
 */
export async function isLinked() {
  const config = await loadConfig()
  return config.linked
}

/**
 * 获取集成状态简介（AI 启动时调用）
 */
export async function statusSummary() {
  const config = await loadConfig()
  if (!config.linked) return null

  try {
    const { status } = await import('./cli.js')
    // We just want a simple summary
    const { listDrawers } = await import('./clerk.js')
    const drawers = await listDrawers()
    const totalEntries = drawers.reduce((sum, d) => sum + d.entryCount, 0)

    return {
      linked: true,
      linkedSince: config.linkedAt,
      drawerCount: drawers.length,
      entryCount: totalEntries,
      autoMode: {
        store: config.autoStore,
        recall: config.autoRecall
      }
    }
  } catch {
    return {
      linked: true,
      linkedSince: config.linkedAt,
      error: '无法读取百斗柜数据'
    }
  }
}

async function loadConfig() {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

async function saveConfig(config) {
  await mkdir(path.dirname(CONFIG_FILE), { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

async function getCabinetStats() {
  try {
    const { listDrawers } = await import('./clerk.js')
    const drawers = await listDrawers()
    return {
      drawerCount: drawers.length,
      entryCount: drawers.reduce((sum, d) => sum + d.entryCount, 0),
      clerkCount: (await import('./clerk.js').then(m => m.getClerksStatus())).length
    }
  } catch {
    return { error: '百斗柜数据不可用' }
  }
}

// CLI 入口（仅在直接运行时执行）
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('integration.js') || process.argv[1].includes('integration'))

if (isDirectRun) {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'link') {
    const result = await linkAI({ aiName: args[1] || 'main' })
    console.log(JSON.stringify(result, null, 2))
  } else if (command === 'status') {
    const result = await setupPage()
    console.log(JSON.stringify(result, null, 2))
  } else if (command === 'summary') {
    const result = await statusSummary()
    console.log(JSON.stringify(result, null, 2))
  }
}
