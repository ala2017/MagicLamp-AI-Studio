import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';

// Mock types for UI to avoid import issues
interface Agent {
    name: string;
    role: string;
    goal: string;
    backstory: string;
}

interface Task {
    id: string;
    description: string;
    expected_output: string;
    agent: string;
}

export const Orchestration: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    // Mock Load Data
    useEffect(() => {
        if (selectedFile === 'crewai_research.yaml') {
            setAgents([
                { name: 'researcher', role: 'Senior Researcher', goal: 'Uncover info', backstory: 'Driven by curiosity' },
                { name: 'writer', role: 'Content Writer', goal: 'Write articles', backstory: 'Expert in tech' }
            ]);
            setTasks([
                { id: 'research_task', description: 'Find news', expected_output: 'A report', agent: 'researcher' },
                { id: 'write_task', description: 'Write blog', expected_output: 'A blog post', agent: 'writer' }
            ]);
        }
    }, [selectedFile]);

    const handleSave = () => {
        console.log('Saving Workflow:', { agents, tasks });
        // In real app: vscode.postMessage({ command: 'workflow.save', data: { agents, tasks } })
    };

    return (
        <div style={{ padding: 20 }}>
            <h1 style={{ color: 'var(--vscode-editor-foreground)' }}>Workflow Configuration</h1>
            <p style={{ color: 'var(--vscode-descriptionForeground)' }}>
                Define and configure your AI Agent Workflows. (Static Configuration Only)
            </p>
            
            <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ color: 'var(--vscode-editor-foreground)', margin: 0 }}>Workflow Files</h3>
                    <Button onClick={() => console.log('Create Config')}>
                        + New Config
                    </Button>
                </div>
                
                <div style={{ 
                    border: '1px solid var(--vscode-widget-border)', 
                    borderRadius: 4,
                    background: 'var(--vscode-editor-background)',
                }}>
                    <div 
                        onClick={() => setSelectedFile('crewai_research.yaml')}
                        style={{ 
                            padding: 15, 
                            borderBottom: '1px solid var(--vscode-widget-border)',
                            cursor: 'pointer',
                            background: selectedFile === 'crewai_research.yaml' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                            color: selectedFile === 'crewai_research.yaml' ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'
                        }}
                    >
                        <div style={{ fontWeight: 'bold' }}>crewai_research.yaml</div>
                        <div style={{ fontSize: '0.9em', opacity: 0.8 }}>3 Agents • 2 Tasks</div>
                    </div>
                    <div style={{ padding: 15, borderBottom: '1px solid var(--vscode-widget-border)', opacity: 0.5 }}>
                        <div style={{ fontWeight: 'bold' }}>autogen_dev_team.json (Mock)</div>
                    </div>
                </div>
            </div>

            {selectedFile && (
                <div style={{ marginTop: 30 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ color: 'var(--vscode-editor-foreground)' }}>Editor: {selectedFile}</h3>
                        <Button variant="primary" onClick={handleSave}>Save Changes</Button>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 10 }}>
                        {/* Agents Column */}
                        <div style={{ 
                            border: '1px solid var(--vscode-widget-border)', 
                            padding: 15, 
                            borderRadius: 4,
                            background: 'var(--vscode-editor-inactiveSelectionBackground)'
                        }}>
                            <h4 style={{ marginTop: 0 }}>Agents</h4>
                            {agents.map((agent, idx) => (
                                <div key={idx} style={{ marginBottom: 15, padding: 10, background: 'var(--vscode-editor-background)', borderRadius: 4 }}>
                                    <div style={{ marginBottom: 5 }}>
                                        <label style={{ display: 'block', fontSize: '0.8em', opacity: 0.7 }}>Name</label>
                                        <input 
                                            value={agent.name} 
                                            onChange={(e) => {
                                                const newAgents = [...agents];
                                                newAgents[idx].name = e.target.value;
                                                setAgents(newAgents);
                                            }}
                                            style={{ width: '100%', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: 5 }}>
                                        <label style={{ display: 'block', fontSize: '0.8em', opacity: 0.7 }}>Role</label>
                                        <input 
                                            value={agent.role} 
                                            onChange={(e) => {
                                                const newAgents = [...agents];
                                                newAgents[idx].role = e.target.value;
                                                setAgents(newAgents);
                                            }}
                                            style={{ width: '100%', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8em', opacity: 0.7 }}>Goal</label>
                                        <textarea 
                                            value={agent.goal} 
                                            onChange={(e) => {
                                                const newAgents = [...agents];
                                                newAgents[idx].goal = e.target.value;
                                                setAgents(newAgents);
                                            }}
                                            style={{ width: '100%', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Tasks Column */}
                        <div style={{ 
                            border: '1px solid var(--vscode-widget-border)', 
                            padding: 15, 
                            borderRadius: 4,
                            background: 'var(--vscode-editor-inactiveSelectionBackground)'
                        }}>
                            <h4 style={{ marginTop: 0 }}>Tasks</h4>
                            {tasks.map((task, idx) => (
                                <div key={idx} style={{ marginBottom: 15, padding: 10, background: 'var(--vscode-editor-background)', borderRadius: 4 }}>
                                    <div style={{ marginBottom: 5 }}>
                                        <label style={{ display: 'block', fontSize: '0.8em', opacity: 0.7 }}>ID</label>
                                        <input 
                                            value={task.id} 
                                            disabled
                                            style={{ width: '100%', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', opacity: 0.5 }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: 5 }}>
                                        <label style={{ display: 'block', fontSize: '0.8em', opacity: 0.7 }}>Assigned Agent</label>
                                        <select 
                                            value={task.agent}
                                            onChange={(e) => {
                                                const newTasks = [...tasks];
                                                newTasks[idx].agent = e.target.value;
                                                setTasks(newTasks);
                                            }}
                                            style={{ width: '100%', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' }}
                                        >
                                            {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8em', opacity: 0.7 }}>Description</label>
                                        <textarea 
                                            value={task.description} 
                                            onChange={(e) => {
                                                const newTasks = [...tasks];
                                                newTasks[idx].description = e.target.value;
                                                setTasks(newTasks);
                                            }}
                                            style={{ width: '100%', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
