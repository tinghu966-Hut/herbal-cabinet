## 百斗柜（Herbal Cabinet）迭代任务

项目路径：C:\Users\admin\.openclaw\workspace\herbal-cabinet
核心文件：src/cli.js（store/recall/status命令），src/backup.js

### 本次迭代内容

#### 1. 存储格式升级（schema加强）
当前每条记录存的是：{time, summary, content, drawer}
改成：{id, time, summary, content, drawer, tags(数组), source(来源), reason(路由理由)}

- id：自动生成唯一ID（用时间戳+随机数）
- tags：字符串数组，如 ['运营', '冷启动', '监控']
- source：记录来源，如 '对话', '自动', '富贵虾'
- reason：为什么存进这个抽屉，一句话说明

#### 2. store 命令支持 -T（tags）和 -R（reason）参数
```
node src/cli.js store "内容" -D "分类" -T "运营,监控" -S "对话" -R "记录搭建进度"
```
- -T：逗号分隔的多个标签
- -R：路由理由
- -S：来源
- -D 改为强制必填（不低于 AI 自动分类）
- 如果不传 -D 则报错，不让 AI 猜

#### 3. recall 支持按标签过滤
```
node src/cli.js recall "关键词" -T "运营"
```
- -T 参数：只搜索某个标签
- 不加 -T 时保持全库搜索

#### 4. status 增加标签统计
Top 10 最常用标签

#### 5. 数据兼容
旧数据（无 tags/source/reason 字段）自动填充默认值，不出错

### 注意事项
- 不要破坏现有 JSON 文件兼容性
- 旧数据必须能正常读取
- backup.js 不需要改
- 写完测试：存一条带标签的、按标签搜、看状态统计、读旧数据
