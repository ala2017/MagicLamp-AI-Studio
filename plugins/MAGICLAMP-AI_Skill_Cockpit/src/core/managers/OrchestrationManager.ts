import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { WorkflowConfig, WorkflowStep } from '../../shared/types';

export interface CrewAIAgent {
    name: string;
    role: string;
    goal: string;
    backstory: string;
}

export interface CrewAITask {
    name: string;
    description: string;
    expected_output: string;
    agent: string;
}

export interface CrewAIConfig {
    agents: Record<string, Omit<CrewAIAgent, 'name'>>;
    tasks: Record<string, Omit<CrewAITask, 'name'>>;
}

export class OrchestrationManager {

    constructor() {
        console.log('[OrchestrationManager] Initialized (Static Mode)');
    }

    /**
     * Parse a workflow file content into a structured config
     */
    public parseWorkflow(content: string, type: 'crewai' | 'autogen' | 'native' = 'crewai'): WorkflowConfig {
        if (type === 'crewai') {
            return this.parseCrewAI(content);
        }
        // Fallback or other types
        return {
            id: 'unknown',
            name: 'Unknown Workflow',
            steps: []
        };
    }

    private parseCrewAI(content: string): WorkflowConfig {
        try {
            const parsed = yaml.load(content) as CrewAIConfig;
            
            const steps: WorkflowStep[] = [];
            
            // Map Tasks to Steps
            if (parsed.tasks) {
                Object.entries(parsed.tasks).forEach(([key, task]) => {
                    steps.push({
                        id: key,
                        name: key, // Task name as step name
                        agent: task.agent,
                        params: {
                            description: task.description,
                            expected_output: task.expected_output
                        }
                    });
                });
            }

            // We also store Agents in a special way or just keep them in params?
            // For editing purposes, we might need a richer structure than WorkflowConfig.
            // But for now, let's pack agents into a "setup" step or similar, 
            // OR extend WorkflowConfig. 
            // Let's store the raw agents in a special step for now or assume UI handles it.
            // A better approach for the Editor is to return the Raw Config wrapped.
            
            return {
                id: 'crewai-workflow', // TODO: Generate or read from somewhere
                name: 'CrewAI Workflow',
                steps: steps,
                // We'll abuse 'description' to store the raw agents JSON for the UI to reconstruct
                description: JSON.stringify(parsed.agents || {}) 
            };
        } catch (e) {
            console.error('Failed to parse CrewAI YAML:', e);
            return { id: 'error', name: 'Error Parsing', steps: [] };
        }
    }

    /**
     * Save a workflow configuration to disk
     */
    public async saveWorkflow(config: WorkflowConfig, filePath: string): Promise<void> {
        // Reconstruct CrewAI YAML
        const agents = config.description ? JSON.parse(config.description) : {};
        const tasks: Record<string, any> = {};

        config.steps.forEach(step => {
            tasks[step.id] = {
                description: step.params?.description,
                expected_output: step.params?.expected_output,
                agent: step.agent
            };
        });

        const yamlObj = {
            agents,
            tasks
        };

        const yamlStr = yaml.dump(yamlObj);
        
        // Write to file
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(yamlStr));
        
        console.log(`[OrchestrationManager] Saved workflow to ${filePath}`);
    }
}
