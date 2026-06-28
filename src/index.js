/**
 * 百斗柜（Herbal Cabinet）— 主入口
 * 
 * 导出核心 API，供其他 Node.js 模块使用
 */

export * from './shopkeeper.js'
export * from './clerk.js'
export * from './cabinet.js'
export * from './indexer.js'
export * from './classifier.js'
export * from './api-client.js'
export { loadTaxonomy, saveTaxonomy, getAllPaths } from './taxonomy.js'

export default {
  version: '2.0.0',
  name: 'herbal-cabinet'
}
