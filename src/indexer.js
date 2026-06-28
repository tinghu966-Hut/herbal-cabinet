/**
 * 百斗柜 — 倒排索引系统
 * 
 * 关键词 → 条目 ID 的映射索引
 * 避免全文扫描，加速检索
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INDEX_FILE = path.resolve(__dirname, '..', 'data', 'index', 'inverted.idx')

/** 默认索引结构 */
const EMPTY_INDEX = { version: 3, keywords: {}, updatedAt: null }

/** 索引修剪：仅保留跨条目重复出现的关键词
 *  受 AI Data Remediation Engineer 启发：
 *  "50,000 个错误不是 50,000 个问题，而是 8-15 个模式族"
 *  滑窗 bigram 生成的边界词（如"流量"中的"量测"）只出现1次就是噪音
 */
function pruneIndex(index, minRefs = 2) {
  const before = Object.keys(index.keywords).length
  for (const [kw, ids] of Object.entries(index.keywords)) {
    if (ids.length < minRefs) {
      delete index.keywords[kw]
    }
  }
  const removed = before - Object.keys(index.keywords).length
  return { before, after: Object.keys(index.keywords).length, removed }
}

/**
 * 加载倒排索引
 */
export async function loadIndex() {
  try {
    const data = await readFile(INDEX_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    await mkdir(path.dirname(INDEX_FILE), { recursive: true })
    await saveIndex(EMPTY_INDEX)
    return { ...EMPTY_INDEX }
  }
}

/**
 * 保存倒排索引
 */
export async function saveIndex(index) {
  await mkdir(path.dirname(INDEX_FILE), { recursive: true })
  index.updatedAt = new Date().toISOString()
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8')
}

/**
 * 从文本中提取关键词（分词辅助）
 * 简单实现：按中英文分隔符拆分，去停用词
 */
export function extractKeywordsFromText(text) {
  if (!text) return []
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'for',
    'on', 'and', 'or', 'with', 'at', 'by', 'from', 'as', 'be', 'this', 'that'
  ])
  
  // 用正则拆分：中文按字符，英文按空格
  const terms = new Set()
  
  // 提取中文词：只索引双字以上组合，单字是噪音
  const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]+/g) || []
  for (const chunk of chineseChars) {
    // 跳过长度不足2的片段
    if (chunk.length < 2) continue
    // 只索引双字组合（bigram），不索引单字
    for (let i = 0; i < chunk.length - 1; i++) {
      const bigram = chunk.slice(i, i + 2)
      if (bigram.length === 2 && !stopWords.has(bigram)) terms.add(bigram)
    }
  }
  
  // 提取英文单词（3字符以上，避免单字母噪声）
  const englishWords = text.match(/[a-zA-Z][a-zA-Z0-9_.-]{1,}/g) || []
  for (const word of englishWords) {
    const lower = word.toLowerCase()
    if (!stopWords.has(lower) && lower.length > 2) terms.add(lower)
  }
  
  return [...terms]
}

/**
 * 倒排索引：添加一条记录
 */
export async function indexEntry(entry) {
  const index = await loadIndex()
  const keywords = extractKeywordsFromText(
    (entry.content || '') + ' ' + (entry.summary || '') + ' ' + (entry.keywords || []).join(' ')
  )
  
  for (const kw of keywords) {
    if (!index.keywords[kw]) {
      index.keywords[kw] = []
    }
    // 去重
    if (!index.keywords[kw].includes(entry.id)) {
      index.keywords[kw].push(entry.id)
    }
  }
  
  await saveIndex(index)
  return keywords
}

/**
 * 倒排索引：删除一条记录（从所有关键词中移除该 ID）
 */
export async function deindexEntry(entryId, index) {
  if (!index) index = await loadIndex()
  for (const kw of Object.keys(index.keywords)) {
    index.keywords[kw] = index.keywords[kw].filter(id => id !== entryId)
    if (index.keywords[kw].length === 0) {
      delete index.keywords[kw]
    }
  }
  await saveIndex(index)
}

/**
 * 通过倒排索引检索
 * @param {string[]} searchTerms - 搜索词列表
 * @param {object} index - 索引对象
 * @returns {Map<string, number>} entryId → 匹配分数
 */
export function searchByIndex(searchTerms, index) {
  const scores = new Map()
  
  for (const term of searchTerms) {
    const normalized = term.toLowerCase().trim()
    if (!normalized) continue
    
    // 精确匹配
    const ids = index.keywords[normalized]
    if (ids) {
      for (const id of ids) {
        scores.set(id, (scores.get(id) || 0) + 1)
      }
    }
    
    // 部分匹配：检查关键词是否包含搜索词，或搜索词是否包含关键词
    for (const [keyword, ids] of Object.entries(index.keywords)) {
      if (keyword !== normalized && 
          (keyword.includes(normalized) || normalized.includes(keyword))) {
        for (const id of ids) {
          scores.set(id, (scores.get(id) || 0) + 0.5)
        }
      }
    }
  }
  
  return scores
}

/**
 * 重建完整索引（从所有抽屉扫描）
 * @param {function|Array} entriesOrFn - 条目数组或加载函数
 */
export async function rebuildIndex(entriesOrFn) {
  console.log('  🔄 正在重建倒排索引...')
  
  const allEntries = typeof entriesOrFn === 'function' ? await entriesOrFn() : entriesOrFn
  const index = { version: 2, keywords: {}, updatedAt: new Date().toISOString() }
  
  for (const entry of allEntries) {
    const keywords = extractKeywordsFromText(
      (entry.content || '') + ' ' + (entry.summary || '') + ' ' + (entry.keywords || []).join(' ')
    )
    for (const kw of keywords) {
      if (!index.keywords[kw]) {
        index.keywords[kw] = []
      }
      if (!index.keywords[kw].includes(entry.id)) {
        index.keywords[kw].push(entry.id)
      }
    }
  }
  
  // 修剪单次引用噪音词（滑窗 bigram 边界产物）
  const pruneResult = pruneIndex(index)
  await saveIndex(index)
  console.log(`  ✅ 索引重建完成：${Object.keys(index.keywords).length} 个关键词（修剪了 ${pruneResult.removed} 个单引用噪音）, ${allEntries.length} 条记录`)
  return index
}

/**
 * 倒排索引状态
 */
export function getIndexStats(index) {
  if (!index) index = EMPTY_INDEX
  const totalKeywords = Object.keys(index.keywords).length
  const totalRefs = Object.values(index.keywords).reduce((s, ids) => s + ids.length, 0)
  return {
    totalKeywords,
    totalRefs,
    updatedAt: index.updatedAt,
    avgRefsPerKeyword: totalKeywords > 0 ? Math.round(totalRefs / totalKeywords * 10) / 10 : 0
  }
}

export default {
  loadIndex,
  saveIndex,
  indexEntry,
  deindexEntry,
  searchByIndex,
  rebuildIndex,
  extractKeywordsFromText,
  getIndexStats,
  pruneIndex
}
