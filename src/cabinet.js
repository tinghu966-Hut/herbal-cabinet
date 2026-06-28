/**
 * 百斗柜 — 柜子管理器
 * 
 * 管理多用户多柜子的生命周期
 * 每个柜子独立配置（软/硬上限、主题等）
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CABINETS_ROOT = path.resolve(__dirname, '..', 'data', 'cabinets')
const CABINET_META_FILE = '.meta.json'

/** 默认柜子：兼容旧版 data/drawers/ 结构 */
export const LEGACY_CABINET = 'default'

/** 默认柜子配置 */
function getDefaultCabinetConfig(name) {
  return {
    name,
    version: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drawerSoftLimit: 30,
    drawerHardLimit: 50,
    drawerMaxDepth: 3,
    description: '',
    tags: [],
    owner: 'local'
  }
}

/**
 * 获取柜子 meta 文件路径
 */
function getCabinetMetaPath(cabinetName) {
  return path.join(CABINETS_ROOT, cabinetName, CABINET_META_FILE)
}

/**
 * 获取柜子的抽屉数据目录
 */
export function getCabinetDrawerRoot(cabinetName) {
  return path.join(CABINETS_ROOT, cabinetName, 'drawers')
}

/**
 * 获取柜子的索引文件路径
 */
export function getCabinetIndexPath(cabinetName) {
  return path.join(CABINETS_ROOT, cabinetName, 'index.idx')
}

/**
 * 列出所有柜子
 */
export async function listCabinets() {
  try {
    const items = await readdir(CABINETS_ROOT, { withFileTypes: true })
    const cabinets = []
    for (const item of items) {
      if (item.isDirectory()) {
        const meta = await loadCabinetMeta(item.name)
        cabinets.push(meta)
      }
    }
    return cabinets
  } catch {
    // 如果 cabinets 目录不存在，检查旧版 data/drawers/
    return []
  }
}

/**
 * 创建或确保柜子存在
 */
export async function ensureCabinet(name) {
  const metaPath = getCabinetMetaPath(name)
  try {
    const data = await readFile(metaPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    // 创建新柜子
    await mkdir(path.dirname(metaPath), { recursive: true })
    const config = getDefaultCabinetConfig(name)
    await writeFile(metaPath, JSON.stringify(config, null, 2), 'utf-8')
    // 创建抽屉目录
    await mkdir(getCabinetDrawerRoot(name), { recursive: true })
    return config
  }
}

/**
 * 加载柜子配置
 */
export async function loadCabinetMeta(name) {
  try {
    const data = await readFile(getCabinetMetaPath(name), 'utf-8')
    return JSON.parse(data)
  } catch {
    return getDefaultCabinetConfig(name)
  }
}

/**
 * 保存柜子配置
 */
export async function saveCabinetMeta(cabinet) {
  const metaPath = getCabinetMetaPath(cabinet.name)
  await mkdir(path.dirname(metaPath), { recursive: true })
  cabinet.updatedAt = new Date().toISOString()
  await writeFile(metaPath, JSON.stringify(cabinet, null, 2), 'utf-8')
}

/**
 * 获取或创建默认柜子（兼容旧版 data/drawers/ 数据）
 */
export async function getOrCreateDefaultCabinet() {
  return await ensureCabinet(LEGACY_CABINET)
}

/**
 * 删除柜子（清空数据 + meta）
 */
export async function removeCabinet(name) {
  const cabinetPath = path.join(CABINETS_ROOT, name)
  if (existsSync(cabinetPath)) {
    const { rm } = await import('node:fs/promises')
    await rm(cabinetPath, { recursive: true, force: true })
    return true
  }
  return false
}

export default {
  listCabinets,
  ensureCabinet,
  loadCabinetMeta,
  saveCabinetMeta,
  getOrCreateDefaultCabinet,
  getCabinetDrawerRoot,
  LEGACY_CABINET
}
