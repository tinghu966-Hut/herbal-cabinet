/**
 * 百斗柜 — API 客户端
 * 统一的 DeepSeek API 调用入口，带指数退避重试
 * 同义词映射表用于搜索扩展
 */

const _proc = globalThis.process;
export const API_URL = _proc.env.HERBAL_API_URL || _proc.env.OPENAI_BASE_URL || 'https://api.deepseek.com'
export const API_KEY = _proc.env.HERBAL_API_KEY || _proc.env.DEEPSEEK_API_KEY || _proc.env.OPENAI_API_KEY

/**
 * 调用 DeepSeek API（统一的调用入口，带指数退避重试）
 * 默认重试 2 次，间隔 1 秒 → 2 秒
 */
export async function callDeepSeek(messages, options = {}) {
  const retries = options.retries ?? 2
  const url = `${API_URL}/chat/completions`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          // 通过 CC Switch 代理时用 openai/gpt-5-chat，直连 DeepSeek 时用 deepseek-chat
          model: options.model || (API_URL.includes('localhost') || API_URL.includes('127.0.0.1') ? 'openai/gpt-5-chat' : 'deepseek-chat'),
          messages,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens || 2000
        })
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`DeepSeek API 错误: ${response.status} ${err}`)
      }
      const data = await response.json()
      return data.choices[0].message.content
    } catch (err) {
      if (attempt === retries) {
        throw err // 最后一次失败则向上抛
      }
      const delay = 1000 * Math.pow(2, attempt) // 1秒 → 2秒
      console.log(`  ⚠️  API 调用失败，${delay}ms 后重试 (${attempt + 1}/${retries}): ${err.message}`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

/**
 * 同义词映射表 — 搜索词扩展
 */
export const SYNONYM_MAP = {
  'api': ['API', '接口', '应用程序接口', '应用程序编程接口', '网络接口'],
  '接口': ['API', '应用程序接口', '网络接口'],
  '股票': ['股票', '股市', '财经', '股', '基金', '投资'],
  '股市': ['股市', '股票', '财经', '基金', '投资'],
  'bug': ['bug', 'BUG', '错误', 'bug修复', '故障', '问题', '缺陷'],
  '错误': ['错误', 'bug', '故障', '问题', '缺陷', '异常'],
  '部署': ['部署', '上线', '发布', '运维', '生产环境', '投产'],
  '上线': ['上线', '部署', '发布', '投产'],
  'ai': ['AI', '人工智能', '模型', '大模型', '深度学习'],
  '人工智能': ['人工智能', 'AI', 'ai', '模型', '大模型'],
  '视频': ['视频', '影片', '短片', '短视频', '影视'],
  '影片': ['影片', '视频', '短片', '短视频'],
  '安全': ['安全', '加密', '防护', '加固', '安全防护'],
  '加密': ['加密', '安全', '防护', '加固']
}

/**
 * 扩展搜索词：加入同义词
 */
export function expandWithSynonyms(terms) {
  const result = new Set(terms.map(t => t.toLowerCase().trim()))
  for (const term of terms) {
    const key = term.toLowerCase().trim()
    if (SYNONYM_MAP[key]) {
      for (const syn of SYNONYM_MAP[key]) {
        result.add(syn.toLowerCase())
      }
    }
  }
  return [...result]
}

/**
 * 从查询中提取搜索关键词（带同义词扩展）
 */
export async function extractSearchTerms(chineseQuery, originalQuery) {
  try {
    const result = await callDeepSeek([
      {
        role: 'system',
        content: `从以下查询中提取3-5个搜索关键词，用于匹配记忆库中的内容。
关键词应该是独立的名词或短语，不是完整的句子。
返回 JSON 数组格式，如 ["关键词1", "关键词2", "关键词3"]
只返回 JSON，不要其他文字。`
      },
      { role: 'user', content: chineseQuery }
    ])
    let terms = JSON.parse(result.trim())
    terms = expandWithSynonyms(terms)
    return terms
  } catch {
    const terms = expandWithSynonyms([chineseQuery])
    if (chineseQuery.length > 4) {
      terms.push(chineseQuery.slice(0, 4).toLowerCase())
      terms.push(chineseQuery.slice(0, 3).toLowerCase())
    }
    return [...new Set(terms)].filter(t => t.length > 0)
  }
}
