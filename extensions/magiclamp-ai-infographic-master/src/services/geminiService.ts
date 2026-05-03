import { GoogleGenAI } from "@google/genai";

export async function extractInfographicContent(
  text: string,
  density: string = "high"
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

  let densityInstruction = "";
  if (density === "low") {
    densityInstruction = `
- DENSITY: LOW (Minimalist Poster)
- TASK: Extract ONLY 1 main overarching title and 1-2 extremely short slogans or keywords.
- Ignore the rest of the details.
`;
  } else if (density === "medium") {
    densityInstruction = `
- DENSITY: MEDIUM (Balanced)
- TASK: Extract 3-5 core points from the source text. Provide short titles and very brief descriptions for each point.
`;
  } else {
    densityInstruction = `
- DENSITY: HIGH (Expert/Hardcore Detail)
- TASK: Vigorously EXTRACT specific data, numbers, percentages, jargon, and hard facts.
- Produce 8 to 12+ highly detailed bullet points, micro-text blocks, or connected knowledge nodes.
`;
  }

  const prompt = `You are an expert data analyst. Parse the following source text for an infographic.

Source Text:
${text}

INSTRUCTIONS:
${densityInstruction}
- TITLE LOGIC: 
  1. Check if the source text starts with a clear headline, title, or prominent opening statement. 
  2. If a clear title exists, you MUST extract it verbatim as the main title. DO NOT summarize or re-write it.
  3. ONLY if the source text has NO obvious title (e.g., it starts directly with body text or raw data), you may then generate a concise, professional title that captures the core essence.
- output language requirement: Use natural Chinese context, but explicitly keep or introduce English professional terminology/jargon (e.g. AI, ROI, Architecture, Framework) to look highly professional.
- Format the output purely as the text data itself. Do not include conversational filler like "Here is the extracted content".

Return ONLY the raw extracted text payload.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", 
    contents: prompt,
  });

  return response.text || "";
}

export function buildImagePrompt(
  extractedContent: string,
  layouts: string[],
  styles: string[],
  aspectRatio: string,
  watermark: string,
  density: string
): string {
  let densityVisuals = "";
  if (density === "low") {
    densityVisuals = "- Emphasize heavy negative space and high visual impact over reading. Do NOT clutter the image with small text.";
  } else if (density === "medium") {
    densityVisuals = "- Balance the text harmoniously with the graphics.";
  } else {
    densityVisuals = "- Pack the layout densely mimicking a hardcore technical schema, manual, or rich data dashboard. Shrink the apparent font size contextually to cram the factual information onto the canvas efficiently.";
  }

  return `You are an expert infographic designer. Generate a highly detailed image prompt.

1. Layout Requirement: ${layouts.join(", ")}. Incorporate this structural placement.
2. Visual Style Requirement: ${styles.join(", ")}. Apply these aesthetics, colors, and textures strictly.
3. Aspect Ratio: ${aspectRatio}
4. Density Directive: ${densityVisuals}
5. Text Content to Incorporate: Focus prominently on rendering the following extracted text data in the graphic:
"""
${extractedContent}
"""
6. Explicitly include the watermark text "${watermark}" clearly in the corner.

Ensure professional mixed typography (Chinese with English terminology).`;
}

export interface DesignGenes {
  colorPalette: {
    description: string;
    hexCodes: string[];
  };
  layoutStructure: {
    description: string;
    keywords: string[];
  };
  typographyMood: {
    description: string;
    keywords: string[];
  };
  graphicStyle: {
    description: string;
    keywords: string[];
  };
}

export async function analyzeDesignImage(base64Data: string, mimeType: string): Promise<DesignGenes> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  
  const prompt = `You are a world-class graphic designer and AI visual reverse-engineer. 
Analyze the provided infographic/design image and extract its core design DNA.
Break it down into specific categories.

Return the result EXCLUSIVELY as a valid JSON object matching the exact structure below.
IMPORTANT RULES: 
- ALL "description" and "keywords" fields MUST be written in fluent, highly professional Chinese design terminology.
- "hexCodes" MUST be extremely precise 6-character hex strings. Pay close attention to the EXACT luminance, saturation, and temperature of the colors. Do not use generic or "safe" colors; capture the specific emerald, neon, or deep charcoal nuances present in the image.
- Extract 4 to 6 dominant colors, ensuring you cover: Primary Brand Color, Secondary, and key Accent/Highlight colors.

{
  "colorPalette": {
    "description": "色彩搭配原理、整体氛围与对比度关系的中文深度描述",
    "hexCodes": ["#HEX1", "#HEX2", "#HEX3", "#HEX4", "#HEX5"]
  },
  "layoutStructure": {
    "description": "骨架版式、视觉引导线和数据分布结构的中文描述",
    "keywords": ["网格布局", "不对称", "三分法", "中心环绕", "瀑布流"] // 提取最核心的3-5个短语标签
  },
  "typographyMood": {
    "description": "主副标题与正文字体风格、情绪和层级的中文描述",
    "keywords": ["粗体无衬线", "高对比度", "科技感", "紧凑字距"] // 提取最核心的3-5个短语标签
  },
  "graphicStyle": {
    "description": "插画、图标风格、数据图表样式以及背景质感的中文描述",
    "keywords": ["扁平化矢量", "3D悬浮", "等距视角", "磨砂玻璃", "流体渐变"] // 提取最核心的3-5个短语标签
  }
}

Do NOT include any markdown formatting like \`\`\`json. Only output the raw JSON object.`;

  // Standardize base64 for API (remove data:image/...;base64, prefix)
  const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const response = await ai.models.generateContent({
    model: "gemini-1.5-pro",
    contents: [
      prompt,
      { inlineData: { data: base64Clean, mimeType: mimeType || "image/png" } }
    ]
  });

  const text = response.text || "{}";
  // Red Team Parse robustness: clean up markdown if the AI hallucinates them despite instructions
  const cleanedText = text.replace(/```json/ig, '').replace(/```/g, '').trim();
  
  try {
    const parsed = JSON.parse(cleanedText) as DesignGenes;
    return {
      colorPalette: parsed.colorPalette || { description: "常规配色", hexCodes: ["#ffffff", "#000000"] },
      layoutStructure: parsed.layoutStructure || { description: "常规布局", keywords: ["基础排版"] },
      typographyMood: parsed.typographyMood || { description: "清晰字体", keywords: ["无衬线"] },
      graphicStyle: parsed.graphicStyle || { description: "基础配图", keywords: ["扁平化"] },
    };
  } catch (e) {
    console.error("Failed to parse design genes from response:", text);
    throw new Error("模型返回的分析结果格式不合规，请重试提取。");
  }
}

export interface SelectedElements {
  colors: string[];
  layout: string[];
  typography: string[];
  graphics: string[];
}

export function buildReimaginedPrompt(
  extractedContent: string,
  genes: DesignGenes,
  selectedElements: SelectedElements,
  aspectRatio: string,
  watermark: string
): string {
  
  const colorInstruction = selectedElements.colors.length > 0 
    ? `MANDATORY COLOR PALETTE: You MUST strictly use these EXACT hex colors: ${selectedElements.colors.join(', ')}. Pay special attention to their saturation and luminance to maintain the same "punch" and depth as the original design.` 
    : "Use a clean, professional color palette suitable for technology.";
    
  const layoutInstruction = selectedElements.layout.length > 0 
    ? `MANDATORY LAYOUT STRUCTURE: Adopt a layout strongly featuring these concepts: [${selectedElements.layout.join(', ')}].` 
    : "Use a balanced, standard infographic grid layout.";
    
  const typeInstruction = selectedElements.typography.length > 0 
    ? `MANDATORY TYPOGRAPHY: The typography mood MUST strictly reflect these characteristics: [${selectedElements.typography.join(', ')}].` 
    : "Use modern sans-serif fonts with good readability.";
    
  const graphicsInstruction = selectedElements.graphics.length > 0
    ? `MANDATORY GRAPHIC STYLE: The illustrations and elements MUST feature this exact style: [${selectedElements.graphics.join(', ')}].`
    : "Use flat, modern vector illustrations and clear charts.";

  return `You are an elite aesthetic data designer. Generate a highly detailed image prompt for a masterful infographic based on STRICT reverse-engineered design constraints.

[DESIGN CONSTRAINTS - YOU MUST FOLLOW THESE STRICTLY]
1. ${colorInstruction}
2. ${layoutInstruction}
3. ${typeInstruction}
4. ${graphicsInstruction}
5. Aspect Ratio: ${aspectRatio}

[CONTENT TO INCORPORATE]
Render the following extracted text data smoothly into the visual structure. Contextually scale the font sizes to make it fit without breaking the layout. Keep the professional Chinese terminology mixed with English jargon:
"""
${extractedContent}
"""

[ADDITIONAL RULES]
- The final design must look coherent, polished, and visually striking.
- Explicitly include the watermark text "${watermark}" clearly in the corner.
`;
}

export async function generateInfographicImage(
  imagePrompt: string,
  aspectRatio: string,
  imageSize: string = "2K"
): Promise<string> {
  // Create instance right before API call to ensure we pick up the latest injected key from the window.aistudio dialog
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: {
      parts: [{ text: imagePrompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: imageSize
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated by the AI.");
}
