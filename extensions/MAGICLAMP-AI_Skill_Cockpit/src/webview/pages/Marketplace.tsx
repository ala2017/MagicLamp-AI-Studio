import React from 'react';
import { Shield, Globe, Download, Plus } from 'lucide-react';
import { Skill } from '@shared/types';
import { Button } from '../components/ui/Button';

interface MarketplacePageProps {
    skills: Skill[];
    loading: boolean;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({ skills, loading }) => {
    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Marketplace {loading && '(Loading...)'}</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: '0.9em', opacity: 0.7, alignSelf: 'center' }}>
                        Sources: Official + SkillHub
                    </span>
                    <button style={{
                        background: 'var(--vscode-button-backgroind)',
                        color: 'var(--vscode-button-foreground)',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: 2,
                        cursor: 'pointer'
                    }}>
                        Add Registry
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {skills.map(skill => (
                    <div key={skill.id} style={{
                        border: '1px solid var(--vscode-widget-border)',
                        background: 'var(--vscode-editor-background)',
                        padding: 15,
                        borderRadius: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong style={{ fontSize: '1.1em' }}>{skill.name}</strong>
                            {skill.tags.includes('official') ? (
                                <span title="Verified Official Source"><Shield size={16} color="var(--neon-green)" /></span>
                            ) : (
                                <span title="Community Source"><Globe size={16} color="#888" /></span>
                            )}
                        </div>

                        <div style={{ fontSize: '0.85em', opacity: 0.8, minHeight: 40 }}>
                            {skill.description.slice(0, 100)}...
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {skill.tags.slice(0, 2).map(tag => (
                                    <span key={tag} style={{
                                        fontSize: '0.75em',
                                        padding: '2px 5px',
                                        background: 'rgba(255,255,255,0.1)',
                                        borderRadius: 3
                                    }}>
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                            <button style={{
                                background: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: 2,
                                cursor: 'pointer'
                            }}>
                                Install
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
