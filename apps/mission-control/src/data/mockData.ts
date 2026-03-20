import { SkillNode } from '../types';

export const mockSkillNodes: SkillNode[] = [
  // Level 1: Main Branches
  { id: 'l1-self-management', level: 1, label: '自我管理', status: 'idle', parentId: null },
  { id: 'l1-media-automation', level: 1, label: '自媒体自动化与内容洞察', status: 'running', parentId: null },
  { id: 'l1-research', level: 1, label: '科研项目与执行', status: 'idle', parentId: null },
  { id: 'l1-finance', level: 1, label: '金融信息获取', status: 'idle', parentId: null },
  { id: 'l1-devops', level: 1, label: 'DevOps与自动化部署', status: 'error', parentId: null },
  { id: 'l1-data-analysis', level: 1, label: '数据分析与可视化', status: 'idle', parentId: null },
  { id: 'l1-iot', level: 1, label: 'IoT与智能家居', status: 'idle', parentId: null },
  { id: 'l1-security', level: 1, label: '网络安全与审计', status: 'idle', parentId: null },

  // Level 2: Sub-categories
  // Self Management
  { id: 'l2-task-tracking', level: 2, label: '任务追踪', status: 'idle', parentId: 'l1-self-management' },
  { id: 'l2-habit-building', level: 2, label: '习惯养成', status: 'idle', parentId: 'l1-self-management' },
  
  // Media Automation
  { id: 'l2-content-generation', level: 2, label: '内容生成', status: 'running', parentId: 'l1-media-automation' },
  { id: 'l2-social-listening', level: 2, label: '社交聆听', status: 'idle', parentId: 'l1-media-automation' },

  // Research
  { id: 'l2-literature-review', level: 2, label: '文献综述', status: 'idle', parentId: 'l1-research' },
  { id: 'l2-experiment-tracking', level: 2, label: '实验追踪', status: 'idle', parentId: 'l1-research' },

  // Finance
  { id: 'l2-market-data', level: 2, label: '市场数据', status: 'idle', parentId: 'l1-finance' },
  { id: 'l2-portfolio-management', level: 2, label: '投资组合', status: 'idle', parentId: 'l1-finance' },

  // DevOps
  { id: 'l2-ci-cd', level: 2, label: 'CI/CD 流水线', status: 'error', parentId: 'l1-devops' },

  // Level 3: Workflow Nodes
  // Content Generation
  {
    id: 'l3-article-writer',
    level: 3,
    label: 'AI 爆款文章生成器',
    status: 'running',
    parentId: 'l2-content-generation',
    drawerContent: {
      invoke: '/content run --style xiaogai --count 1',
      commands: ['/content run --style xiaogai --count 1'],
      capabilities: ['多平台风格适配', 'SEO 关键词优化', '自动配图生成'],
      useCases: [
        { title: '科技博主日更', summary: '每天自动抓取最新科技新闻并生成 1500 字深度分析文章。' },
        { title: '小红书种草文', summary: '根据产品卖点，生成带有 emoji 和网感排版的种草笔记。' }
      ],
      inputs: [
        { field: '主题关键词', type: 'text' },
        { field: '文章长度 (字数)', type: 'slider' },
        { field: '创意程度 (Temperature)', type: 'slider' }
      ],
      knowledgeBase: {
        tags: ['小红书', '爆款文案', 'SEO'],
        documents: [
          { title: '小红书爆款标题库.md', url: '#' },
          { title: '2025科技圈热词总结.pdf', url: '#' }
        ]
      }
    }
  },
  {
    id: 'l3-video-script',
    level: 3,
    label: '短视频脚本编排',
    status: 'idle',
    parentId: 'l2-content-generation',
    drawerContent: {
      invoke: '/video script --topic "AI科普"',
      commands: ['/video script --topic "AI科普"'],
      capabilities: ['分镜头脚本生成', '爆款开头钩子设计', 'BGM 推荐'],
      useCases: [
        { title: '知识科普短视频', summary: '将复杂的学术概念转化为 1 分钟的通俗易懂短视频脚本。' }
      ],
      inputs: [
        { field: '核心概念', type: 'text' },
        { field: '视频时长 (秒)', type: 'slider' }
      ],
      knowledgeBase: {
        tags: ['短视频', '脚本模板', '完播率'],
        documents: [
          { title: '黄金前三秒钩子库.md', url: '#' },
          { title: '科普类视频分镜参考.pdf', url: '#' }
        ]
      }
    }
  },
  
  // CI/CD
  {
    id: 'l3-docker-build',
    level: 3,
    label: 'Docker 镜像构建',
    status: 'error',
    parentId: 'l2-ci-cd',
    drawerContent: {
      invoke: '/devops build --target docker',
      commands: ['/devops build --target docker'],
      capabilities: ['多架构镜像编译', '安全漏洞扫描', '自动推送到 Registry'],
      useCases: [
        { title: '微服务自动部署', summary: '代码合并到 main 分支后，自动触发构建并部署到 K8s 集群。' }
      ],
      inputs: [
        { field: 'Dockerfile 路径', type: 'text' },
        { field: '镜像标签', type: 'text' }
      ],
      knowledgeBase: {
        tags: ['DevOps', 'Docker', 'CI/CD'],
        documents: [
          { title: '公司内部镜像构建规范.md', url: '#' },
          { title: '常见安全漏洞修复指南.pdf', url: '#' }
        ]
      }
    }
  },

  // Market Data
  {
    id: 'l3-crypto-tracker',
    level: 3,
    label: '加密货币异动监控',
    status: 'idle',
    parentId: 'l2-market-data',
    drawerContent: {
      invoke: '/risk monitor --asset BTC --threshold 0.05',
      commands: ['/risk monitor --asset BTC --threshold 0.05'],
      capabilities: ['巨鲸钱包追踪', '交易所资金净流入/流出', '社交媒体情绪分析'],
      useCases: [
        { title: '高频交易信号', summary: '当某代币在 5 分钟内交易量激增 500% 时，自动发送 Telegram 警报。' }
      ],
      inputs: [
        { field: '监控币种 (如 BTC, ETH)', type: 'text' },
        { field: '报警阈值 (%)', type: 'slider' }
      ],
      knowledgeBase: {
        tags: ['量化交易', '链上数据', '风控'],
        documents: [
          { title: '巨鲸地址监控列表.csv', url: '#' },
          { title: '极端行情风控策略.md', url: '#' }
        ]
      }
    }
  }
];
