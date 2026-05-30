# Target-Tool Adaptive Matrix (Module 5)

After dehydration, append ONE matching Sub-ruleset to the bottom of
`DEHYDRATED_CONTEXT.md` (section 6). Pick the block for the destination tool.
The list below is illustrative — any AI IDE / agent / CLI that supports the
Skill spec is a valid migration target; reuse the closest profile.

---

## Antigravity

**Init driver**
- If local init was NOT triggered: instruct the user to run the native
  Tree-sitter + `uv` virtualenv sync:
  ```
  ag sync
  ```
- If already built: declare "consume the existing local index in full; do NOT
  re-scan."

**Tool-call contract (iron law)**
- Fully leverage its atomic task-management capability.
- DO NOT edit physical files directly. Every code change MUST be driven through
  a Task node:
  ```
  ag task create "<atomic breakpoint from section 3>"
  ```

---

## Hermes Agent

**Init driver**
- Use and trust its local incremental vector index + WASM symbol analysis.
- Do not force a full re-read; request only the delta around active breakpoints.

**Tool-call contract**
- Enforce its native `thought -> action -> observation` loop.
- Declare explicit temp-file write permission for scratch artifacts.

---

## Generic IDE / Standard MCP

**Init driver**
- No auto-init exists. Force a dependency self-check first:
  ```
  npm install        # Node    | pip install -r requirements.txt   # Python
  go mod download    # Go      | cargo fetch                       # Rust
  ```

**Tool-call contract**
- Use standard local file APIs (`read_file`, `write_file`) only.
- Hard-lock the token budget: read ONLY the paths named in section 2/3.
- Never blindly full-scan the tree; the ignore files from Module 1 are authoritative.

---

## Cost-control downgrade wizard (Module 4)

Always print this block after handoff, then emit `[TERMINATE_SESSION]`:

```
Recommended low-cost cold-start models:
- Gemini 1.5/2.x Flash   : ultra-large-context low-cost local analysis
- DeepSeek-Coder / V3    : high-value code generation & reasoning
- Claude 3.5 Haiku       : fast logical triage & sorting
```
