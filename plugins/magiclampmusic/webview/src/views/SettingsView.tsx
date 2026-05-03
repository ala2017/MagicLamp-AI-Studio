import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Download, Cpu } from 'lucide-react';
import { loadPrompt, getAvailableModels, PromptConfig } from '../services/promptService';

// 算法列表
const ALGORITHMS = [
    { id: 'lyrics-optimize', name: '歌词润色', description: '优化歌词押韵、情感表达' },
    { id: 'style-match', name: '风格匹配', description: '分析歌词生成 Suno 提示词' },
    { id: 'cover-suggest', name: '封面创意', description: '生成 FLUX 封面提示词' },
    { id: 'mv-script-gen', name: 'MV 脚本', description: '生成分镜脚本' },
    { id: 'suno-prompt-gen', name: 'Suno Prompt', description: '生成音乐提示词' }
];

export const SettingsView = () => {
    const [selectedAlgoId, setSelectedAlgoId] = useState<string>('lyrics-optimize');
    const [config, setConfig] = useState<PromptConfig | null>(null);
    const [editedConfig, setEditedConfig] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const models = getAvailableModels();

    // 加载选中的算法配置
    useEffect(() => {
        loadAlgorithmConfig(selectedAlgoId);
    }, [selectedAlgoId]);

    const loadAlgorithmConfig = async (id: string) => {
        setLoading(true);
        try {
            const cfg = await loadPrompt(id);
            setConfig(cfg);
            setEditedConfig(JSON.stringify(cfg, null, 4));
        } catch (e) {
            console.error('Failed to load config:', e);
        } finally {
            setLoading(false);
        }
    };

    // 重置为原始配置
    const handleReset = () => {
        if (config) {
            setEditedConfig(JSON.stringify(config, null, 4));
        }
    };

    // 导出配置
    const handleExport = () => {
        const blob = new Blob([editedConfig], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedAlgoId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 animate-fade-in h-full flex flex-col gap-4 overflow-hidden">
            <div>
                <h2 className="text-2xl font-bold text-textMain tracking-tight flex items-center gap-3">
                    <Settings className="text-accent" size={24} />
                    Algorithm Settings
                </h2>
                <p className="text-textMuted text-sm">配置和微调核心 AI 算法参数</p>
            </div>

            <div className="flex-1 grid grid-cols-4 gap-4 min-h-0 overflow-hidden">
                {/* Left: Algorithm List */}
                <div className="col-span-1 flex flex-col gap-4 overflow-hidden">
                    {/* 算法列表 */}
                    <div className="glass-panel border-white/5 p-2 flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">
                        <label className="text-xs font-bold text-textMuted px-2 py-1">AI 算法</label>
                        {ALGORITHMS.map(algo => (
                            <button
                                key={algo.id}
                                onClick={() => setSelectedAlgoId(algo.id)}
                                className={`text-left p-3 rounded-lg transition-all border ${
                                    selectedAlgoId === algo.id
                                        ? 'bg-accent/10 border-accent/30 text-accent'
                                        : 'hover:bg-white/5 border-transparent text-textMain'
                                }`}
                            >
                                <div className="font-bold text-sm mb-1">{algo.name}</div>
                                <div className="text-xs opacity-60 line-clamp-2">{algo.description}</div>
                            </button>
                        ))}
                    </div>

                    {/* 模型列表 */}
                    <div className="glass-panel border-white/5 p-3 flex-shrink-0">
                        <label className="text-xs font-bold text-textMuted flex items-center gap-2 mb-2">
                            <Cpu size={12} /> 可用模型
                        </label>
                        <div className="space-y-1">
                            {models.map(model => (
                                <div key={model.id} className="text-xs text-textMuted flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${model.recommended ? 'bg-green-400' : 'bg-gray-500'}`}></span>
                                    <span className="truncate">{model.name}</span>
                                    {model.recommended && <span className="text-green-400 text-[10px]">推荐</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Editor */}
                <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-textMuted">
                            加载配置中...
                        </div>
                    ) : config && (
                        <>
                            {/* 配置信息 */}
                            <div className="glass-panel border-white/5 p-3 flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h3 className="text-sm font-bold text-textMain">{config.name}</h3>
                                    <p className="text-xs text-textMuted">{config.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleReset}
                                        title="重置"
                                        className="p-2 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        title="导出 JSON"
                                        className="p-2 bg-primary hover:bg-primaryHover text-white rounded transition-colors shadow-lg"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* JSON 编辑器 */}
                            <div className="glass-panel border-white/5 p-0 flex-1 overflow-hidden flex flex-col">
                                <textarea
                                    value={editedConfig}
                                    onChange={(e) => setEditedConfig(e.target.value)}
                                    className="flex-1 w-full bg-[#1e1e1e] p-4 font-mono text-sm leading-relaxed text-gray-300 outline-none resize-none custom-scrollbar"
                                    spellCheck={false}
                                />
                            </div>

                            {/* 提示 */}
                            <div className="glass-panel rounded-lg p-3 border-yellow-500/20 bg-yellow-500/5 flex-shrink-0">
                                <p className="text-xs text-yellow-400/80">
                                    💡 提示：修改后点击"导出"下载 JSON 文件。当前版本配置内嵌在插件中，导出后可用于备份或分享。
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
