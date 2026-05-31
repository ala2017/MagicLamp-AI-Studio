# 评估工具:量化 MagicLamp 迁移穿梭机的收益

回答一个核心问题:**用了这个 Skill,迁移项目时到底省了多少 Token、效率提升多少?**

收益分两个维度,分别用两套工具度量:

| 维度 | 工具 | 是否需要 API | 说明 |
|---|---|---|---|
| **Token / 成本** | `run_benchmark.py` / `estimate_savings.py` | 否(本地) | 盲扫体量 vs 交接书,确定性可复现 |
| **多轮效率**(轮数/成功率) | `ab_runner.py` | 是(真实模型) | 实测 agent 跑迁移任务的行为 |

---

## 1. Token / 成本对比(零 API,立即可跑)

```powershell
# 自动跨 4 档合成项目对比并生成 evaluation/REPORT.md
python evaluation\run_benchmark.py

# 把你的真实项目也纳入对比
python evaluation\run_benchmark.py --roots "C:\path\to\projA" "C:\path\to\projB"

# 单个项目快速看节省率
python evaluation\estimate_savings.py --root "C:\path\to\proj"
```

原理:对比**盲启动需要吞入的全量代码 token** 与**脱水交接书 token**。
装了 `tiktoken` 则为精确计数,否则走内置启发式。

> 最新基线(合成 4 档):现实场景平均省 **94.7%** 输入 Token,平均 **168×** 更小;
> 项目越大收益越高(large 档 99.8%)。详见 `REPORT.md`。

---

## 2. 多轮效率对比(需真实 API)

这部分必须让模型实际跑一遍"接手半成品项目"的任务才能测出**轮数、成功率、读错文件**等行为指标——本地估算无法替代。

```powershell
# 1) 先给目标项目生成交接书(B 臂需要)
python magiclamp-project-migration\scripts\dehydrate.py --root "C:\path\to\proj"

# 2) 跑双臂 A/B(A=盲启动 / B=带交接书),各 5 次取均值±方差
$env:ANTHROPIC_API_KEY="sk-ant-..."
python evaluation\ab_runner.py --root "C:\path\to\proj" --expect "支付" --runs 5
```

输出 `AB_REPORT.md`,包含:到答轮数、工具调用次数、实测 input/output token、
成功率、单任务输入成本——A vs B 并列对照。

两臂使用**完全相同**的工具集与问题,唯一变量是"有没有交接书",从而干净隔离 Skill 的贡献。

---

## 方法学说明

- **代理估算**衡量输入 token 体量上界,反映"隔离 + 脱水"的压缩效果。
- 它**未建模**盲启动 agent 反复读盘/纠错的多轮开销,因此真实节省通常**高于**代理值。
- 想要严谨结论:用 `ab_runner.py` 跑 N≥5 次,报告均值±方差,并在多个真实项目上复现。
