#!/usr/bin/env node
/**
 * 百斗柜 — HTTP API 服务器（v2）
 * 
 * 用 Node.js 内置 http 模块，零外部依赖
 * 支持 CORS，方便前端对接
 * 
 * 启动：node src/server.js [port]（默认 5432）
 */

import http from 'node:http'
import url from 'node:url'
import * as shopkeeper from './shopkeeper.js'
import { listCabinets } from './cabinet.js'
import { t } from './locale.js'

const PORT = parseInt(process.argv[2] || process.env.HERBAL_PORT || process.env.PORT || '5432')
const AUTH_TOKEN = process.env.HERBAL_AUTH_TOKEN || process.env.AUTH_TOKEN || ''

/**
 * 检查认证
 * 如果设置了 AUTH_TOKEN，所有 API 请求必须在 header 中携带 Authorization: Bearer <token>
 */
function checkAuth(req, res) {
  if (!AUTH_TOKEN) return true // 未设置 token 则跳过认证
  const auth = req.headers['authorization'] || ''
  if (auth === `Bearer ${AUTH_TOKEN}`) return true
  sendJSON(res, 401, { success: false, error: t('error_auth_invalid') })
  return false
}

/** 读取请求 body */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(new Error('无效的 JSON 请求体'))
      }
    })
    req.on('error', reject)
  })
}

/** 发送 JSON 响应 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  })
  res.end(JSON.stringify(data, null, 2))
}

/** 解析 URL 路径 */
function parsePath(reqUrl) {
  const parsed = url.parse(reqUrl, true)
  const segments = parsed.pathname.split('/').filter(Boolean)
  return { segments, query: parsed.query }
}

/** 路由处理 */
async function handleRequest(req, res) {
  const method = req.method.toUpperCase()
  const { segments, query } = parsePath(req.url)

  // CORS preflight
  if (method === 'OPTIONS') {
    sendJSON(res, 204, {})
    return
  }

  // API 路径一概检查认证
  if (pathStr.startsWith('api/')) {
    if (!checkAuth(req, res)) return
  }

  const pathStr = segments.join('/')

  try {
    // GET /api/status
    if (method === 'GET' && pathStr === 'api/status') {
      const status = await shopkeeper.status()
      sendJSON(res, 200, { success: true, data: status })
      return
    }

    // POST /api/store
    if (method === 'POST' && pathStr === 'api/store') {
      const body = await readBody(req)
      if (!body.content) {
        sendJSON(res, 400, { success: false, error: 'content 是必填字段' })
        return
      }
      const result = await shopkeeper.process({
        content: body.content,
        drawerPath: body.drawer || body.drawerPath,
        tags: body.tags,
        source: body.source,
        reason: body.reason,
        owner: body.owner,
        importance: body.importance,
        cabinet: body.cabinet
      })
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // POST /api/recall
    if (method === 'POST' && pathStr === 'api/recall') {
      const body = await readBody(req)
      if (!body.query) {
        sendJSON(res, 400, { success: false, error: 'query 是必填字段' })
        return
      }
      const result = await shopkeeper.recall({
        text: body.query,
        cabinet: body.cabinet,
        tag: body.tag,
        type: body.type,
        limit: body.limit || 10
      })
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // POST /api/recall-cross
    if (method === 'POST' && pathStr === 'api/recall-cross') {
      const body = await readBody(req)
      if (!body.query) {
        sendJSON(res, 400, { success: false, error: 'query 是必填字段' })
        return
      }
      const result = await shopkeeper.recallCross({
        text: body.query,
        limit: body.limit || 5
      })
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // GET /api/drawers
    if (method === 'GET' && pathStr === 'api/drawers') {
      const cabinets = await listCabinets()
      const { listAllDrawers } = await import('./clerk.js')
      const drawers = await listAllDrawers(cabinets.map(c => c.name || 'default'))
      sendJSON(res, 200, { success: true, data: { cabinets, drawers } })
      return
    }

    // GET /api/drawers/:path (e.g., /api/drawers/技术/AI模型)
    if (method === 'GET' && segments[0] === 'api' && segments[1] === 'drawers' && segments.length > 2) {
      const drawerPath = segments.slice(2)
      const result = await shopkeeper.drawerInfo(drawerPath, query.cabinet)
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // POST /api/export
    if (method === 'POST' && pathStr === 'api/export') {
      const data = await shopkeeper.exportData()
      sendJSON(res, 200, { success: true, data })
      return
    }

    // POST /api/import
    if (method === 'POST' && pathStr === 'api/import') {
      const body = await readBody(req)
      if (!body.data) {
        sendJSON(res, 400, { success: false, error: 'data 是必填字段' })
        return
      }
      const result = await shopkeeper.importData(body.data)
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // POST /api/reindex
    if (method === 'POST' && pathStr === 'api/reindex') {
      const result = await shopkeeper.reindex()
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // GET /api/cabinets
    if (method === 'GET' && pathStr === 'api/cabinets') {
      const cabinets = await listCabinets()
      sendJSON(res, 200, { success: true, data: cabinets })
      return
    }

    // POST /api/split
    if (method === 'POST' && pathStr === 'api/split') {
      const body = await readBody(req)
      if (!body.drawer) {
        sendJSON(res, 400, { success: false, error: 'drawer 是必填字段' })
        return
      }
      const result = await shopkeeper.split(body.drawer, body.cabinet)
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // POST /api/merge
    if (method === 'POST' && pathStr === 'api/merge') {
      const body = await readBody(req)
      if (!body.child || !body.parent) {
        sendJSON(res, 400, { success: false, error: 'child 和 parent 是必填字段' })
        return
      }
      const result = await shopkeeper.merge(body.child, body.parent, body.cabinet)
      sendJSON(res, 200, { success: true, data: result })
      return
    }

    // 404
    sendJSON(res, 404, { success: false, error: `未找到路由: ${method} /${pathStr}` })

  } catch (err) {
    console.error('❌ API 错误:', err)
    sendJSON(res, 500, { success: false, error: err.message })
  }
}

// 启动服务器
const server = http.createServer(handleRequest)

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║     🏪 百斗柜 API 服务器 v2          ║
║                                      ║
║  地址: http://localhost:${PORT}        ║
║                                      ║
║  端点:                               ║
║    GET  /api/status      系统状态     ║
║    POST /api/store       存入记忆     ║
║    POST /api/recall      检索         ║
║    POST /api/recall-cross 跨柜检索    ║
║    GET  /api/drawers     列出抽屉     ║
║    GET  /api/drawers/:p  抽屉详情     ║
║    POST /api/export      导出         ║
║    POST /api/import      导入         ║
║    POST /api/reindex     重建索引     ║
║    POST /api/split       分裂         ║
║    POST /api/merge       合并         ║
║    GET  /api/cabinets    列出柜子     ║
╚══════════════════════════════════════╝
  `)
})

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 百斗柜 API 服务器已关闭')
  server.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  server.close()
  process.exit(0)
})
