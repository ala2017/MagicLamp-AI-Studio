
export type KnowledgeType = 'concept' | 'procedure' | 'principle';
export type LearningMethod = 'socratic' | 'feynman' | 'first_principles' | 'deliberate_practice' | 'ai_adaptive';

export interface Step {
  id: string;
  instruction: string;
}

export interface ExpertMetadata {
  core_problem: string;
  decision_path: Step[];
  common_pitfalls: string[];
  context_boundary: string;
}

export interface CapabilityNode {
  id: string;
  source_id: string;
  chapter_index: number;
  name: string;
  level: 1 | 2;
  type: KnowledgeType;
  expert_metadata: ExpertMetadata;
  dependencies: string[];
}

export interface Chapter {
  index: number;
  title: string;
  content: string;
  status: 'locked' | 'processing' | 'ready' | 'completed';
}

export interface KnowledgeAsset {
  id: string;
  name: string;
  type: string;
  date: string;
  chapters: Chapter[];
  nodes: CapabilityNode[];
}

export interface CapabilityState {
  mastery_score: number;
  stability: number;
  last_review: string;
  error_patterns: string[];
}

export interface LearnerProfile {
  user_id: string;
  capabilities_state: Record<string, CapabilityState>;
  learning_style: {
    pacing: 'intensive' | 'relaxed';
    preferred_methodology: LearningMethod;
  };
}

export enum PlayerStep {
  AWAKENING = 'AWAKENING',     // 认知唤醒：意识到痛点
  MODELING = 'MODELING',       // 核心建模：掌握专家模型
  REASONING = 'REASONING',     // 逻辑推演：理解底层原理
  PRACTICE = 'PRACTICE',       // 实战磨炼：复杂变式训练
  CERTIFICATION = 'CERTIFICATION', // 专家认证：费曼授课
  REPORT = 'REPORT'            // 养成报告
}
