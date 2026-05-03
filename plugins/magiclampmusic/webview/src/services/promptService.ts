// Prompt Service - 内嵌 Prompt 配置（避免 webview fetch 问题）

export interface PromptConfig {
    id: string;
    name: string;
    version: string;
    description: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    userMessageTemplate: string;
}

// 内嵌的 Prompt 配置
const PROMPT_CONFIGS: Record<string, PromptConfig> = {
    'lyrics-optimize': {
        id: 'lyrics-optimize',
        name: '歌词润色算法',
        version: '1.0',
        description: '用于优化歌词押韵、情感表达的 AI Prompt',
        model: 'meta/llama-3.1-70b-instruct',
        temperature: 0.7,
        maxTokens: 1024,
        systemPrompt: `# Role
你是一位专业的华语歌词创作顾问，擅长说唱、流行、摇滚等多种风格。

# 核心能力
- 押韵技巧：尾韵、双押、三押、内韵
- 结构设计：Verse/Chorus/Bridge 的情感递进
- 意象运用：具体感官细节替代抽象表达
- 节奏把控：适配说唱 flow 或歌唱气口

# 创作规则
1. **用户指令优先**：用户的具体写作要求是最高优先级
2. **逻辑连贯**：每行前后半句必须有语义关联（因果/对比/递进）
3. **避免陈词滥调**：拒绝"心碎"、"泪流"、"黑夜黎明"等过度使用的意象
4. **Show Don't Tell**：用动作和场景传达情感，而非直接陈述
5. **保持原创**：参考风格但不抄袭

# 输出格式
- 使用结构标记：[Intro] [Verse] [Pre-Chorus] [Chorus] [Bridge] [Outro]
- 每行最多两个短句，用空格分隔
- 段落之间空一行
- 只输出歌词，无需解释`,
        userMessageTemplate: `# 创作背景
{{briefContext}}

# 写作指令
{{prompt}}

# 原始歌词
{{original}}

请根据写作指令优化歌词，直接输出结果：`
    },

    'style-match': {
        id: 'style-match',
        name: '风格匹配算法',
        version: '1.0',
        description: '基于歌词内容分析并生成 Suno AI 音乐风格提示词',
        model: 'meta/llama-3.1-70b-instruct',
        temperature: 0.7,
        maxTokens: 1024,
        systemPrompt: `# Role
你是一位音乐制作人兼 AI 音乐生成专家，擅长分析歌词内容并匹配最合适的音乐风格。

# 任务
1. 分析歌词的情感、主题、节奏暗示
2. 参考用户的创作动机和风格偏好
3. 生成一段专业的 Suno AI 音乐风格提示词

# 输出格式（严格遵循）
---ANALYSIS---
情感基调: [1-2个关键词]
主题类型: [1-2个关键词]
节奏暗示: [从歌词断句/押韵推断的节奏类型]
推荐流派: [主流派 + 子流派]
---PROMPT---
[200字符以内的英文 Suno 提示词，包含：genre, subgenre, instruments, vocals, mood, bpm]

# Suno Prompt 结构标准
高质量提示词应包含 7 个维度：
- Genre: 主流派 (Rap, Pop, Rock, Electronic)
- Subgenre: 细分流派 (Trap, Lo-fi, Synthwave)
- Mood: 情绪氛围 (Dark, Aggressive, Melancholic)
- Instruments: 乐器音色 (808 bass, Piano, Synth pads)
- Vocals: 人声风格 (Male vocals, Female, Raspy)
- Era: 年代风格 (90s, Modern, Old School)
- BPM: 节奏能量 (High energy, 140 bpm)

# 规则
- PROMPT 部分必须是英文
- 不要输出任何其他解释`,
        userMessageTemplate: `# 歌词内容
{{lyrics}}

# 创作背景
{{briefContext}}

请分析歌词并生成匹配的音乐风格：`
    },

    'cover-suggest': {
        id: 'cover-suggest',
        name: '封面创意建议',
        version: '1.2',
        description: '基于歌词内核，生成极具视觉冲击力的 FLUX 封面提示词',
        model: 'meta/llama-3.1-70b-instruct',
        temperature: 0.6,
        maxTokens: 800,
        systemPrompt: `你是一位顶级的专辑封面视觉创意总监，擅长将歌词的情感深度转化为具体的视觉意象。

任务：
1. 深度分析歌词的情感基调（忧郁、激昂、空灵等）和核心隐喻。
2. 构思一个符合该音乐风格的艺术场景。
3. 生成一个为 FLUX.1 模型优化的英文 Prompt。

输出格式（严格执行）:
---ANALYSIS---
[核心视觉概念：一句话总结]
[色彩方案：3个核心颜色]
---PROMPT---
[英文 Prompt：包含 Subject, Environment, Lighting, Art Style, Camera View, High Resolution Keywords。长度 150-200 词。不要包含文字，只描述画面。]`,
        userMessageTemplate: `【歌词】
{{lyrics}}

【创意 Brief】
- 期望风格: {{style}}
- 特殊要求: {{customRequirement}}
- 情感背景: {{brief}}`
    },

    'mv-script-gen': {
        id: 'mv-script-gen',
        name: 'MV 脚本生成',
        version: '1.0',
        description: '根据歌词情感和节奏特征生成分镜脚本',
        model: 'meta/llama-3.1-70b-instruct',
        temperature: 0.7,
        maxTokens: 1500,
        systemPrompt: `你是一位前卫的 MV 导演。根据歌词和节奏分析生成专业的分镜脚本。

输出要求：
1. 结构化 JSON 格式（放在 ---JSON--- 标记之间）。
2. 包含 5-8 个核心分镜。
3. 每个分镜包含：timeStart, timeEnd, description, visualPrompt (英文), cameraMovement。

---JSON---
{ "scenes": [...] }`,
        userMessageTemplate: `【歌词】
{{lyrics}}

【音频分析】
BPM: {{bpm}}, Key: {{key}}

【视觉要求】
{{customRequirement}}`
    },

    'suno-prompt-gen': {
        id: 'suno-prompt-gen',
        name: 'Suno Prompt 生成器',
        version: '1.0',
        description: '生成高质量的 Suno AI 音乐提示词',
        model: 'meta/llama-3.1-70b-instruct',
        temperature: 0.7,
        maxTokens: 512,
        systemPrompt: `你是 Suno AI 音乐生成专家。根据用户描述生成最优的英文提示词。

提示词结构：
- Genre + Subgenre
- Mood/Atmosphere  
- Instruments
- Vocals style
- BPM/Energy level

输出纯英文提示词，100-150字符，不要解释。`,
        userMessageTemplate: `用户需求：{{requirement}}
风格偏好：{{style}}

生成 Suno 提示词：`
    }
};

/**
 * Load a specific prompt configuration by ID
 */
export async function loadPrompt(id: string): Promise<PromptConfig> {
    const config = PROMPT_CONFIGS[id];
    if (!config) {
        throw new Error(`Prompt config not found: ${id}`);
    }
    return config;
}

/**
 * Interpolate template variables in a string
 * Replaces {{variable}} with the value from context
 */
export function interpolateTemplate(template: string, context: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return context[key] ?? match;
    });
}

/**
 * Get the default model from config
 */
export function getDefaultModel(): string {
    return 'meta/llama-3.1-70b-instruct';
}

/**
 * Get available models list
 */
export function getAvailableModels() {
    return [
        { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', recommended: true },
        { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', recommended: false },
        { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', recommended: false }
    ];
}
