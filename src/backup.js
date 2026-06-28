/**
 * 百斗柜 — 备份工具
 * 
 * 功能：
 *   1. 自动备份 data/ 目录到 backups/ 下
 *   2. 按日期命名：backups/backup-YYYY-MM-DD/
 *   3. 保留最近7天，自动删除更早的
 *   4. 生成 manifest 记录备份时间、抽屉数、条目数
 * 
 * 用法：
 *   node src/backup.js            — 执行一次备份
 *   node src/backup.js status     — 查看备份状态
 *   node src/backup.js cleanup    — 手动清理过期备份
 */

import { readdir, mkdir, stat, copyFile, readFile, writeFile, rm } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const DATA_DIR = join(PROJECT_ROOT, 'data')
const BACKUPS_ROOT = join(PROJECT_ROOT, 'backups')
const MAX_BACKUP_DAYS = 7  // 保留最近 7 天

/**
 * 递归获取目录下所有文件（相对路径）
 */
async function getAllFiles(dir, baseDir = dir) {
  const entries = []
  try {
    const items = await readdir(dir, { withFileTypes: true })
    for (const item of items) {
      const fullPath = join(dir, item.name)
      const relPath = relative(baseDir, fullPath)
      if (item.isDirectory()) {
        entries.push(...await getAllFiles(fullPath, baseDir))
      } else {
        entries.push({ fullPath, relPath })
      }
    }
  } catch (err) {
    // data/ 目录不存在也正常
    if (err.code !== 'ENOENT') throw err
  }
  return entries
}

/**
 * 解析 entries.json，计数
 */
async function getEntryCount(filePath) {
  try {
    const data = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(data)
    return parsed.entries?.length || 0
  } catch {
    return 0
  }
}

/**
 * 计算所有抽屉的条目总数
 */
async function totalEntryCount() {
  const drawersDir = join(DATA_DIR, 'drawers')
  let total = 0
  const files = await getAllFiles(drawersDir, drawersDir)
  for (const f of files) {
    if (f.relPath.endsWith('entries.json')) {
      total += await getEntryCount(f.fullPath)
    }
  }
  return total
}

/**
 * 计算抽屉数量
 */
async function countDrawers() {
  const drawersDir = join(DATA_DIR, 'drawers')
  let drawerCount = 0
  const files = await getAllFiles(drawersDir, drawersDir)
  const dirs = new Set()
  for (const f of files) {
    if (f.relPath.endsWith('entries.json')) {
      dirs.add(dirname(f.relPath))
    }
  }
  return dirs.size
}

/**
 * 执行一次完整备份
 */
export async function backup() {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10) // YYYY-MM-DD
  const timestamp = today.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDirName = `backup-${dateStr}`
  const backupDir = join(BACKUPS_ROOT, backupDirName)
  
  console.log(`\n📦 开始备份百斗柜数据...`)
  console.log(`  目标: ${backupDir}`)

  // 1. 创建备份目录
  await mkdir(backupDir, { recursive: true })

  // 2. 复制 data/ 下所有文件
  const dataFiles = await getAllFiles(DATA_DIR, DATA_DIR)
  let copiedCount = 0
  
  for (const f of dataFiles) {
    const destPath = join(backupDir, f.relPath)
    await mkdir(dirname(destPath), { recursive: true })
    await copyFile(f.fullPath, destPath)
    copiedCount++
  }

  // 3. 计算统计数据
  const drawerCount = await countDrawers()
  const entryCount = await totalEntryCount()

  // 4. 生成 manifest
  const manifest = {
    backupDate: timestamp,
    dateStr,
    drawerCount,
    entryCount,
    fileCount: copiedCount,
    version: '0.1.0'
  }
  await writeFile(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  console.log(`  ✅ 备份完成:`)
  console.log(`     📂 共 ${copiedCount} 个文件`)
  console.log(`     📁 ${drawerCount} 个抽屉`)
  console.log(`     💾 ${entryCount} 条记忆`)

  // 5. 清理过期备份
  await cleanupOldBackups()

  return manifest
}

/**
 * 删除超过 7 天的旧备份
 */
export async function cleanupOldBackups() {
  try {
    const backupDirs = await readdir(BACKUPS_ROOT, { withFileTypes: true })
    const now = Date.now()
    const maxAgeMs = MAX_BACKUP_DAYS * 24 * 60 * 60 * 1000
    let removed = 0

    for (const entry of backupDirs) {
      if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue

      const dirPath = join(BACKUPS_ROOT, entry.name)
      const dirStat = await stat(dirPath)
      
      // 从目录名提取日期，或使用 mtime
      let dirDate
      const dateMatch = entry.name.match(/backup-(\d{4}-\d{2}-\d{2})/)
      if (dateMatch) {
        dirDate = new Date(dateMatch[1]).getTime()
      } else {
        dirDate = dirStat.mtimeMs
      }

      if (now - dirDate > maxAgeMs) {
        console.log(`  🗑️  清理过期备份: ${entry.name}`)
        await rm(dirPath, { recursive: true, force: true })
        removed++
      }
    }

    if (removed > 0) {
      console.log(`  ✅ 已清理 ${removed} 个过期备份`)
    }

    return removed
  } catch {
    // backups/ 目录不存在也正常
    return 0
  }
}

/**
 * 查看备份状态
 */
export async function backupStatus() {
  console.log('\n📦 百斗柜备份状态')

  try {
    const backupDirs = await readdir(BACKUPS_ROOT, { withFileTypes: true })
    const backups = []
    
    for (const entry of backupDirs) {
      if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue
      
      const dirPath = join(BACKUPS_ROOT, entry.name)
      const manifestPath = join(dirPath, 'manifest.json')
      
      try {
        const manifestData = await readFile(manifestPath, 'utf-8')
        const manifest = JSON.parse(manifestData)
        backups.push({
          name: entry.name,
          ...manifest
        })
      } catch {
        const dirStat = await stat(dirPath)
        backups.push({
          name: entry.name,
          backupDate: new Date(dirStat.mtimeMs).toISOString(),
          note: '无 manifest'
        })
      }
    }

    // 按日期降序排列
    backups.sort((a, b) => b.name.localeCompare(a.name))

    if (backups.length === 0) {
      console.log('  ⚠️  尚无备份')
      return { hasBackup: false, backups: [] }
    }

    console.log(`  📋 共 ${backups.length} 个备份（保留最近 7 天）`)
    
    for (const b of backups) {
      const date = b.backupDate?.slice(0, 19) || b.name.replace('backup-', '')
      const entries = b.entryCount !== undefined ? `${b.entryCount}条` : '?'
      const drawers = b.drawerCount !== undefined ? `${b.drawerCount}个抽屉` : '?'
      const files = b.fileCount !== undefined ? `${b.fileCount}文件` : ''
      console.log(`     📁 ${b.name} — ${date} | ${entries} | ${drawers} ${files}`)
    }

    // 检查最近一次备份的时间
    const latest = backups[0]
    const label = latest.name.replace('backup-', '')
    console.log(`\n  最新备份: ${label}`)

    return { hasBackup: true, backups, latest: label }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('  ⚠️  尚无备份')
      return { hasBackup: false, backups: [] }
    }
    throw err
  }
}

// CLI 入口
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('backup.js') ||
  process.argv[1].includes('backup')
)

if (isDirectRun) {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'status' || command === 'st') {
    backupStatus().catch(err => {
      console.error('❌ 备份状态查询失败:', err)
      process.exit(1)
    })
  } else if (command === 'cleanup' || command === 'cl') {
    cleanupOldBackups().catch(err => {
      console.error('❌ 清理失败:', err)
      process.exit(1)
    })
  } else {
    backup().catch(err => {
      console.error('❌ 备份失败:', err)
      process.exit(1)
    })
  }
}
