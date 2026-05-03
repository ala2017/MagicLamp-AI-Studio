import React, { useState, useEffect } from 'react';
import { Sparkles, Music, Copy } from 'lucide-react';
import { loadPrompt, interpolateTemplate, PromptConfig } from '../services/promptService';
import { ViewProps } from '../types';

import { callNvidiaChat } from '../services/aiService';

// Removed temporary API logic


export const StyleView = ({ project, updateProject }: ViewProps) => {
    const [loading, setLoading] = useState(false);
    const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);

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

    // Load prompt config on mount
    useEffect(() => {
        loadPrompt('style-match')
            .then(config => setPromptConfig(config))
            .catch(err => console.error('Failed to load style-match config:', err));
    }, []);

    const handleAnalyze = async () => {
        if (!promptConfig) return;

        setLoading(true);
        // Clear previous results
        updateProject({ styleAnalysis: '', sunoPrompt: '' });

        // Build User Message
        const lyricsToAnalyze = project.optimizedLyrics || project.originalLyrics;
        const userMessage = interpolateTemplate(promptConfig.userMessageTemplate, {
            lyrics: lyricsToAnalyze,
            briefContext: briefContext.trim()
        });

        try {
            const result = await callNvidiaChat(promptConfig.systemPrompt, userMessage, {
                model: promptConfig.model,
                temperature: promptConfig.temperature,
                maxTokens: promptConfig.maxTokens
            });

            // Parse Output
            const analysisMatch = result.match(/---ANALYSIS---([\s\S]*?)---PROMPT---/);
            const promptMatch = result.match(/---PROMPT---([\s\S]*?)$/);

            const analysis = analysisMatch ? analysisMatch[1].trim() : result;
            const prompt = promptMatch ? promptMatch[1].trim() : "";

            updateProject({
                styleAnalysis: analysis,
                sunoPrompt: prompt
            });

        } catch (e: any) {
            console.error(e);
            updateProject({ styleAnalysis: `Error: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 animate-fade-in h-full flex flex-col gap-4">
            <div>
                <h2 className="text-2xl font-bold text-textMain tracking-tight flex items-center gap-3">
                    <Music className="text-secondary" size={24} />
                    Style Director
                </h2>
                <p className="text-textMuted text-sm">AI 分析歌词 → 生成音乐风格 → Suno Prompt</p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
                {/* Left Panel */}
                <div className="flex flex-col h-full overflow-hidden">
                    {/* 歌词卡片 - 自适应高度，占据剩余空间 */}
                    <div className="glass-panel rounded-xl p-4 border-white/5 flex-1 flex flex-col mb-4 min-h-0">
                        <label className="text-xs font-bold text-textMuted mb-2 flex items-center gap-2 flex-shrink-0">
                            <Sparkles size={12} /> 当前歌词内容 (Live)
                        </label>
                        <div className="flex-1 text-sm text-textMain/80 font-mono whitespace-pre-wrap opacity-70 overflow-y-auto custom-scrollbar">
                            {project.optimizedLyrics || project.originalLyrics || "(暂无歌词，请先在 Lyrics 页面创作)"}
                        </div>
                    </div>

                    {/* 创作意图卡片 - 固定高度 */}
                    <div className="glass-panel rounded-xl p-4 border-white/5 mb-4 flex-shrink-0">
                        <label className="text-xs font-bold text-textMuted mb-2 block">🎯 创作意图 (来自 Brief)</label>
                        <ul className="text-xs text-textMuted space-y-1 ml-4 list-disc">
                            <li>情感：{emotion.join(', ') || '-'}</li>
                            <li>主题：{theme.join(', ') || '-'}</li>
                            <li>风格：{styleRef.join(', ') || '-'}</li>
                        </ul>
                    </div>

                    {/* 按钮固定底部 */}
                    <div className="flex-shrink-0">
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || (!project.originalLyrics && !project.optimizedLyrics)}
                            className={`w-full py-3 bg-secondary hover:bg-emerald-600 text-white font-medium rounded-lg transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                        >
                            <Sparkles size={16} className={loading ? "animate-spin" : ""} />
                            {loading ? 'AI 正在分析...' : '开始风格匹配'}
                        </button>
                    </div>
                </div>

                {/* Right Panel: Output */}
                <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    {/* Analysis Result */}
                    {project.styleAnalysis && (
                        <div className="glass-panel rounded-xl p-4 border-secondary/20 bg-secondary/5 animate-fade-in">
                            <label className="text-xs font-bold text-secondary mb-2 block">📊 风格分析报告</label>
                            <pre className="text-sm text-textMain whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto max-h-48 custom-scrollbar">
                                {project.styleAnalysis}
                            </pre>
                        </div>
                    )}

                    {/* Suno Prompt Card */}
                    {project.sunoPrompt && (
                        <div className="glass-panel rounded-xl p-5 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-2xl relative overflow-hidden animate-fade-in">
                            <div className="absolute top-0 right-0 p-4 opacity-50">
                                <Music size={64} className="text-primary opacity-20" />
                            </div>

                            <div className="relative z-10">
                                <label className="text-xs font-bold text-primary mb-3 flex items-center gap-2 uppercase tracking-wider">
                                    <Sparkles size={12} /> Suno AI Prompt
                                </label>
                                <div className="bg-black/40 rounded-lg p-4 text-sm font-mono text-white leading-relaxed border border-white/10 shadow-inner">
                                    {project.sunoPrompt}
                                </div>
                                <div className="flex justify-end mt-3">
                                    <button
                                        onClick={() => navigator.clipboard.writeText(project.sunoPrompt)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs text-white transition-colors"
                                    >
                                        <Copy size={12} /> 复制
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!project.styleAnalysis && !project.sunoPrompt && (
                        <div className="flex-1 flex flex-col items-center justify-center text-textMuted/50 gap-4">
                            <div className="w-24 h-24 rounded-2xl bg-surfaceHighlight/30 border border-white/5 flex items-center justify-center">
                                <Music size={48} className="opacity-30" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm">点击「开始风格匹配」</p>
                                <p className="text-xs opacity-60 mt-1">AI 将为您定制专属 Prompts</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
