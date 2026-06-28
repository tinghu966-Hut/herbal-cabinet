/**
 * 百斗柜 — 掌柜（v2 重构版）
 * 
 * 总管全局调度：
 * - 多柜子管理
 * - 翻译 → 分类 → 摘要 → 存入
 * - 检索（支持倒排索引加速）
 * - 抽屉分裂
 * - 数据导入导出
 */

import { loadTaxonomy, resolvePath, saveTaxonomy, getAllPaths } from './taxonomy.js'
import { storeEntry, recallFromDrawer, splitDrawer, mergeDrawer, listDrawers, listAllDrawers,
         loadAllEntries, getTagStats, updateAccess, createEntry } from './clerk.js'
import { translateToChinese, classifyContent, generateMetadata, decideSplit, processBatch } from './classifier.js'
import { extractSearchTerms, expandWithSynonyms } from './api-client.js'
import { loadIndex, saveIndex, indexEntry, searchByIndex, rebuildIndex, getIndexStats } from './indexer.js'
import { ensureCabinet, listCabinets, loadCabinetMeta, saveCabinetMeta, getOrCreateDefaultCabinet,
         LEGACY_CABINET } from './cabinet.js'
import { withWriteLock } from './lock.js'

/**
 * 标准化抽屉路径
 */
function normalizePath(p) {
  if (Array.isArray(p)) return p.map(s => String(s).trim()).filter(s => s && !s.includes('..') && !s.includes('/') && !s.includes('\\')).filter(Boolean)
  return String(p || '').split(/\s*(?:>|\/|\\)\s*/).map(s => s.trim()).filter(s => s && !s.includes('..') && !s.includes('/') && !s.includes('\\')).filter(Boolean)
}

/**
 * 获取所有可用柜子
 */
export async function getActiveCabinets() {
  const cabinets = await listCabinets()
  if (cabinets.length === 0) {
    // 检查是否有旧版数据
    const defaultCabinet = await getOrCreateDefaultCabinet()
    return [defaultCabinet]
  }
  return cabinets
}

/**
 * 存入一条记忆
 * 
 * @param {object} input
 * @param {string} input.content - 内容
 * @param {string} [input.cabinet] - 柜子名
 * @param {string|string[]} [input.drawerPath] - 指定抽屉路径
 * @param {string[]} [input.tags] - 标签
 * @param {string} [input.source] - 来源
 * @param {string} [input.reason] - 理由
 * @param {string} [input.owner] - 所有者
 * @param {number} [input.importance] - 重要性 1-5
 */
export async function process(input) {
  const content = input.content
  if (!content) throw new Error('内容不能为空')

  console.log(`\n🧑‍💼 掌柜收到: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`)

  // 1. 确定柜子
  const cabinetName = input.cabinet || LEGACY_CABINET
  const cabinetMeta = await ensureCabinet(cabinetName)
  console.log(`  📦 柜子: ${cabinetName}`)

  // 2. 加载分类树
  const taxonomy = await loadTaxonomy()
  const existingPaths = getAllPaths(null, taxonomy)

  let chinese, sourceLang, drawerPath, meta

  // 3. 批量处理（翻译+分类+摘要+关键词）
  if (input.drawerPath) {
    // 指定抽屉
    drawerPath = normalizePath(input.drawerPath)
    console.log(`  📂 指定抽屉: ${drawerPath.join(' > ')}`)
    
    const translation = await translateToChinese(content)
    chinese = translation.content
    sourceLang = translation.sourceLang
    console.log(`  📝 ${sourceLang === 'zh' ? '已是中文' : `翻译完成`}`)

    meta = await generateMetadata(chinese)
  } else {
    console.log('  🧠 批量处理（翻译+分类+摘要+关键词）...')
    const batchResult = await processBatch(content, existingPaths)

    if (batchResult) {
      chinese = batchResult.content || content
      sourceLang = batchResult.translated ? 'en' : 'zh'
      drawerPath = batchResult.path || ['通用']
      meta = {
        summary: batchResult.summary || chinese.slice(0, 40) + '...',
        keywords: batchResult.keywords || [],
        type: batchResult.type || 'discussion'
      }
      console.log(`  🏷️  分类: ${drawerPath.join(' > ')}`)
      console.log(`  📋 ${meta.summary}`)
    } else {
      // 降级：逐个处理
      const translation = await translateToChinese(content)
      chinese = translation.content
      sourceLang = translation.sourceLang

      drawerPath = await classifyContent(chinese, existingPaths)
      console.log(`  🏷️  分类: ${drawerPath.join(' > ')}`)

      meta = await generateMetadata(chinese)
    }
  }

  // 4. 确保分类树中存在路径
  resolvePath(taxonomy, drawerPath, true)
  await saveTaxonomy(taxonomy)

  // 5. 存入（带写锁）
  let storeResult
  await withWriteLock(async () => {
    const result = await storeEntry(drawerPath, {
    content: chinese,
    originalContent: content,
    sourceLang,
    type: input.type || meta.type || 'discussion',
    summary: meta.summary,
    keywords: meta.keywords || [],
    tags: normalizeTags(input.tags),
    source: input.source || '对话',
    reason: input.reason || '',
    owner: input.owner || 'local',
    importance: input.importance || 0
    }, cabinetName)

    // 6. 更新倒排索引
    try {
      await indexEntry(result.entry)
    } catch (e) {
      console.log(`  ⚠️  索引更新失败: ${e.message}`)
    }

    console.log(`  💾 已存入 📁 ${drawerPath.join(' > ')} (${result.currentCount}/${result.hardLimit})`)

    // 7. 检查分裂
    if (result.mustSplit) {
      console.log('  ⚠️  抽屉已达硬上限，自动分裂...')
      await autoSplitDrawer(drawerPath, cabinetName)
    } else if (result.needsSplit) {
      console.log(`  💡 提示: 抽屉 ${drawerPath.join(' > ')} 超过软上限 (${result.currentCount}/${result.softLimit})，建议分裂`)
      console.log(`     使用: node src/cli.js split "${drawerPath.join(' > ')}"`)
    }

    storeResult = result
    return result
  }, cabinetName)

  return {
    drawerPath,
    entryId: storeResult.entry.id,
    summary: meta.summary,
    cabinet: cabinetName,
    entryCount: storeResult.currentCount
  }
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean)
  if (!tags) return []
  return String(tags).split(/[,，、]/).map(t => t.trim()).filter(Boolean)
}

/**
 * 自动分裂抽屉
 */
async function autoSplitDrawer(drawerPath, cabinet) {
  const { loadDrawer } = await import('./clerk.js')
  const fullDrawer = await loadDrawer(drawerPath, cabinet)

  if (fullDrawer.entries.length === 0) return { parent: drawerPath, children: [] }

  const splitPlan = await decideSplit(drawerPath, fullDrawer.entries)

  const entryIdsByCategory = {}
  for (const [catName, indices] of Object.entries(splitPlan.categories)) {
    entryIdsByCategory[catName] = indices.map(i => fullDrawer.entries[i]?.id).filter(Boolean)
  }

  const result = await splitDrawer(drawerPath, entryIdsByCategory, cabinet)
  console.log(`  📂 分裂完成 → ${Object.keys(splitPlan.categories).join(', ')}`)
  console.log(`  💡 ${splitPlan.reason}`)

  // 重建索引
  await rebuildIndexForCabinet(cabinet)

  return result
}

/**
 * 为指定柜子重建索引
 */
async function rebuildIndexForCabinet(cabinet) {
  const drawers = await listDrawers([], cabinet)
  const allEntries = []
  for (const d of drawers) {
    const { loadDrawer } = await import('./clerk.js')
    const drawer = await loadDrawer(d.path, cabinet)
    allEntries.push(...drawer.entries.filter(e => !e.archived))
  }
  return await rebuildIndex(allEntries)
}

/**
 * 检索记忆
 */
export async function recall(query) {
  const text = query.text
  const cabinetName = query.cabinet || LEGACY_CABINET

  console.log(`\n🔍 掌柜检索: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`)

  const { content: chineseQuery } = await translateToChinese(text)
  const searchTerms = await extractSearchTerms(chineseQuery, text)
  console.log(`  🔑 搜索关键词: ${searchTerms.join(', ')}`)

  // 先用倒排索引加速
  let index = null
  let indexedResults = null
  try {
    index = await loadIndex()
    if (index && index.keywords && Object.keys(index.keywords).length > 0) {
      const expandedTerms = expandWithSynonyms(searchTerms)
      indexedResults = searchByIndex(expandedTerms, index)
      console.log(`  📊 索引命中 ${indexedResults.size} 条`)
    }
  } catch {
    // 索引不可用，回退全量搜索
  }

  // 确定目标抽屉
  let targetDrawers = []
  if (query.drawerPath) {
    targetDrawers = [normalizePath(query.drawerPath)]
    console.log(`  📂 指定抽屉: ${targetDrawers[0].join(' > ')}`)
  } else if (query.cabinet) {
    // 指定柜子 => 搜索该柜子所有抽屉
    const drawers = await listDrawers([], cabinetName)
    targetDrawers = drawers.filter(d => !d.archived).map(d => d.path)
    console.log(`  📂 搜索柜子 ${cabinetName} 的 ${targetDrawers.length} 个抽屉`)
  } else {
    const taxonomy = await loadTaxonomy()
    const existingPaths = getAllPaths(null, taxonomy)
    const guessPath = await classifyContent(chineseQuery, existingPaths)
    targetDrawers = [guessPath]
    console.log(`  🏷️  掌柜判断应在: ${guessPath.join(' > ')}`)
  }

  // 执行检索
  let allEntries = []
  for (const dp of targetDrawers) {
    const entries = await recallFromDrawer(dp, {
      keywords: searchTerms,
      tag: query.tag,
      type: query.type,
      limit: (query.limit || 10) * 2,
      includeArchived: query.includeArchived
    }, cabinetName)
    
    // 如果有索引结果，用索引分数补充排序
    if (indexedResults && indexedResults.size > 0) {
      entries.sort((a, b) => {
        const scoreA = indexedResults.get(a.id) || 0
        const scoreB = indexedResults.get(b.id) || 0
        return scoreB - scoreA
      })
    }
    
    allEntries.push(...entries)
  }

  // 去重
  const seen = new Set()
  allEntries = allEntries.filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  // 上限
  if (query.limit && allEntries.length > query.limit) {
    allEntries = allEntries.slice(0, query.limit)
  }

  // 无结果时尝试相似抽屉
  if (allEntries.length === 0 && !query.drawerPath && !query.cabinet) {
    console.log('  🔄 无结果，尝试相邻抽屉...')
    const taxonomy = await loadTaxonomy()
    const allPaths = getAllPaths(null, taxonomy)
    const drawerPath = targetDrawers[0] || []
    const similarPaths = allPaths.filter(p =>
      p.some((seg, i) => drawerPath[i] && seg.includes(drawerPath[i]))
    ).slice(0, 5)

    for (const sp of similarPaths) {
      const more = await recallFromDrawer(sp, { keywords: searchTerms, limit: 3 }, cabinetName)
      allEntries.push(...more)
    }

    const seen2 = new Set()
    allEntries = allEntries.filter(e => {
      if (seen2.has(e.id)) return false
      seen2.add(e.id)
      return true
    })
  }

  console.log(`  📄 共找到 ${allEntries.length} 条`)
  allEntries.forEach((e, i) => {
    const path = e.drawerPath?.join(' > ') || '?'
    console.log(`    ${i + 1}. [${path}] ${e.summary || e.content?.slice(0, 50)}`)
  })

  return { drawerPath: targetDrawers, entries: allEntries }
}

/**
 * 跨柜检索
 */
export async function recallCross(query) {
  const text = query.text
  console.log(`\n🔍 掌柜跨柜检索: "${text.slice(0, 60)}"`)

  const { content: chineseQuery } = await translateToChinese(text)
  const searchTerms = await extractSearchTerms(chineseQuery, text)
  console.log(`  🔑 搜索关键词: ${searchTerms.join(', ')}`)

  const cabinets = await getActiveCabinets()
  let allEntries = []

  for (const cabinet of cabinets) {
    const drawers = await listDrawers([], cabinet.name || 'default')
    for (const d of drawers) {
      if (d.archived) continue
      const entries = await recallFromDrawer(d.path, {
        keywords: searchTerms,
        limit: query.limit || 5
      }, cabinet.name || 'default')
      allEntries.push(...entries)
    }
  }

  // 去重排序
  const seen = new Set()
  allEntries = allEntries.filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
  allEntries.sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))

  const totalDrawers = new Set(allEntries.map(e => e.drawerPath?.join(' > ') || '?')).size
  console.log(`  📄 共找到 ${allEntries.length} 条（来自 ${totalDrawers} 个抽屉，${cabinets.length} 个柜子）`)
  allEntries.forEach((e, i) => {
    const path = e.drawerPath?.join(' > ') || '?'
    console.log(`    ${i + 1}. [${e.cabinet || 'default'} > ${path}] ${e.summary || e.content?.slice(0, 50)}`)
  })

  return { entries: allEntries, totalDrawers, totalCabinets: cabinets.length }
}

/**
 * 系统状态
 */
export async function status() {
  console.log('\n🏪 百斗柜 · 系统状态')

  const cabinets = await getActiveCabinets()
  console.log(`\n📦 柜子: ${cabinets.length} 个`)
  
  let totalDrawers = 0
  let totalEntries = 0
  let allTags = []

  for (const cabinet of cabinets) {
    const name = cabinet.name || 'default'
    const drawers = await listDrawers([], name)
    const activeDrawers = drawers.filter(d => !d.archived)
    const entries = activeDrawers.reduce((s, d) => s + d.entryCount, 0)
    totalDrawers += activeDrawers.length
    totalEntries += entries
    console.log(`  📦 ${name}: ${activeDrawers.length} 个活跃抽屉, ${entries} 条记录`)

    const tags = await getTagStats([], name)
    allTags.push(...tags.slice(0, 5))
  }

  // 索引状态
  try {
    const index = await loadIndex()
    const stats = getIndexStats(index)
    console.log(`\n📊 倒排索引: ${stats.totalKeywords} 个关键词, ${stats.totalRefs} 条引用, 最后更新: ${stats.updatedAt ? stats.updatedAt.slice(0, 19) : '无'}`)
  } catch {
    console.log('\n📊 倒排索引: 未建立')
  }

  if (totalDrawers > 0) {
    console.log(`\n📂 ${totalDrawers} 个活跃抽屉, ${totalEntries} 条记忆`)
  }

  if (allTags.length > 0) {
    console.log('\n🏷️  热门标签:')
    const seen = new Set()
    for (const { tag, count } of allTags) {
      if (seen.has(tag)) continue
      seen.add(tag)
      console.log(`  ${tag} — ${count}条`)
      if (seen.size >= 5) break
    }
  }

  console.log('\n💻 服务:')
  console.log('  CLI:  node src/cli.js')
  console.log('  API:  node src/server.js [port]')

  return { cabinets: cabinets.length, drawers: totalDrawers, entries: totalEntries }
}

/**
 * 手动分裂抽屉
 */
export async function split(drawerPath, cabinet) {
  const dp = normalizePath(drawerPath)
  const cab = cabinet || LEGACY_CABINET
  return await withWriteLock(async () => {
    return await autoSplitDrawer(dp, cab)
  }, cab)
}

/**
 * 手动合并抽屉
 */
export async function merge(childPath, parentPath, cabinet) {
  const { mergeDrawer } = await import('./clerk.js')
  const cab = cabinet || LEGACY_CABINET
  return await withWriteLock(async () => {
    return await mergeDrawer(normalizePath(childPath), normalizePath(parentPath), cab)
  }, cab)
}

/**
 * 导出数据
 */
export async function exportData(options = {}) {
  const cabinets = await getActiveCabinets()
  const dump = {
    version: 2,
    exportedAt: new Date().toISOString(),
    cabinets: []
  }

  for (const cabinet of cabinets) {
    const name = cabinet.name || 'default'
    const drawers = await listDrawers([], name)
    const cabinetData = {
      name,
      meta: await loadCabinetMeta(name),
      drawers: []
    }

    for (const d of drawers) {
      const { loadDrawer } = await import('./clerk.js')
      const drawer = await loadDrawer(d.path, name)
      cabinetData.drawers.push({
        path: d.path,
        entries: drawer.entries
      })
    }

    dump.cabinets.push(cabinetData)
  }

  return dump
}

/**
 * 导入数据
 */
export async function importData(data, options = {}) {
  if (!data || !data.cabinets) throw new Error('无效的数据格式')

  let imported = 0
  for (const cabinetData of data.cabinets) {
    const name = cabinetData.name || 'default'
    await ensureCabinet(name)
    
    for (const drawerData of cabinetData.drawers) {
      const path = drawerData.path
      const { saveDrawer } = await import('./clerk.js')
      await saveDrawer(path, { entries: drawerData.entries, metadata: { created: new Date().toISOString(), path, cabinet: name } }, name)
      imported += drawerData.entries.length
    }
  }

  console.log(`  ✅ 导入完成: ${imported} 条记忆`)
  return { imported }
}

/**
 * 重建所有索引
 */
export async function reindex() {
  const cabinets = await getActiveCabinets()
  const allEntries = await loadAllEntries(cabinets.map(c => c.name || 'default'))
  return await rebuildIndex(allEntries)
}

/**
 * 获取抽屉详情
 */
export async function drawerInfo(drawerPath, cabinet) {
  const { loadDrawer } = await import('./clerk.js')
  const dp = normalizePath(drawerPath)
  const drawer = await loadDrawer(dp, cabinet || LEGACY_CABINET)
  return {
    path: dp,
    cabinet: cabinet || LEGACY_CABINET,
    entryCount: drawer.entries.length,
    archived: drawer.metadata.archived || false,
    createdAt: drawer.metadata.created,
    entries: drawer.entries
  }
}

export default {
  process,
  recall,
  recallCross,
  status,
  split,
  merge,
  exportData,
  importData,
  reindex,
  drawerInfo,
  getActiveCabinets
}
