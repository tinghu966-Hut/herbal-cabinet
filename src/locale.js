/**
 * 百斗柜 — 简单本地化（i18n）
 * 
 * 支持中文、英文，通过 --lang=en 或 HERBAL_LANG 环境变量切换
 * 默认为中文（当前用户习惯）
 */

import { env } from 'node:process'

const LOCALE = {
  zh: {
    // 基本
    cabinet: '柜子',
    drawer: '抽屉',
    entry: '条目',
    clerk: '伙计',
    shopkeeper: '掌柜',
    index: '索引',

    // 状态
    status_header: '系统状态',
    total_drawers: '活跃抽屉',
    total_entries: '条记忆',
    total_cabinets: '个柜子',
    hot_tags: '热门标签',
    service_cli: 'CLI',
    service_api: 'API',
    index_keywords: '个关键词',
    index_refs: '条引用',

    // 操作
    store_success: '已存入',
    recall_results: '条结果',
    recall_no_results: '无结果',
    searching: '检索',
    processing: '处理',
    saving: '保存中',
    completed: '完成',
    failed: '失败',
    warning: '警告',

    // 交互
    interactive_prompt: '百斗柜> ',
    interactive_welcome: '百斗柜 · 记忆管理系统',
    interactive_exit: '已关闭',
    enter_content: '输入内容 → 自动存储',
    enter_query: '输入 ?查询内容 → 检索',

    // 抽屉
    drawer_info: '抽屉详情',
    drawer_archived: '已归档',
    drawer_created: '创建时间',
    drawer_empty: '空',
    drawer_split_hint: '建议分裂',
    drawer_must_split: '已达硬上限，自动分裂',
    drawer_split_done: '分裂完成',
    drawer_merged: '已合并',

    // 倒排索引
    index_building: '正在重建倒排索引...',
    index_done: '索引重建完成',
    index_noise_removed: '个单引用噪音被修剪',

    // 检索
    recall_index_hits: '索引命中',
    recall_classifier: '判断应在',
    recall_adjacent: '无结果，尝试相邻抽屉',
    recall_keywords: '搜索关键词',

    // 错误
    error_no_content: '内容不能为空',
    error_no_drawer: 'store 必须指定抽屉：-D "分类" 或 --drawer "分类"',
    error_lock_failed: '无法获取写入锁',
    error_unknown: '未知错误',
    error_auth_required: '需要认证 Token',
    error_auth_invalid: '认证 Token 无效',

    // 帮助
    help_title: '命令参考',
    help_store: '存入记忆',
    help_recall: '检索记忆',
    help_rc: '跨抽屉检索',
    help_status: '系统状态',
    help_reindex: '重建索引',
    help_export: '导出数据',
    help_import: '导入数据',
    help_split: '手动分裂抽屉',
    help_merge: '合并抽屉',
    help_detail: '抽屉详情',
    help_cabinets: '列出柜子',

    // API
    api_server_start: 'API 服务器已启动',
    api_server_stop: '服务器已关闭',
    api_endpoint: '端点',
  },

  en: {
    cabinet: 'Cabinet',
    drawer: 'Drawer',
    entry: 'Entry',
    clerk: 'Clerk',
    shopkeeper: 'Shopkeeper',
    index: 'Index',

    status_header: 'System Status',
    total_drawers: 'Active Drawers',
    total_entries: 'Memories',
    total_cabinets: 'Cabinets',
    hot_tags: 'Hot Tags',
    service_cli: 'CLI',
    service_api: 'API',
    index_keywords: 'Keywords',
    index_refs: 'References',

    store_success: 'Stored',
    recall_results: 'Results',
    recall_no_results: 'No results',
    searching: 'Searching',
    processing: 'Processing',
    saving: 'Saving',
    completed: 'Done',
    failed: 'Failed',
    warning: 'Warning',

    interactive_prompt: 'herbal> ',
    interactive_welcome: 'Herbal Cabinet · Memory System',
    interactive_exit: 'Closed',
    enter_content: 'Type content → auto store',
    enter_query: 'Type ?query → search',

    drawer_info: 'Drawer Details',
    drawer_archived: 'Archived',
    drawer_created: 'Created',
    drawer_empty: 'Empty',
    drawer_split_hint: 'Suggest splitting',
    drawer_must_split: 'Hard limit reached, auto-splitting...',
    drawer_split_done: 'Split complete',
    drawer_merged: 'Merged',

    index_building: 'Rebuilding inverted index...',
    index_done: 'Index rebuilt',
    index_noise_removed: 'single-use noise keywords pruned',

    recall_index_hits: 'Index hits',
    recall_classifier: 'Classifier suggests',
    recall_adjacent: 'No results in target, searching adjacent drawers...',
    recall_keywords: 'Search keywords',

    error_no_content: 'Content cannot be empty',
    error_no_drawer: 'store requires --drawer or -D flag',
    error_lock_failed: 'Cannot acquire write lock',
    error_unknown: 'Unknown error',
    error_auth_required: 'Authentication token required',
    error_auth_invalid: 'Invalid authentication token',

    help_title: 'Commands',
    help_store: 'Store a memory',
    help_recall: 'Search memories',
    help_rc: 'Cross-drawer search',
    help_status: 'System status',
    help_reindex: 'Rebuild index',
    help_export: 'Export data',
    help_import: 'Import data',
    help_split: 'Split a drawer',
    help_merge: 'Merge drawers',
    help_detail: 'Drawer details',
    help_cabinets: 'List cabinets',

    api_server_start: 'API server started',
    api_server_stop: 'Server stopped',
    api_endpoint: 'Endpoint',
  }
}

/**
 * 获取当前语言
 * 优先级：--lang=参数 > HERBAL_LANG 环境变量 > 默认中文
 */
export function getLang() {
  // 检查 process.argv 中的 --lang 参数
  const langArg = process.argv.find(a => a.startsWith('--lang='))
  if (langArg) {
    const lang = langArg.split('=')[1]
    if (lang === 'en' || lang === 'zh') return lang
  }
  // 检查环境变量
  if (env.HERBAL_LANG === 'en' || env.HERBAL_LANG === 'zh') return env.HERBAL_LANG
  return 'zh'
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {object} params - 插值参数（可选）
 * @returns {string}
 */
export function t(key, params = {}) {
  const lang = getLang()
  const text = LOCALE[lang]?.[key] || LOCALE.zh[key] || key
  // 简单插值：替换 {key} 占位符
  return text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`)
}

/**
 * 格式化数字（保持一致性）
 */
export function n(num) {
  return String(num)
}

/**
 * 获取 emoji + 翻译的组合
 */
export function labeled(key, value) {
  return `${t(key)}: ${value}`
}

export default { t, getLang, n }
