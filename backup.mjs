// 百斗柜 — 记忆数据备份脚本
// 用法: node backup.mjs [备注]
// 备份到 workspace 的 backup 目录

import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, 'data')
const BACKUP_ROOT = path.resolve(__dirname, '..', 'backups') // workspace 通用备份目录
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const NOTE = process.argv[2] || 'auto'

// 备份文件名
const BACKUP_NAME = `cabinet-${TIMESTAMP}`
const BACKUP_DIR = path.join(BACKUP_ROOT, BACKUP_NAME)
const BACKUP_ARCHIVE = path.join(BACKUP_ROOT, `${BACKUP_NAME}.tar`)

async function main() {
  console.log(`📦 百斗柜备份开始...`)
  console.log(`  时间: ${TIMESTAMP}`)
  console.log(`  备注: ${NOTE}`)

  // 读取状态快照
  let stats
  try {
    const integration = await import('./src/integration.js')
    stats = await integration.statusSummary()
  } catch {
    stats = { linked: 'unknown' }
  }

  // 1. 复制 data/ 到备份目录
  await mkdir(BACKUP_DIR, { recursive: true })
  
  // 使用 robocopy (Windows) 或 cp -r
  const { execSync } = await import('node:child_process')
  try {
    execSync(`robocopy "${DATA_DIR}" "${BACKUP_DIR}" /E /NJH /NJS /NDL`, { stdio: 'pipe' })
  } catch {
    // fallback: 手动复制
    await cp(DATA_DIR, BACKUP_DIR, { recursive: true })
  }

  // 2. 写备份元数据
  const meta = {
    backupTime: TIMESTAMP,
    note: NOTE,
    cabinetVersion: '0.1.0',
    stats: stats || {},
    files: []
  }

  // 列出备份中的文件
  const { readdir } = await import('node:fs/promises')
  async function listFiles(dir, prefix) {
    try {
      const items = await readdir(dir, { withFileTypes: true })
      for (const item of items) {
        const rel = path.join(prefix, item.name)
        if (item.isDirectory()) {
          await listFiles(path.join(dir, item.name), rel)
        } else {
          meta.files.push(rel)
        }
      }
    } catch {}
  }
  await listFiles(BACKUP_DIR, '')

  await writeFile(path.join(BACKUP_DIR, 'backup-meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

  const totalSize = meta.files.length
  console.log(`  ✅ 已备份 ${totalSize} 个文件到:`)
  console.log(`     ${BACKUP_DIR}`)

  // 3. 清理超过 30 天的旧备份
  const oldCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  try {
    const backupRoot = await readdir(BACKUP_ROOT)
    for (const item of backupRoot) {
      const itemPath = path.join(BACKUP_ROOT, item)
      if (item.startsWith('cabinet-')) {
        const stat = await import('node:fs/promises').then(m => m.stat(itemPath))
        if (stat.mtimeMs < oldCutoff) {
          await import('node:fs/promises').then(m => m.rm(itemPath, { recursive: true, force: true }))
          console.log(`  🗑️  清理旧备份: ${item}`)
        }
      }
    }
  } catch {}

  console.log(`  备份容量: ~${humanSize(meta.files.length * 500)} (估计)`)
  console.log(`📦 备份完成！`)
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

main().catch(err => {
  console.error('❌ 备份失败:', err.message)
  process.exit(1)
})
