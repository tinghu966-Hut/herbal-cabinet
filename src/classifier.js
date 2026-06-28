/**
 * 百斗柜 — 分类器
 * 负责翻译、分类路径判断、摘要/关键词生成、抽屉分裂决策
 *
 * v3 改进：
 * - 分类提示词动态生成（不再硬编码项目名）
 * - 从现有路径自动推断分类规则
 */

import { callDeepSeek } from './api-client.js'

/**
 * 检测语言并翻译到中文
 */
export async function translateToChinese(text) {
  const hasChinese = /[\u4e00-\u9fff]/.test(text)
  if (hasChinese) return { content: text, sourceLang: 'zh' }

  const result = await callDeepSeek([
    {
      role: 'system',
      content: '你是一位翻译。将用户的输入翻译成中文。只返回翻译结果，不要解释，不要加引号。'
    },
    { role: 'user', content: text }
  ])

  return { content: result.trim(), sourceLang: 'en' }
}

/**
 * 从现有路径动态构建分类提示词（不再硬编码项目名称）
 */
function buildClassificationPrompt(existingPaths) {
  const topLevels = [...new Set(existingPaths.map(p => p[0]))]

  // 路径提示
  const pathsHint = existingPaths.length > 0
    ? `现有路径（必须从以下路径中选择，禁止创建新路径）：\n${existingPaths.map(p => '  📁 ' + p.join(' > ')).join('\n')}`
    : '暂无现有路径。'

  // 构建技术子类的规则说明
  const techPaths = existingPaths.filter(p => p[0] === '技术')
  const techRules = techPaths.length > 0
    ? `\n### 🏗️ 技术子类\n${techPaths.map(p => `- ${p.join(' > ')}：该主题的相关内容`).join('\n')}`
    : ''

  // 构建项目路径的规则说明
  const projectPaths = existingPaths.filter(p => p[0] === '项目')
  const projectNames = [...new Set(projectPaths.map(p => p[1] || ''))].filter(Boolean)
  const projectRules = projectNames.length > 0
    ? `\n### 📦 项目（${projectNames.join('、')}）\n${projectNames.map(n => `- 如果内容与"${n}"相关 → 项目 > ${n}`).join('\n')}\n${projectPaths.filter(p => p.length >= 3).map(p => `- 关于${p.slice(0, -1).join(' > ')}的${p[p.length - 1]}相关内容 → ${p.join(' > ')}`).join('\n')}`
    : ''

  return `你是一位中药房的掌柜，负责将信息片段准确分类放入正确的抽屉。

## 核心规则（必须遵守）
1. **只能从现有路径中选择，绝对不允许创建新路径**
2. 如果内容完全不匹配任何现有路径，返回 ["通用"]

## 顶层分类判断
${topLevels.includes('技术') ? '- "技术"：通用技术问题（跨项目的纯技术话题：开发、部署、架构、维护等）\n' : ''}${topLevels.includes('项目') ? '- "项目"：与具体业务项目相关的内容（决策、方向、进度等）\n' : ''}${topLevels.includes('运营') ? '- "运营"：跨项目运营/推广/社区\n' : ''}${topLevels.includes('项目进度') ? '- "项目进度"：项目进度汇总\n' : ''}- "通用"：生活日常、非业务相关的一切内容（最后的兜底分类，慎用）

## 分类路径规则
${techRules}${projectRules}

${pathsHint}

## 输出
只返回 JSON 数组，不要任何其他文字。
输出格式：["顶层", "子层"] 或 ["顶层", "子层", "子子层"]`
}

/**
 * 判断一段内容应该放进哪个抽屉
 *
 * v3 改进：分类提示词从现有路径动态生成，不再硬编码项目名称
 */
export async function classifyContent(text, existingPaths) {
  const systemPrompt = buildClassificationPrompt(existingPaths)

  const result = await callDeepSeek([
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: `请分类这段内容：\n---\n${text}\n---`
    }
  ])

  try {
    const parsed = JSON.parse(result.trim())
    if (Array.isArray(parsed)) {
      const validTops = ['技术', '项目', '通用', '项目进度', '运营']
      if (!validTops.includes(parsed[0])) {
        parsed[0] = '通用'
      }
      // 验证路径是否在现有路径中
      const pathStr = parsed.join(' > ')
      const exists = existingPaths.some(p => p.join(' > ') === pathStr)
      if (!exists && parsed[0] !== '通用' && parsed[0] !== '项目进度' && parsed[0] !== '运营') {
        if (parsed.length > 1) {
          const parentMatch = existingPaths.some(p => {
            const pp = parsed.slice(0, -1).join(' > ')
            return p.join(' > ') === pp || p.join(' > ').startsWith(pp)
          })
          if (!parentMatch) {
            parsed[0] = '通用'
            parsed.length = 1
          }
        }
      }
      return parsed
    }
    return ['通用']
  } catch {
    const match = result.match(/\[.*?\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        return Array.isArray(parsed) ? parsed : ['通用']
      } catch {}
    }
    return ['通用']
  }
}

/**
 * 生成摘要和关键词
 */
export async function generateMetadata(content) {
  const result = await callDeepSeek([
    {
      role: 'system',
      content: `分析以下内容，返回 JSON 格式的摘要信息：
{
  "summary": "一句话摘要（不超过20字）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "type": "内容类型（discussion=讨论/decision=决策/client_note=客户记录/tech_note=技术记录/idea=想法）"
}
只返回 JSON，不要其他文字。`
    },
    { role: 'user', content }
  ])

  try {
    return JSON.parse(result.trim())
  } catch {
    return {
      summary: content.slice(0, 40) + '...',
      keywords: [content.slice(0, 10)],
      type: 'discussion'
    }
  }
}

/**
 * 决定如何分裂一个已满的抽屉
 */
export async function decideSplit(drawerPath, entries) {
  const entriesText = entries.map((e, i) =>
    `[${i}] 摘要: ${e.summary || e.content.slice(0, 50)} | 关键词: ${(e.keywords || []).join(', ')}`
  ).join('\n')

  const result = await callDeepSeek([
    {
      role: 'system',
      content: `抽屉 "${drawerPath.join(' > ')}" 中的条目已满（${entries.length}条），需要分裂成更细的子抽屉。

分析以下条目，将它们分成2-4个子类目。返回 JSON：
{
  "categories": {
    "子类目名称1": [条目索引数组],
    "子类目名称2": [条目索引数组]
  },
  "reason": "分裂理由"
}
只返回 JSON，不要其他文字。`
    },
    { role: 'user', content: entriesText }
  ])

  try {
    return JSON.parse(result.trim())
  } catch {
    const mid = Math.floor(entries.length / 2)
    const plan = {
      categories: {
        'A组': Array.from({ length: mid }, (_, i) => i),
        'B组': Array.from({ length: entries.length - mid }, (_, i) => mid + i)
      },
      reason: '条目数量超过上限，自动均分成两组'
    }
    return plan
  }
}

/**
 * 批量处理（翻译+分类+摘要+关键词）
 * 合并为一次 API 调用
 */
export async function processBatch(content, existingPaths) {
  const hasChinese = /[\u4e00-\u9fff]/.test(content)
  const pathsHint = existingPaths.length > 0
    ? `现有路径（必须从以下路径中选择，禁止创建新路径）：\n${existingPaths.map(p => '  📁 ' + p.join(' > ')).join('\n')}`
    : '暂无现有路径。'

  const prompt = hasChinese
    ? `处理以下内容，返回 JSON：
{
  "content": "（原文，不需翻译）",
  "path": ["顶层", "子层"],
  "summary": "一句话摘要（不超过20字）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "type": "内容类型"
}

## 路径选择规则
- "技术"：通用技术问题
- "项目"：与具体项目相关的内容
- "通用"：非业务相关的一切内容

${pathsHint}

只返回 JSON，不要其他文字。`
    : `将以下内容翻译成中文，然后分类和生成摘要：
{
  "content": "（翻译后的中文）",
  "path": ["顶层", "子层"],
  "summary": "一句话摘要（不超过20字）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "type": "内容类型",
  "translated": true
}

## 路径选择规则
- "技术"：通用技术问题
- "项目"：与具体项目相关的内容
- "通用"：非业务相关的一切内容

${pathsHint}

只返回 JSON，不要其他文字。`

  const result = await callDeepSeek([
    {
      role: 'system',
      content: `你是一位中药房的掌柜，负责处理药材（信息片段）。${hasChinese ? '内容已是中文，直接处理。' : '先翻译成中文，再处理。'}`
    },
    { role: 'user', content: `${prompt}\n\n内容：\n${content}` }
  ])

  try {
    return JSON.parse(result.trim())
  } catch {
    return null
  }
}
