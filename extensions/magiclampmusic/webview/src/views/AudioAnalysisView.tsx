import React, { useState } from 'react';
import { ViewProps } from '../types';
import { Activity, Upload, FileAudio, BarChart3, Zap, Music2, Share2 } from 'lucide-react';

export const AudioAnalysisView = ({ project, updateProject }: ViewProps) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [fileUploaded, setFileUploaded] = useState(false);

    const handleFileUpload = () => {
        setFileUploaded(true);
        setIsAnalyzing(true);
        // Simulate deep analysis
        setTimeout(() => {
            setIsAnalyzing(false);
            updateProject({
                audioAnalysis: {
                    bpm: 128,
                    key: 'Cm',
                    energy: 0.85,
                    loudness: -8.4,
                    spectral_centroid: 2450
                }
            });
        }, 3000);
    };

    return (
        <div className="p-6 animate-fade-in h-full flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-bold text-textMain tracking-tight flex items-center gap-3">
                    <Activity className="text-primary" size={24} />
                    Audio Analysis
                </h2>
                <p className="text-textMuted text-sm">提取音频特征指纹，为后期处理和视频生成提供数据底座</p>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left side: Upload & Waveform */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    <div className={`flex-1 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-8 ${fileUploaded ? 'border-primary/30 bg-primary/5' : 'border-white/10 hover:border-primary/40 hover:bg-white/5'}`}>
                        {!fileUploaded ? (
                            <div className="text-center group cursor-pointer" onClick={handleFileUpload}>
                                <div className="w-16 h-16 rounded-full bg-surfaceHighlight/50 border border-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="text-primary opacity-50 group-hover:opacity-100" size={32} />
                                </div>
                                <h3 className="text-lg font-medium text-textMain mb-2">点击或拖拽音频文件</h3>
                                <p className="text-sm text-textMuted max-w-xs">支持 WAV, MP3, FLAC (最高 24-bit/96kHz)</p>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/20 rounded-lg">
                                            <FileAudio className="text-primary" size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{project.songTitle}.wav</div>
                                            <div className="text-[10px] text-textMuted uppercase tabular-nums">03:42 • 44.1kHz • 16-bit</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setFileUploaded(false)} className="text-xs text-textMuted hover:text-white transition-colors">移除文件</button>
                                </div>

                                {/* Mock Waveform */}
                                <div className="flex-1 bg-black/40 rounded-xl relative overflow-hidden flex items-center px-4">
                                    <div className="absolute inset-0 flex items-center justify-around gap-1 px-4 opacity-40">
                                        {Array.from({ length: 100 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-primary/50 rounded-full"
                                                style={{ height: `${20 + Math.random() * 60}%` }}
                                            />
                                        ))}
                                    </div>
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px] flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                <div className="text-xs font-bold text-primary animate-pulse tracking-widest uppercase">Deep Analyzing Samples...</div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Playback Progress Line */}
                                    {!isAnalyzing && <div className="absolute left-1/4 top-0 bottom-0 w-px bg-accent shadow-[0_0_10px_rgba(34,211,238,0.8)] z-10" />}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Spectral / Dynamics Visualization */}
                    <div className="h-48 glass-panel rounded-2xl p-6 border-white/5 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Spectral Distribution</div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5 text-[10px] text-textMuted font-medium"><div className="w-2 h-2 rounded-full bg-primary" /> Bass</div>
                                <div className="flex items-center gap-1.5 text-[10px] text-textMuted font-medium"><div className="w-2 h-2 rounded-full bg-accent" /> Mid</div>
                                <div className="flex items-center gap-1.5 text-[10px] text-textMuted font-medium"><div className="w-2 h-2 rounded-full bg-white/20" /> Treble</div>
                            </div>
                        </div>
                        <div className="h-24 flex items-end gap-1 px-2">
                            {Array.from({ length: 48 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 rounded-t-sm transition-all duration-500 ${i < 12 ? 'bg-primary/40' : i < 30 ? 'bg-accent/40' : 'bg-white/10'}`}
                                    style={{ height: isAnalyzing ? '5%' : `${30 + Math.sin(i * 0.2) * 50 + Math.random() * 20}%` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right side: Metrics */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                    <div className="glass-panel rounded-2xl p-6 border-white/5 space-y-6">
                        <h3 className="text-sm font-bold text-textMain flex items-center gap-2">
                            <BarChart3 size={16} className="text-primary" />
                            Audio Metadata
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <MetricCard label="BPM" value={project.audioAnalysis?.bpm || 0} unit="Tempo" icon={Zap} />
                            <MetricCard label="Key" value={project.audioAnalysis?.key || '--'} unit="Root" icon={Music2} />
                            <MetricCard label="Loudness" value={project.audioAnalysis?.loudness ? `${project.audioAnalysis.loudness} dB` : '--'} unit="LUFS" />
                            <MetricCard label="Energy" value={project.audioAnalysis?.energy ? `${(project.audioAnalysis.energy * 100).toFixed(0)}%` : '--'} unit="Intensity" />
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] text-textMuted font-bold uppercase tracking-wider">
                                    <span>Vocal Presence</span>
                                    <span>84%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-[84%] rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] text-textMuted font-bold uppercase tracking-wider">
                                    <span>Harmonic Density</span>
                                    <span>62%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-accent w-[62%] rounded-full" />
                                </div>
                            </div>
                        </div>

                        <button
                            disabled={!fileUploaded || isAnalyzing}
                            className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all border flex items-center justify-center gap-2 ${fileUploaded && !isAnalyzing ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 hover:scale-[1.02]' : 'bg-surfaceHighlight/20 border-white/5 text-textMuted opacity-50'}`}
                        >
                            <Share2 size={16} />
                            导出分析报告 (.json)
                        </button>
                    </div>

                    <div className="flex-1 glass-panel rounded-2xl p-6 border-white/5 bg-gradient-to-br from-primary/5 to-transparent">
                        <div className="text-xs font-bold text-primary mb-3 uppercase tracking-widest">AI Insights</div>
                        <p className="text-sm text-textMain/80 leading-relaxed italic">
                            "这段音频具有强烈的攻击性低音(808)和清亮的高频打击乐，情感曲线在 01:24 处达到顶点，非常适合配合具有快速镜头切变的视觉效果。"
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, unit, icon: Icon }: any) => (
    <div className="p-3 rounded-xl bg-surfaceHighlight/30 border border-white/5">
        <div className="flex items-center gap-1.5 mb-1">
            {Icon && <Icon size={12} className="text-primary opacity-60" />}
            <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-xl font-bold text-white tabular-nums">{value}</div>
        <div className="text-[9px] text-textMuted font-medium uppercase mt-0.5">{unit}</div>
    </div>
);
