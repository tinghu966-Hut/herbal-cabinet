/**
 * 百斗柜 — 文件锁（并发控制）
 *
 * 简单的文件锁机制，防止多 Agent 同时写入导致数据损坏。
 * - 写锁：独占锁，等待最多 3 秒
 * - 读锁：共享锁（不做真的共享锁，但写锁等待时允许并发读取）
 *
 * 锁文件放在 data/locks/{cabinet}.lock
 * 锁内容为持有者的 PID + 时间戳，用于调试
 */

import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCKS_ROOT = path.resolve(__dirname, '..', 'data', 'locks')

const WRITE_TIMEOUT_MS = 3000  // 写锁最长等待 3 秒
const POLL_INTERVAL_MS = 100   // 轮询间隔 100ms
const STALE_LOCK_MS = 10000    // 超过 10 秒的锁视为过期

/**
 * 获取锁文件路径
 */
function getLockPath(cabinet) {
  return path.join(LOCKS_ROOT, `${cabinet}.lock`)
}

/**
 * 检查锁是否过期
 */
function isLockStale(lockData) {
  const now = Date.now()
  return (now - lockData.timestamp) > STALE_LOCK_MS
}

/**
 * 读取锁文件内容
 */
async function readLock(cabinet) {
  try {
    const data = await readFile(getLockPath(cabinet), 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * 写入锁文件
 */
async function writeLock(cabinet, data) {
  await mkdir(LOCKS_ROOT, { recursive: true })
  await writeFile(getLockPath(cabinet), JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 删除锁文件
 */
async function releaseLock(cabinet) {
  try {
    await unlink(getLockPath(cabinet))
  } catch {
    // 文件可能已被其他进程删除
  }
}

/**
 * 获取写锁（独占）
 *
 * 轮询锁文件，直到获得锁或超时。
 * 如果发现锁过期（超过 10 秒），自动清除并重新获取。
 *
 * @param {string} cabinet - 柜子名称（用于锁命名空间）
 * @returns {Promise<boolean>} 是否成功获取锁
 */
export async function acquireWriteLock(cabinet = 'default') {
  const startTime = Date.now()
  const lockInfo = {
    pid: process.pid || 0,
    timestamp: startTime,
    type: 'write',
    cabinet
  }

  while (Date.now() - startTime < WRITE_TIMEOUT_MS) {
    // 检查当前是否有锁
    const currentLock = await readLock(cabinet)

    if (!currentLock) {
      // 没有锁，获取
      await writeLock(cabinet, lockInfo)
      return true
    }

    // 有锁但过期，清除并重试
    if (isLockStale(currentLock)) {
      await releaseLock(cabinet)
      continue
    }

    // 有锁且未过期，等待
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  // 超时：尝试强制获取（谨慎）
  const staleLock = await readLock(cabinet)
  if (staleLock && isLockStale(staleLock)) {
    await releaseLock(cabinet)
    await writeLock(cabinet, lockInfo)
    return true
  }

  return false
}

/**
 * 释放写锁
 */
export async function releaseWriteLock(cabinet = 'default') {
  const currentLock = await readLock(cabinet)
  if (currentLock && currentLock.type === 'write') {
    await releaseLock(cabinet)
  }
}

/**
 * 带锁执行写入操作
 *
 * 自动获取锁、执行操作、释放锁
 *
 * @param {Function} fn - 要执行的异步写入操作
 * @param {string} cabinet - 柜子名称
 * @returns {Promise<any>} 操作结果
 */
export async function withWriteLock(fn, cabinet = 'default') {
  const acquired = await acquireWriteLock(cabinet)
  if (!acquired) {
    throw new Error(`无法获取写入锁（柜子: ${cabinet}），请稍后重试`)
  }

  try {
    return await fn()
  } finally {
    await releaseWriteLock(cabinet)
  }
}

/**
 * 清理所有过期的锁文件
 */
export async function cleanStaleLocks() {
  const { readdir } = await import('node:fs/promises')
  try {
    const files = await readdir(LOCKS_ROOT)
    for (const file of files) {
      if (!file.endsWith('.lock')) continue
      const cabinet = file.replace('.lock', '')
      const lock = await readLock(cabinet)
      if (lock && isLockStale(lock)) {
        await releaseLock(cabinet)
      }
    }
  } catch {
    // 目录不存在就跳过
  }
}

export default {
  acquireWriteLock,
  releaseWriteLock,
  withWriteLock,
  cleanStaleLocks
}
