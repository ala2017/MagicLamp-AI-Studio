
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CapabilityNode, LearnerProfile, LearningMethod, Chapter, KnowledgeAsset } from './types';
import { modelChapterToGraph } from './services/geminiService';
import { speakText, AudioRecorder } from './services/voiceService';
import CapabilityGraph from './components/CapabilityGraph';
import UnitPlayer from './components/UnitPlayer';
import { 
  Sparkles, Plus, Search, Loader2, Upload, ChevronRight, Library, 
  BrainCircuit, FileText, Clock, Trash2, ArrowRight, CheckCircle, 
  LayoutDashboard, Star, Map as MapIcon, Mic, Volume2
} from 'lucide-react';

const INITIAL_PROFILE: LearnerProfile = {
  user_id: '用户_1',
  capabilities_state: {},
  learning_style: { pacing: 'intensive', preferred_methodology: 'ai_adaptive' }
};

const App: React.FC = () => {
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [profile, setProfile] = useState<LearnerProfile>(INITIAL_PROFILE);
  const [activeNode, setActiveNode] = useState<CapabilityNode | null>(null);
  const [view, setView] = useState<'dashboard' | 'library' | 'learning'>('dashboard');
  const [isModeling, setIsModeling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAsset = assets.find(a => a.id === activeAssetId);

  const handleComplete = useCallback((nodeId: string, mastery: number) => {
    setProfile(prev => ({
      ...prev,
      capabilities_state: {
        ...prev.capabilities_state,
        [nodeId]: {
          ...(prev.capabilities_state[nodeId] || { 
            stability: 1, 
            last_review: new Date().toISOString(), 
            error_patterns: [] 
          }),
          mastery_score: mastery,
          last_review: new Date().toISOString(),
        }
      }
    }));
    setView('dashboard');
    speakText("能力内化完成，已同步至能力地图。");
  }, []);

  const splitContentLocally = useCallback((text: string): Chapter[] => {
    const lines = text.split('\n');
    let rawChapters: { title: string; content: string[] }[] = [];
    let currentContent: string[] = [];
    let currentTitle = "大师入门：核心概览";
    const majorHeaderPattern = /^(?:第[一二三四五六七八九十百\d]+[章节部分单元])/;
    const markdownHeaderPattern = /^#{1,2}\s+(.*)$/;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (majorHeaderPattern.test(trimmed) || markdownHeaderPattern.test(trimmed)) {
        if (currentContent.length > 0) rawChapters.push({ title: currentTitle, content: [...currentContent] });
        currentTitle = trimmed.replace(/#/g, '').trim();
        currentContent = [];
      } else { currentContent.push(line); }
    }
    if (currentContent.length > 0) rawChapters.push({ title: currentTitle, content: currentContent });
    return rawChapters.map((raw, i) => ({ index: i, title: raw.title, content: raw.content.join('\n'), status: i === 0 ? 'processing' : 'locked' }));
  }, []);

  useEffect(() => {
    if (!activeAssetId || isModeling) return;
    const currentAsset = assets.find(a => a.id === activeAssetId);
    if (!currentAsset) return;
    const targetChapter = currentAsset.chapters.find(c => c.status === 'processing');
    if (!targetChapter) return;

    const performDeconstruction = async () => {
      setIsModeling(true);
      try {
        const newNodes = await modelChapterToGraph(targetChapter.content, targetChapter.index, currentAsset.nodes);
        setAssets(prev => prev.map(a => {
          if (a.id === activeAssetId) {
            const updatedNodes = [...a.nodes, ...newNodes];
            if (updatedNodes.length > 0 && !activeNode) setActiveNode(updatedNodes[0]);
            return { ...a, nodes: updatedNodes, chapters: a.chapters.map(c => c.index === targetChapter.index ? { ...c, status: 'ready' } : c) };
          }
          return a;
        }));
      } finally { setIsModeling(false); }
    };
    performDeconstruction();
  }, [assets, activeAssetId, isModeling, activeNode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const chapters = splitContentLocally(text);
    const newAsset: KnowledgeAsset = {
      id: `资料_${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      type: '能力资料',
      date: new Date().toLocaleDateString('zh-CN'),
      chapters,
      nodes: []
    };
    setAssets(prev => [newAsset, ...prev]);
    setActiveAssetId(newAsset.id);
    setView('dashboard');
    speakText(`《${newAsset.name}》导入成功，正在拆解大师思维。`);
  };

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased overflow-hidden">
      {/* 侧边导航 */}
      <aside className="w-72 border-r bg-white flex flex-col z-30 border-slate-200 shadow-sm">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="font-black text-base text-slate-900 leading-tight">神灯AI·大师学习精灵</h1>
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">小白变大师·实战进阶系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide mt-4">
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-black text-sm transition-all ${view === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <LayoutDashboard size={18} /> 能力通关中心
          </button>
          <button onClick={() => setView('library')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-black text-sm transition-all ${view === 'library' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Library size={18} /> 资料库
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col bg-[#F8FAFC]">
        {/* Header 仅保留基本的占位与隐藏文件入口，移除搜索栏 */}
        <header className="h-20 flex items-center px-10 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-20">
          <div className="text-xs font-black text-slate-300 uppercase tracking-widest">
            {view === 'dashboard' ? '能力实战大厅' : '资料管理中心'}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} />
        </header>

        {view === 'dashboard' && (
          <div className="flex-1 flex flex-col p-8 overflow-hidden">
            {activeAsset ? (
              <div className="h-full flex flex-col gap-6">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
                      《{activeAsset.name}》实战地图
                      {isModeling && <Loader2 size={18} className="animate-spin text-indigo-500" />}
                    </h2>
                    <div className="flex gap-5 mt-2">
                      <span className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-widest"><Clock size={12}/> {activeAsset.date} 拆解</span>
                      <span className="text-[10px] font-black text-indigo-500 flex items-center gap-1 uppercase tracking-widest"><MapIcon size={12}/> {activeAsset.nodes.length} 个实战关卡</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex gap-8 min-h-0">
                  <div className="flex-[3] bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative neural-grid">
                    <CapabilityGraph nodes={activeAsset.nodes} profile={profile.capabilities_state} onNodeClick={setActiveNode} activeNodeId={activeNode?.id} />
                  </div>

                  <aside className="flex-[1.5] bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col glass-panel">
                    {activeNode ? (
                      <div className="p-10 flex flex-col h-full overflow-y-auto scrollbar-hide">
                        <span className="px-3 py-1 w-fit bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-[2px] mb-4">
                          {activeNode.type === 'concept' ? '基础认知' : activeNode.type === 'procedure' ? '操作流程' : '底层秘籍'}
                        </span>
                        <h4 className="text-2xl font-black text-slate-900 tracking-tighter leading-tight mb-10">{activeNode.name}</h4>

                        <div className="space-y-10 flex-1">
                          <section>
                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-[3px] mb-4 block">大师解决的问题</label>
                            <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl italic text-[14px] font-bold text-slate-700 leading-relaxed">
                              “{activeNode.expert_metadata.core_problem}”
                            </div>
                          </section>
                          <section>
                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-[3px] mb-4 block">通关进度</label>
                            <div className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-2xl">
                               <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                  <Star size={24} fill={profile.capabilities_state[activeNode.id]?.mastery_score >= 0.8 ? "currentColor" : "none"} />
                               </div>
                               <div>
                                  <p className="text-sm font-black text-slate-900">{Math.round((profile.capabilities_state[activeNode.id]?.mastery_score || 0) * 100)}% 掌握</p>
                                  <p className="text-[10px] font-bold text-slate-400">完成对话实操即通关</p>
                               </div>
                            </div>
                          </section>
                        </div>
                        <button onClick={() => setView('learning')} className="w-full py-5 mt-10 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3">
                          开始对话·实战内化 <ArrowRight size={20} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-200">
                        <BrainCircuit size={64} className="mb-6 opacity-10" />
                        <p className="text-sm font-black leading-relaxed">在左侧地图里点一个能力<br/>看看大师是怎么操作的</p>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-20 animate-in fade-in">
                <div className="w-24 h-24 bg-indigo-50 border border-indigo-100 rounded-[32px] flex items-center justify-center text-indigo-600 mb-10 float-anim shadow-xl shadow-indigo-50">
                  <Star size={40} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter text-center">把书里的本事，变成你自己的能力</h2>
                <p className="text-slate-500 max-w-lg text-center text-base font-bold leading-relaxed mb-12">
                  读一百遍书不如练一遍。丢进一份文档，我会帮你拆出大师的实战地图，然后带你练透、讲透，直到你彻底掌握。
                </p>
                <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-lg shadow-2xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-4">
                  <Plus strokeWidth={4} /> 导入资料
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'library' && (
          <div className="p-16 h-full overflow-y-auto bg-white">
             <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-16">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter">能力资料库</h2>
                    <p className="text-slate-400 text-sm font-bold mt-1">管理你导入的所有实战资料</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all">
                    <Plus size={14} /> 导入新资料
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {assets.map(a => (
                    <div key={a.id} onClick={() => { setActiveAssetId(a.id); setView('dashboard'); }} className="p-8 bg-slate-50 border border-slate-100 rounded-[40px] shadow-sm hover:border-indigo-600 cursor-pointer transition-all group relative">
                       <FileText className="mb-6 text-indigo-600 group-hover:scale-110 transition-transform" size={40} />
                       <h3 className="font-black text-lg text-slate-900 truncate mb-3">{a.name}</h3>
                       <p className="text-[10px] font-black text-slate-400 mb-10 flex items-center gap-2 uppercase tracking-widest"><Clock size={12}/> {a.date} 录入</p>
                       <div className="flex justify-between items-center">
                          <span className="bg-white px-4 py-2 rounded-xl text-[10px] font-black text-slate-500 border border-slate-100">已载入</span>
                          <button onClick={(e) => { e.stopPropagation(); setAssets(prev => prev.filter(x => x.id !== a.id)); }} className="w-10 h-10 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center text-slate-200"><Trash2 size={18} /></button>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}
      </main>

      {view === 'learning' && activeNode && (
        <UnitPlayer node={activeNode} method={profile.learning_style.preferred_methodology} onComplete={handleComplete} onBack={() => setView('dashboard')} />
      )}
    </div>
  );
};

export default App;
