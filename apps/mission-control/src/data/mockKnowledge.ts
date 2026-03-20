import { KnowledgeItem } from "../types";

export const seedKnowledgeBase: KnowledgeItem[] = [
  {
    id: "kb_20260306_001",
    human: {
      title: "AI提效：小红书选题模板",
      summary: "适用于AI效率类内容，包含爆款标题公式与网感排版指南。",
      content_md:
        "# AI提效：小红书选题模板\n\n## 核心逻辑\n1. 痛点前置\n2. 解决方案\n3. 情绪价值",
      tags: ["AI效率", "选题", "爆款"],
      domain: "AI效率",
      platform: "小红书",
    },
    machine: {
      intent: "content_ideation",
      entities: { topic: "AI提效" },
      steps: ["检索热词", "生成标题", "输出大纲"],
      commands: ["/content run --style xiaogai --count 1"],
      constraints: ["厚版700-1000字", "带emoji"],
      trigger: { type: "cron", schedule: "0 9 * * *" },
    },
  },
  {
    id: "kb_20260306_002",
    human: {
      title: "金融风控：极端行情监控策略",
      summary: "当市场波动率超过阈值时，自动触发风控警报并平仓。",
      content_md:
        "# 极端行情监控策略\n\n## 触发条件\n- 5分钟内波动 > 5%\n- 资金净流出 > 1000万",
      tags: ["量化交易", "风控", "预警"],
      domain: "金融风控",
      platform: "Telegram",
    },
    machine: {
      intent: "risk_management",
      entities: { threshold: "5%" },
      steps: ["获取实时K线", "计算波动率", "发送警报"],
      commands: ["/risk monitor --asset BTC --threshold 0.05"],
      constraints: ["延迟<100ms"],
    },
  },
];
