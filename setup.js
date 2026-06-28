/**
 * 百斗柜 — 一次性集成设置脚本
 * 
 * 用法: node setup.js
 * 运行一次即可，以后 AI 自动调用百斗柜
 */

import { linkAI, setupPage } from './src/integration.js'

async function setup() {
  console.log(`
╔══════════════════════════════════════╗
║       百斗柜 — AI 记忆系统设置       ║
║                                      ║
║  首次使用需要做一次性链接            ║
║  以后 AI 会自动调用百斗柜            ║
╚══════════════════════════════════════╝
  `)

  // 检查是否已链接
  const status = await setupPage()
  if (status.status === 'linked') {
    console.log(`✅ 百斗柜已经链接过了！`)
    console.log(`   链接时间: ${status.linkedAt}`)
    console.log(`   AI 名称: ${status.aiName}`)
    console.log(`   抽屉数: ${status.stats?.drawerCount || 0}`)
    console.log(`   记忆条数: ${status.stats?.entryCount || 0}`)
    console.log(`\n不需要再次设置，直接使用即可。`)
    return
  }

  console.log('正在建立链接...\n')

  // 自动链接 main AI
  const result = await linkAI({ aiName: 'main' })

  console.log(`✅ ${result.message}`)
  console.log(`
📋 集成配置:
   - 自动存储: ${result.config.autoStore ? '开' : '关'}
   - 自动检索: ${result.config.autoRecall ? '开' : '关'}
   - 会话追踪: ${result.config.sessionTracking ? '开' : '关'}

📌 使用方式:
   从现在开始，每次对话结束后，AI 自动记住关键内容。
   新对话开始时，AI 自动检索相关记忆。

   不需要你做任何额外操作。
  `)

  console.log('设置完成！')
}

setup().catch(err => {
  console.error('设置失败:', err)
  process.exit(1)
})
