# 红队战报：MagicLamp 项目迁移穿梭机

## 执行状态：完成
红队采用"构造真实项目 + 实际运行脚本 + 边缘攻击"方式，共发现并修复 **5 项高危/中危**，其他历史问题均验证已修复。

## 本次攻击面 & 修复清单

| # | 攻击面 | 严重程度 | 状态 | 修复方式 |
|---|---|---|---|---|
| 1 | **自覆盖污染**：`DEHYDRATED_CONTEXT.md` 被第二轮 `discover_docs` / `coverage_audit` 误当作文档源，导致 `omission` 从 100%→0%，触发 CODE_MAP 消失后复现 | **高危** | 已修复 | `GENERATED_DOC_NAMES` 集合跳过；`discover_docs`/`iter_files`/`_collect_doc_text` 全域拦截 |
| 2 | **Git 脏区计数污染**：生成交接书本身被 `git status` 统计为脏文件，导致 Resume 持续误判 `dirty_delta`，进入 `resume_then_resnapshot` 死循环 | **高危** | 已修复 | `git_status_summary` 通过 `_porcelain_path()` 排除 `out_name`；`detect_snapshot` 同步过滤 |
| 3 | **影子工程旧文件残留**：`shadow_project.py` 复用目标目录时，上一轮旧文件不被清理，可能随新快照一并移交 | **中危** | 已修复 | `build_shadow` 开头增加 `shutil.rmtree(dest)`（仅当 `dest != root`） |
| 4 | **CODE_MAP 隐私泄露**：`generic_signature` 取源文件前 8 行作为 doc 摘要，若首行为 `export const API_KEY = 'ghp_...'`，密钥直接注入交接书 | **高危** | 已修复 | `build_project_map.py` 新增 `_launder_field()`，对 `doc` 字段做轻量级脱敏，保留字段名，仅替换值 |
| 5 | **正则不一致**：`STATUS_ACTIVE` / `IRON_LAW` 未使用 `re.A`，与 `STATUS_DONE` 修复后的行为不一致，不同 Python 版本下中文边界解释可能漂移 | **中危** | 已修复 | 统一追加 `re.A` 与 trailing `(?![\w])` 断言 |

## 历史问题验证（上一轮修复后回归确认）

| 历史问题 | 当前状态 |
|---|---|
| `STATUS_DONE` 中文边界 + `re.A` | 已修，复现通过 |
| `arbitrate` 排序缺少稳定 tie-break `x['rel']` | 已修，静态块字节级稳定 |
| `launder_secrets` 键值对整体替换导致语义丢失 | 已修，`repl_kv` 保留 `group(1)` |
| `git_status_summary` dirty_count 上限锁死 50 | 已修，先算全量再切片 |
| `.gitignore` 忽略 `__pycache__`，.pyc 已清 cache | 已修，验证无未跟踪 .pyc |
| `shadow_project` 递归 & `.lock` & `.git` 排除 | 已修，实测 dest 在 root 内不循环 |

## 端到端验证结论

- **静态块字节稳定**：同一项目连续 2 次运行，截掉 `VOLATILE_METADATA` 后 `strcmp` 完全匹配。
- **中文断点**：`开发中`、`TODO`、`MUST`、`已完成` 全部正确提取，无 `进行中abc` 类 false positive。
- **Secret 清洗**：`api_key = sk-xxx` → `api_key = [REDACTED]`；`ghp_xxx` 不再出现在 CODE_MAP。
- **Git 漂移感知**：生成文件不再计入 dirty count，`detect --root` 正确返回 `resume`（无漂移）。

## 最终发布结论

**无阻塞性高危或中危**。可发布，进入营销阶段。
