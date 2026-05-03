import React, { useState } from 'react';
import { Music, Sliders, Image as ImageIcon, Mic2, FileAudio, Video, Activity, Maximize2 } from 'lucide-react';
import { ViewName, ProjectState, CreativeBrief, DEFAULT_LYRICS, DEFAULT_BRIEF } from './types';
import { SidebarItem } from './components/SidebarItem';
import { LyricsView } from './views/LyricsView';
import { StyleView } from './views/StyleView';
import { AudioGeneratorView } from './views/AudioGeneratorView';
import { ArtworkView } from './views/ArtworkView';
import { AudioAnalysisView } from './views/AudioAnalysisView';
import { MVGeneratorView } from './views/MVGeneratorView';
import { SettingsView } from './views/SettingsView';

// --- Main Layout ---
function App() {
    const [activeView, setActiveView] = useState<ViewName>('lyrics');

    // ========== 全局项目状态 (流程式工作流核心) ==========
    const [project, setProject] = useState<ProjectState>({
        songTitle: '他们说',
        version: 1,
        originalLyrics: DEFAULT_LYRICS,
        optimizedLyrics: '',
        brief: DEFAULT_BRIEF,
        sunoPrompt: '',
        styleAnalysis: '',
        coverPrompt: '',
        generatedCoverUrl: null,
        audioGenerations: []
    });

    // 更新项目状态的便捷方法
    const updateProject = (updates: Partial<ProjectState>) => {
        setProject(prev => ({ ...prev, ...updates }));
    };

    const updateBrief = (updates: Partial<CreativeBrief>) => {
        setProject(prev => ({
            ...prev,
            brief: { ...prev.brief, ...updates }
        }));
    };

    const renderContent = () => {
        switch (activeView) {
            case 'lyrics': return <LyricsView project={project} updateProject={updateProject} updateBrief={updateBrief} />;
            case 'style': return <StyleView project={project} updateProject={updateProject} />;
            case 'audio': return <AudioGeneratorView project={project} updateProject={updateProject} />;
            case 'artwork': return <ArtworkView project={project} updateProject={updateProject} />;
            case 'settings': return <SettingsView />;
            case 'audio-analysis': return <AudioAnalysisView project={project} updateProject={updateProject} />;
            case 'mv-generation': return <MVGeneratorView project={project} updateProject={updateProject} />;
            case 'mastering': // Fallthrough for WIP
            case 'export': // Fallthrough for WIP
            default: return (
                <div className="h-full flex flex-col items-center justify-center text-textMuted animate-fade-in relative z-20">
                    <div className="w-20 h-20 rounded-2xl bg-surfaceHighlight/50 border border-white/5 flex items-center justify-center mb-6 shadow-2xl backdrop-blur-sm">
                        <Sliders size={40} className="opacity-30" />
                    </div>
                    <h3 className="text-xl font-medium text-textMain mb-2">Work in Progress</h3>
                    <p className="text-sm opacity-50">The "{activeView}" module is coming in the next update.</p>
                </div>
            );
        }
    };

    return (
        <div className="flex h-screen w-screen bg-background text-textMain overflow-hidden font-sans selection:bg-primary/30 selection:text-white">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/5 bg-surface flex flex-col flex-shrink-0 z-50 shadow-2xl">
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-white/10">
                            <Music size={18} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">Magic Lamp</h1>
                            <p className="text-[10px] text-textMuted font-medium tracking-wider uppercase opacity-70">Music Studio</p>
                        </div>
                        <button
                            onClick={() => {
                                // @ts-ignore
                                if (typeof vscode !== 'undefined') {
                                    // @ts-ignore
                                    vscode.postMessage({ type: 'toggleZenMode' });
                                }
                            }}
                            className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-textMuted hover:text-white transition-colors"
                            title="全屏模式 (Zen Mode)"
                        >
                            <Maximize2 size={14} />
                        </button>
                    </div>

                    {/* Project Status Snippet */}
                    <div className="px-3 py-2 bg-surfaceHighlight/30 rounded-lg border border-white/5">
                        <div className="text-[10px] text-textMuted uppercase tracking-wider mb-1">Current Project</div>
                        <div className="text-xs font-bold text-white truncate">{project.songTitle}</div>
                        <div className="text-[10px] text-primary mt-1">v{project.version} • {project.brief.emotion[0] || 'Unset'}</div>
                    </div>
                </div>

                <div className="flex-1 py-4 overflow-y-auto custom-scrollbar space-y-1">
                    <div className="px-4 pb-2">
                        <p className="text-[10px] font-bold text-textMuted uppercase tracking-widest opacity-50">Workflow</p>
                    </div>
                    <SidebarItem icon={Mic2} label="Lyrics Studio" active={activeView === 'lyrics'} onClick={() => setActiveView('lyrics')} />
                    <SidebarItem icon={Music} label="Style Director" active={activeView === 'style'} onClick={() => setActiveView('style')} />
                    <SidebarItem icon={FileAudio} label="Audio Generator" active={activeView === 'audio'} onClick={() => setActiveView('audio')} />

                    <div className="my-2 border-t border-white/5 mx-4" />
                    <div className="px-4 py-1">
                        <p className="text-[10px] font-bold text-textMuted uppercase tracking-widest opacity-50">Post-Prod</p>
                    </div>
                    <SidebarItem icon={Activity} label="Audio Analysis" active={activeView === 'audio-analysis'} onClick={() => setActiveView('audio-analysis')} />
                    <SidebarItem icon={Sliders} label="Mastering" active={activeView === 'mastering'} onClick={() => setActiveView('mastering')} />
                    <SidebarItem icon={ImageIcon} label="Artwork Gen" active={activeView === 'artwork'} onClick={() => setActiveView('artwork')} />
                    <SidebarItem icon={Video} label="MV Director" active={activeView === 'mv-generation'} onClick={() => setActiveView('mv-generation')} />

                    <div className="my-2 border-t border-white/5 mx-4" />
                    <SidebarItem icon={Sliders} label="Export / Publish" active={activeView === 'export'} onClick={() => setActiveView('export')} />
                    <SidebarItem icon={Sliders} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} />
                </div>

                <div className="p-4 border-t border-white/5 bg-surfaceHighlight/5">
                    <div className="text-[10px] text-textMuted text-center opacity-40 hover:opacity-100 transition-opacity cursor-default">
                        GenAI Powered by NVIDIA NIM<br />
                        v1.2.0 (Phase 2)
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-background relative overflow-hidden flex flex-col">
                {/* Background Effects */}
                <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

                {renderContent()}
            </div>
        </div>
    );
}

export default App;
