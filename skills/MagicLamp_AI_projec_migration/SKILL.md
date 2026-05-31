---
name: magiclamp-project-migration
description: 神灯AI·项目迁移穿梭机 (MagicLamp AI Project Migration). Two-flow zero-token cold-start fuel for AI project handoff. SNAPSHOT flow — use when the user runs /migrate or asks to "migrate this project", "迁移项目", "生成快照/交接书", "换工具/换模型继续开发", "脱水上下文", "DEHYDRATED_CONTEXT", to hand off a half-finished project across AI tools/models without burning tokens on blind full-scans. RESUME flow — use when entering a project that ALREADY has DEHYDRATED_CONTEXT.md, or the user asks to "继续开发", "理解项目", "了解项目状态", "恢复进度", "阅读交接书", "resume": adapt to the current tool and rebuild context from the handoff doc. Builds shadow-ignorance isolation, arbitrates bilingual breakpoint conflicts, launders secrets, emits a cache-stable handoff doc, and recommends a low-cost model for the snapshot step.
metadata:
  author: MagicLamp AI
  version: 1.1.0
  tags: migration, cold-start, dehydration, handoff, shadow-project, secrets-laundering, prompt-cache
---

# 神灯AI·项目迁移穿梭机 (MagicLamp AI Project Migration)

跨工具 / 跨模型迁移"开发中(半成品)或面临重大技术调整"的核心项目时的**冷启动燃料与行为约束器**。
目标:在更换工具或重置会话时,**零 Token 盲读盘**,只交付绝对纯净的靶向上下文,并强制命中云端提示词缓存。

## 产品定位:两条流程

本 Skill 有且仅有两条流程,由项目根目录是否已存在 `DEHYDRATED_CONTEXT.md` 决定:

| 流程 | 触发 | 目标 |
|------|------|------|
| **Snapshot(快照迁移)** | `/migrate` / "迁移项目 / 生成快照 / 换工具继续";或目录**无**交接书 | 给项目拍快照,产出交接书,引导用户切低成本模型 + 开新会话 |
| **Resume(续接开发)** | "继续开发 / 理解项目 / 了解项目状态 / 恢复进度 / 阅读交接书";或目录**已有**交接书 | 适配当前工具环境,阅读交接书重建上下文,恢复开发 |

## 生态位铁律(先判断,再行动)

- **充分利用**:目标工具自带低能耗本地初始化/索引 → 终止全量扫描,直接承接其原生索引。
- **替代优化**:目标工具盲目全量读盘 / 无自动初始化 → 强行介入,物理隔离 + 专属 SOP 驱动。
- **无损补充**:针对工具感知不到的业务盲区(中英双语 PRD/Task 断点、控制台报错行)→ 输出纯净补充。

> **绝对禁止**:调用大模型通读文件来计算栈/时钟/熵/密钥/路由。这些信号一律由 `scripts/dehydrate.py` 本地确定性产出。

---

## Step 0 — 流程路由(零 Token 确定性判定)

任何触发先跑一次确定性探测,由脚本(而非大模型)决定走哪条流程:

```bash
python scripts/dehydrate.py --root <PROJECT_ROOT> --detect
```
返回 JSON 中的 `recommended_flow`:
- `snapshot` → 无交接书,走 **流程 A(Snapshot)**。
- `resume` → 交接书新鲜且无显著漂移,走 **流程 B(Resume)**。
- `resume_then_resnapshot` → 交接书陈旧(> 14 天)或 git 漂移(脏文件较记录 +5 以上)→ 先走流程 B 恢复,再建议用户重新 `/migrate` 刷新快照。

> 用户显式 `/migrate` 时无条件走流程 A(强制重新快照),覆盖探测结果。

---

## 流程 A — Snapshot(快照迁移)

### A1 — 先提示切换低成本模型(强制第一步)
快照全程为确定性脚本,**无须高性能模型推理**。因此首先提示用户:

> "当前项目尚未做过迁移快照。建议先切换到**低成本模型**(如 Gemini Flash / DeepSeek-Coder·V3 / Claude 3.5 Haiku)再执行快照生成,以节省 Token;待快照完成后,再切换到高性能模型续接开发。"

用户确认或跳过后继续。**严禁**在快照阶段消耗高性能模型 Token 做无谓阅读。

### A2 — 模块一:物理截流与多生态屏蔽(Shadow Ignorance)
零 Token 嗅探技术栈,并把隔离补丁**强行置顶**写入全生态 AI 忽略文件
(`.gitignore` / `.cursorignore` / `.aiderignore` / `.claudeignore`)。

```bash
python scripts/dehydrate.py --root <PROJECT_ROOT> --apply-ignores
```
- 拦截对象:`.aider*`、`.cursor/`、`.claude/`、`*.log`、`.chroma/`、`.qdrant/` 等。
- 已存在的忽略文件采用**增量追加且置顶**(Append-to-Top),绝不破坏原有规则。

> **物理隔离兜底**:若目标环境会无视忽略文件强行扫描,改用影子工程,
> 在系统临时目录建立硬链接副本(保留 `.git` 与锁文件,物理剔除缓存/大日志),再把影子目录移交目标工具:
> ```bash
> python scripts/shadow_project.py --root <PROJECT_ROOT>
> ```

### A3 — 模块二:双语断点检索 + 立体时钟熔断
`dehydrate.py` 已内置:中英文双轨模糊检索(PRD/需求/Requirement、README/CHANGELOG/更新日志、
TASK/TODO/任务/进度),并对冲突文档执行 **Stereo-Clock 立体时钟仲裁**:

- **方案 A(标准 Git 逻辑时钟)**:`.git` 存在且文件 `Clean` → 取 `git log` 提交时间为真理源。
- **方案 B(虚拟物理时钟 + 语义熵)**:无 Git → 取 `ctime/mtime`;不可信则统计 `TODO/FIXME/- [ ]`
  数量与报错特征行,活跃现场赋更高权重。
- **方案 C(暂存区差异捕获)**:`.git` 存在但 `Modified/Staged/Untracked` → `git hash-object` 生成虚拟
  Object ID;脏代码含报错/最新需求关键词时,**判定脏代码为最高真理源**。
- **非阻塞延迟仲裁**:方案 B 下语义熵完全对等且时间差 < 24h → **严禁原地死锁**,自动在
  `DEHYDRATED_CONTEXT.md` 顶部开辟 `[CRITICAL_CONFUSED_ZONE]`,把冲突原子断点交给新环境高性能模型推理。

状态词统一对齐为 `[DONE]` / `[ACTIVE_BREAKPOINT]`;仅锚定含 `MUST/REQUIRED/严禁/必须` 的 `[IRON_LAW]`。

> **覆盖门控(模块六)**:断点来自文档,只答"做什么"不答"在哪"。`dehydrate.py` 会先用
> `scripts/build_project_map.py` 做零 Token 覆盖审计(omission% = 真实源码文件从未被任何文档提及的比例;
> drift% = 文档引用但已不存在的路径比例)。当 `omission% > 15` 或 `drift% > 20` 时,自动用 `ast`
> 抽取"真实文件树 + 每文件类/函数签名"注入交接书 `## 3b. CODE_MAP`(**只写签名,绝不复制源码体**),
> 补上代码锚点、消除断点漂移。可选 `--describe` 仅把签名喂给最廉价模型生成一句话责任说明;`--no-code-map` 关闭。

### A4 — 模块三:脱水产出 + 凭证洗涤 + 缓存强固化
生成最终交接书(默认置于项目根目录):

```bash
python scripts/dehydrate.py --root <PROJECT_ROOT> --out DEHYDRATED_CONTEXT.md
```
- **全管道凭证洗涤**:任何 API Key/密码/Token 及高熵串 → `[REDACTED_SECRET_HASH_SHA256:<hash>]`(键值对仅抹除值,保留字段名)。
- **绝对锚定 + 视界截断**:代码只写 `path -> symbol -> line`,三方依赖截断为 `[External_Dep] -> ...`,严禁复制源码。
- **缓存稳定**:静态头部 + 1–6 节字节级固定;时间戳等易变元数据置于尾部 `VOLATILE_METADATA`。
- 详见 `references/output_schema.md`。

> 仅需信号、不落盘时:`python scripts/dehydrate.py --root <ROOT> --signals-only`(输出 JSON)。

### A5 — 模块五:目标工具初始化自适应适配
读取 `references/adaptive_matrix.md`,选择目标工具对应 Sub-ruleset,**追加**到交接书第 6 节
(`6. TARGET_TOOL_INIT`):Antigravity(`ag sync` / `ag task create`)、Hermes
(`thought->action->observation`)、通用 IDE/MCP(依赖自检 + 锁死 Token 边界)。

### A6 — 模块四:成本控制向导 + 会话终止
- 打印降级向导(Gemini Flash / DeepSeek-Coder·V3 / Claude 3.5 Haiku),见 `references/adaptive_matrix.md` 末节。
- 输出 NEXT 指引:"复制 `DEHYDRATED_CONTEXT.md` 全文 → 切换到推荐模型/工具 → 开启新会话粘贴。"
- 交接书结尾已写入显式终止符 `[TERMINATE_SESSION]`。**输出向导后立即闭环,严禁继续输出总结性废话。**

---

## 流程 B — Resume(续接开发)

前提:`--detect` 返回 `resume` 或 `resume_then_resnapshot`(目录已有 `DEHYDRATED_CONTEXT.md`)。

### B1 — 当前工具环境适配
读取交接书第 6 节 `TARGET_TOOL_INIT`,执行当前工具的初始化驱动
(Antigravity → `ag sync`;通用 IDE/MCP → 依赖自检如 `npm install` / `pip install -r requirements.txt`)。
**信任** Step 0 探测结果与交接书既有 Stereo-Clock 排序,**不重新跑** M2 断点仲裁。

### B2 — 阅读交接书重建上下文(只读交接书,不盲读源码)
按顺序消化 `DEHYDRATED_CONTEXT.md`:
- **Section 1 STACK** → 技术栈。
- **Section 2 TRUTH_SOURCE_RANKING** → 文档真理源优先级(已排好,直接采信)。
- **Section 3 ATOMIC_BREAKPOINTS** → 逐个理解原子断点(`[DONE]` / `[ACTIVE_BREAKPOINT]` / `[IRON_LAW]`)。
- **Section 4 GIT_HIGHLIGHT_ZONE** → 分支与未提交脏文件,**防止覆盖未提交代码**。
- **Section 5 SHADOW_IGNORANCE** → 哪些目录/文件已被隔离,不要去读。
- 若存在 **`[CRITICAL_CONFUSED_ZONE]`** → 这是 Snapshot 阶段无法判定的冲突,此处用高性能模型结合代码实况裁决真理源。

### B3 — 漂移与新鲜度处置(由 Step 0 决定)
- `recommended_flow == resume` → 直接续接开发。
- `recommended_flow == resume_then_resnapshot` → 先据交接书恢复理解,然后提示用户:
  "检测到快照陈旧/项目有未记录增量,建议执行 `/migrate` 刷新快照后再深入开发。"

### B4 — 恢复开发
按 Section 3 的 `[ACTIVE_BREAKPOINT]` 顺序推进任务,所有代码改动通过目标工具原生机制驱动
(`ag task create` / 标准文件 API)。Resume 流程**不**写入 `[TERMINATE_SESSION]`,正常进入开发会话。

---

## 输出产物

```
<PROJECT_ROOT>/
├── DEHYDRATED_CONTEXT.md     # 唯一交接书(缓存稳定 + 凭证洗涤)
├── .gitignore  .cursorignore  .aiderignore  .claudeignore   # 置顶隔离补丁
└── (可选) %TEMP%/magiclamp_shadow_*/   # 影子工程(物理隔离兜底)
```

## 安全防线

- `git status` 摘要写入交接书"高亮观察区",防止新模型覆盖未提交代码。
- 多层凭证洗涤:扫描文档/.env 模板/局部注释,任何明文密钥一律 SHA256 占位抹除。

## 故障排除

- **Q: 未发现任何文档** → 项目无 PRD/README/TASK;交接书仍输出栈+git 高亮区,断点区为空,正常。
- **Q: 无 Git 环境** → 自动走方案 B 虚拟物理时钟,`GIT_HIGHLIGHT_ZONE` 标注 `no-git`。
- **Q: 误报密钥/过度洗涤** → 高熵阈值为 Shannon≥4.0;如需放宽,调整 `dehydrate.py` 中 `repl_entropy`。
- **Q: 目标工具仍强行全量读盘** → 改用 `shadow_project.py`,移交临时目录硬链接副本。
