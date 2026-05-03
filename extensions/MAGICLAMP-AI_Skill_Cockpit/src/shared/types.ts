
export type SkillType = 'skill' | 'mcp' | 'extension' | 'agent' | 'cursor-rule' | 'opencode-config' | 'workflow';
export type SkillScope = 'global' | 'project' | 'app-specific';
export type SkillStatus = 'active' | 'idle' | 'error' | 'not-installed';

export type SkillSource =
    | 'local-workspace'
    | 'global-antigravity'
    | 'claude-config'
    | 'vscode-extension'
    | 'cursor-rules'
    | 'opencode-config'
    | 'workflow-file';

export interface SecurityReport {
    riskScore: number; // 0-100, >0 implies risk
    isOfficial: boolean; // From trusted registry
    permissions: string[]; // e.g. ['cmd_run', 'net_access']
    auditReport?: string; // Summarized LLM audit
}

// Alias for backward compatibility if needed
export type SkillSecurity = SecurityReport;

export interface Skill {
    id: string; // Unique ID (e.g. "antigravity.vscode-expert")
    name: string;
    description: string;
    version: string;
    author: string;

    type: SkillType;
    scope: SkillScope;
    source: SkillSource; // New: Where did this come from?
    realPath?: string;   // New: Physical path on disk for editing

    // Metadata
    repoUrl?: string;
    icon?: string; // Lucide icon name or local path
    tags: string[];

    // Core Logic Content (PRD Requirement)
    instructions?: string;
    config?: any; // JSON config for MCP/OpenCode

    // Runtime State
    status: SkillStatus;
    enabled: boolean;

    // Security Guard
    security: SecurityReport;

    // Sync Status
    syncStatus?: {
        syncedToCursor?: boolean;
        syncedToClaude?: boolean;
    };
    
    // Update Status (New)
    updateAvailable?: boolean;
}

export interface Registry {
    name: string;
    url: string;
    type: 'official' | 'verified' | 'community';
    enabled: boolean;
}

// --- Orchestration & Workflow Types ---

export interface WorkflowStep {
    id: string;
    name: string;
    tool?: string; // e.g. "mcp.google-search"
    agent?: string; // e.g. "agent.code-reviewer"
    params?: Record<string, any>;
    next?: string[]; // IDs of next steps
}

export interface WorkflowConfig {
    id: string;
    name: string;
    description?: string;
    steps: WorkflowStep[];
    triggers?: ('on_save' | 'manual' | 'cron')[];
}

export interface WorkflowExecutionState {
    workflowId: string;
    status: 'running' | 'completed' | 'failed' | 'idle';
    currentStepId?: string;
    logs: string[];
    result?: any;
}

export interface AppState {
    installedSkills: Skill[];
    availableSkills: Skill[]; // From Marketplace
    registries: Registry[];
    globalSecurityLevel: 'strict' | 'standard' | 'loose';
    // New: Orchestration State
    activeWorkflows?: WorkflowExecutionState[];
}
