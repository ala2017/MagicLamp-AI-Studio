import React, { useState, useEffect } from 'react';
import { Sparkles, Mic2, Settings, Upload } from 'lucide-react';
import { TagSelect } from '../components/TagSelect';
import { loadPrompt, interpolateTemplate, PromptConfig } from '../services/promptService';
import { ViewProps, CreativeBrief } from '../types';

import { callNvidiaChat } from '../services/aiService';

// Removed temporary API logic


export const LyricsView = ({ project, updateProject, updateBrief }: ViewProps) => {
    const [prompt, setPrompt] = useState("优化押韵，让 flow 更流畅");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // UI State
    const [briefOpen, setBriefOpen] = useState(true);

    const toggleTag = (field: keyof CreativeBrief, tag: string) => {
        if (!updateBrief) return;
        const currentTags = project.brief[field] as string[];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];
        updateBrief({ [field]: newTags });
    };

    // Prompt Config state
    const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);

    // Load prompt config on mount
    useEffect(() => {
        loadPrompt('lyrics-optimize')
            .then(config => setPromptConfig(config))
            .catch(err => console.error('Failed to load prompt config:', err));
    }, []);

    const handleOptimize = async () => {
        if (!promptConfig) {
            setError("Prompt configuration not loaded");
            return;
        }

        setLoading(true);
        setError("");

        // Build context from Creative Brief
        const { emotion, theme, styleRef, perspective, langStyle, motivation } = project.brief;
        const briefContext = `
【创作背景】
- 情感基调：${emotion.join('、') || '未指定'}
- 核心主题：${theme.join('、') || '未指定'}
- 风格参考：${styleRef.join('、') || '未指定'}
- 叙事视角：${perspective.join('、') || '未指定'}
- 语言风格：${langStyle.join('、') || '未指定'}
- 创作动机：${motivation || '未指定'}
`;

        const systemPrompt = promptConfig.systemPrompt;
        const userMessage = interpolateTemplate(promptConfig.userMessageTemplate, {
            briefContext: briefContext.trim(),
            prompt,
            original: project.originalLyrics
        });

        try {
            const result = await callNvidiaChat(systemPrompt, userMessage, {
                model: promptConfig.model,
                temperature: promptConfig.temperature,
                maxTokens: promptConfig.maxTokens
            });
            updateProject({ optimizedLyrics: result });
        } catch (e: any) {
            setError(e.message);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full p-4 gap-4 animate-fade-in">
            {/* Top Control Bar */}
            <div className="flex flex-col gap-4 mb-2">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Mic2 size={20} className="text-primary" />
                            <input
                                type="text"
                                value={project.songTitle}
                                onChange={(e) => updateProject({ songTitle: e.target.value })}
                                className="text-2xl font-bold text-textMain tracking-tight bg-transparent border-none outline-none focus:text-primary transition-colors w-auto"
                                placeholder="输入歌名..."
                            />
                            <span className="text-xs text-textMuted bg-surfaceHighlight px-2 py-0.5 rounded">v{project.version}</span>
                        </div>
                        <p className="text-textMuted text-sm">Compare and refine your verses with AI intelligence.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setBriefOpen(!briefOpen)}
                            className={`px-3 py-2 border rounded-md text-xs transition-colors flex items-center gap-2 ${briefOpen ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surfaceHighlight border-white/5 text-textMain hover:bg-white/5'}`}
                        >
                            <Settings size={14} /> Brief {briefOpen ? '▲' : '▼'}
                        </button>
                        <button
                            onClick={handleOptimize}
                            disabled={loading}
                            className={`px-4 py-2 bg-primary hover:bg-primaryHover text-white rounded-md text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 duration-100 ${loading ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            <Sparkles size={14} className={loading ? "animate-spin" : ""} />
                            {loading ? "Optimizing..." : "Optimize"}
                        </button>
                    </div>
                </div>

                {/* Creative Brief Panel */}
                {briefOpen && updateBrief && (
                    <div className="glass-panel rounded-xl p-5 border-white/5 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-textMain">📝 创作 Brief</span>
                            <span className="text-xs text-textMuted">填写越详细，AI 优化越精准</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <TagSelect
                                label="🎭 情感基调"
                                options={['愤怒', '悲伤', '励志', '讽刺', '绝望', '温暖', '冷酷', '释然']}
                                selected={project.brief.emotion}
                                onToggle={(t) => toggleTag('emotion', t)}
                            />
                            <TagSelect
                                label="📌 核心主题"
                                options={['社会批判', '个人成长', '爱情', '友情', '政治', '自我怀疑', '反抗', '追忆']}
                                selected={project.brief.theme}
                                onToggle={(t) => toggleTag('theme', t)}
                            />
                            <TagSelect
                                label="🎤 风格参考"
                                options={['NF', 'Eminem', 'GAI', '法老', '马思唯', 'Rage Against', '谢帝', '艾热']}
                                selected={project.brief.styleRef}
                                onToggle={(t) => toggleTag('styleRef', t)}
                            />
                            <TagSelect
                                label="👁️ 叙事视角"
                                options={['第一人称', '第二人称', '第三人称', '多视角切换']}
                                selected={project.brief.perspective}
                                onToggle={(t) => toggleTag('perspective', t)}
                            />
                            <TagSelect
                                label="🗣️ 语言风格"
                                options={['街头口语', '诗意文学', '脏话狂暴', '内敛克制', '幽默讽刺', '哲学思辨']}
                                selected={project.brief.langStyle}
                                onToggle={(t) => toggleTag('langStyle', t)}
                            />
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-textMuted">💡 创作动机</label>
                                <input
                                    type="text"
                                    value={project.brief.motivation}
                                    onChange={(e) => updateBrief({ motivation: e.target.value })}
                                    className="w-full bg-surfaceHighlight/50 border border-white/5 rounded-md px-3 py-2 text-xs text-textMain placeholder-textMuted/40 focus:border-primary/50 outline-none"
                                    placeholder="为什么写这首歌？想表达什么？"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Prompt Input */}
                <div className="bg-surfaceHighlight/30 p-1 rounded-lg border border-white/5 flex gap-2 items-center focus-within:border-primary/30 transition-colors">
                    <div className="p-2 text-primary">
                        <Sparkles size={16} />
                    </div>
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-textMain placeholder-textMuted/50 outline-none h-9"
                        placeholder="告诉 AI 如何优化 (例如: '更多押韵', '副歌更有力')..."
                    />
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs">
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* Editor Split Pane */}
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 relative">

                {/* Left: Original */}
                <div className="flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-bold text-textMuted uppercase tracking-wider">原稿 Original</span>
                        <span className="text-xs text-textMuted/50">v1.0</span>
                    </div>
                    <div className="flex-1 glass-panel p-0 overflow-hidden flex flex-col group border-white/5 focus-within:border-white/20 transition-colors bg-surface/40">
                        <textarea
                            value={project.originalLyrics}
                            onChange={(e) => updateProject({ originalLyrics: e.target.value })}
                            className="flex-1 w-full bg-transparent border-none resize-none p-4 font-mono text-sm leading-relaxed text-textMain/90 focus:ring-0 outline-none custom-scrollbar"
                            spellCheck={false}
                        />
                    </div>
                </div>

                {/* Right: AI Optimized */}
                <div className="flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                            <Sparkles size={12} /> AI 润色
                        </span>
                        <button
                            className="text-xs flex items-center gap-1 text-secondary hover:text-white px-2 py-0.5 rounded bg-secondary/10 hover:bg-secondary/20 transition-colors border border-secondary/20 hover:border-secondary/50 disabled:opacity-30"
                            onClick={() => {
                                const blob = new Blob([project.optimizedLyrics], { type: 'text/plain;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${project.songTitle}_v${project.version}.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                                updateProject({ version: project.version + 1 });
                            }}
                            title="保存润色歌词到本地（自动版本号）"
                            disabled={!project.optimizedLyrics}
                        >
                            <Upload size={10} className="rotate-[-90deg]" /> 保存 v{project.version}
                        </button>
                    </div>

                    <div className="flex-1 glass-panel p-0 overflow-hidden flex flex-col border-primary/20 bg-primary/5 focus-within:border-primary/40 transition-colors relative">
                        <textarea
                            value={project.optimizedLyrics}
                            onChange={(e) => updateProject({ optimizedLyrics: e.target.value })}
                            placeholder={loading ? "AI 正在思考中..." : "润色结果将显示在这里..."}
                            className="flex-1 w-full bg-transparent border-none resize-none p-4 font-mono text-sm leading-relaxed text-textMain focus:ring-0 outline-none custom-scrollbar placeholder:text-textMuted/30"
                            spellCheck={false}
                        />
                        {loading && (
                            <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center">
                                <div className="flex items-center gap-2 text-primary bg-black/60 px-4 py-2 rounded-full border border-white/5 shadow-xl">
                                    <Sparkles size={16} className="animate-spin" />
                                    <span className="text-xs font-medium">DeepSeek 正在思考...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
