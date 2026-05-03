import { useState, useEffect } from "react";
import { Loader2, Palette, LayoutTemplate, Download, ImageIcon, Save, Library, Trash2, X } from "lucide-react";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { ScrollArea } from "./components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./components/ui/hover-card";
import { Input } from "./components/ui/input";
import { LAYOUTS, STYLES } from "./constants";
import { generateInfographicImage, extractInfographicContent, buildImagePrompt, analyzeDesignImage, DesignGenes, buildReimaginedPrompt } from "./services/geminiService";
import { UploadCloud, CheckCircle2 } from "lucide-react";

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface SavedGeneBlueprint {
  id: string;
  name: string;
  timestamp: number;
  genes: DesignGenes;
  selectedElements: {
    colors: string[];
    layout: string[];
    typography: string[];
    graphics: string[];
  };
  thumbnail: string | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"standard" | "reverse">("standard");

  const [hasApiKey, setHasApiKey] = useState(true);
  const [sourceText, setSourceText] = useState("");
  const [selectedLayout, setSelectedLayout] = useState<string>(
    () => localStorage.getItem("infographic_layout") || "bridge"
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(
    () => localStorage.getItem("infographic_style") || "craft-handmade"
  );
  const [aspectRatio, setAspectRatio] = useState<string>(
    () => localStorage.getItem("infographic_aspectRatio") || "9:16"
  );
  const [imageSize, setImageSize] = useState<string>(
    () => localStorage.getItem("infographic_imageSize") || "2K"
  );
  const [density, setDensity] = useState<string>(
    () => localStorage.getItem("infographic_density") || "high"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // States to cache the extracted text content
  const [cachedSourceText, setCachedSourceText] = useState("");
  const [cachedDensity, setCachedDensity] = useState("");
  const [extractedContent, setExtractedContent] = useState("");

  // Sandbox UI States
  const [revRefImage, setRevRefImage] = useState<string | null>(null);
  const [revRefMimeType, setRevRefMimeType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [designGenes, setDesignGenes] = useState<DesignGenes | null>(null);
  
  // Element-level selection state
  const [selectedElements, setSelectedElements] = useState<{
    colors: string[];
    layout: string[];
    typography: string[];
    graphics: string[];
  }>({ colors: [], layout: [], typography: [], graphics: [] });

  const [reverseSourceText, setReverseSourceText] = useState("");
  const [isReverseGenerating, setIsReverseGenerating] = useState(false);
  const [reverseGeneratedImage, setReverseGeneratedImage] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);

  // Vault States
  const [savedBlueprints, setSavedBlueprints] = useState<SavedGeneBlueprint[]>(() => {
    try {
      const saved = localStorage.getItem("infographic_blueprints");
      return saved ? JSON.parse(saved) : [];
    } catch(e) {
      return [];
    }
  });
  const [showVault, setShowVault] = useState(false);
  const [newBlueprintName, setNewBlueprintName] = useState("");

  const saveBlueprint = () => {
    if (!designGenes) return;
    const newBlueprint: SavedGeneBlueprint = {
      id: Date.now().toString(),
      name: newBlueprintName || `未命名基因 ${new Date().toLocaleTimeString()}`,
      timestamp: Date.now(),
      genes: designGenes,
      selectedElements,
      thumbnail: revRefImage
    };
    const updated = [newBlueprint, ...savedBlueprints];
    setSavedBlueprints(updated);
    localStorage.setItem("infographic_blueprints", JSON.stringify(updated));
    setNewBlueprintName("");
  };

  const applyBlueprint = (bp: SavedGeneBlueprint) => {
    setDesignGenes(bp.genes);
    setSelectedElements(bp.selectedElements);
    setRevRefImage(bp.thumbnail);
    setShowVault(false);
    setReverseGeneratedImage(null);
  };

  const deleteBlueprint = (id: string) => {
    const updated = savedBlueprints.filter(b => b.id !== id);
    setSavedBlueprints(updated);
    localStorage.setItem("infographic_blueprints", JSON.stringify(updated));
  };

  const toggleElement = (category: keyof typeof selectedElements, value: string) => {
    setSelectedElements(prev => {
      const current = prev[category];
      if (current.includes(value)) {
        return { ...prev, [category]: current.filter((v: string) => v !== value) };
      } else {
        return { ...prev, [category]: [...current, value] };
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setReverseError("Image is too large. Please upload an image under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setRevRefImage(dataUrl);
      setRevRefMimeType(file.type);
      setDesignGenes(null); // reset evaluation when a new image is uploaded
      setReverseError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeDesign = async () => {
    if (!revRefImage || !revRefMimeType) return;
    
    try {
      setIsAnalyzing(true);
      setReverseError(null);
      const genes = await analyzeDesignImage(revRefImage, revRefMimeType);
      setDesignGenes(genes);
      // Auto-select all elements on load
      setSelectedElements({
        colors: genes.colorPalette.hexCodes,
        layout: genes.layoutStructure.keywords,
        typography: genes.typographyMood.keywords,
        graphics: genes.graphicStyle.keywords
      });
    } catch (err: any) {
      setReverseError(err.message || "Failed to analyze design image");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReverseGenerate = async () => {
    if (!designGenes || !reverseSourceText.trim()) {
      setReverseError("Please complete the analysis and enter text.");
      return;
    }

    try {
      setIsReverseGenerating(true);
      setReverseError(null);
      setReverseGeneratedImage(null);

      // Extract content format using quick 2.5
      const extractedContentRev = await extractInfographicContent(reverseSourceText, "high");

      const watermark = "Created by 神灯智库·天火义王";
      // Construct exact prompt based on analysis + text
      const imagePrompt = buildReimaginedPrompt(
        extractedContentRev,
        designGenes,
        selectedElements,
        "9:16", // Hardcode 9:16 for sandbox simplicity right now
        watermark
      );

      // Generate the new graphic
      const imageData = await generateInfographicImage(imagePrompt, "9:16", "2K");
      setReverseGeneratedImage(imageData);
    } catch (err: any) {
       console.error(err);
      if (err.message && (err.message.includes("not found") || err.message.includes("PERMISSION_DENIED") || err.message.includes("permission"))) {
        setHasApiKey(false);
        setReverseError("API Key configuration error or missing permissions.");
      } else {
        setReverseError(err.message || "Failed to generate reimagined infographic.");
      }
    } finally {
      setIsReverseGenerating(false);
    }
  };

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success to bypass race condition
      setHasApiKey(true);
    }
  };

  useEffect(() => {
    localStorage.setItem("infographic_layout", selectedLayout);
    localStorage.setItem("infographic_style", selectedStyle);
    localStorage.setItem("infographic_aspectRatio", aspectRatio);
    localStorage.setItem("infographic_imageSize", imageSize);
    localStorage.setItem("infographic_density", density);
  }, [selectedLayout, selectedStyle, aspectRatio, imageSize, density]);

  const toggleLayout = (id: string) => {
    setSelectedLayout(id);
  };

  const toggleStyle = (id: string) => {
    setSelectedStyle(id);
  };

  const handleGenerate = async () => {
    if (!sourceText.trim()) {
      setError("Please paste some source text first.");
      return;
    }
    if (!selectedLayout || !selectedStyle) {
      setError("Please select one layout and one style.");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setGeneratedImage(null);

      const watermark = "Created by 神灯智库·天火义王";
      
      let currentExtracted = extractedContent;
      // Step 1: Check cache. If text or density changed, we must re-parse it with 2.5-flash
      if (sourceText !== cachedSourceText || density !== cachedDensity || !currentExtracted) {
        currentExtracted = await extractInfographicContent(sourceText, density);
        setExtractedContent(currentExtracted);
        setCachedSourceText(sourceText);
        setCachedDensity(density);
      }

      // Find readable labels for the prompt
      const layoutLabel = LAYOUTS.find(l => l.id === selectedLayout)?.label || selectedLayout;
      const styleLabel = STYLES.find(s => s.id === selectedStyle)?.label || selectedStyle;

      // Step 2: Build the final image prompt combining cached content + user visual choices
      const imagePrompt = buildImagePrompt(
        currentExtracted,
        [layoutLabel],
        [styleLabel],
        aspectRatio,
        watermark,
        density
      );

      // Step 3: Trigger nanobanana2 to render the image
      const imageData = await generateInfographicImage(imagePrompt, aspectRatio, imageSize);
      setGeneratedImage(imageData);
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("not found") || err.message.includes("PERMISSION_DENIED") || err.message.includes("permission"))) {
        setHasApiKey(false);
        setError("API Key configuration error or missing permissions. Please re-select your Paid API Key.");
      } else {
        setError(err.message || "Failed to generate infographic.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = generatedImage;
    a.download = `infographic-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-slate-100 font-sans p-4 md:p-6 lg:p-8 flex flex-col overflow-x-hidden">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">AI 信息图生成引擎</h1>
          <div className="flex items-center gap-3 mt-2">
            <button 
              onClick={() => setActiveTab("standard")}
              className={`text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded transition-colors ${activeTab === "standard" ? "bg-indigo-500/20 text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              文本驱动引擎 (稳定版)
            </button>
            <button 
              onClick={() => setActiveTab("reverse")}
              className={`text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded border border-transparent transition-colors ${activeTab === "reverse" ? "bg-amber-500/20 border-amber-500/30 text-amber-400" : "text-amber-600/50 hover:text-amber-500"}`}
            >
              视觉逆向黑客 (实验舱)
            </button>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] text-slate-500 font-mono">Created by 神灯智库·天火义王</p>
        </div>
      </header>

      {!hasApiKey && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-slate-900 border-slate-700 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl text-white">Gemini API 访问配置</CardTitle>
              <CardDescription className="text-slate-400">
                AI信息图引擎使用了最新的 Gemini 3.1 图像生成与推理能力，这些高阶功能需要您的个人 API Key 支持。请通过 AI Studio 的内置鉴权框绑定您的带计费权限的云项目 API Key。
                如果您已经在系统侧边栏设置了 <b>GEMINI_API_KEY</b>，您可以直接跳过此提示。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleSelectKey} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                一键授权 / 选择云项目 API Key
              </Button>
              <Button onClick={() => setHasApiKey(true)} variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                我已经在系统设置中添加了 Key，直接进入
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "standard" ? (
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left pane: Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="bg-slate-900/50 border-slate-800 rounded-2xl flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. 输入源文本</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col relative pb-6">
              <Textarea
                maxLength={3000}
                placeholder="请输入需要转换为信息图的文本... (最多3000字，超出部分将被丢弃)"
                className="flex-1 min-h-[160px] resize-y bg-slate-950/50 border-slate-800/50 text-sm text-slate-300 font-serif leading-relaxed"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
              />
              <div className="absolute bottom-1 right-5 text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <span className={sourceText.length >= 3000 ? "text-red-400" : ""}>{sourceText.length}</span>
                <span>/ 3000</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 rounded-2xl">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-indigo-400" />
                2. 布局模式
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ScrollArea className="h-[200px] pr-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {LAYOUTS.map((layout) => {
                    const isSelected = selectedLayout === layout.id;
                    const imageUrl = `https://raw.githubusercontent.com/JimLiu/baoyu-skills/main/screenshots/infographic-layouts/${layout.id}.webp`;
                    return (
                      <div key={layout.id}>
                        <HoverCard>
                          <HoverCardTrigger className="block w-full text-left p-0 m-0 border-0 bg-transparent h-full">
                            <div
                              className={`group relative p-3 h-full rounded-xl border flex flex-col items-center cursor-pointer transition-all ${
                                isSelected 
                                  ? "bg-indigo-500/20 border-indigo-500" 
                                  : "bg-slate-800/50 border-slate-700 opacity-60 hover:opacity-100 hover:border-indigo-400/50"
                              }`}
                              onClick={() => setSelectedLayout(layout.id)}
                            >
                              <div 
                                className={`w-full h-16 rounded mb-2 bg-cover bg-center border border-slate-700/50 relative transition-transform group-hover:scale-105 ${isSelected ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                                style={{ backgroundImage: `url(${imageUrl})` }}
                              />
                              <div className={`text-[11px] font-medium text-center ${isSelected ? "text-indigo-200" : "text-slate-300"}`}>{layout.label}</div>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-[280px] p-2 bg-slate-900 border-slate-700 shadow-xl pointer-events-none z-50">
                            <img src={imageUrl} alt={layout.label} className="w-full h-auto rounded border border-slate-800" />
                            <div className="mt-2 text-xs font-semibold text-slate-300 px-1 pb-1">{layout.label}：{layout.desc}</div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 rounded-2xl">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                3. 视觉风格
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ScrollArea className="h-[200px] pr-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STYLES.map((style) => {
                    const isSelected = selectedStyle === style.id;
                    const imageUrl = `https://raw.githubusercontent.com/JimLiu/baoyu-skills/main/screenshots/infographic-styles/${style.id}.webp`;
                    return (
                      <div key={style.id}>
                        <HoverCard>
                          <HoverCardTrigger className="block w-full text-left p-0 m-0 border-0 bg-transparent h-full">
                            <div
                              className={`group relative p-3 h-full rounded-xl border flex flex-col items-center cursor-pointer transition-all ${
                                isSelected 
                                  ? "bg-cyan-900/20 border-cyan-500" 
                                  : "bg-slate-800/50 border-slate-700 opacity-60 hover:opacity-100 hover:border-cyan-400/50"
                              }`}
                              onClick={() => setSelectedStyle(style.id)}
                            >
                              <div 
                                className={`w-full h-16 rounded mb-2 bg-cover bg-center border border-slate-700/50 relative transition-transform group-hover:scale-105 ${isSelected ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                                style={{ backgroundImage: `url(${imageUrl})` }}
                              />
                              <div className={`text-[11px] font-medium text-center ${isSelected ? "text-cyan-200" : "text-slate-300"}`}>{style.label}</div>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-[280px] p-2 bg-slate-900 border-slate-700 shadow-xl pointer-events-none z-50">
                            <img src={imageUrl} alt={style.label} className="w-full h-auto rounded border border-slate-800" />
                            <div className="mt-2 text-xs font-semibold text-slate-300 px-1 pb-1">{style.label}：{style.desc}</div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 rounded-2xl">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">4. 视觉微调 (导出配置)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-3">
                <Label className="text-[11px] font-medium text-slate-400">输出比例 (DIMENSIONS)</Label>
                <div className="flex flex-wrap gap-2">
                  {["16:9", "9:16", "1:1", "4:3", "3:4"].map((ratio) => (
                    <Badge
                      key={ratio}
                      variant="outline"
                      className={`cursor-pointer px-3 py-1.5 text-[10px] font-bold border rounded transition-colors ${
                        aspectRatio === ratio
                          ? "bg-indigo-900/30 text-indigo-400 border-indigo-800/50"
                          : "bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700"
                      }`}
                      onClick={() => setAspectRatio(ratio)}
                    >
                      {ratio}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3 pt-3 border-t border-slate-800/50 mt-3">
                <Label className="text-[11px] font-medium text-slate-400">图像分辨率 (RESOLUTION)</Label>
                <div className="flex flex-wrap gap-2">
                  {["1K", "2K", "4K"].map((size) => (
                    <Badge
                      key={size}
                      variant="outline"
                      className={`cursor-pointer px-3 py-1.5 text-[10px] font-bold border rounded transition-colors ${
                        imageSize === size
                          ? "bg-indigo-900/30 text-indigo-400 border-indigo-800/50"
                          : "bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700"
                      }`}
                      onClick={() => setImageSize(size)}
                    >
                      {size}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3 pt-3 border-t border-slate-800/50 mt-3">
                <Label className="text-[11px] font-medium text-slate-400">信息密度 (INFORMATION DENSITY)</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "low", label: "低 (简明海报)" },
                    { id: "medium", label: "中 (图文均衡)" },
                    { id: "high", label: "高 (硬核细节)" }
                  ].map((option) => (
                    <Badge
                      key={option.id}
                      variant="outline"
                      className={`cursor-pointer px-3 py-1.5 text-[10px] font-bold border rounded transition-colors ${
                        density === option.id
                          ? "bg-indigo-900/30 text-indigo-400 border-indigo-800/50"
                          : "bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700"
                      }`}
                      onClick={() => setDensity(option.id)}
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl shadow-lg shadow-indigo-900/20 transition-all text-sm uppercase tracking-wider"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-200" />
                      开始合成...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-5 w-5" />
                      生成信息大图
                    </>
                  )}
                </Button>
                {error && <p className="text-xs text-red-400 font-medium text-center mt-3">{error}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right pane: Preview */}
        <div className="lg:col-span-7 flex flex-col">
          <Card className="bg-slate-900/50 border-slate-800 rounded-2xl flex-1 flex flex-col overflow-visible">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">生成预览 (Preview)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col relative">
              <div className="flex-1 bg-gradient-to-br from-indigo-900/20 to-slate-950 border border-slate-800 rounded-xl overflow-hidden relative group flex flex-col items-center justify-center min-h-[400px]">
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col p-6 items-center justify-center z-10">
                    <div className="w-32 h-32 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4 relative">
                      <div className="w-24 h-24 rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                      <div className="absolute w-16 h-16 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                    </div>
                    <div className="space-y-2 w-full px-4 max-w-sm text-center">
                      <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-3">AI 脑洞构建中</h3>
                      <div className="h-2 w-3/4 bg-slate-800 rounded-full mx-auto overflow-hidden">
                         <div className="h-full w-full bg-indigo-500 origin-left animate-pulse"></div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-4">
                        文本解析... 应用 {selectedLayout} 布局... 融入 {selectedStyle} 风格...
                      </p>
                    </div>
                  </div>
                ) : generatedImage ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 z-10">
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                       <Button onClick={handleDownload} variant="outline" size="sm" className="bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white backdrop-blur">
                         <Download className="w-4 h-4 mr-2 text-cyan-400"/>
                         保存高清图 (PNG)
                       </Button>
                    </div>
                    <img
                      src={generatedImage}
                      alt="Generated Infographic"
                      className="w-full h-auto max-h-[75vh] object-contain rounded-lg shadow-2xl relative z-10"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col p-6 items-center justify-center z-10 opacity-30">
                    <div className="w-24 h-24 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center mb-4">
                      <ImageIcon className="h-10 w-10 text-slate-500" />
                    </div>
                    <div className="space-y-3 w-full max-w-xs px-4">
                      <div className="h-2 w-3/4 bg-slate-800 rounded-full mx-auto"></div>
                      <div className="h-2 w-1/2 bg-slate-800 rounded-full mx-auto opacity-50"></div>
                    </div>
                  </div>
                )}
                
                {/* Overlay Watermark (shows when there's an image or placeholder) */}
                <div className="absolute bottom-3 right-4 opacity-50 text-[9px] pointer-events-none font-mono text-slate-500 z-20">
                  Created by 神灯智库·天火义王
                </div>
              </div>
            </CardContent>
          </Card>
          
          <footer className="mt-6 flex justify-between items-center opacity-50 px-2">
            <div className="text-[9px] font-mono tracking-tighter uppercase text-slate-500">
              System Status: Online • Nodes: 24 • Latency: 42ms
            </div>
            <div className="text-[9px] font-mono text-slate-500">
              © 2024 神灯智库
            </div>
          </footer>
        </div>
      </main>
      ) : (
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Left pane: Upload & Extraction */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <Card className="bg-slate-900/50 border-amber-900/40 rounded-2xl">
              <CardHeader className="pb-3 border-b border-slate-800/50">
                <CardTitle className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center justify-between w-full">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    1. 视觉黑客分析台 (上传参考图)
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setShowVault(true)} className="h-7 text-[10px] border-amber-900/50 text-amber-500 bg-amber-950/20 hover:bg-amber-900/40 hover:text-amber-300">
                    <Library className="w-3 h-3 mr-1" /> 基因仓库
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {!revRefImage ? (
                  <div className="border-2 border-dashed border-amber-900/50 hover:border-amber-500/50 rounded-xl p-8 text-center cursor-pointer relative transition-colors group bg-slate-950/50">
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <UploadCloud className="w-8 h-8 text-amber-600/50 group-hover:text-amber-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">点击或拖拽上传设计佳作</p>
                    <p className="text-xs text-slate-500 mt-1">支持 PNG, JPG (最大 5MB)</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="relative rounded-xl border border-amber-900 overflow-hidden bg-black/40 h-48 flex items-center justify-center">
                       <img src={revRefImage} alt="Reference" className="max-h-full max-w-full object-contain" />
                       <button onClick={() => { setRevRefImage(null); setDesignGenes(null); }} className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 text-white text-[10px] px-2 py-1 rounded">移除</button>
                    </div>
                    {!designGenes ? (
                      <Button onClick={handleAnalyzeDesign} disabled={isAnalyzing} className="w-full bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20">
                        {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 执行多模态解构拆解...</> : "启动 AI 设计基因提取"}
                      </Button>
                    ) : (
                      <div className="space-y-4 pt-2">
                        <div className="bg-emerald-900/20 border border-emerald-900/50 p-2.5 rounded-lg flex items-center gap-2 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 基因池萃取成功，请点选组合所需的具体元素：
                        </div>
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl border bg-slate-900/50 border-slate-800">
                            <p className="text-xs font-bold text-amber-500 mb-1">色彩系统 (Color Palette)</p>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">{designGenes.colorPalette.description}</p>
                            <div className="flex flex-wrap gap-3">
                              {designGenes.colorPalette.hexCodes.map(hex => {
                                const isSelected = selectedElements.colors.includes(hex);
                                return (
                                  <div 
                                    key={hex} 
                                    onClick={() => toggleElement('colors', hex)}
                                    className={`w-12 h-12 rounded-full cursor-pointer transition-all duration-300 shadow-lg border-2
                                      ${isSelected ? 'border-amber-400 scale-110 z-10 shadow-amber-900/40 ring-2 ring-amber-400/20' : 'border-white/10 opacity-100 scale-100 hover:scale-105 hover:border-white/30'}`} 
                                    style={{backgroundColor: hex}} 
                                    title={hex} 
                                  />
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="p-3 rounded-xl border bg-slate-900/50 border-slate-800">
                            <p className="text-xs font-bold text-amber-500 mb-1">骨架版式 (Layout Structure)</p>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">{designGenes.layoutStructure.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {designGenes.layoutStructure.keywords.map((kw, i) => {
                                const isSelected = selectedElements.layout.includes(kw);
                                return (
                                  <Badge 
                                    key={i} 
                                    onClick={() => toggleElement('layout', kw)}
                                    variant="secondary" 
                                    className={`cursor-pointer px-2 py-1 text-[10px] transition-all 
                                      ${isSelected ? 'bg-amber-600 text-white border-amber-500 hover:bg-amber-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700 hover:text-slate-300'}`}
                                  >
                                    {kw}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="p-3 rounded-xl border bg-slate-900/50 border-slate-800">
                            <p className="text-xs font-bold text-amber-500 mb-1">排版情绪 (Typography Mood)</p>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">{designGenes.typographyMood.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {designGenes.typographyMood.keywords.map((kw, i) => {
                                const isSelected = selectedElements.typography.includes(kw);
                                return (
                                  <Badge 
                                    key={i} 
                                    onClick={() => toggleElement('typography', kw)}
                                    variant="secondary" 
                                    className={`cursor-pointer px-2 py-1 text-[10px] transition-all 
                                      ${isSelected ? 'bg-amber-600 text-white border-amber-500 hover:bg-amber-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700 hover:text-slate-300'}`}
                                  >
                                    {kw}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>

                          <div className="p-3 rounded-xl border bg-slate-900/50 border-slate-800">
                            <p className="text-xs font-bold text-amber-500 mb-1">插画与图形风格 (Graphic Style)</p>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">{designGenes.graphicStyle.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {designGenes.graphicStyle.keywords.map((kw, i) => {
                                const isSelected = selectedElements.graphics.includes(kw);
                                return (
                                  <Badge 
                                    key={i} 
                                    onClick={() => toggleElement('graphics', kw)}
                                    variant="secondary" 
                                    className={`cursor-pointer px-2 py-1 text-[10px] transition-all 
                                      ${isSelected ? 'bg-amber-600 text-white border-amber-500 hover:bg-amber-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700 hover:text-slate-300'}`}
                                  >
                                    {kw}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/50">
                          <Input 
                            value={newBlueprintName} 
                            onChange={e => setNewBlueprintName(e.target.value)} 
                            placeholder="为这组成果命名 (例：赛博冷血风)" 
                            className="bg-slate-900/50 border-slate-700 text-xs text-slate-300 h-9"
                          />
                          <Button onClick={saveBlueprint} className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 h-9 px-3">
                            <Save className="w-4 h-4 mr-1" /> 固化基因
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {reverseError && <div className="text-xs text-red-400 bg-red-950/50 p-2 rounded border border-red-900">{reverseError}</div>}
              </CardContent>
            </Card>

            {designGenes && (
              <Card className="bg-slate-900/50 border-amber-900/40 rounded-2xl flex-1 flex flex-col">
                <CardHeader className="pb-3 border-b border-slate-800/50">
                  <CardTitle className="text-xs font-bold text-amber-500 uppercase tracking-wider">2. 注入您的新内容</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex-1 flex flex-col gap-4">
                  <Textarea
                    placeholder="输入要填充进新设计中的核心文字内容..."
                    className="flex-1 min-h-[160px] resize-y bg-slate-950/50 border-slate-800/50 text-sm text-slate-300 font-serif"
                    value={reverseSourceText}
                    onChange={(e) => setReverseSourceText(e.target.value)}
                  />
                  <Button 
                    onClick={handleReverseGenerate} 
                    disabled={isReverseGenerating || !reverseSourceText.trim()}
                    size="lg"
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white shadow-xl shadow-amber-900/20"
                  >
                    {isReverseGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 正在应用基因重组绘图...</> : "生成复刻重制版"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right pane: Preview */}
          <div className="lg:col-span-6 flex flex-col">
            <Card className="bg-slate-900/50 border-slate-800 rounded-2xl h-full flex flex-col relative overflow-hidden backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-900/80 sticky top-0 z-10 flex flex-row justify-between items-center">
                 <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">生成画板 (9:16)</CardTitle>
                 {reverseGeneratedImage && (
                    <Button variant="outline" size="sm" onClick={() => {
                        const a = document.createElement("a");
                        a.href = reverseGeneratedImage;
                        a.download = `reimagined-${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }} className="h-7 text-[10px] border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white">
                      <Download className="w-3 h-3 mr-1" /> 导出图像
                    </Button>
                  )}
              </CardHeader>
              <CardContent className="p-0 flex-1 relative flex items-center justify-center min-h-[500px]">
                {/* Checkboard pattern background (Tailwind custom setup logic) */}
                <div className="absolute inset-0 opacity-[0.03] bg-[length:16px_16px]" style={{backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)"}}></div>
                
                <div className="relative w-full h-full p-4 md:p-8 flex items-center justify-center z-10">
                  {isReverseGenerating ? (
                    <div className="flex flex-col items-center text-slate-400 gap-3">
                       <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                       <p className="text-xs font-medium animate-pulse text-amber-200">引擎全力渲染中，最高分辨率构图可能需要30秒...</p>
                    </div>
                  ) : reverseGeneratedImage ? (
                    <img 
                      src={reverseGeneratedImage} 
                      alt="Reimagined Generated output" 
                      className="max-h-full max-w-full object-contain rounded shadow-2xl ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="text-center text-slate-600 flex flex-col items-center gap-3">
                      <div className="w-32 h-40 border border-slate-700/50 rounded flex items-center justify-center bg-slate-800/20">
                         <div className="w-8 h-8 rounded-full border border-slate-600 text-slate-600 flex items-center justify-center text-[10px] font-bold">RAW</div>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-widest opacity-50">等待装配设计基因</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gene Vault Modal Overlay */}
          {showVault && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <Card className="w-full max-w-2xl bg-slate-950 border border-amber-900/50 shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
                <CardHeader className="border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between shrink-0">
                  <CardTitle className="text-amber-500 text-sm flex items-center gap-2">
                    <Library className="w-4 h-4" /> 我的视觉基因库
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowVault(false)} className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800">
                    <X className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 overflow-y-auto flex-1">
                  {savedBlueprints.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      <Library className="w-12 h-12 mx-auto mb-3 opacity-20" />
                       基因库空空如也。<br />去分析一张好图，然后固化它的基因吧！
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedBlueprints.map(bp => (
                        <div key={bp.id} className="border border-slate-800 bg-slate-900/30 rounded-xl p-3 flex flex-col gap-3 group">
                          <div className="flex justify-between items-start">
                            <div>
                               <h4 className="text-xs font-bold text-amber-100">{bp.name}</h4>
                               <p className="text-[9px] text-slate-500 mt-0.5">{new Date(bp.timestamp).toLocaleString()}</p>
                            </div>
                            {bp.thumbnail && <img src={bp.thumbnail} className="w-8 h-8 rounded object-cover border border-slate-700" alt="thumb" />}
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                             {bp.selectedElements.colors.map(c => <div key={c} className="w-3 h-3 rounded-full" style={{backgroundColor: c}}></div>)}
                          </div>
                          <div className="flex flex-wrap gap-1">
                             {bp.selectedElements.layout.slice(0, 2).map((l, i) => <span key={i} className="text-[8px] px-1 bg-slate-800 text-slate-400 rounded">{l}</span>)}
                             {bp.selectedElements.layout.length > 2 && <span className="text-[8px] px-1 text-slate-500">+{bp.selectedElements.layout.length - 2}</span>}
                          </div>
                          
                          <div className="mt-auto pt-2 flex justify-between items-center border-t border-slate-800/50">
                             <Button variant="ghost" size="sm" onClick={() => deleteBlueprint(bp.id)} className="h-6 text-[10px] text-red-400 hover:bg-red-950/30 px-2">
                               <Trash2 className="w-3 h-3 mr-1" /> 删除
                             </Button>
                             <Button size="sm" onClick={() => applyBlueprint(bp)} className="h-6 text-[10px] bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white px-2">
                               应用此配方
                             </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

