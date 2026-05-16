
import React, { useState, useEffect, useRef } from 'react';
import { CapabilityNode, PlayerStep, LearningMethod } from '../types';
import { generateAwakening, generateExpertInteraction, evaluateExpertise } from '../services/geminiService';
import { speakText, stopSpeaking, voiceManager, AudioRecorder } from '../services/voiceService';
import { Send, ChevronRight, Zap, ArrowLeft, Loader2, GraduationCap, BrainCircuit, Heart, Mic, Volume2, Square, VolumeX } from 'lucide-react';
import { marked } from 'marked';

interface UnitPlayerProps {
  node: CapabilityNode;
  method: LearningMethod;
  onComplete: (nodeId: string, mastery: number) => void;
  onBack: () => void;
}

const UnitPlayer: React.FC<UnitPlayerProps> = ({ node, method, onComplete, onBack }) => {
  const [step, setStep] = useState<PlayerStep>(PlayerStep.AWAKENING);
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const speakingCheckRef = useRef<number>(0);

  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    speakingCheckRef.current = window.setInterval(() => {
      setIsSpeaking(voiceManager.isSpeaking);
    }, 200);

    return () => {
      window.clearInterval(speakingCheckRef.current);
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (step === PlayerStep.AWAKENING) {
      const init = async () => {
        setIsLoading(true);
        const text = await generateAwakening(node);
        setContent(text);
        setIsLoading(false);
        speakText(text);
      };
      init();
    }
  }, [node, step]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleToggleSpeak = (text: string) => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speakText(text);
    }
  };

  const handleNext = async () => {
    stopSpeaking();
    if (step === PlayerStep.AWAKENING) setStep(PlayerStep.MODELING);
    else if (step === PlayerStep.MODELING) {
      setStep(PlayerStep.REASONING);
      setIsLoading(true);
      const q = await generateExpertInteraction(node, 'reasoning', []);
      setMessages([{ role: 'ai', content: q }]);
      setIsLoading(false);
      speakText(q);
    }
    else if (step === PlayerStep.REASONING) {
      setStep(PlayerStep.CERTIFICATION);
      setIsLoading(true);
      const q = await generateExpertInteraction(node, 'certification', []);
      setMessages([{ role: 'ai', content: q }]);
      setIsLoading(false);
      speakText(q);
    }
  };

  const startVoiceInteraction = async () => {
    stopSpeaking(); 
    try {
      await recorderRef.current.start();
      setIsRecording(true);
    } catch (e) { 
      alert("请允许使用麦克风以开始语音对话。"); 
    }
  };

  const stopVoiceInteraction = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsLoading(true);
    try {
      const audioData = await recorderRef.current.stop();
      
      const userMsg = "[语音输入]";
      const newHistory = [...messages, { role: 'user' as const, content: userMsg }];
      setMessages(newHistory);

      const stepType = step === PlayerStep.REASONING ? 'reasoning' : 'certification';
      const aiResponse = await generateExpertInteraction(node, stepType, newHistory, audioData);
      setMessages([...newHistory, { role: 'ai', content: aiResponse }]);
      setIsLoading(false);
      speakText(aiResponse);
    } catch (err) {
      console.error("语音录制失败:", err);
      setIsLoading(false);
    }
  };

  const handleChat = async () => {
    if (!input.trim() || isLoading) return;
    stopSpeaking(); 
    const userMsg = input;
    setInput('');
    const newHistory = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newHistory);
    setIsLoading(true);
    const stepType = step === PlayerStep.REASONING ? 'reasoning' : 'certification';
    const aiResponse = await generateExpertInteraction(node, stepType, newHistory);
    setMessages([...newHistory, { role: 'ai', content: aiResponse }]);
    setIsLoading(false);
    speakText(aiResponse);
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    try {
      const html = marked.parse(text);
      return (
        <div 
          className="prose prose-slate max-w-none text-slate-700 leading-relaxed 
                     prose-headings:text-slate-900 prose-headings:font-black
                     prose-strong:text-indigo-600 prose-strong:font-bold
                     prose-p:mb-4 prose-li:mb-2" 
          dangerouslySetInnerHTML={{ __html: html }} 
        />
      );
    } catch (e) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in fade-in duration-300">
      <header className="h-20 border-b bg-white flex items-center justify-between px-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className="p-3 hover:bg-slate-50 rounded-full text-slate-400 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="font-black text-lg text-slate-900">{node.name}</h2>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">从小白到大师·进阶关卡</p>
          </div>
        </div>
        <div className="flex gap-1">
          {[PlayerStep.AWAKENING, PlayerStep.MODELING, PlayerStep.REASONING, PlayerStep.CERTIFICATION].map((s) => (
             <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step === s ? 'w-12 bg-indigo-600' : 'w-4 bg-slate-100'}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto py-12 px-10 bg-[#F9FAFB] flex flex-col items-center scrollbar-hide">
        <div className="w-full max-w-3xl bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
          
          {step === PlayerStep.AWAKENING && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3 mb-8">
                <Heart className="text-rose-500 fill-rose-500" size={20} />
                <span className="text-xs font-black text-slate-400 tracking-[3px]">第一步：为什么非练不可？</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 mb-8 leading-tight">如果不掌握这项能力，你会吃什么亏？</h1>
              <div className="p-8 bg-slate-50 border-l-4 border-indigo-500 rounded-2xl">
                {isLoading ? <Loader2 className="animate-spin text-indigo-400 mx-auto" size={32} /> : renderMarkdown(content)}
              </div>
              <button 
                onClick={handleNext} 
                className="mt-12 w-full py-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200"
              >
                看大师是怎么操作的 <ChevronRight size={20} />
              </button>
            </div>
          )}

          {step === PlayerStep.MODELING && (
            <div className="animate-in fade-in slide-in-from-right-4">
               <div className="flex items-center gap-3 mb-8">
                <BrainCircuit className="text-indigo-600" size={20} />
                <span className="text-xs font-black text-slate-400 tracking-[3px]">第二步：大师思维路径图</span>
              </div>
              <div className="space-y-8">
                <div className="p-8 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">大师解决的核心逻辑</h3>
                  <p className="text-xl font-black text-indigo-900 leading-snug">{node.expert_metadata.core_problem}</p>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">决策路径（小白跟着做就行）</h3>
                  {node.expert_metadata.decision_path.map((s, idx) => (
                    <div key={s.id} className="flex gap-5 p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                      <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</span>
                      <p className="font-bold text-slate-700 leading-relaxed flex-1">{s.instruction}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={handleNext} 
                className="mt-12 w-full py-5 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 transition-all"
              >
                进入模拟实操对话 <Zap size={20} />
              </button>
            </div>
          )}

          {(step === PlayerStep.REASONING || step === PlayerStep.CERTIFICATION) && (
            <div className="flex flex-col h-full flex-1">
               <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center gap-3">
                  <GraduationCap className="text-indigo-600" size={24} />
                  <span className="text-xs font-black text-slate-400 tracking-[3px]">
                    {step === PlayerStep.REASONING ? '第三步：深度逻辑过招' : '第四步：讲透了才算学会了'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mic className={`text-indigo-500 ${isRecording ? 'animate-pulse' : ''}`} size={16} />
                  <span className="text-[10px] font-black text-slate-400">支持语音回复</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pb-6 pr-2 scrollbar-hide" ref={scrollRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`group relative max-w-[85%] p-6 rounded-[32px] text-[15px] font-bold leading-relaxed shadow-sm ${
                      m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'
                    }`}>
                      {m.role === 'ai' ? renderMarkdown(m.content) : m.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                      <Loader2 size={20} className="animate-spin text-indigo-300" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 flex gap-4 shrink-0 relative">
                {isRecording && (
                  <div className="absolute -top-12 left-0 right-0 flex justify-center">
                    <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black animate-pulse border-2 border-white shadow-lg">正在录音... 松开即可发送</div>
                  </div>
                )}
                
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder={isRecording ? "正在语音录入..." : "向教练提问或回答..."}
                  className="flex-1 px-7 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:bg-white focus:border-indigo-400 font-bold transition-all shadow-inner"
                  disabled={isRecording || isLoading}
                />
                
                <button 
                  onMouseDown={startVoiceInteraction}
                  onMouseUp={stopVoiceInteraction}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                    isRecording ? 'bg-rose-500 scale-110 shadow-rose-200' : 'bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95'
                  }`}
                >
                  {isRecording ? <Square size={20} fill="white" /> : <Mic size={24}/>}
                </button>

                <button 
                  onClick={handleChat} 
                  disabled={!input.trim() || isLoading}
                  className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-indigo-700 disabled:opacity-50 active:scale-90 transition-all"
                >
                  <Send size={24}/>
                </button>

                {step === PlayerStep.CERTIFICATION && messages.length >= 2 && !isRecording && !isLoading && (
                   <button 
                     onClick={async () => {
                       setIsLoading(true);
                       const res = await evaluateExpertise(node, messages.filter(m => m.role === 'user').pop()?.content || "");
                       setFeedback(res);
                       setStep(PlayerStep.REPORT);
                       setIsLoading(false);
                       speakText(`养成报告已生成，你的胜任度得分是 ${Math.round(res.score * 100)}%`);
                     }}
                     className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-black transition-all shadow-xl"
                   >
                     完成内化
                   </button>
                )}
              </div>
            </div>
          )}

          {step === PlayerStep.REPORT && feedback && (
            <div className="text-center animate-in zoom-in-95 py-6">
               <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-10 border-8 border-white shadow-xl ring-2 ring-emerald-100">
                  <span className="text-3xl font-black text-emerald-600">{Math.round(feedback.score * 100)}<span className="text-sm ml-0.5">%</span></span>
               </div>
               <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tighter">能力内化报告</h2>
               <div className="bg-slate-50 p-10 rounded-[40px] text-left mb-12 border border-slate-100">
                  {renderMarkdown(feedback.feedback)}
               </div>
               <button 
                onClick={() => { onComplete(node.id, feedback.score); }} 
                className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-2xl hover:bg-indigo-700 transition-all active:scale-95"
               >
                 同步能力地图并返回
               </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UnitPlayer;
