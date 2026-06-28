/**
 * 百斗柜 — 小伙计（v2 容器系统版）
 * 
 * 管理抽屉的生命周期：
 * - 存入/检索条目
 * - 抽屉分裂/合并
 * - 倒排索引同步
 * - 频率加权检索
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 默认抽屉根（兼容旧版） */
const LEGACY_DRAWERS_ROOT = path.resolve(__dirname, '..', 'data', 'drawers')

/** 默认限制 */
const DEFAULT_SOFT_LIMIT = 30
const DEFAULT_HARD_LIMIT = 50
const MAX_DRAWER_DEPTH = 3

/**
 * 获取柜子的抽屉根目录
 */
function getDrawerRoot(cabinet) {
  if (!cabinet || cabinet === 'default') return LEGACY_DRAWERS_ROOT
  return path.resolve(__dirname, '..', 'data', 'cabinets', cabinet, 'drawers')
}

/**
 * 获取抽屉文件路径
 */
function getDrawerFilePath(drawerPath, cabinet) {
  return path.join(getDrawerRoot(cabinet), ...drawerPath, 'entries.json')
}

/**
 * 创建标准条目对象
 */
export function createEntry({ content, originalContent, summary, keywords, tags, type, source, reason,
                              owner, agent, relationIds, cabinet, drawerPath, importance }) {
  const now = new Date().toISOString()
  const drawerId = drawerPath ? drawerPath.join('›') : 'unknown'
  
  return {
    id: randomUUID(),
    cabinet: cabinet || 'default',
    drawerPath: drawerPath || [],
    drawerId,
    content: content || '',
    originalContent: originalContent || content || '',
    summary: summary || (content ? content.slice(0, 40) + '...' : ''),
    keywords: keywords || [],
    tags: tags || [],
    type: type || 'discussion',
    source: source || '未知',
    reason: reason || '',
    owner: owner || 'local',
    agent: agent || '',
    relations: relationIds || [],
    lastAccessed: now,
    accessCount: 0,
    time: now,
    timestamp: now,
    importance: importance || 0,
    archived: false
  }
}

/**
 * 标准化条目（兼容旧数据）
 */
function normalizeEntry(entry, drawerPath) {
  if (!entry || typeof entry !== 'object') {
    entry = { content: String(entry || '') }
  }
  const now = new Date().toISOString()
  const dPath = entry.drawerPath || drawerPath || []
  
  return {
    id: entry.id || randomUUID(),
    cabinet: entry.cabinet || 'default',
    drawerPath: dPath,
    drawerId: entry.drawerId || (Array.isArray(dPath) ? dPath.join('›') : 'unknown'),
    content: entry.content || '',
    originalContent: entry.originalContent || entry.content || '',
    summary: entry.summary || '',
    keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    type: entry.type || 'discussion',
    source: entry.source || '未知',
    reason: entry.reason || '',
    owner: entry.owner || 'local',
    agent: entry.agent || '',
    relations: Array.isArray(entry.relations) ? entry.relations : [],
    lastAccessed: entry.lastAccessed || entry.timestamp || now,
    accessCount: entry.accessCount || 0,
    time: entry.time || entry.timestamp || now,
    timestamp: entry.timestamp || entry.time || now,
    importance: entry.importance || 0,
    archived: entry.archived || false
  }
}

/**
 * 标准化抽屉数据
 */
function normalizeDrawer(drawer, drawerPath) {
  const d = drawer && typeof drawer === 'object' ? drawer : { entries: [] }
  d.entries = Array.isArray(d.entries) ? d.entries.map(e => normalizeEntry(e, drawerPath)) : []
  d.metadata = d.metadata || { created: new Date().toISOString(), path: drawerPath }
  return d
}

/**
 * 加载抽屉内容
 */
async function loadDrawer(drawerPath, cabinet) {
  const filePath = getDrawerFilePath(drawerPath, cabinet)
  try {
    const data = await readFile(filePath, 'utf-8')
    return normalizeDrawer(JSON.parse(data), drawerPath)
  } catch {
    return { entries: [], metadata: { created: new Date().toISOString(), path: drawerPath, cabinet: cabinet || 'default' } }
  }
}

/**
 * 保存抽屉内容
 */
async function saveDrawer(drawerPath, drawer, cabinet) {
  const filePath = getDrawerFilePath(drawerPath, cabinet)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(drawer, null, 2), 'utf-8')
}

/**
 * 获取所有抽屉递归
 */
export async function listDrawers(basePath = [], cabinet) {
  const root = getDrawerRoot(cabinet)
  const dir = path.join(root, ...basePath)
  try {
    const items = await readdir(dir, { withFileTypes: true })
    const result = []
    for (const item of items) {
      if (item.isDirectory()) {
        const subPath = [...basePath, item.name]
        const drawer = await loadDrawer(subPath, cabinet)
        result.push({
          path: subPath,
          entryCount: drawer.entries.length,
          archived: drawer.metadata.archived || false,
          cabinet: cabinet || 'default',
          drawerSoftLimit: drawer.metadata.softLimit || DEFAULT_SOFT_LIMIT,
          drawerHardLimit: drawer.metadata.hardLimit || DEFAULT_HARD_LIMIT
        })
        result.push(...await listDrawers(subPath, cabinet))
      }
    }
    return result
  } catch {
    return []
  }
}

/**
 * 列出所有柜子的所有抽屉
 */
export async function listAllDrawers(cabinets) {
  const allDrawers = []
  for (const cabinet of cabinets) {
    const drawers = await listDrawers([], cabinet)
    allDrawers.push(...drawers)
  }
  return allDrawers
}

/**
 * 加载所有条目（用于重建索引、导出）
 */
export async function loadAllEntries(cabinets) {
  const all = []
  for (const cabinet of cabinets) {
    const drawers = await listDrawers([], cabinet)
    for (const d of drawers) {
      const drawer = await loadDrawer(d.path, cabinet)
      for (const entry of drawer.entries) {
        all.push(entry)
      }
    }
  }
  return all
}

/**
 * 存入一条记忆
 */
export async function storeEntry(drawerPath, entryData, cabinet) {
  const drawer = await loadDrawer(drawerPath, cabinet)
  const meta = drawer.metadata
  const softLimit = meta.softLimit || DEFAULT_SOFT_LIMIT
  const hardLimit = meta.hardLimit || DEFAULT_HARD_LIMIT

  const entry = createEntry({
    ...entryData,
    drawerPath,
    cabinet: cabinet || 'default'
  })

  drawer.entries.push(entry)

  const needsSplit = drawer.entries.length >= softLimit
  const mustSplit = drawer.entries.length >= hardLimit

  await saveDrawer(drawerPath, drawer, cabinet)

  return {
    entry,
    needsSplit,
    mustSplit,
    currentCount: drawer.entries.length,
    softLimit,
    hardLimit
  }
}

/**
 * 检索记忆（加权排序）
 * 
 * 权重：
 * - 摘要/标题匹配 → ×3
 * - 关键词列表匹配 → ×2
 * - 正文匹配 → ×1
 * - 时间衰减：30天内线性衰减
 * - 访问频率：accessCount × 0.1
 * - 最近访问：7天内额外 +0.5
 * - 重要性：importance × 0.5
 */
export async function recallFromDrawer(drawerPath, options = {}, cabinet) {
  const drawer = await loadDrawer(drawerPath, cabinet)
  let entries = drawer.entries

  // 过滤：归档
  if (options.includeArchived !== true) {
    entries = entries.filter(e => !e.archived)
  }

  // 过滤：标签
  if (options.tag) {
    const tag = options.tag.toLowerCase()
    entries = entries.filter(e => (e.tags || []).some(t => String(t).toLowerCase() === tag))
  }

  // 过滤：类型
  if (options.type) {
    entries = entries.filter(e => e.type === options.type)
  }

  // 过滤：时间范围
  if (options.since) {
    const sinceDate = new Date(options.since)
    entries = entries.filter(e => new Date(e.timestamp) >= sinceDate)
  }

  // 关键词检索 + 加权排序
  if (options.keywords && options.keywords.length > 0) {
    const allTerms = options.keywords.flatMap(k => {
      const terms = [k.toLowerCase()]
      const splitParts = k.split(/[,，、。.．；;：:\s]+/).filter(Boolean)
      terms.push(...splitParts.map(p => p.toLowerCase()))
      if (k.length > 4) {
        terms.push(k.slice(0, 3).toLowerCase())
        terms.push(k.slice(0, 2).toLowerCase())
      }
      return terms
    })
    const uniqueTerms = [...new Set(allTerms)].filter(t => t.length > 0)

    // 先过滤（含任一关键词即保留）
    entries = entries.filter(e => {
      const searchText = (e.content + ' ' + (e.summary || '') + ' ' + (e.keywords || []).join(' ')).toLowerCase()
      return uniqueTerms.some(term => searchText.includes(term))
    })

    // 加权排序
    const queryTime = Date.now()
    entries.sort((a, b) => {
      const scoreA = calcWeightedScore(a, uniqueTerms, queryTime)
      const scoreB = calcWeightedScore(b, uniqueTerms, queryTime)
      return scoreB - scoreA
    })
  }

  // 上限
  if (options.limit && entries.length > options.limit) {
    entries = entries.slice(0, options.limit)
  }

  return entries
}

/**
 * 计算加权得分（增强版）
 */
function calcWeightedScore(entry, terms, queryTime) {
  const content = (entry.content || '').toLowerCase()
  const summary = (entry.summary || '').toLowerCase()
  const kwList = (entry.keywords || []).map(k => k.toLowerCase())
  const allText = content + ' ' + summary + ' ' + kwList.join(' ')

  let score = 0

  for (const term of terms) {
    // 摘要/标题匹配 → ×3
    if (summary.includes(term)) score += 3
    // 关键词列表匹配 → ×2
    if (kwList.some(kw => kw.includes(term) || term.includes(kw))) score += 2
    // 内容匹配 → ×1
    if (content.includes(term)) score += 1
  }

  // 时间衰减：30天内从1线性降到0.5
  const entryTime = new Date(entry.timestamp || Date.now()).getTime()
  const ageMs = Math.max(0, queryTime - entryTime)
  const ageDays = ageMs / 86400000
  score *= Math.max(0.5, 1 - ageDays / 30)

  // 访问频率加分
  score += (entry.accessCount || 0) * 0.1

  // 最近访问加分（7天内）
  if (entry.lastAccessed) {
    const lastAccessMs = new Date(entry.lastAccessed).getTime()
    const daysSinceAccess = (queryTime - lastAccessMs) / 86400000
    if (daysSinceAccess < 7) score += 0.5
  }

  // 重要性加分
  score += (entry.importance || 0) * 0.5

  return score
}

/**
 * 更新条目的访问信息
 */
export async function updateAccess(entry, drawerPath, cabinet) {
  entry.accessCount = (entry.accessCount || 0) + 1
  entry.lastAccessed = new Date().toISOString()
  // 回写
  const drawer = await loadDrawer(drawerPath, cabinet)
  const idx = drawer.entries.findIndex(e => e.id === entry.id)
  if (idx >= 0) {
    drawer.entries[idx].accessCount = entry.accessCount
    drawer.entries[idx].lastAccessed = entry.lastAccessed
    await saveDrawer(drawerPath, drawer, cabinet)
  }
}

/**
 * 分裂抽屉
 * @param {string[]} drawerPath - 父抽屉路径
 * @param {object} subCategories - { subName: [entryId, ...], ... }
 * @param {string} cabinet - 柜子名
 */
export async function splitDrawer(drawerPath, subCategories, cabinet) {
  const parentDrawer = await loadDrawer(drawerPath, cabinet)
  const parentEntries = parentDrawer.entries

  const children = []
  for (const [subName, entryIds] of Object.entries(subCategories)) {
    const subPath = [...drawerPath, subName]
    const subDrawer = { entries: [], metadata: { created: new Date().toISOString(), parent: drawerPath.join('›'), splitFrom: drawerPath.join('›'), cabinet: cabinet || 'default' } }
    subDrawer.entries = parentEntries.filter(e => entryIds.includes(e.id))
    await saveDrawer(subPath, subDrawer, cabinet)
    children.push({ path: subPath, count: subDrawer.entries.length })
  }

  // 归档父抽屉
  parentDrawer.metadata.archived = true
  parentDrawer.metadata.archivedAt = new Date().toISOString()
  parentDrawer.metadata.children = Object.keys(subCategories)
  parentDrawer.entries = [] // 清空（条目已迁移到子抽屉）
  await saveDrawer(drawerPath, parentDrawer, cabinet)

  return { parent: drawerPath, children }
}

/**
 * 合并抽屉（child → parent）
 */
export async function mergeDrawer(childPath, parentPath, cabinet) {
  const childDrawer = await loadDrawer(childPath, cabinet)
  const parentDrawer = await loadDrawer(parentPath, cabinet)

  // 将子抽屉所有条目迁移到父抽屉
  for (const entry of childDrawer.entries) {
    entry.drawerPath = parentPath
    entry.drawerId = parentPath.join('›')
    parentDrawer.entries.push(entry)
  }

  // 归档子抽屉
  childDrawer.metadata.archived = true
  childDrawer.metadata.mergedInto = parentPath.join('›')
  childDrawer.metadata.mergedAt = new Date().toISOString()
  childDrawer.entries = []

  await saveDrawer(parentPath, parentDrawer, cabinet)
  await saveDrawer(childPath, childDrawer, cabinet)

  return {
    parent: parentPath,
    child: childPath,
    movedCount: childDrawer.entries.length
  }
}

/**
 * 获取标签统计
 */
export async function getTagStats(basePath = [], cabinet) {
  const root = getDrawerRoot(cabinet)
  const dir = path.join(root, ...basePath)
  const counts = new Map()

  try {
    const drawer = await loadDrawer(basePath, cabinet)
    for (const entry of drawer.entries) {
      for (const tag of entry.tags || []) {
        const cleanTag = String(tag).trim()
        if (!cleanTag) continue
        counts.set(cleanTag, (counts.get(cleanTag) || 0) + 1)
      }
    }

    const items = await readdir(dir, { withFileTypes: true })
    for (const item of items) {
      if (!item.isDirectory()) continue
      const childCounts = await getTagStats([...basePath, item.name], cabinet)
      for (const { tag, count } of childCounts) {
        counts.set(tag, (counts.get(tag) || 0) + count)
      }
    }
  } catch {}

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'))
}

/**
 * 兼容：从旧 clerk 中获取伙计配置
 */
export async function assignClerk(drawerPath) {
  return { id: 'default', name: '伙计-甲', drawerCount: 0, team: '通用' }
}

export async function getClerksStatus() {
  return [{ id: 'default', name: '掌柜', team: '通用', drawerCount: 0, maxDrawers: 99 }]
}

export default {
  createEntry,
  storeEntry,
  recallFromDrawer,
  updateAccess,
  splitDrawer,
  mergeDrawer,
  listDrawers,
  listAllDrawers,
  loadAllEntries,
  loadDrawer,
  saveDrawer,
  getTagStats,
  assignClerk,
  getClerksStatus
}
