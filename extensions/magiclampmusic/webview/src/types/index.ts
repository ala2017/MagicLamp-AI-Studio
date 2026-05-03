export type ViewName = 'lyrics' | 'style' | 'audio' | 'audio-analysis' | 'mastering' | 'artwork' | 'mv-generation' | 'export' | 'settings';

export interface CreativeBrief {
    emotion: string[];
    theme: string[];
    styleRef: string[];
    perspective: string[];
    langStyle: string[];
    motivation: string;
}

export interface AudioAnalysis {
    bpm?: number;
    key?: string;
    energy?: number;
    loudness?: number;
    spectral_centroid?: number;
}

export interface MVScript {
    scenes: {
        timeStart: string;
        timeEnd: string;
        description: string;
        visualPrompt: string;
        cameraMovement: string;
    }[];
}

// Suno 音频生成相关类型
export interface AudioGeneration {
    id: string;
    title: string;
    audioUrl: string;
    videoUrl?: string;
    imageUrl?: string;
    status: 'queued' | 'streaming' | 'complete' | 'error';
    liked: boolean;
    createdAt: number;
    model?: string;
    prompt?: string;
    lyrics?: string;
}

export interface ProjectState {
    // 核心歌词数据
    songTitle: string;
    version: number;
    originalLyrics: string;
    optimizedLyrics: string;
    // 创作 Brief
    brief: CreativeBrief;
    // AI 生成结果 (跨模块共享)
    sunoPrompt: string;
    styleAnalysis: string;
    // 音频分析数据
    audioAnalysis?: AudioAnalysis;
    // 封面与视觉
    coverPrompt: string;
    generatedCoverUrl: string | null;
    // MV 数据
    mvScript?: MVScript;
    // Suno 音频生成
    audioGenerations?: AudioGeneration[];
}

export const DEFAULT_LYRICS = `[Verse]
他们说的都是对的 我们只能闭嘴听话
他们画的都是大饼 我们永远够不到它

[Verse 2]
规则是他们写的 裁判也站在他们那
我们拼命往上爬 他们一脚把梯子踢塌
但如果我们沉默 真相就一直被冻结

[Chorus]
眼泪和汗水 都被写成内疚的伤
日复一日的辛劳 被变成他们的光芒
他们叫我们低头顺从 像傀儡一样
但真相正藏在我们心里 待释放

[Verse 3]
他们的伟大建筑是用谁的血刻成
封住我们的嘴 而他们的酒杯正填满
承诺是毒药 梦想是头套 在这阴暗城
摧毁的 不只是自由 更是希望破散

[Bridge]
你会问 为什么沉默就会败北
可事实从未对害怕抗争的人妥协
要斗争 要呼喊 让真相灼破眼帘
不再沉睡的人 才能摆脱这虚假的氛围

[Chorus]
眼泪和汗水 都被写成内疚的伤
日复一日的辛劳 被变成他们的光芒
他们叫我们低头顺从 像傀儡一样
但真相正藏在我们心里 待释放`;

export const DEFAULT_BRIEF: CreativeBrief = {
    emotion: ['愤怒'],
    theme: ['社会批判'],
    styleRef: ['NF'],
    perspective: ['第一人称'],
    langStyle: ['街头口语'],
    motivation: '揭露社会不公，替底层人民发声'
};

export interface ViewProps {
    project: ProjectState;
    updateProject: (updates: Partial<ProjectState>) => void;
    updateBrief?: (updates: Partial<CreativeBrief>) => void;
}
