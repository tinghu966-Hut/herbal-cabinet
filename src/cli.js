/**
 * 百斗柜 — CLI 入口（v2 增强版）
 * 
 * 用法：
 *   node src/cli.js store <内容> -D "分类" [-T "标签"] [-S 来源] [-R 理由] [-O 用户] [-I 重要性] [-C 柜子]
 *   node src/cli.js recall <查询> [-C 柜子] [-T 标签] [-L 限制] [--type 类型]
 *   node src/cli.js rc <查询>        -- 跨抽屉聚合检索
 *   node src/cli.js status           -- 完整状态
 *   node src/cli.js reindex          -- 重建索引
 *   node src/cli.js export           -- 导出数据
 *   node src/cli.js import <文件>     -- 导入数据
 *   node src/cli.js info <路径>      -- 抽屉详情
 *   node src/cli.js split <路径>     -- 手动分裂
 *   node src/cli.js merge <源> <目标> -- 合并抽屉
 *   node src/cli.js cabinets         -- 列出柜子
 *   node src/cli.js                   -- 交互模式
 */

import * as shopkeeper from './shopkeeper.js'
import { listCabinets } from './cabinet.js'
import { init } from './init.js'
import { t, getLang } from './locale.js'

async function main() {
  // 预先过滤 --lang=* 参数
  const allArgs = process.argv.slice(2)
  const filtered = allArgs.filter(a => !a.startsWith('--lang='))
  const command = filtered[0]
  const remaining = filtered.slice(1)

  if (!command || command === 'interactive' || command === 'i') {
    await interactiveMode()
    return
  }

  const parsed = parseArgs(remaining)

  switch (command) {
    case 'store':
    case 's':
      await cmdStore(parsed)
      break

    case 'recall':
    case 'r':
      await cmdRecall(parsed)
      break

    case 'recall-cross':
    case 'rc':
      await cmdRecallCross(parsed)
      break

    case 'status':
    case 'st':
    case 'info':
    case 'i':
      await shopkeeper.status()
      break

    case 'reindex':
      await shopkeeper.reindex()
      break

    case 'export':
    case 'e':
      await cmdExport(parsed)
      break

    case 'import':
    case 'im':
      await cmdImport(parsed)
      break

    case 'split':
      await cmdSplit(parsed)
      break

    case 'merge':
      await cmdMerge(parsed)
      break

    case 'detail':
    case 'details':
      await cmdDetail(parsed)
      break

    case 'init':
      await init()
      break

    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break

    case 'cabinets':
      await cmdCabinets()
      break

    default:
      console.log(`${t('error_unknown')}: ${command}`)
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  const isEn = getLang() === 'en'
  if (isEn) {
    console.log(`
🏪 Herbal Cabinet v2 — ${t('interactive_welcome')}

Usage:
  node src/cli.js store <content>    ${t('help_store')}
    -D, --drawer "category/path"   Drawer path (required)
    -T, --tags "tag1,tag2"         Tags
    -S, --source source             Source (default: conversation)
    -R, --reason reason             Reason for storing
    -O, --owner owner               Owner ID
    -I, --importance 1-5            Importance
    -C, --cabinet name              Cabinet name

  node src/cli.js recall <query>   ${t('help_recall')}
    -C, --cabinet name             Limit to cabinet
    -T, --tag tag                  Filter by tag
    -L, --limit N                  Result limit
    --type type                    Filter by type

  node src/cli.js rc <query>       ${t('help_rc')}
  node src/cli.js status           ${t('help_status')}
  node src/cli.js reindex          ${t('help_reindex')}
  node src/cli.js init             Initialize with seed data
  node src/cli.js export           ${t('help_export')}
  node src/cli.js import <file>    ${t('help_import')}
  node src/cli.js split <path>     ${t('help_split')}
  node src/cli.js merge <src> <dst> ${t('help_merge')}
  node src/cli.js detail <path>    ${t('help_detail')}
  node src/cli.js cabinets         ${t('help_cabinets')}
`)
  } else {
    console.log(`
📖 百斗柜 v2 — ${t('interactive_welcome')}

用法:
  node src/cli.js store <内容>    ${t('help_store')}
    -D, --drawer "分类路径"     分类（必填）
    -T, --tags "标签1,标签2"    标签
    -S, --source 来源           来源（默认: 对话）
    -R, --reason 记录理由
    -O, --owner 所有者
    -I, --importance 重要性     1-5
    -C, --cabinet 柜子名        柜子

  node src/cli.js recall <查询>  ${t('help_recall')}
    -C, --cabinet 柜子名        限定柜子
    -T, --tag 标签              按标签过滤
    -L, --limit 数量            结果上限
    --type 类型                 过滤类型

  node src/cli.js rc <查询>      ${t('help_rc')}
  node src/cli.js status         ${t('help_status')}
  node src/cli.js reindex        ${t('help_reindex')}
  node src/cli.js init           初始化示例数据
  node src/cli.js export         ${t('help_export')}
  node src/cli.js import <文件>  ${t('help_import')}
  node src/cli.js split <路径>   ${t('help_split')}
  node src/cli.js merge <源> <目标> ${t('help_merge')}
  node src/cli.js detail <路径>  ${t('help_detail')}
  node src/cli.js cabinets       ${t('help_cabinets')}
`)
  }
}

async function cmdStore(parsed) {
  const content = parsed.positionals.join(' ')
  if (!content) {
    console.error('❌ 用法: node src/cli.js store <内容> -D "分类"')
    process.exit(1)
  }
  if (!parsed.options.drawer) {
    console.error('❌ store 必须指定抽屉：-D "分类" 或 --drawer "分类"')
    process.exit(1)
  }

  const result = await shopkeeper.process({
    content,
    drawerPath: parsed.options.drawer,
    tags: parsed.options.tags,
    source: parsed.options.source,
    reason: parsed.options.reason,
    owner: parsed.options.owner,
    importance: parsed.options.importance ? parseInt(parsed.options.importance) : undefined,
    cabinet: parsed.options.cabinet
  })

  console.log(`\n✅ ${t('store_success')} [${result.drawerPath.join(' > ')}] (${result.cabinet})`)
  console.log(`   ${t('index_keywords')}: ${result.summary}`)
}

async function cmdRecall(parsed) {
  const query = parsed.positionals.join(' ')
  if (!query) {
    console.error('❌ 用法: node src/cli.js recall <查询内容>')
    process.exit(1)
  }

  const result = await shopkeeper.recall({
    text: query,
    cabinet: parsed.options.cabinet,
    tag: parsed.options.tag || parsed.options.tags,
    type: parsed.options.type,
    limit: parsed.options.limit ? parseInt(parsed.options.limit) : 10
  })

  console.log(`\n--- 共 ${result.entries.length} 条结果 ---`)
  result.entries.forEach((e, i) => {
    const path = e.drawerPath?.join(' > ') || '?'
    console.log(`\n  [${i + 1}] 📁 ${path}`)
    console.log(`      时间: ${(e.timestamp || e.time || '').slice(0, 19)}`)
    console.log(`      摘要: ${e.summary || '无'}`)
    console.log(`      内容: ${(e.content || '').slice(0, 200)}`)
    console.log(`      标签: ${(e.tags || []).join(', ') || '无'}`)
    if (e.importance > 0) console.log(`      重要性: ${'⭐'.repeat(e.importance)}`)
  })
}

async function cmdRecallCross(parsed) {
  const query = parsed.positionals.join(' ')
  if (!query) {
    console.error('❌ 用法: node src/cli.js rc <查询内容>')
    process.exit(1)
  }

  const result = await shopkeeper.recallCross({
    text: query,
    limit: parsed.options.limit ? parseInt(parsed.options.limit) : 5
  })
}

async function cmdExport(parsed) {
  const data = await shopkeeper.exportData()
  const outputPath = parsed.options.output || parsed.options.O || `herbal-cabinet-export-${new Date().toISOString().slice(0, 10)}.json`
  
  const { writeFile } = await import('node:fs/promises')
  await writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`\n✅ 已导出到: ${outputPath}`)
  console.log(`   共 ${data.cabinets.length} 个柜子`)
}

async function cmdImport(parsed) {
  const inputPath = parsed.options.input || parsed.options.I || parsed.positionals[0]
  if (!inputPath) {
    console.error('❌ 用法: node src/cli.js import <文件路径>')
    process.exit(1)
  }

  const { readFile } = await import('node:fs/promises')
  const data = JSON.parse(await readFile(inputPath, 'utf-8'))
  await shopkeeper.importData(data)
  console.log(``)
}

async function cmdSplit(parsed) {
  const path = parsed.positionals.join(' ')
  if (!path) {
    console.error('❌ 用法: node src/cli.js split <抽屉路径>')
    process.exit(1)
  }

  const result = await shopkeeper.split(path, parsed.options.cabinet)
  console.log(`\n✅ 分裂完成`)
  for (const child of result.children) {
    console.log(`   📁 ${child.path.join(' > ')} (${child.count} 条)`)
  }
}

async function cmdMerge(parsed) {
  const [child, parent] = parsed.positionals
  if (!child || !parent) {
    console.error('❌ 用法: node src/cli.js merge <源路径> <目标路径>')
    process.exit(1)
  }

  const result = await shopkeeper.merge(child, parent, parsed.options.cabinet)
  console.log(`\n✅ 已合并 ${result.movedCount} 条到 ${result.parent.join(' > ')}`)
}

async function cmdDetail(parsed) {
  const path = parsed.positionals.join(' ')
  if (!path) {
    console.error('❌ 用法: node src/cli.js detail <抽屉路径>')
    process.exit(1)
  }

  const info = await shopkeeper.drawerInfo(path, parsed.options.cabinet)
  console.log(`\n📁 抽屉: ${info.path.join(' > ')} (${info.cabinet})`)
  console.log(`   条目数: ${info.entryCount}`)
  console.log(`   归档: ${info.archived ? '是' : '否'}`)
  console.log(`   创建时间: ${info.createdAt || '未知'}`)

  if (info.entries.length > 0) {
    console.log('\n📋 条目列表:')
    info.entries.slice(0, 20).forEach((e, i) => {
      console.log(`  ${i + 1}. [${(e.timestamp || '').slice(0, 10)}] ${e.summary || (e.content || '').slice(0, 60)}`)
    })
    if (info.entries.length > 20) {
      console.log(`  ... 还有 ${info.entries.length - 20} 条`)
    }
  }
}

async function cmdCabinets() {
  const cabinets = await listCabinets()
  console.log(`\n📦 柜子 (${cabinets.length} 个):`)
  for (const c of cabinets) {
    console.log(`  ${c.name} — 创建: ${(c.createdAt || '').slice(0, 10)}`)
  }
}

function parseArgs(args) {
  const options = {}
  const positionals = []
  const flagMap = {
    '-D': 'drawer', '--drawer': 'drawer',
    '-T': 'tags', '--tags': 'tags', '--tag': 'tags',
    '-S': 'source', '--source': 'source',
    '-R': 'reason', '--reason': 'reason',
    '-O': 'owner', '--owner': 'owner',
    '-I': 'importance', '--importance': 'importance',
    '-C': 'cabinet', '--cabinet': 'cabinet',
    '-L': 'limit', '--limit': 'limit',
    '--type': 'type',
    '--output': 'output', '-O': 'output',
    '--input': 'input', '-I': 'input'
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const eqIndex = arg.indexOf('=')
    const flag = eqIndex > -1 ? arg.slice(0, eqIndex) : arg
    const optionName = flagMap[flag]

    if (!optionName) {
      positionals.push(arg)
      continue
    }

    const value = eqIndex > -1 ? arg.slice(eqIndex + 1) : args[++i]
    if (!value) {
      console.error(`❌ 参数 ${flag} 需要一个值`)
      process.exit(1)
    }

    options[optionName] = optionName === 'tags'
      ? value.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
      : value
  }

  return { positionals, options }
}

async function interactiveMode() {
  console.log(`
╔══════════════════════════════════════╗
║     🏪 百斗柜 v2 · 记忆管理系统      ║
║                                      ║
║  输入内容 → 自动翻译/分类/存储        ║
║  ?查询内容 → 检索                     ║
║  status → 查看状态                    ║
║  cabinets → 列出柜子                 ║
║  /split → 分裂                       ║
║  /export → 导出                      ║
║  exit → 退出                         ║
╚══════════════════════════════════════╝
  `)

  const readline = (await import('node:readline')).default
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '🏪 百斗柜> '
  })

  rl.prompt()

  for await (const line of rl) {
    const input = line.trim()
    if (!input) { rl.prompt(); continue }
    if (input === 'exit' || input === 'quit') break

    if (input === 'status' || input === 'st') {
      await shopkeeper.status()
    } else if (input === 'cabinets') {
      await cmdCabinets()
    } else if (input.startsWith('/') || input.startsWith('!')) {
      const cmd = input.slice(1).trim()
      if (cmd === 'export') {
        const data = await shopkeeper.exportData()
        const filename = `herbal-cabinet-export-${new Date().toISOString().slice(0, 10)}.json`
        const { writeFile } = await import('node:fs/promises')
        await writeFile(filename, JSON.stringify(data, null, 2), 'utf-8')
        console.log(`✅ 已导出到 ${filename}`)
      } else if (cmd === 'reindex') {
        await shopkeeper.reindex()
      }
    } else if (input.startsWith('?')) {
      const query = input.slice(1).trim()
      if (query) {
        await shopkeeper.recall({ text: query })
      }
    } else {
      await shopkeeper.process({ content: input })
    }
    rl.prompt()
  }

  rl.close()
  console.log('\n👋 百斗柜已关闭')
}

// 仅在直接运行时执行
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('cli.js') || 
  process.argv[1].includes('cli')
)

if (isDirectRun) {
  main().catch(err => {
    console.error('❌ 错误:', err)
    process.exit(1)
  })
}
