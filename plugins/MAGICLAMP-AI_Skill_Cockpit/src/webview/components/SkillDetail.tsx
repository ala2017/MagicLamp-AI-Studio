import React, { useEffect, useState } from 'react';
import { Skill } from '@shared/types';
import { Button } from './ui/Button';
import { X, FileCode, BookOpen, ExternalLink, Play } from 'lucide-react';
import { vscode } from '../utils/vscode';

interface SkillDetailProps {
    skill: Skill;
    onClose: () => void;
}

export const SkillDetail: React.FC<SkillDetailProps> = ({ skill, onClose }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'code'>('overview');
    const [details, setDetails] = useState<{ readme: string; files: string[], type: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // Request details
        vscode.postMessage({ command: 'skills.getDetails', skillId: skill.id });

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'skill.details' && message.skillId === skill.id) {
                setDetails(message.details);
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [skill.id]);

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--vscode-editor-background)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--vscode-widget-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--vscode-editor-background)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '24px' }}>{skill.icon || '📦'}</div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px' }}>{skill.name}</h2>
                        <div style={{ opacity: 0.7, fontSize: '12px' }}>v{skill.version} • {skill.author}</div>
                    </div>
                </div>
                <Button variant="ghost" size="sm" icon={<X size={16} />} onClick={onClose} />
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--vscode-widget-border)',
                padding: '0 24px'
            }}>
                <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BookOpen size={14} />} label="Overview" />
                <TabButton active={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<FileCode size={14} />} label="Source Code" />
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>Loading details...</div>
                ) : (
                    <>
                        {activeTab === 'overview' && (
                            <div className="markdown-body">
                                {details?.readme ? (
                                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--vscode-font-monospace)' }}>
                                        {details.readme}
                                    </div>
                                ) : (
                                    <div style={{ opacity: 0.6 }}>No documentation available.</div>
                                )}
                            </div>
                        )}

                        {activeTab === 'code' && (
                            <div>
                                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3>Core Files</h3>
                                    {details?.type === 'file' && (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon={<ExternalLink size={14} />}
                                            onClick={() => vscode.postMessage({ command: 'skills.openFile', skillId: skill.id })}
                                        >
                                            Open File in Editor
                                        </Button>
                                    )}
                                </div>

                                {details?.files && details.files.length > 0 ? (
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {details.files.map(file => (
                                            <div
                                                key={file}
                                                style={{
                                                    padding: '12px',
                                                    background: 'var(--vscode-textBlockQuote-background)',
                                                    border: '1px solid var(--vscode-textBlockQuote-border)',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}
                                                onClick={() => vscode.postMessage({ command: 'skills.openFile', skillId: skill.id, file })}
                                            >
                                                <FileCode size={16} />
                                                <span>{file}</span>
                                                <ExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ opacity: 0.6 }}>No source files found.</div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        style={{
            background: 'none',
            border: 'none',
            borderBottom: active ? '2px solid var(--vscode-activityBar-activeBorder)' : '2px solid transparent',
            color: active ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500
        }}
    >
        {icon}
        {label}
    </button>
);
