import React, { useState, useEffect } from 'react';
import { ViewProps, MVScript } from '../types';
import { Video, Wand2, Play, Plus, Clock, Camera, MonitorPlay, Sparkles, Languages } from 'lucide-react';
import { loadPrompt, interpolateTemplate, PromptConfig } from '../services/promptService';

import { callNvidiaChat } from '../services/aiService';

// Reusing same API call logic for now or could be imported if centralized

export const MVGeneratorView = ({ project, updateProject }: ViewProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);
    const [previewActive, setPreviewActive] = useState(false);

    useEffect(() => {
        loadPrompt('mv-script-gen').then(setPromptConfig);
    }, []);

    const generateScript = async () => {
        if (!promptConfig) return;
        setIsLoading(true);
        try {
            const userMsg = interpolateTemplate(promptConfig.userMessageTemplate, {
                lyrics: project.optimizedLyrics || project.originalLyrics,
                bpm: String(project.audioAnalysis?.bpm || 120),
                key: project.audioAnalysis?.key || 'C',
                customRequirement: "赛博朋克风格，霓虹闪烁，故障艺术效果"
            });
            const result = await callNvidiaChat(promptConfig.systemPrompt, userMsg);
            const jsonMatch = result.match(/---JSON---([\s\S]*?)---/i) || result.match(/{[\s\S]*}/);
            if (jsonMatch) {
                const scriptData = JSON.parse(jsonMatch[0].replace(/---JSON---/gi, '').replace(/---/g, '').trim()) as MVScript;
                updateProject({ mvScript: scriptData });
            }
        } catch (e) {
            console.error("Failed to generate MV script", e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 animate-fade-in h-full flex flex-col gap-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-textMain tracking-tight flex items-center gap-3">
                        <Video className="text-primary" size={24} />
                        MV Director
                    </h2>
                    <p className="text-textMuted text-sm">由 AI 驱动的分镜脚本生成与视频合成</p>
                </div>
                <button
                    onClick={generateScript}
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Wand2 size={16} className={isLoading ? "animate-spin" : ""} />
                    {isLoading ? "AI 导演构思中..." : "AI 生成分镜脚本"}
                </button>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left: Script Timeline */}
                <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 overflow-hidden">
                    <div className="flex-1 glass-panel rounded-2xl border-white/5 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <span className="text-xs font-bold text-textMuted uppercase tracking-widest flex items-center gap-2">
                                <Clock size={12} /> Timeline Script
                            </span>
                            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                {project.mvScript?.scenes.length || 0} Scenes Generated
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                            {project.mvScript?.scenes ? (
                                project.mvScript.scenes.map((scene, i) => (
                                    <div key={i} className="group relative glass-panel rounded-xl p-4 border-white/5 hover:border-primary/30 transition-all bg-surfaceHighlight/20">
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-bold mb-2">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 w-px bg-white/10" />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <div className="text-[10px] font-mono text-accent">{scene.timeStart} → {scene.timeEnd}</div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-1 hover:text-primary transition-colors"><Plus size={14} /></button>
                                                    </div>
                                                </div>
                                                <h4 className="text-sm font-medium text-white">{scene.description}</h4>
                                                <div className="text-[10px] text-textMuted font-mono bg-black/30 p-2 rounded border border-white/5 leading-relaxed">
                                                    <span className="text-primary/70 mr-1">PROMPT:</span> {scene.visualPrompt}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-accent/80">
                                                    <Camera size={10} />
                                                    {scene.cameraMovement}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-textMuted opacity-30 italic py-20">
                                    <Video size={48} className="mb-4" />
                                    <p>点击上方按钮生成 AI 分镜脚本</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Preview & Style */}
                <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                    {/* Preview Monitor */}
                    <div className="aspect-video rounded-2xl bg-black border border-white/10 relative overflow-hidden group shadow-2xl">
                        {previewActive ? (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black animate-pulse">
                                <Sparkles className="text-primary/40" size={64} />
                                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                                    <div className="text-[10px] text-primary font-bold uppercase tracking-widest mb-0.5">Preview Rendering</div>
                                    <div className="text-xs text-white font-mono tabular-nums">Scene 01 • 00:04.2</div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setPreviewActive(true)}>
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Play size={32} className="text-white fill-white" />
                                </div>
                                <span className="text-xs font-bold text-textMuted uppercase tracking-widest">Click to Preview Generated Scenes</span>
                            </div>
                        )}
                        <div className="absolute top-4 right-4 flex gap-2">
                            <div className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                            </div>
                        </div>
                    </div>

                    {/* Style Presets */}
                    <div className="glass-panel rounded-2xl p-6 border-white/5 space-y-4">
                        <h3 className="text-sm font-bold text-textMain flex items-center gap-2">
                            <MonitorPlay size={16} className="text-primary" />
                            Visual Preferences
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {['Cyberpunk', 'Cinematic', 'Anime', 'Vaporwave', 'Lo-Fi', 'Grainy Film'].map(style => (
                                <button key={style} className="px-4 py-3 rounded-xl bg-surfaceHighlight/30 border border-white/5 text-xs text-textMuted hover:border-primary/50 hover:text-white transition-all text-left">
                                    {style}
                                </button>
                            ))}
                        </div>
                        <div className="pt-4 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-textMuted uppercase font-bold tracking-wider">Language for Prompts</span>
                                <div className="flex bg-surfaceHighlight/50 rounded-lg p-1 border border-white/5">
                                    <button className="px-3 py-1 bg-primary text-white rounded-md text-[10px] font-bold">EN</button>
                                    <button className="px-3 py-1 text-textMuted rounded-md text-[10px] font-bold opacity-50">CN</button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-[10px] text-textMuted font-bold uppercase">Prompt Strength</div>
                                <input type="range" className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary" />
                            </div>
                        </div>
                    </div>

                    <button className="w-full py-4 bg-gradient-to-r from-secondary to-accent text-black font-black text-sm rounded-2xl shadow-xl shadow-secondary/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                        <Play size={18} className="fill-black" />
                        GENERATE FULL MV
                    </button>
                </div>
            </div>
        </div>
    );
};
