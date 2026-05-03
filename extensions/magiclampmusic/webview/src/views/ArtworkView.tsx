import React, { useState, useEffect } from 'react';
import { TagSelect } from '../components/TagSelect';
import { loadPrompt, interpolateTemplate, PromptConfig } from '../services/promptService';
import { ViewProps } from '../types';
import { ImageIcon, Mic2, Sparkles, Download, Wand2, Maximize2 } from 'lucide-react';

import { callNvidiaChat, callNvidiaGenAI } from '../services/aiService';

// Removed duplicated API logic and AICallOptions
type TitlePosition = 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const ArtworkView = ({ project, updateProject }: ViewProps) => {
    // Local UI State -> These could also be part of project state if persistence is needed
    // For now, keeping them local as they are specific to the artwork generation session
    const [selectedStyle, setSelectedStyle] = useState<string>('AI创意');
    const [customReq, setCustomReq] = useState('');
    const [mainTitle, setMainTitle] = useState(project.songTitle || '');
    const [subTitle, setSubTitle] = useState(`v${project.version}`);
    const [titlePosition, setTitlePosition] = useState<TitlePosition>('center');

    // 文字样式配置
    const [fontFamily, setFontFamily] = useState<string>('Inter');
    const [fontSize, setFontSize] = useState<number>(72);
    const [fontColor, setFontColor] = useState<string>('#FFFFFF');
    const [showTextOnPreview, setShowTextOnPreview] = useState<boolean>(true);

    const [promptConfigLoading, setPromptConfigLoading] = useState(true);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState('');
    const [imageError, setImageError] = useState('');

    const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);

    // Load prompt config
    useEffect(() => {
        setPromptConfigLoading(true);
        loadPrompt('cover-suggest')
            .then(config => setPromptConfig(config))
            .catch(err => {
                console.error('Failed to load cover-suggest config:', err);
                setAiSuggestion('配置加载失败: cover-suggest.json');
            })
            .finally(() => setPromptConfigLoading(false));
    }, []);

    // Sync title from project if changed externally
    useEffect(() => {
        if (project.songTitle) setMainTitle(project.songTitle);
        if (project.version) setSubTitle(`v${project.version}`);
    }, [project.songTitle, project.version]);


    // Step 1: Get AI Suggestion (DeepSeek)
    const handleGetSuggestion = async () => {
        if (!promptConfig) {
            setAiSuggestion('配置未加载，请刷新页面重试');
            return;
        }

        setSuggestLoading(true);
        setAiSuggestion('');

        const lyricsContent = project.optimizedLyrics || project.originalLyrics;
        const briefContext = JSON.stringify(project.brief, null, 2);

        // 如果是“AI创意”，则让模型自由发挥；否则使用用户选择的风格
        const styleContext = selectedStyle === 'AI创意'
            ? "不限制特定风格。请你作为视觉总监，根据歌词的情感内核和意境，完全自主地定义最完美、最契合的视觉风格。"
            : selectedStyle;

        const userMessage = interpolateTemplate(promptConfig.userMessageTemplate, {
            lyrics: lyricsContent,
            brief: briefContext,
            style: styleContext,

            customRequirement: customReq || "无特殊要求"
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

            const suggestion = analysisMatch ? analysisMatch[1].trim() : result;
            const prompt = promptMatch ? promptMatch[1].trim() : "";

            setAiSuggestion(suggestion);
            updateProject({ coverPrompt: prompt });

        } catch (e: any) {
            console.error(e);
            setAiSuggestion(`获取建议失败: ${e.message}`);
        } finally {
            setSuggestLoading(false);
        }
    };

    // Step 2: Generate Image (FLUX via NVIDIA NIM)
    const handleGenerateImage = async () => {
        if (!project.coverPrompt?.trim()) {
            setImageError('请先获取 AI 建议生成 Prompt');
            return;
        }

        setImageLoading(true);
        setImageError('');
        updateProject({ generatedCoverUrl: null }); // Clear previous

        try {
            // 使用 Stable Diffusion XL 替代 FLUX（更稳定）
            const data = await callNvidiaGenAI('stabilityai/stable-diffusion-xl', {
                text_prompts: [{ text: project.coverPrompt, weight: 1 }],
                cfg_scale: 7,
                steps: 30,
                width: 1024,
                height: 1024,
                seed: Math.floor(Math.random() * 2147483647)
            });

            // SDXL 返回 artifacts 数组
            if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) {
                updateProject({ generatedCoverUrl: `data:image/png;base64,${data.artifacts[0].base64}` });
            } else {
                console.log('SDXL Response:', data);
                throw new Error('未收到图像数据，请检查 API 响应格式');
            }
        } catch (e: any) {
            console.error(e);
            setImageError(e.message || '图像生成失败');
        } finally {
            setImageLoading(false);
        }
    };

    // Download - withText 参数控制是否叠加文字
    const handleDownloadImage = (withText: boolean = true) => {
        if (!project.generatedCoverUrl) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);

            // Add title overlay only if withText is true
            if (withText && ctx && (mainTitle || subTitle)) {
                let x = canvas.width / 2;
                let y = canvas.height / 2;
                let textAlign: CanvasTextAlign = 'center';

                if (titlePosition.includes('left')) { x = 80; textAlign = 'left'; }
                if (titlePosition.includes('right')) { x = canvas.width - 80; textAlign = 'right'; }
                if (titlePosition.includes('top')) y = 120;
                if (titlePosition.includes('bottom')) y = canvas.height - 100;

                ctx.textAlign = textAlign;
                ctx.fillStyle = fontColor;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 20;

                // Main title - 使用用户自定义字体
                if (mainTitle) {
                    ctx.font = `bold ${fontSize}px "${fontFamily}", "Microsoft YaHei", system-ui, sans-serif`;
                    ctx.fillText(mainTitle, x, y);
                }

                // Subtitle
                if (subTitle) {
                    ctx.font = `${Math.floor(fontSize * 0.45)}px "${fontFamily}", "Microsoft YaHei", system-ui, sans-serif`;
                    // 副标题略透明
                    const subtitleColor = fontColor + 'CC'; // 添加 80% 透明度
                    ctx.fillStyle = subtitleColor.length > 7 ? fontColor : subtitleColor;
                    ctx.fillText(subTitle, x, y + fontSize * 0.7);
                }
            }

            const link = document.createElement('a');
            const suffix = withText ? '_artwork' : '_original';
            link.download = `${mainTitle || 'cover'}${suffix}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.src = project.generatedCoverUrl;
    };


    return (
        <div className="p-6 animate-fade-in h-full flex flex-col gap-4">
            <div>
                <h2 className="text-2xl font-bold text-textMain tracking-tight flex items-center gap-3">
                    <ImageIcon className="text-primary" size={24} />
                    Artwork Generator
                </h2>
                <p className="text-textMuted text-sm">AI 分析歌词 → 生成封面创意 → FLUX 生成图像</p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
                {/* Left Panel: Configuration */}
                <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    {/* Lyrics Input Display */}
                    <div className="glass-panel rounded-xl p-4 border-white/5 flex flex-col min-h-[120px]">
                        <label className="text-xs font-bold text-textMuted mb-2 flex items-center gap-2">
                            <Mic2 size={12} /> 歌词内容 (Live)
                        </label>
                        <div className="flex-1 text-xs text-textMain/70 font-mono whitespace-pre-wrap overflow-hidden mask-linear-fade">
                            {project.optimizedLyrics || project.originalLyrics || "暂无歌词..."}
                        </div>
                    </div>

                    <TagSelect
                        label="🎨 视觉风格"
                        options={['AI创意', '赛博朋克', '暗黑哥特', '街头涂鸦', '极简主义', '复古浪潮', '抽象艺术', '写实摄影', '日系动漫']}
                        selected={[selectedStyle]}
                        onToggle={(t) => setSelectedStyle(t)}
                    />

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-textMuted">✏️ 自定义要求 (可选)</label>
                        <textarea
                            value={customReq}
                            onChange={(e) => setCustomReq(e.target.value)}
                            className="w-full h-16 bg-surfaceHighlight/50 border border-white/5 rounded-md px-3 py-2 text-xs text-textMain placeholder-textMuted/40 focus:border-primary/50 outline-none resize-none"
                            placeholder="例如：画面要即使感强，包含一把破碎的吉他..."
                        />
                    </div>

                    {/* Title Overlay Settings */}
                    <div className="glass-panel rounded-xl p-4 border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-textMuted">📝 封面文字</label>
                            <label className="flex items-center gap-2 text-xs text-textMuted cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showTextOnPreview}
                                    onChange={(e) => setShowTextOnPreview(e.target.checked)}
                                    className="w-3 h-3 accent-primary"
                                />
                                预览叠加
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={mainTitle}
                                onChange={(e) => setMainTitle(e.target.value)}
                                className="bg-surfaceHighlight/50 border border-white/5 rounded px-2 py-1.5 text-xs text-textMain outline-none focus:border-primary/50"
                                placeholder="主标题"
                            />
                            <input
                                type="text"
                                value={subTitle}
                                onChange={(e) => setSubTitle(e.target.value)}
                                className="bg-surfaceHighlight/50 border border-white/5 rounded px-2 py-1.5 text-xs text-textMain outline-none focus:border-primary/50"
                                placeholder="副标题"
                            />
                        </div>

                        {/* 字体样式控件 */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] text-textMuted">字体</label>
                                <select
                                    value={fontFamily}
                                    onChange={(e) => setFontFamily(e.target.value)}
                                    className="w-full bg-surfaceHighlight/50 border border-white/5 rounded px-2 py-1 text-xs text-textMain outline-none focus:border-primary/50"
                                >
                                    <option value="Inter">Inter</option>
                                    <option value="Microsoft YaHei">微软雅黑</option>
                                    <option value="PingFang SC">苹方</option>
                                    <option value="SimHei">黑体</option>
                                    <option value="serif">衬线体</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-textMuted">字号 ({fontSize}px)</label>
                                <input
                                    type="range"
                                    min="24"
                                    max="120"
                                    value={fontSize}
                                    onChange={(e) => setFontSize(Number(e.target.value))}
                                    className="w-full h-6 accent-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-textMuted">颜色</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="color"
                                        value={fontColor}
                                        onChange={(e) => setFontColor(e.target.value)}
                                        className="w-8 h-6 rounded border border-white/10 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={fontColor}
                                        onChange={(e) => setFontColor(e.target.value)}
                                        className="flex-1 bg-surfaceHighlight/50 border border-white/5 rounded px-1 py-0.5 text-[10px] text-textMuted outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Position Selector */}
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] text-textMuted">位置</span>
                            <div className="grid grid-cols-3 gap-1 w-20">
                                {['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
                                    <button
                                        key={pos}
                                        onClick={() => setTitlePosition(pos as TitlePosition)}
                                        className={`w-full aspect-square rounded-sm border ${titlePosition === pos ? 'bg-primary border-primary' : 'bg-surfaceHighlight border-white/10'} hover:bg-white/10 transition-colors ${pos === 'center' ? 'col-start-2 row-start-2' : ''}`}
                                        title={pos}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 gap-2 mt-2">
                        <button
                            onClick={handleGetSuggestion}
                            disabled={suggestLoading}
                            className={`py-3 bg-secondary/20 border border-secondary/50 hover:bg-secondary/30 text-secondary font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${suggestLoading ? 'opacity-50' : 'active:scale-95'}`}
                        >
                            <Sparkles size={16} className={suggestLoading ? "animate-spin" : ""} />
                            {suggestLoading ? 'AI 构思中...' : '获取 AI 创意建议'}
                        </button>
                    </div>
                </div>

                {/* Right Panel: Output & Generation */}
                <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    {/* AI Suggestion */}
                    {aiSuggestion && (
                        <div className="glass-panel rounded-xl p-3 border-secondary/20 bg-secondary/5 animate-fade-in">
                            <div className="flex justify-between items-start mb-2">
                                <label className="text-xs font-bold text-secondary">🤖 AI 创意建议</label>
                            </div>
                            <p className="text-xs text-textMain leading-relaxed whitespace-pre-wrap">{aiSuggestion}</p>
                        </div>
                    )}

                    {/* Prompt Editor */}
                    <div className="glass-panel rounded-xl p-3 border-primary/20 bg-primary/5">
                        <label className="text-xs font-bold text-primary mb-2 block flex items-center gap-2">
                            <Wand2 size={12} /> FLUX Prompt (Edit before generating)
                        </label>
                        <textarea
                            value={project.coverPrompt}
                            onChange={(e) => updateProject({ coverPrompt: e.target.value })}
                            className="w-full h-24 bg-transparent border-none resize-none text-xs font-mono text-textMain/90 focus:ring-0 outline-none custom-scrollbar"
                            placeholder="Waiting for AI suggestion..."
                        />
                    </div>

                    <button
                        onClick={handleGenerateImage}
                        disabled={imageLoading || !project.coverPrompt}
                        className={`py-4 bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/30 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 transform ${imageLoading ? 'opacity-80' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                    >
                        {imageLoading ? (
                            <>
                                <Sparkles size={20} className="animate-spin" />
                                FLUX 正在绘图 (可能需要 15-30秒)...
                            </>
                        ) : (
                            <>
                                <ImageIcon size={20} /> 使用 FLUX 生成封面
                            </>
                        )}
                    </button>

                    {imageError && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                            {imageError}
                        </div>
                    )}

                    {/* Image Preview Area */}
                    <div className={`flex-1 min-h-[300px] rounded-xl border-2 border-dashed ${project.generatedCoverUrl ? 'border-primary/50 bg-black' : 'border-white/10 bg-surfaceHighlight/20'} flex items-center justify-center relative group overflow-hidden transition-all`}>
                        {project.generatedCoverUrl ? (
                            <>
                                <img src={project.generatedCoverUrl} alt="Generated Cover" className="w-full h-full object-contain animate-fade-in" />

                                {/* 实时文字叠加层 - CSS 定位 */}
                                {showTextOnPreview && (mainTitle || subTitle) && (
                                    <div
                                        className={`absolute pointer-events-none flex flex-col gap-1
                                            ${titlePosition.includes('left') ? 'items-start left-6' : ''}
                                            ${titlePosition.includes('right') ? 'items-end right-6' : ''}
                                            ${titlePosition.includes('center') && !titlePosition.includes('top') && !titlePosition.includes('bottom') ? 'items-center left-1/2 -translate-x-1/2' : ''}
                                            ${titlePosition === 'top-center' ? 'items-center left-1/2 -translate-x-1/2' : ''}
                                            ${titlePosition === 'bottom-center' ? 'items-center left-1/2 -translate-x-1/2' : ''}
                                            ${titlePosition.includes('top') ? 'top-6' : ''}
                                            ${titlePosition.includes('bottom') ? 'bottom-6' : ''}
                                            ${titlePosition === 'center' ? 'top-1/2 -translate-y-1/2' : ''}
                                        `}
                                        style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.6)' }}
                                    >
                                        {mainTitle && (
                                            <span
                                                style={{
                                                    fontFamily: `"${fontFamily}", "Microsoft YaHei", system-ui, sans-serif`,
                                                    fontSize: `${fontSize * 0.5}px`,  // 预览缩放
                                                    color: fontColor,
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {mainTitle}
                                            </span>
                                        )}
                                        {subTitle && (
                                            <span
                                                style={{
                                                    fontFamily: `"${fontFamily}", "Microsoft YaHei", system-ui, sans-serif`,
                                                    fontSize: `${fontSize * 0.25}px`,
                                                    color: fontColor,
                                                    opacity: 0.8
                                                }}
                                            >
                                                {subTitle}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* 右上角悬浮按钮组 - 不遮挡图片 */}
                                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <button
                                        onClick={() => project.generatedCoverUrl && window.open(project.generatedCoverUrl, '_blank')}
                                        className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
                                        title="查看原图"
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadImage(false)}
                                        className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
                                        title="下载原图（无文字）"
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadImage(true)}
                                        className="p-2 bg-primary/80 hover:bg-primary text-white rounded-lg backdrop-blur-sm border border-primary/50 hover:border-primary transition-all"
                                        title="下载带文字封面"
                                    >
                                        <Download size={16} />
                                        <span className="sr-only">带文字</span>
                                    </button>
                                </div>
                                <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/70 rounded text-[10px] text-white/70">
                                    SDXL • 1024x1024
                                </div>
                            </>
                        ) : (
                            !imageLoading && (
                                <div className="text-center text-textMuted/40">
                                    <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">预览区域</p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
