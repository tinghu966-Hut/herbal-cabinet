/**
 * 百斗柜分类准确率 Benchmark
 * 
 * 测试方法：200条测试数据，人工标注期望路径，与AI分类结果比较
 * 通过标准：准确率 ≥ 85%
 */

import { classifyContent } from './src/classifier.js'
import { callDeepSeek } from './src/api-client.js'
import fs from 'node:fs'
import path from 'node:path'

// 当前已有的抽屉路径
const EXISTING_PATHS = [
  ['技术', 'AI模型'],
  ['技术', 'AI模型', 'OpenRouter配置'],
  ['技术', '项目部署'],
  ['技术', '项目部署', 'Vercel'],
  ['技术', '环境配置'],
  ['技术', '开发'],
  ['技术', '系统维护'],
  ['技术', 'AI模型配置'],
  ['技术', '架构设计'],
  ['项目', '咨询', 'AI咨询'],
  ['项目', '咨询', 'AI咨询', '冷启动'],
  ['项目', '咨询', 'AI咨询', '国外市场'],
  ['项目', '东方命运'],
  ['项目', '东方命运', '修复记录'],
  ['项目', '东方命运', '音频'],
  ['项目', '东方命运', '运营'],
  ['项目', '东方命运', '财务'],
  ['项目', '东方命运', '方向'],
  ['项目', '东方命运', '开发'],
  ['项目', '龙虾', '视频宣传'],
  ['项目', '龙虾', 'ClaudeCode安装方案'],
  ['项目', '麻小'],
  ['项目', '麻小', '运营'],
  ['项目', '综合日志'],
  ['项目', '百斗柜'],
  ['项目', '百斗柜', '运营'],
  ['项目', '瑞草集'],
  ['项目', '调查'],
  ['通用', '工作原则'],
  ['通用', '重要决策'],
  ['通用', '项目构想'],
  ['项目进度'],
  ['运营'],
]

// ============================================================
// 200 条测试数据集
// 格式: { input: "内容", expected: ["顶层", "中层"], note: "场景说明" }
// ============================================================
const testCases = [
  // ---- 技术类 (40条) ----
  { input: 'DeepSeek V3的API总是返回401错误，检查发现是Key过期了', expected: ['技术', 'AI模型'], note: 'API key问题 → AI模型' },
  { input: '今天改了八字排盘算法的日柱计算，修复了闰月bug', expected: ['项目', '东方命运', '开发'], note: '代码改动 → 东方命运开发' },
  { input: 'Vercel的部署又失败了，说是有类型错误', expected: ['技术', '项目部署', 'Vercel'], note: '部署问题 → Vercel' },
  { input: 'pnpm install一直报错，发现是Node版本不兼容', expected: ['技术', '环境配置'], note: 'Node版本兼容 → 环境配置' },
  { input: '需要在Next.js里加一个中间件做请求日志', expected: ['技术', '开发'], note: 'Next.js中间件 → 开发' },
  { input: '服务器的CPU一直在100%，怀疑是某个进程泄露了', expected: ['技术', '系统维护'], note: '服务器问题 → 系统维护' },
  { input: 'OpenRouter配置太复杂了，改了好几次才通', expected: ['技术', 'AI模型', 'OpenRouter配置'], note: 'OpenRouter → 指定路径' },
  { input: 'Tavily搜索API返回的数据格式变了，需要适配', expected: ['技术', 'AI模型'], note: 'API适配 → AI模型' },
  { input: 'Dockerfile要优化，现在构建太慢了', expected: ['技术', '项目部署'], note: 'Docker → 项目部署' },
  { input: 'Git合并冲突，main分支和dev分支的八字引擎代码有冲突', expected: ['技术', '开发'], note: 'Git冲突 → 开发' },
  { input: 'TypeScript类型定义报了很多红色波浪线', expected: ['技术', '开发'], note: 'TS类型错误 → 开发' },
  { input: 'npm audit发现有高危漏洞需要修复', expected: ['技术', '系统维护'], note: 'npm漏洞 → 系统维护' },
  { input: 'TailwindCSS配置要加新的自定义颜色', expected: ['技术', '开发'], note: 'Tailwind → 开发' },
  { input: '备份脚本执行失败了，说磁盘空间不足', expected: ['技术', '系统维护'], note: '备份失败 → 系统维护' },
  { input: '新买的阿里云服务器要配域名和SSL证书', expected: ['技术', '环境配置'], note: '服务器配置 → 环境配置' },
  { input: 'GitHub Actions CI加了一个lint检查步骤', expected: ['技术', '开发'], note: 'CI配置 → 开发' },
  { input: '飞书机器人回调接口需要重写，现在经常超时', expected: ['技术', '开发'], note: '接口重写 → 开发' },
  { input: 'Next.js 15的新App Router和之前Page Router差别很大', expected: ['技术', '开发'], note: '框架升级 → 开发' },
  { input: '百斗柜的api-client.js里DeepSeek调用方式要改成BYOK', expected: ['项目', '百斗柜'], note: '百斗柜开发 → 百斗柜' },
  { input: '通义万相生成图片的质量不如FLUX，考虑换模型', expected: ['技术', 'AI模型'], note: '图片模型 → AI模型' },
  { input: 'Vercel的免费额度用完了，看账单要加钱', expected: ['技术', '项目部署', 'Vercel'], note: 'Vercel额度 → Vercel' },
  { input: 'Codex CLI的沙盒模式怎么配置网络访问', expected: ['技术', '开发'], note: 'Codex配置 → 开发' },
  { input: 'Redis连接池满了，需要优化连接管理', expected: ['技术', '系统维护'], note: 'Redis → 系统维护' },
  { input: 'JWT密钥需要轮换，旧的马上过期了', expected: ['技术', '环境配置'], note: 'JWT → 环境配置' },
  { input: 'MCP Server的SDK升级了，要更新兼容代码', expected: ['技术', '开发'], note: 'MCP SDK → 开发' },
  { input: 'aliyun的api key似乎被限流了，请求返回429', expected: ['技术', 'AI模型'], note: 'API限流 → AI模型' },
  { input: 'FAL_KEY的余额不够了，需要充值', expected: ['技术', 'AI模型'], note: 'FAL充值 → AI模型' },
  { input: '代码里的console.log太多，上线前要清一遍', expected: ['技术', '开发'], note: '清理日志 → 开发' },
  { input: '监控脚本每隔30分钟检查一次网站是否在线', expected: ['技术', '系统维护'], note: '监控脚本 → 系统维护' },
  { input: '环境变量OPENAI_API_KEY指向的是DeepSeek，不能用于OpenAI', expected: ['技术', '环境配置'], note: '环境变量混乱 → 环境配置' },
  { input: '数据库迁移脚本写得不对，主键冲突了', expected: ['技术', '开发'], note: '数据库迁移 → 开发' },
  { input: '正在研究用什么向量数据库，Milvus还是Chroma', expected: ['技术', '架构设计'], note: '技术选型 → 架构设计' },
  { input: 'CORS跨域问题，前端调接口报错', expected: ['技术', '开发'], note: 'CORS → 开发' },
  { input: 'SSH密钥过期了，需要重新生成和配置', expected: ['技术', '系统维护'], note: 'SSH → 系统维护' },
  { input: 'WebSocket连接不稳定，经常自动断开', expected: ['技术', '开发'], note: 'WebSocket → 开发' },
  { input: 'PWA的manifest.json配置了新的图标', expected: ['技术', '开发'], note: 'PWA配置 → 开发' },
  { input: '服务器要迁移到新机房，IP和DNS都得改', expected: ['技术', '环境配置'], note: '服务器迁移 → 环境配置' },
  { input: 'pm2进程管理器的日志轮转配置', expected: ['技术', '系统维护'], note: 'pm2 → 系统维护' },
  { input: 'GraphQL API的schema设计要重构', expected: ['技术', '架构设计'], note: '架构设计 → 架构设计' },
  { input: 'CICD流水线加了一个自动化测试步骤', expected: ['技术', '项目部署'], note: 'CI/CD → 项目部署' },

  // ---- 项目·东方命运 (35条) ----
  { input: '八字排盘用户反馈说大运计算跟其他网站不同', expected: ['项目', '东方命运', '修复记录'], note: '八字bug修复记录' },
  { input: '紫微斗数命宫安星逻辑review完毕，已经合并到main', expected: ['项目', '东方命运', '开发'], note: 'ZWDS开发' },
  { input: '今天上线了付费墙功能，用户免费额度用完会弹窗', expected: ['项目', '东方命运', '开发'], note: '付费墙上线' },
  { input: 'PayPal支付回调有个签名验证问题', expected: ['项目', '东方命运', '修复记录'], note: 'PayPal问题' },
  { input: '网站访问量今天涨了200%，可能是那篇博客火了', expected: ['项目', '东方命运', '运营'], note: '流量增长 → 运营' },
  { input: 'Google Search Console显示sitemap无法抓取', expected: ['项目', '东方命运', '运营'], note: 'SEO → 运营' },
  { input: '决定换掉Stripe用PayPal，香港用户支付更方便', expected: ['项目', '东方命运', '方向'], note: '支付决策 → 方向' },
  { input: '品牌色方案确定了：黑金配朱砂红点缀', expected: ['项目', '东方命运', '方向'], note: '品牌色 → 方向' },
  { input: '铜钱音效改成了物理合成，不再依赖外部文件', expected: ['项目', '东方命运', '音频'], note: '音频优化' },
  { input: 'BGM换成Water Lillies竹笛古筝曲', expected: ['项目', '东方命运', '音频'], note: 'BGM更换' },
  { input: '用户反馈说注册流程太复杂，建议简化', expected: ['项目', '东方命运', '运营'], note: '用户反馈 → 运营' },
  { input: '运营方案写好了：Reddit冷启动+SEO+Twitter同步', expected: ['项目', '东方命运', '运营'], note: '运营方案' },
  { input: '今天花了5块钱在阿里云续费域名', expected: ['项目', '东方命运', '财务'], note: '域名费用' },
  { input: 'Vercel Pro账单来了，一个月$20', expected: ['项目', '东方命运', '财务'], note: 'Vercel费用' },
  { input: '首页Banner的"Hook"改了三次，还是不够吸引人', expected: ['项目', '东方命运', '运营'], note: '首页优化 → 运营' },
  { input: 'I Ching页面加了铜钱手掷动画，效果非常好', expected: ['项目', '东方命运', '开发'], note: 'I Ching动画开发' },
  { input: '六爻的卦象解读AI prompt优化了，回复质量提升', expected: ['项目', '东方命运', '开发'], note: 'AI解读优化' },
  { input: '用户登录后首页应该跳转到上次未完成的阅读', expected: ['项目', '东方命运', '开发'], note: 'UX优化' },
  { input: 'Substack上发了第一篇东方命运newsletter', expected: ['项目', '东方命运', '运营'], note: 'Newsletter → 运营' },
  { input: 'Quora回复了5条关于I Ching的问题', expected: ['项目', '东方命运', '运营'], note: 'Quora → 运营' },
  { input: 'Reddit r/iching的帖子只有3个upvote，不理想', expected: ['项目', '东方命运', '运营'], note: 'Reddit效果 → 运营' },
  { input: '决定把目标市场从国内转到欧美', expected: ['项目', '东方命运', '方向'], note: '市场方向决策' },
  { input: '@EasternDestiny的Twitter账号注册好了', expected: ['项目', '东方命运', '运营'], note: 'Twitter账号' },
  { input: 'JWT认证有一个漏洞，用户A可以读到用户B的数据', expected: ['项目', '东方命运', '修复记录'], note: '安全漏洞修复' },
  { input: '移动端UI在iPhone SE上显示不全', expected: ['项目', '东方命运', '修复记录'], note: '移动端bug' },
  { input: '思考要不要加一个"大师点评"付费服务', expected: ['项目', '东方命运', '方向'], note: '新服务方向' },
  { input: 'Admin后台加了用户管理页面', expected: ['项目', '东方命运', '开发'], note: 'Admin开发' },
  { input: 'Email订阅功能对接了Mailchimp', expected: ['项目', '东方命运', '开发'], note: '邮件系统开发' },
  { input: '竞品分析：FateMaster有免费的每日运势，我们也要做', expected: ['项目', '东方命运', '运营'], note: '竞品分析 → 运营' },
  { input: 'SEO关键词工具分析：bazi calculator月搜索量10K+', expected: ['项目', '东方命运', '运营'], note: 'SEO关键词 → 运营' },
  { input: 'Google Analytics配置好了，PV/UV数据开始收集', expected: ['项目', '东方命运', '运营'], note: 'GA → 运营' },
  { input: '支付网关批量测试：PayPal/信用卡/支付宝都通了', expected: ['技术', '项目部署'], note: '支付测试 → 部署' },
  { input: '老文章里的dead link要全部检查和修复', expected: ['项目', '东方命运', '运营'], note: '死链修复 → 运营' },
  { input: 'Cookie政策需要加GDPR弹窗', expected: ['项目', '东方命运', '开发'], note: 'GDPR → 开发' },
  { input: 'https证书还有7天到期，别忘了续', expected: ['技术', '系统维护'], note: 'SSL证书 → 系统维护' },

  // ---- 项目·咨询类 (15条) ----
  { input: 'AI咨询的Quick Audit定价$299起', expected: ['项目', '咨询', 'AI咨询'], note: '咨询定价' },
  { input: '跟一个想做客服AI的创业公司开了第一次电话', expected: ['项目', '咨询', 'AI咨询', '冷启动'], note: '咨询客户' },
  { input: '发现国内企业对AI Agent工作组的概念接受度不高', expected: ['项目', '咨询', 'AI咨询', '国内'], note: '市场洞察 → AI咨询' },
  { input: '写了篇Medium文章讲多Agent系统架构', expected: ['项目', '咨询', 'AI咨询', '国外市场'], note: '海外内容 → 国外市场' },
  { input: 'Reddit上有人问怎么搭建AI客服系统，回复了他', expected: ['项目', '咨询', 'AI咨询', '冷启动'], note: '冷启动互动' },
  { input: '决定把AI咨询的市场定位从国内改为主攻英文市场', expected: ['项目', '咨询', 'AI咨询'], note: '市场方向' },
  { input: '做了一个AI咨询的Landing Page，放在Vercel上', expected: ['项目', '咨询', 'AI咨询'], note: 'Landing Page → AI咨询' },
  { input: '客户问能不能做私有化部署，报价要加30%', expected: ['项目', '咨询', 'AI咨询', '冷启动'], note: '客户问询→冷启动' },
  { input: '准备好了一套Agent SOUL.md的模板', expected: ['项目', '咨询', 'AI咨询'], note: 'SOUL模板→AI咨询' },
  { input: '知乎上回答了一个关于AI Agent的问题，加了咨询链接', expected: ['项目', '咨询', 'AI咨询', '冷启动'], note: '知乎引流→冷启动' },
  { input: '有一家上海的公司问能不能做全套Agent部署', expected: ['项目', '咨询', 'AI咨询', '冷启动'], note: '域内咨询→冷启动' },
  { input: 'AI咨询的英文邮件模板写好了，等客户发', expected: ['项目', '咨询', 'AI咨询', '国外市场'], note: '英文模板→国外市场' },
  { input: '发现竞争对手的定价比我们低50%，要调整策略', expected: ['项目', '咨询', 'AI咨询', '冷启动'], note: '竞品→冷启动' },
  { input: '今天跟一个硅谷的Startup founder聊了2小时Agent', expected: ['项目', '咨询', 'AI咨询', '国外市场'], note: '硅谷客户→国外市场' },
  { input: 'AI咨询项目的合同模板要找法律agent审核', expected: ['通用', '重要决策'], note: '合同审核→通用决策' },

  // ---- 项目·其他 (20条) ----
  { input: '龙虾保姆v2.0加了系统清理功能，UI重做了', expected: ['项目', '龙虾'], note: '龙虾项目开发' },
  { input: '龙虾医生的视频宣传脚本写好了，准备找人配音', expected: ['项目', '龙虾', '视频宣传'], note: '龙虾视频' },
  { input: 'Claude Code在本地跑不通，卡在环境变量上', expected: ['项目', '龙虾', 'ClaudeCode安装方案'], note: 'CC安装问题' },
  { input: '搭搭（DaDa）穿搭推荐PWA可以在手机上离线用了', expected: ['项目', '麻小'], note: 'DaDa项目' },
  { input: '麻小MX的UI需要重新设计，现在的太丑了', expected: ['项目', '麻小'], note: '麻小UI' },
  { input: '麻小MX的运营计划：先在小红书上预热', expected: ['项目', '麻小', '运营'], note: '麻小运营' },
  { input: '瑞草集的文案写完了，准备让copywriter润色', expected: ['项目', '瑞草集'], note: '瑞草集文案' },
  { input: '今天在群里讨论HUTING公司里的事，说股票跌了', expected: ['通用'], note: '日常闲聊→通用（无群聊分类时）' },
  { input: 'HUTING说这个周末不加班，要休息', expected: ['通用'], note: '日常→通用' },
  { input: '百斗柜的三合一API调用优化完成了，省了2/3的API费用', expected: ['项目', '百斗柜'], note: '百斗柜优化' },
  { input: '百斗柜应该走开源还是闭源？讨论结果：先开源MCP再考虑付费', expected: ['项目', '百斗柜', '运营'], note: '百斗柜运营决策' },
  { input: '百斗柜的MCP Server今天写了一下午，基本框架搭好了', expected: ['项目', '百斗柜'], note: '百斗柜开发' },
  { input: '项目进度：本周完成了八字排盘和紫微斗数两个核心模块', expected: ['项目进度'], note: '项目进度汇报' },
  { input: '今日工作日志：修了3个bug，写了1篇博客', expected: ['项目', '综合日志'], note: '日常日志→综合日志' },
  { input: '调研了Mem0和CrewAI的记忆模块，对比分析完成', expected: ['项目', '百斗柜'], note: '竞品调研→百斗柜' },
  { input: '决定先不打工了，全力搞这个独立站项目', expected: ['通用', '重要决策'], note: '人生决策→重要决策' },
  { input: '想做一个AI教太极拳的App，不知道市场大不大', expected: ['通用', '项目构想'], note: '新想法→项目构想' },
  { input: '工作原则：不要急着交付，打磨再打磨', expected: ['通用', '工作原则'], note: '工作原则记录' },
  { input: '群里有同事说最近在学八字，问有什么书推荐', expected: ['通用'], note: '闲聊→通用' },
  { input: '今天的任务完成了，去跑步', expected: ['通用'], note: '生活→通用' },

  // ---- 运营类 (20条) ----
  { input: 'Twitter大V互动策略：每天关注5个I Ching相关账号', expected: ['运营'], note: 'Twitter运营' },
  { input: 'Product Hunt上线排队排到了下周，要准备Launch kit', expected: ['运营'], note: 'PH上线' },
  { input: '写了篇"Hook"很强的推文，获得了50个浏览', expected: ['运营'], note: '推文效果' },
  { input: 'Google Analytics显示80%流量来自直接访问，没有自然搜索', expected: ['运营'], note: '流量分析' },
  { input: '新闻稿：东方命运AI玄学平台正式上线', expected: ['运营'], note: '新闻稿' },
  { input: '做了一个A/B测试，比较两个Landing Page的转化率', expected: ['运营'], note: 'A/B测试' },
  { input: 'Affiliate联盟营销计划：给KOL 30%佣金', expected: ['运营'], note: '联盟营销' },
  { input: 'Email营销：给订阅用户发了本周运势newsletter', expected: ['运营'], note: 'Email营销' },
  { input: 'Hacker News上有人推荐了我们的八字排盘工具', expected: ['运营'], note: 'HN推荐' },
  { input: 'Medium博客的SEO优化：加了meta description和alt text', expected: ['运营'], note: '博客SEO' },
  { input: '小红书发的关于八字的内容有200赞', expected: ['运营'], note: '小红书' },
  { input: '建了Discord服务器，目前只有3个人', expected: ['运营'], note: 'Discord社区' },
  { input: 'B站发了紫微斗数入门视频，播放量500', expected: ['运营'], note: 'B站视频' },
  { input: '知乎专栏整理了10个八字入门问题', expected: ['运营'], note: '知乎内容' },
  { input: 'YouTube Shorts发了每日运势的短视频', expected: ['运营'], note: 'Youtube Shorts' },
  { input: 'SEO排名跟踪：bazi calculator在Google第8页', expected: ['运营'], note: 'SEO排名' },
  { input: '写了一篇关于I Ching的文章，准备发Medium', expected: ['运营'], note: '内容创作→运营' },
  { input: 'Luna Oracleycai的粉丝涨得很快，研究一下他们的策略', expected: ['运营'], note: '竞品分析→运营' },
  { input: '网站加载速度优化，LCP从3.2s降到1.1s', expected: ['技术', '开发'], note: '性能优化→技术开发' },
  { input: 'Cold outreach：给5个I Ching博主发了合作邀请', expected: ['运营'], note: '外联→运营' },

  // ---- 综合日志 (10条) ----
  { input: '2026-06-27 今天做了啥：改了博客、搭了Twitter、跑了benchmark', expected: ['项目', '综合日志'], note: '今日总结' },
  { input: '本周工作内容：SEO优化完成，博客全部上线', expected: ['项目', '综合日志'], note: '周总结' },
  { input: '6月复盘：英文站流量涨了30%，中文站还是不行', expected: ['项目', '综合日志'], note: '月度总结' },
  { input: '周末看了三篇关于Agent memory的论文，很有启发', expected: ['项目', '百斗柜'], note: '学习笔记→百斗柜' },
  { input: '今天收到一个用户反馈说我们的I Ching解读很有深度', expected: ['项目', '东方命运', '运营'], note: '用户好评→运营' },
  { input: '修了一个生产环境的大bug，导致用户无法登录', expected: ['项目', '东方命运', '修复记录'], note: '生产bug修复' },
  { input: '跟HUTING通了一次电话，讨论了未来3个月的roadmap', expected: ['项目', '综合日志'], note: '会议记录' },
  { input: '中午和同事们吃了火锅，聊了很多工作的事', expected: ['通用'], note: '日常→通用' },
  { input: 'HUTING说想做一个AI Agent咨询的副业', expected: ['项目', '咨询', 'AI咨询'], note: '咨询想法' },
  { input: '今天研究了Agent-to-Agent通信协议，有很多思考', expected: ['通用', '项目构想'], note: '研究笔记→构建' },

  // ---- 边界/模糊案例 (30条) ----
  { input: 'DeepSeek的回复质量最近下降了，在想是不是prompt的问题', expected: ['技术', 'AI模型'], note: 'API质量→AI模型' },
  { input: '八字和紫微斗数哪个更准？', expected: ['项目', '东方命运', '运营'], note: '用户疑问→运营' },
  { input: 'JWT token过期了，重新登录后数据还在吗？', expected: ['项目', '东方命运', '开发'], note: '技术问题→开发' },
  { input: '想去大理住一个月，远程办公', expected: ['通用'], note: '生活计划→通用' },
  { input: '看到有人用AI生成星座运势，月入2万美金', expected: ['运营'], note: '赚钱案例→运营' },
  { input: 'SSL证书还有3天过期', expected: ['技术', '系统维护'], note: '证书到期→系统维护' },
  { input: 'HUTING说想要一个手机版的控制面板', expected: ['项目', '东方命运', '方向'], note: '需求→方向' },
  { input: '今天Aliyun的SDK好像有bug，SDK文档里的示例跑不通', expected: ['技术', '开发'], note: 'SDK问题→开发' },
  { input: 'CI跑了10分钟，太慢了，要优化', expected: ['技术', '项目部署'], note: 'CI慢→项目部署' },
  { input: '想做一个纯前端的八字排盘PWA', expected: ['项目', '东方命运', '方向'], note: '新产品方向' },
  { input: 'Twitter上有人私信我问I Ching怎么用', expected: ['运营'], note: '私信→运营' },
  { input: '今天花了500块买了一个AI工具的年费', expected: ['通用'], note: '消费→通用' },
  { input: 'Next.js的server action和API route有什么区别', expected: ['技术', '开发'], note: '技术疑问→开发' },
  { input: '用户说我们的紫微斗数命盘排版有问题', expected: ['项目', '东方命运', '修复记录'], note: 'UX bug' },
  { input: 'HUTING的同事推荐了一个风水师，说想请他合作', expected: ['项目', '东方命运', '运营'], note: '合作机会→运营' },
  { input: 'docker-compose.yml里暴露了敏感端口', expected: ['技术', '项目部署'], note: 'Docker安全→项目部署' },
  { input: '想把百斗柜部署成SaaS，不知道市场接受度怎么样', expected: ['项目', '百斗柜', '运营'], note: '百斗柜商业化' },
  { input: 'Github上fork了我们项目的人提了一个PR', expected: ['项目', '百斗柜'], note: '开源PR' },
  { input: '一个客户投诉说AI解读太模板化', expected: ['项目', '东方命运', '运营'], note: '投诉→运营' },
  { input: 'AI模型选择：开源vs闭源，各有优劣', expected: ['技术', 'AI模型'], note: '模型讨论' },
  { input: '瑞草集的产品包装设计初稿出来了', expected: ['项目', '瑞草集'], note: '瑞草集设计' },
  { input: 'DeepSeek R1的推理能力评测完成', expected: ['技术', 'AI模型'], note: '模型评测' },
  { input: '今天听了《纳瓦尔宝典》，很有感触', expected: ['通用'], note: '读书→通用' },
  { input: '创业公司第一年的税务问题咨询了会计师', expected: ['通用', '重要决策'], note: '税务→决策' },
  { input: '日语N3考试通过了！', expected: ['通用'], note: '个人成就→通用' },
  { input: '网站的黑暗模式用户更喜欢，打开了默认深色', expected: ['项目', '东方命运', '开发'], note: 'UI偏好→开发' },
  { input: 'Google Play Console账号注册了，准备上架App', expected: ['项目', '东方命运', '运营'], note: 'App上架→运营' },
  { input: 'mermaid diagram画架构图很好用', expected: ['技术', '开发'], note: '工具推荐→开发' },
  { input: 'IMessage里HUTING说周末想讨论AI咨询的定价', expected: ['项目', '咨询', 'AI咨询'], note: '讨论→AI咨询' },
  { input: '其实玄学命理和现代心理学有很多共通之处', expected: ['通用', '项目构想'], note: '跨学科思考→构型' },

  // ---- 噪音案例 (10条，应该归通用) ----
  { input: '今天天气真热，40度了', expected: ['通用'], note: '天气→通用' },
  { input: '中午吃了碗兰州拉面，还不错', expected: ['通用'], note: '饮食→通用' },
  { input: '推荐一部电影：《奥本海默》', expected: ['通用'], note: '影视→通用' },
  { input: '今天地铁又晚点了', expected: ['通用'], note: '交通→通用' },
  { input: 'iPhone 17发布了，有点贵', expected: ['通用'], note: '科技产品→通用' },
  { input: '新买的耳机音质很不错', expected: ['通用'], note: '购物→通用' },
  { input: '今晚欧冠决赛，看好谁？', expected: ['通用'], note: '体育→通用' },
  { input: '一个人去了趟黄山，风景真好', expected: ['通用'], note: '旅游→通用' },
  { input: '隔壁装修太吵了，没法工作', expected: ['通用'], note: '噪音→通用' },
  { input: '今天心情不太好，什么都不想干', expected: ['通用'], note: '情绪→通用' },
]

console.log(`📋 共 ${testCases.length} 条测试数据`)
console.log('')

// ============================================================
// Benchmark 执行
// ============================================================
async function runBenchmark() {
  let correct = 0
  let total = 0
  const errors = []

  // 提取所有已存在的路径文本（用于classifier的pathsHint）
  const existingPathStrings = EXISTING_PATHS.map(p => p)
  
  console.log('🏃 开始Benchmark...')
  console.log('')

  for (let i = 0; i < testCases.length; i++) {
    const { input, expected, note } = testCases[i]
    
    try {
      const result = await classifyContent(input, existingPathStrings)
      const resultPath = Array.isArray(result) ? result : ['通用', '未分类']
      
      // 比较：只看顶层分类是否匹配
      const topLevelMatch = resultPath[0] === expected[0]
      // 全路径匹配：前2层
      const pathMatch = resultPath.length >= 2 && expected.length >= 2 
        ? resultPath[0] === expected[0] && resultPath[1] === expected[1]
        : topLevelMatch

      if (pathMatch) {
        correct++
      } else {
        errors.push({
          index: i,
          input: input.slice(0, 60),
          expected: expected.join(' > '),
          got: resultPath.join(' > '),
          note
        })
      }
      total++
    } catch (err) {
      errors.push({
        index: i,
        input: input.slice(0, 60),
        expected: expected.join(' > '),
        got: `ERROR: ${err.message}`,
        note
      })
      total++
    }

    // 进度提示，每20条输出一次
    if ((i + 1) % 20 === 0 || i === testCases.length - 1) {
      console.log(`  进度: ${i + 1}/${testCases.length} | 当前准确率: ${((correct / total) * 100).toFixed(1)}%`)
    }
  }

  // ============================================================
  // 结果输出
  // ============================================================
  const accuracy = (correct / total) * 100
  const passThreshold = 85

  console.log('')
  console.log('='.repeat(60))
  console.log('  📊 Benchmark 结果')
  console.log('='.repeat(60))
  console.log(`  总测试数:      ${total}`)
  console.log(`  正确数:        ${correct}`)
  console.log(`  错误数:        ${total - correct}`)
  console.log(`  准确率:        ${accuracy.toFixed(2)}%`)
  console.log(`  通过标准:      ≥ ${passThreshold}%`)
  console.log(`  判定:          ${accuracy >= passThreshold ? '✅ 通过' : '❌ 未通过'}`)
  console.log('')
  
  if (errors.length > 0) {
    console.log('  ❌ 分类错误明细:')
    console.log('')
    errors.forEach((e, i) => {
      console.log(`  [${e.index}] 期望: ${e.expected}`)
      console.log(`       实际: ${e.got}`)
      console.log(`       输入: "${e.input}..."`)
      console.log(`       场景: ${e.note}`)
      console.log('')
    })
  }

  // 按错误类型分析
  console.log('='.repeat(60))
  console.log('  📈 错误模式分析')
  console.log('='.repeat(60))
  
  const errorPatterns = {}
  errors.forEach(e => {
    // 只分析非ERROR的case
    if (!e.got.startsWith('ERROR')) {
      const pattern = `${e.expected} → ${e.got}`
      errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1
    }
  })
  
  // 排序并输出最常见的错误模式
  const sortedErrors = Object.entries(errorPatterns)
    .sort((a, b) => b[1] - a[1])
  
  if (sortedErrors.length > 0) {
    console.log('  最常见的分类混淆:')
    sortedErrors.slice(0, 10).forEach(([pattern, count]) => {
      console.log(`    ${count}次: ${pattern}`)
    })
  } else {
    console.log('  无分类混淆（完美或全出错在ERROR）')
  }

  // 保存报告
  const report = {
    date: new Date().toISOString(),
    total,
    correct,
    accuracy: accuracy.toFixed(2) + '%',
    passed: accuracy >= passThreshold,
    errorDetails: errors.slice(0, 30), // 只保留前30条详情
    topErrorPatterns: sortedErrors.slice(0, 10)
  }

  fs.writeFileSync(
    path.join('E:', '项目目录', '百斗柜', 'benchmark-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  )
  console.log('')
  console.log('  报告已保存: E:\\项目目录\\百斗柜\\benchmark-report.json')

  return { accuracy, correct, total, errors }
}

runBenchmark().catch(console.error)
