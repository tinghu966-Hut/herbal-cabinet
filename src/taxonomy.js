/**
 * 百斗柜 — 分类树管理
 * 定义抽屉的层级结构，支持自动创建和路径解析
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TAXONOMY_FILE = path.resolve(__dirname, '..', 'data', 'config', 'taxonomy.json')

const DEFAULT_TAXONOMY = {
  version: 1,
  root: {
    name: '根目录',
    path: [],
    children: {},
    maxEntries: 0 // root doesn't store entries directly
  }
}

export async function loadTaxonomy() {
  try {
    const data = await readFile(TAXONOMY_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    await mkdir(path.dirname(TAXONOMY_FILE), { recursive: true })
    await saveTaxonomy(DEFAULT_TAXONOMY)
    return JSON.parse(JSON.stringify(DEFAULT_TAXONOMY))
  }
}

export async function saveTaxonomy(taxonomy) {
  await mkdir(path.dirname(TAXONOMY_FILE), { recursive: true })
  await writeFile(TAXONOMY_FILE, JSON.stringify(taxonomy, null, 2), 'utf-8')
}

/**
 * 根据路径查找或创建抽屉节点
 * @param {object} taxonomy - 分类树
 * @param {string[]} pathParts - 路径 ["技术", "命理站", "八字"]
 * @param {boolean} create - 如果不存在是否创建
 * @returns {object|null} 节点对象
 */
export function resolvePath(taxonomy, pathParts, create = false) {
  let current = taxonomy.root
  const fullPath = []

  for (const part of pathParts) {
    fullPath.push(part)
    if (!current.children[part]) {
      if (!create) return null
      current.children[part] = {
        name: part,
        path: [...fullPath],
        children: {},
        maxEntries: 100,
        entryCount: 0
      }
    }
    current = current.children[part]
  }

  return current
}

/**
 * 获取所有叶子节点（实际存内容的抽屉）
 */
export function getLeafNodes(node = null, taxonomy = null) {
  if (!node && taxonomy) node = taxonomy.root
  if (!node || !node.children) return []

  const leaves = []
  const children = Object.values(node.children)

  if (children.length === 0) {
    // 叶子节点
    leaves.push(node)
  } else {
    for (const child of children) {
      leaves.push(...getLeafNodes(child))
    }
  }

  return leaves
}

/**
 * 获取某个节点下的所有路径
 */
export function getAllPaths(node = null, taxonomy = null, prefix = []) {
  if (!node && taxonomy) node = taxonomy.root
  if (!node) return []

  const paths = []
  if (node.path.length > 0) {
    paths.push(node.path)
  }

  for (const child of Object.values(node.children)) {
    paths.push(...getAllPaths(child, null, node.path))
  }

  return paths
}

/**
 * 根据关键词搜索匹配的路径
 * @param {string} keyword 
 * @param {object} taxonomy 
 * @returns {string[]} 匹配的路径数组
 */
export function searchPaths(keyword, taxonomy) {
  const allPaths = getAllPaths(null, taxonomy)
  const kw = keyword.toLowerCase()
  return allPaths.filter(p => 
    p.some(segment => segment.toLowerCase().includes(kw))
  )
}
