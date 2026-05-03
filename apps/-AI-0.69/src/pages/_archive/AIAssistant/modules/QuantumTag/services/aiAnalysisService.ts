/**
 * AI分析服务
 * 用于调用AI模型分析书签数据，提取标签和关系
 */
import { Bookmark } from './bookmarkService';

export interface Tag {
  id: string;
  label: string;
  weight: number;
}

export interface Relation {
  source: string;
  target: string;
  weight: number;
}

export interface AnalysisResult {
  tags: Tag[];
  relations: Relation[];
}

/**
 * 构建AI分析提示词
 */
const buildAnalysisPrompt = (bookmarks: Bookmark[]): string => {
  const bookmarkList = bookmarks.map(b => `标题: "${b.title}", URL: "${b.url}", 路径: "${b.path}"`).join('\n');
  
  return `分析以下书签，提取最有代表性的标签以及标签之间的关系：
${bookmarkList}

以JSON格式返回分析结果，格式如下：
{
  "tags": [
    {"id": "标签唯一ID", "label": "标签显示名称", "weight": 标签权重(1-10之间)}
  ],
  "relations": [
    {"source": "源标签ID", "target": "目标标签ID", "weight": 关系强度(1-5之间)}
  ]
}

注意:
1. 标签应尽可能涵盖不同维度和领域
2. 每个标签ID应该是唯一的
3. 标签之间的关系应该有明确的关联性
4. 尽量提取10-20个标签`;
};

/**
 * 解析AI返回的JSON结果
 */
const parseAnalysisResult = (aiResponse: string): AnalysisResult => {
  try {
    // 从AI响应中提取JSON
    const match = aiResponse.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('无法从AI响应中提取JSON');
    
    const jsonStr = match[0];
    const result = JSON.parse(jsonStr);
    
    // 验证结果结构
    if (!result.tags || !Array.isArray(result.tags)) {
      throw new Error('AI响应缺少标签数组');
    }
    
    if (!result.relations || !Array.isArray(result.relations)) {
      result.relations = []; // 如果没有关系，使用空数组
    }
    
    return {
      tags: result.tags.map((tag: any) => ({
        id: tag.id || String(Math.random()).slice(2, 10),
        label: tag.label || '未命名标签',
        weight: typeof tag.weight === 'number' ? tag.weight : 5
      })),
      relations: result.relations.map((rel: any) => ({
        source: rel.source || '',
        target: rel.target || '',
        weight: typeof rel.weight === 'number' ? rel.weight : 1
      })).filter((rel: Relation) => rel.source && rel.target)
    };
  } catch (error) {
    console.error('解析AI响应失败:', error);
    return { tags: [], relations: [] };
  }
};

/**
 * 合并多次分析结果
 */
export const mergeAnalysisResults = (results: AnalysisResult[]): AnalysisResult => {
  const tagMap = new Map<string, Tag>();
  const relationMap = new Map<string, Relation>();
  
  // 合并标签
  results.forEach(result => {
    result.tags.forEach(tag => {
      if (tagMap.has(tag.id)) {
        // 如果标签已存在，取最大权重
        const existingTag = tagMap.get(tag.id)!;
        existingTag.weight = Math.max(existingTag.weight, tag.weight);
      } else {
        tagMap.set(tag.id, { ...tag });
      }
    });
    
    // 合并关系
    result.relations.forEach(relation => {
      const relationKey = `${relation.source}-${relation.target}`;
      if (relationMap.has(relationKey)) {
        // 如果关系已存在，取最大权重
        const existingRelation = relationMap.get(relationKey)!;
        existingRelation.weight = Math.max(existingRelation.weight, relation.weight);
      } else {
        relationMap.set(relationKey, { ...relation });
      }
    });
  });
  
  return {
    tags: Array.from(tagMap.values()),
    relations: Array.from(relationMap.values())
  };
};

/**
 * 分析书签批次
 */
export const analyzeBookmarkBatch = async (
  bookmarks: Bookmark[], 
  apiEndpoint: string,
  apiKey: string,
  model: string
): Promise<AnalysisResult> => {
  try {
    // 验证API配置
    if (!apiKey) {
      throw new Error('API密钥未配置。请前往"模型设置"页面设置您的API密钥。');
    }
    
    if (!apiEndpoint) {
      throw new Error('API端点未配置。请前往"模型设置"页面设置API端点。');
    }
    
    if (!model) {
      throw new Error('AI模型未选择。请前往"模型设置"页面选择要使用的模型。');
    }
    
    const prompt = buildAnalysisPrompt(bookmarks);
    
    // 发送请求到AI模型
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      // 区分不同类型的错误
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API密钥验证失败 (${response.status})。请检查您的API密钥是否正确。`);
      } else if (response.status === 404) {
        throw new Error(`API端点或模型未找到 (${response.status})。请检查您的API设置。`);
      } else if (response.status === 429) {
        throw new Error(`API请求超出限制 (${response.status})。请稍后再试或检查您的API使用配额。`);
      } else {
        throw new Error(`API错误: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices.length) {
      throw new Error('API返回的数据格式无效，未包含有效的内容。');
    }
    
    const aiResponse = data.choices[0]?.message?.content || '';
    
    if (!aiResponse) {
      throw new Error('API返回的响应为空。');
    }
    
    return parseAnalysisResult(aiResponse);
  } catch (error) {
    console.error('分析书签失败:', error);
    throw error; // 向上传播错误，让调用者处理
  }
};

/**
 * 批量分析书签并保持进度更新
 */
export const batchAnalyzeBookmarks = async (
  bookmarkBatches: Bookmark[][],
  apiEndpoint: string,
  apiKey: string,
  model: string,
  onProgress: (progress: number) => void
): Promise<AnalysisResult> => {
  let processedCount = 0;
  const totalBatches = bookmarkBatches.length;
  const batchResults: AnalysisResult[] = [];
  
  for (const batch of bookmarkBatches) {
    const result = await analyzeBookmarkBatch(batch, apiEndpoint, apiKey, model);
    batchResults.push(result);
    
    processedCount++;
    onProgress(processedCount / totalBatches);
  }
  
  // 合并结果
  return mergeAnalysisResults(batchResults);
}; 