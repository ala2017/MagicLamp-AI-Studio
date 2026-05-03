import React, { useState, useEffect } from 'react';
import { Wrench, Save, X, Play, Eraser, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { vscode } from '../utils/vscode';

interface WorkshopPageProps {
    skillId?: string | null;
}

export const WorkshopPage: React.FC<WorkshopPageProps> = ({ skillId }) => {
    const [activeTab, setActiveTab] = useState<'editor' | 'playground'>('editor');

    // Editor State
    const [name, setName] = useState('');
    const [type, setType] = useState('skill');
    const [version, setVersion] = useState('1.0.0');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');

    // Playground State
    const [chatLog, setChatLog] = useState<{ role: 'user' | 'agent', content: string }[]>([]);
    const [testInput, setTestInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (skillId) {
            console.log('[Workshop] Editing Skill ID:', skillId);
            setIsLoading(true);
            
            // Request skill data from backend
            vscode.postMessage({ command: 'skills.get', skillId });

            const handleMessage = (event: MessageEvent) => {
                const message = event.data;
                if (message.type === 'skill.data' && message.skill) {
                    const s = message.skill;
                    if (s.id === skillId) {
                        setName(s.name || '');
                        setVersion(s.version || '1.0.0');
                        setType(s.type || 'skill');
                        setDescription(s.description || '');
                        setInstructions(s.instructions || '');
                        setIsLoading(false);
                    }
                }
            };

            window.addEventListener('message', handleMessage);
            return () => window.removeEventListener('message', handleMessage);
        } else {
            // Reset for new skill
            setName('');
            setVersion('1.0.0');
            setType('skill');
            setDescription('');
            setInstructions('');
        }
    }, [skillId]);

    const handleSave = () => {
        vscode.postMessage({
            command: 'skills.save',
            skill: {
                id: skillId || name.toLowerCase().replace(/\s/g, '-'),
                name,
                version,
                type,
                description,
                instructions,
                author: 'User',
                tags: [],
                scope: 'project',
                repoUrl: ''
            }
        });
        alert('Save command sent!');
    };

    const handleRunTest = () => {
        if (!testInput.trim()) return;

        // 1. Add User Message
        setChatLog(prev => [...prev, { role: 'user', content: testInput }]);

        // 2. Simulate Processing (Simple Template Replacement for MVP)
        const output = instructions.replace('{{input}}', testInput)
            .replace('{{user_input}}', testInput);

        setTimeout(() => {
            setChatLog(prev => [...prev, { role: 'agent', content: output }]);
        }, 500);

        setTestInput('');
    };

    return (
        <div style={{ padding: '30px 40px', maxWidth: '1200px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* HERDER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ color: 'var(--neon-cyan)', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Wrench size={28} style={{ filter: 'drop-shadow(0 0 8px var(--neon-cyan))' }} />
                    {skillId ? `Edit Skill: ${name}` : 'Create New Skill'}
                </h1>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button
                        variant={activeTab === 'editor' ? 'primary' : 'ghost'}
                        onClick={() => setActiveTab('editor')}
                        icon={<Wrench size={16} />}
                    >
                        Editor
                    </Button>
                    <Button
                        variant={activeTab === 'playground' ? 'primary' : 'ghost'}
                        onClick={() => setActiveTab('playground')}
                        icon={<Play size={16} />}
                    >
                        Playground
                    </Button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="hud-glass-panel" style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                
                {isLoading && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        Loading skill data...
                    </div>
                )}

                {/* EDITOR TAB */}
                {activeTab === 'editor' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
                            <div className="hud-input-group">
                                <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7, fontSize: '0.85rem' }}>SKILL NAME</label>
                                <input className="hud-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Code Reviewer" />
                            </div>
                            <div className="hud-input-group">
                                <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7, fontSize: '0.85rem' }}>VERSION</label>
                                <input className="hud-input" value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.0" />
                            </div>
                            <div className="hud-input-group">
                                <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7, fontSize: '0.85rem' }}>TYPE</label>
                                <select className="hud-input" value={type} onChange={e => setType(e.target.value)} style={{ cursor: 'pointer' }}>
                                    <option value="skill">Skill</option>
                                    <option value="mcp">MCP</option>
                                    <option value="agent">Agent</option>
                                </select>
                            </div>
                        </div>

                        <div className="hud-input-group">
                            <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7, fontSize: '0.85rem' }}>DESCRIPTION</label>
                            <input className="hud-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short summary..." />
                        </div>

                        <div className="hud-input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7, fontSize: '0.85rem' }}>INSTRUCTIONS / PROMPT TEMPLATE</label>
                            <textarea
                                className="hud-input"
                                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', lineHeight: '1.6' }}
                                value={instructions}
                                onChange={e => setInstructions(e.target.value)}
                                placeholder="# System Prompt..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '10px' }}>
                            <Button variant="ghost" icon={<X size={16} />}>Cancel</Button>
                            <Button variant="success" icon={<Save size={16} />} onClick={handleSave}>Save Skill</Button>
                        </div>
                    </div>
                )}

                {/* PLAYGROUND TAB */}
                {activeTab === 'playground' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{
                            flex: 1,
                            border: '1px solid rgba(0,243,255,0.2)',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            padding: '20px',
                            background: 'rgba(0,0,0,0.2)',
                            overflowY: 'auto'
                        }}>
                            {chatLog.length === 0 ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, flexDirection: 'column', gap: '10px' }}>
                                    <MessageSquare size={40} />
                                    <div>Test your skill prompts here</div>
                                </div>
                            ) : (
                                chatLog.map((msg, i) => (
                                    <div key={i} style={{
                                        marginBottom: '15px',
                                        textAlign: msg.role === 'user' ? 'right' : 'left'
                                    }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '10px 16px',
                                            borderRadius: '12px',
                                            background: msg.role === 'user' ? 'var(--neon-cyan)' : '#334',
                                            color: msg.role === 'user' ? '#000' : '#fff',
                                            maxWidth: '80%',
                                            borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                                            borderTopLeftRadius: msg.role === 'agent' ? '2px' : '12px',
                                        }}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '15px' }}>
                            <Button variant="ghost" onClick={() => setChatLog([])} icon={<Eraser size={16} />}>Clear</Button>
                            <input
                                className="hud-input"
                                style={{ flex: 1 }}
                                placeholder="Enter test input..."
                                value={testInput}
                                onChange={e => setTestInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRunTest()}
                            />
                            <Button variant="primary" onClick={handleRunTest} icon={<Play size={16} />}>Run</Button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
