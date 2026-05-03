
import { GoogleGenAI, Type } from "@google/genai";
import { CapabilityNode, LearningMethod } from "../types";

export const modelChapterToGraph = async (
  content: string, 
  chapterIndex: number,
  existingNodes: CapabilityNode[] = []
): Promise<CapabilityNode[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const context = existingNodes.length > 0 
    ? `已有节点: [${existingNodes.map(n => n.name).join(', ')}]`
    : "";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: `你是一位顶级教育工程专家。请将内容逆向建模为纯中文能力节点。
    ${context}
    【规则】：禁止任何英文！节点名必须是中文，描述必须是中文。
    待解析：${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            level: { type: Type.INTEGER },
            type: { type: Type.STRING, enum: ['concept', 'procedure', 'principle'] },
            expert_metadata: {
              type: Type.OBJECT,
              properties: {
                core_problem: { type: Type.STRING },
                decision_path: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      instruction: { type: Type.STRING }
                    }
                  }
                },
                common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
                context_boundary: { type: Type.STRING }
              },
              required: ['core_problem', 'decision_path', 'common_pitfalls', 'context_boundary']
            },
            dependencies: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['id', 'name', 'level', 'type', 'expert_metadata', 'dependencies']
        }
      }
    }
  });

  try {
    const text = response.text || '[]';
    return JSON.parse(text).map((n: any) => ({ ...n, chapter_index: chapterIndex }));
  } catch (e) { return []; }
};

export const generateAwakening = async (node: CapabilityNode): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `针对能力“${node.name}”，描述一个不掌握此能力的人在现实中会遇到的具体尴尬、亏损或失败场景。
    要求：纯中文，Markdown 格式。`
  });
  return response.text || '';
};

export const generateExpertInteraction = async (
  node: CapabilityNode, 
  stepType: 'reasoning' | 'certification',
  history: { role: 'user' | 'ai', content: string }[],
  audioData?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chatHistory = history.map(h => `${h.role === 'user' ? '用户' : '导师'}: ${h.content}`).join('\n');
  
  let instruction = "";
  if (stepType === 'reasoning') {
    instruction = "逻辑推演阶段：追问用户为什么要按照专家路径执行。如果用户通过语音回答，请重点表扬其讲解的流利度。";
  } else {
    instruction = "费曼授课阶段：要求用户教你。如果收到音频输入，请先在回复开头说：‘我听到了你的精彩讲解...’。";
  }

  const parts: any[] = [{ text: `教学目标：${instruction}\n节点：${node.name}\n历史：\n${chatHistory}\n回复要求：纯中文，禁止英文。` }];
  if (audioData) {
    parts.push({ inlineData: { mimeType: 'audio/pcm;rate=16000', data: audioData } });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    contents: { parts }
  });
  return response.text || '';
};

export const evaluateExpertise = async (
  node: CapabilityNode,
  userInput: string,
  audioData?: string
): Promise<{ score: number; feedback: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [{ text: `评价用户的“授课”：\n文字内容："${userInput}"\n
    参考专家模型：${JSON.stringify(node.expert_metadata)}\n
    要求：纯中文。如果用户使用了语音，请额外评价其声音中的自信度和逻辑连贯性。` }];
  
  if (audioData) {
    parts.push({ inlineData: { mimeType: 'audio/pcm;rate=16000', data: audioData } });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        },
        required: ['score', 'feedback']
      }
    }
  });
  return JSON.parse(response.text || '{"score": 0, "feedback": "评估失败"}');
};
