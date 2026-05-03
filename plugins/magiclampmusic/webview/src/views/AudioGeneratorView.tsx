import React, { useState, useEffect } from 'react';
import { Sparkles, Music, Play, Pause, Heart, Download, Trash2, Copy, RefreshCw, AlertCircle, ExternalLink, HelpCircle, X } from 'lucide-react';
import { ViewProps, AudioGeneration } from '../types';

declare const vscode: any;

export const AudioGeneratorView = ({ project, updateProject }: ViewProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [serviceConnected, setServiceConnected] = useState<boolean | null>(null);
    const [hasToken, setHasToken] = useState<boolean>(false);
    const [configuring, setConfiguring] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    
    // Local state for editable fields
    const [lyrics, setLyrics] = useState(project.optimizedLyrics || project.originalLyrics);
    const [stylePrompt, setStylePrompt] = useState(project.sunoPrompt);
    const [musicType, setMusicType] = useState<'vocal' | 'instrumental'>('vocal');
    const [model, setModel] = useState('chirp-crow'); // V5 默认
    
    // Audio playback state
    const [playingId, setPlayingId] = useState<string | null>(null);

    // 检测 suno-api-private 服务状态
    const checkService = () => {
        vscode.postMessage({ type: 'checkSunoService' });
    };

    useEffect(() => {
        checkService();
    }, []);

    // Listen for messages from extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'sunoServiceStatus':
                    setServiceConnected(message.data.connected);
                    setHasToken(message.data.hasToken);
                    break;
                case 'tokenConfigured':
                    setConfiguring(false);
                    if (message.data.success) {
                        checkService();
                    }
                    break;
                case 'audioGenerated':
                    setLoading(false);
                    if (message.data && message.data.length > 0) {
                        const currentGenerations = project.audioGenerations || [];
                        updateProject({ 
                            audioGenerations: [...message.data, ...currentGenerations] 
                        });
                    }
                    break;
                case 'error':
                    setLoading(false);
                    setError(message.data.message);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [project.audioGenerations, updateProject]);

    // Sync from other views
    const syncLyrics = () => {
        const latest = project.optimizedLyrics || project.originalLyrics;
        setLyrics(latest);
    };

    const syncStylePrompt = () => {
        setStylePrompt(project.sunoPrompt);
    };

    // Generate music
    const handleGenerate = async () => {
        if (!lyrics.trim()) {
            setError('请输入歌词内容');
            return;
        }

        setLoading(true);
        setError('');

        try {
            vscode.postMessage({
                type: 'generateAudio',
                payload: {
                    prompt: lyrics.trim(),
                    tags: stylePrompt.trim(),
                    title: project.songTitle || '未命名',
                    makeInstrumental: musicType === 'instrumental',
                    model: model
                }
            });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Audio controls
    const togglePlay = (id: string, url: string) => {
        if (playingId === id) {
            setPlayingId(null);
            // Pause audio
        } else {
            setPlayingId(id);
            // Play audio
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => setPlayingId(null);
        }
    };

    const toggleLike = (id: string) => {
        const updated = project.audioGenerations?.map(gen =>
            gen.id === id ? { ...gen, liked: !gen.liked } : gen
        );
        updateProject({ audioGenerations: updated });
    };

    const downloadAudio = (url: string, title: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.mp3`;
        a.click();
    };

    const deleteGeneration = (id: string) => {
        const updated = project.audioGenerations?.filter(gen => gen.id !== id);
        updateProject({ audioGenerations: updated });
    };

    const generations = project.audioGenerations || [];

    return (
        <div className="p-6 animate-fade-in h-full flex flex-col gap-4 overflow-hidden">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-textMain tracking-tight flex items-center gap-3">
                    <Music className="text-primary" size={24} />
                    Audio Generator
                </h2>
                <p className="text-textMuted text-sm">使用 Suno AI 生成完整音乐作品</p>
            </div>

            {/* 服务未连接提示 */}
            {serviceConnected === false && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h3 className="text-yellow-400 font-bold text-sm mb-2 flex items-center gap-2">
                                {hasToken ? 'Suno 服务未启动' : '需要配置 Suno Token'}
                                <button
                                    onClick={() => setShowHelp(true)}
                                    className="text-yellow-400/60 hover:text-yellow-400 transition-colors"
                                    title="查看详细教程"
                                >
                                    <HelpCircle size={16} />
                                </button>
                            </h3>
                            
                            {!hasToken ? (
                                <>
                                    <p className="text-yellow-200/80 text-xs mb-3">
                                        首次使用需要从浏览器获取 Token。只需配置一次（Token 过期后需重新配置）。
                                    </p>
                                    <button
                                        onClick={() => {
                                            setConfiguring(true);
                                            vscode.postMessage({ type: 'configureSunoToken' });
                                        }}
                                        disabled={configuring}
                                        className="text-sm flex items-center gap-2 text-white bg-primary hover:bg-primaryHover px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <Sparkles size={14} />
                                        {configuring ? '配置中...' : '配置 Token'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-yellow-200/80 text-xs mb-3">
                                        Token 已配置，点击下方按钮启动服务。
                                    </p>
                                    <button
                                        onClick={() => {
                                            vscode.postMessage({ type: 'startSunoService' });
                                        }}
                                        className="text-sm flex items-center gap-2 text-white bg-primary hover:bg-primaryHover px-4 py-2 rounded-lg transition-colors"
                                    >
                                        <Play size={14} />
                                        启动 Suno 服务
                                    </button>
                                </>
                            )}
                            
                            <div className="flex gap-2 mt-3">
                                <a 
                                    href="https://suno.com/create" 
                                    target="_blank"
                                    className="text-xs flex items-center gap-1 text-textMuted hover:text-primary transition-colors"
                                >
                                    <ExternalLink size={12} /> 打开 Suno
                                </a>
                                <button
                                    onClick={checkService}
                                    className="text-xs flex items-center gap-1 text-textMuted hover:text-secondary transition-colors"
                                >
                                    <RefreshCw size={12} /> 刷新状态
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 帮助弹窗 */}
            {showHelp && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                                <HelpCircle size={20} className="text-primary" />
                                如何获取 Suno Token
                            </h3>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="text-textMuted hover:text-textMain transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto custom-scrollbar space-y-4 text-sm">
                            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                                <p className="text-primary font-medium">⏱️ 预计耗时：2-3 分钟（首次配置）</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">1</span>
                                    <div>
                                        <p className="text-textMain font-medium">打开 Suno 网站并登录</p>
                                        <p className="text-textMuted text-xs mt-1">访问 <a href="https://suno.com/create" target="_blank" className="text-primary hover:underline">suno.com/create</a>，使用你的账号登录</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">2</span>
                                    <div>
                                        <p className="text-textMain font-medium">打开浏览器开发者工具</p>
                                        <p className="text-textMuted text-xs mt-1">按 <kbd className="px-1.5 py-0.5 bg-surfaceHighlight rounded text-textMain">F12</kbd> 或右键 → 检查</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">3</span>
                                    <div>
                                        <p className="text-textMain font-medium">切换到 Network（网络）标签</p>
                                        <p className="text-textMuted text-xs mt-1">在开发者工具顶部找到 "Network" 或 "网络" 标签并点击</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">4</span>
                                    <div>
                                        <p className="text-textMain font-medium">刷新页面</p>
                                        <p className="text-textMuted text-xs mt-1">按 <kbd className="px-1.5 py-0.5 bg-surfaceHighlight rounded text-textMain">F5</kbd> 或点击浏览器刷新按钮</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">5</span>
                                    <div>
                                        <p className="text-textMain font-medium">找到 API 请求</p>
                                        <p className="text-textMuted text-xs mt-1">在请求列表中找到包含 <code className="px-1 py-0.5 bg-surfaceHighlight rounded text-primary">studio-api.prod.suno.com</code> 的请求，点击它</p>
                                        <p className="text-textMuted text-xs mt-1">💡 提示：可以在筛选框输入 "studio-api" 快速查找</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">6</span>
                                    <div>
                                        <p className="text-textMain font-medium">复制 Cookie</p>
                                        <p className="text-textMuted text-xs mt-1">点击请求 → Headers（标头）→ 找到 <code className="px-1 py-0.5 bg-surfaceHighlight rounded text-yellow-400">Cookie</code> → 复制整个值</p>
                                        <div className="bg-black/30 rounded p-2 mt-2 text-xs font-mono text-gray-400 break-all">
                                            __client=xxx; __session=eyJhbGci...; ajs_anonymous_id=xxx
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">7</span>
                                    <div>
                                        <p className="text-textMain font-medium">复制 JWT Token</p>
                                        <p className="text-textMuted text-xs mt-1">在同一个 Headers 中找到 <code className="px-1 py-0.5 bg-surfaceHighlight rounded text-yellow-400">Authorization</code> → 复制 "Bearer " 后面的部分</p>
                                        <div className="bg-black/30 rounded p-2 mt-2 text-xs font-mono text-gray-400 break-all">
                                            Bearer <span className="text-green-400">eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...</span>
                                        </div>
                                        <p className="text-textMuted text-xs mt-1">⚠️ 只复制绿色部分，不要包含 "Bearer "</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs">
                                <p className="text-yellow-400 font-medium mb-1">⚠️ 注意事项</p>
                                <ul className="text-yellow-200/80 space-y-1 list-disc list-inside">
                                    <li>Token 会在几小时到几天后过期，届时需要重新获取</li>
                                    <li>出现 401 错误时说明 Token 已过期</li>
                                    <li>请勿分享你的 Token，它等同于你的账号密码</li>
                                </ul>
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/10">
                            <button
                                onClick={() => setShowHelp(false)}
                                className="w-full py-2 bg-primary hover:bg-primaryHover text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                我知道了
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 服务已连接标识 */}
            {serviceConnected === true && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Suno 服务已连接 (localhost:3001)
                </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
                {/* Left Panel: Input Controls */}
                <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    
                    {/* Lyrics Input */}
                    <div className="glass-panel rounded-xl p-4 border-white/5 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-textMuted flex items-center gap-2">
                                📝 歌词内容
                            </label>
                            <button
                                onClick={syncLyrics}
                                className="text-xs flex items-center gap-1 text-primary hover:text-primaryHover px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                                title="从 Lyrics Studio 同步最新歌词"
                            >
                                <RefreshCw size={10} /> 同步
                            </button>
                        </div>
                        <textarea
                            value={lyrics}
                            onChange={(e) => setLyrics(e.target.value)}
                            className="w-full bg-surfaceHighlight/50 border border-white/5 rounded-md px-3 py-2 text-sm text-textMain placeholder-textMuted/40 focus:border-primary/50 outline-none font-mono resize-none custom-scrollbar"
                            placeholder="输入或粘贴歌词..."
                            rows={8}
                            style={{ height: '160px' }}
                        />
                        <div className="text-xs text-textMuted/50 mt-1 text-right">
                            {lyrics.length} 字符
                        </div>
                    </div>

                    {/* Style Prompt Input */}
                    <div className="glass-panel rounded-xl p-4 border-white/5 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-textMuted flex items-center gap-2">
                                🎵 Suno 风格提示词
                            </label>
                            <button
                                onClick={syncStylePrompt}
                                className="text-xs flex items-center gap-1 text-secondary hover:text-emerald-400 px-2 py-1 rounded bg-secondary/10 hover:bg-secondary/20 transition-colors"
                                title="从 Style Director 同步生成的 Prompt"
                            >
                                <RefreshCw size={10} /> 同步
                            </button>
                        </div>
                        <textarea
                            value={stylePrompt}
                            onChange={(e) => setStylePrompt(e.target.value)}
                            className="w-full bg-surfaceHighlight/50 border border-white/5 rounded-md px-3 py-2 text-sm text-textMain placeholder-textMuted/40 focus:border-primary/50 outline-none resize-none custom-scrollbar"
                            placeholder="例如: aggressive hip-hop, dark trap beat, 808 bass..."
                            rows={4}
                            style={{ height: '96px' }}
                        />
                        <div className="text-xs text-textMuted/50 mt-1">
                            建议 50-150 字符，描述音乐风格、节奏、乐器等
                        </div>
                    </div>

                    {/* Generation Options */}
                    <div className="glass-panel rounded-xl p-4 border-white/5 space-y-3">
                        <label className="text-xs font-bold text-textMuted block">⚙️ 生成选项</label>
                        
                        {/* Music Type Toggle */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMusicType('vocal')}
                                className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                    musicType === 'vocal'
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'bg-surfaceHighlight text-textMuted hover:bg-white/5'
                                }`}
                            >
                                🎤 人声版
                            </button>
                            <button
                                onClick={() => setMusicType('instrumental')}
                                className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                    musicType === 'instrumental'
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'bg-surfaceHighlight text-textMuted hover:bg-white/5'
                                }`}
                            >
                                🎹 纯音乐
                            </button>
                        </div>

                        {/* Model Selection */}
                        <div>
                            <label className="text-xs text-textMuted mb-1 block">模型版本</label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full bg-surfaceHighlight border border-white/5 rounded-md px-3 py-2 text-sm text-textMain focus:border-primary/50 outline-none"
                            >
                                <option value="chirp-v3-5">V3.5 (稳定)</option>
                                <option value="chirp-v4">V4</option>
                                <option value="chirp-bluejay">V4.5+ 蓝松鸦</option>
                                <option value="chirp-auk">V4.5 Pro 海雀</option>
                                <option value="chirp-crow">V5 乌鸦 (推荐)</option>
                            </select>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !lyrics.trim()}
                        className={`py-3 bg-primary hover:bg-primaryHover text-white font-medium rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 ${
                            loading ? 'opacity-50 cursor-wait' : 'active:scale-95'
                        }`}
                    >
                        <Sparkles size={16} className={loading ? 'animate-spin' : ''} />
                        {loading ? '生成中...' : '🎵 生成音乐'}
                    </button>
                </div>

                {/* Right Panel: Generation History */}
                <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-textMuted uppercase tracking-wider">
                            🎼 生成历史
                        </label>
                        <span className="text-xs text-textMuted/50">
                            {generations.length} 首作品
                        </span>
                    </div>

                    {generations.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-textMuted/50 gap-4">
                            <div className="w-24 h-24 rounded-2xl bg-surfaceHighlight/30 border border-white/5 flex items-center justify-center">
                                <Music size={48} className="opacity-30" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm">暂无生成记录</p>
                                <p className="text-xs opacity-60 mt-1">点击「生成音乐」开始创作</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {generations.map((gen) => (
                                <div
                                    key={gen.id}
                                    className="glass-panel rounded-xl p-4 border-white/5 hover:border-primary/20 transition-all group"
                                >
                                    {/* Cover Image */}
                                    {gen.imageUrl && (
                                        <div className="w-full h-32 rounded-lg overflow-hidden mb-3 bg-surfaceHighlight">
                                            <img
                                                src={gen.imageUrl}
                                                alt={gen.title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    {/* Title & Status */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-textMain truncate">
                                                {gen.title}
                                            </h4>
                                            <p className="text-xs text-textMuted mt-0.5">
                                                {gen.model || 'V3.5'} • {new Date(gen.createdAt).toLocaleString('zh-CN')}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded ${
                                                gen.status === 'complete'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : gen.status === 'error'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                            }`}
                                        >
                                            {gen.status === 'complete' ? '✓' : gen.status === 'error' ? '✗' : '⏳'}
                                        </span>
                                    </div>

                                    {/* Controls */}
                                    {gen.status === 'complete' && gen.audioUrl && (
                                        <div className="flex items-center gap-2 mt-3">
                                            <button
                                                onClick={() => togglePlay(gen.id, gen.audioUrl)}
                                                className="flex-1 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2"
                                            >
                                                {playingId === gen.id ? (
                                                    <>
                                                        <Pause size={12} /> 暂停
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play size={12} /> 播放
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => toggleLike(gen.id)}
                                                className={`p-2 rounded-md transition-all ${
                                                    gen.liked
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : 'bg-surfaceHighlight text-textMuted hover:bg-white/5'
                                                }`}
                                            >
                                                <Heart size={14} fill={gen.liked ? 'currentColor' : 'none'} />
                                            </button>
                                            <button
                                                onClick={() => downloadAudio(gen.audioUrl, gen.title)}
                                                className="p-2 bg-surfaceHighlight text-textMuted hover:bg-white/5 rounded-md transition-all"
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteGeneration(gen.id)}
                                                className="p-2 bg-surfaceHighlight text-textMuted hover:bg-red-500/20 hover:text-red-400 rounded-md transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
