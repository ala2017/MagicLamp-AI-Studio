import React, { useState } from 'react';
import { Skill } from '@shared/types';
import {
    Plug,
    Zap,
    Settings,
    Pencil,
    Download,
    FileText,
    FolderGit2,
    Tags,
    CheckCircle2,
    XCircle,
    Shield,
    Wifi,
    Trash2,
    Power,
    Eye,
    BookOpen,
    FileCode,
    ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { vscode } from '../utils/vscode';
import { SkillDetail } from '../components/SkillDetail';

interface ConsolePageProps {
    skills: Skill[];
    loading: boolean;
    isZenMode?: boolean;
}

// Reusable Badge Component
const HudBadge: React.FC<{ label: string; sub?: string; color: 'blue' | 'purple' | 'green' }> = ({ label, sub, color }) => {
    const colorMap = {
        blue: 'var(--neon-cyan)',
        purple: 'var(--neon-purple)',
        green: 'var(--neon-green)'
    };

    return (
        <div style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: `1px solid ${colorMap[color]}`,
            background: `${colorMap[color]}15`,
            fontSize: '0.75rem',
            fontWeight: 600,
            color: colorMap[color],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px'
        }}>
            <span>{label}</span>
            {sub && <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>{sub}</span>}
        </div>
    );
};

// Icon Box Component for consistent icon styling
const IconBox: React.FC<{ children: React.ReactNode; active?: boolean; color?: string }> = ({
    children,
    active = false,
    color = 'var(--neon-cyan)'
}) => (
    <div className="hud-icon-box" style={{
        width: '42px',
        height: '42px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.3)',
        border: `1px solid ${active ? color : '#445'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        boxShadow: active ? `0 0 15px ${color}40` : 'none',
        transition: 'all 0.3s ease'
    }}>
        {children}
    </div>
);

// Tool Badge Component
const ToolBadge: React.FC<{ label: string; color: string; border: string }> = ({ label, color, border }) => (
    <div style={{
        padding: '6px 8px',
        background: color,
        border: `1px solid ${border}`,
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600
    }}>
        {label}
    </div>
);

// Individual Skill Row Component
const HudRow: React.FC<{ skill: Skill; expanded: boolean; onToggle: () => void; onInspect: (s: Skill) => void }> = ({ skill, expanded, onToggle, onInspect }) => {
    const isMcp = skill.type === 'mcp';
    const iconColor = isMcp ? 'var(--neon-purple)' : 'var(--neon-cyan)';
    
    // Local state for fetching details on expand
    const [details, setDetails] = React.useState<{ readme: string; files: string[]; type: string } | null>(null);
    const [activeFile, setActiveFile] = React.useState<string | null>(null);
    const [fileContent, setFileContent] = React.useState<string>('');
    const [loadingDetails, setLoadingDetails] = React.useState(false);

    React.useEffect(() => {
        if (expanded && !details) {
            setLoadingDetails(true);
            vscode.postMessage({ command: 'skills.getDetails', skillId: skill.id });
        }
    }, [expanded]);

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'skill.details' && message.skillId === skill.id) {
                setDetails(message.details);
                setLoadingDetails(false);
                // Default to first file if code view
                if (message.details.files && message.details.files.length > 0) {
                     // Try to find index.* or similar
                     const mainFile = message.details.files.find((f: string) => f.startsWith('index') || f.startsWith('main') || f.endsWith('.py') || f.endsWith('.js') || f.endsWith('.ts'));
                     if (mainFile) {
                         setActiveFile(mainFile);
                         vscode.postMessage({ command: 'skills.getFileContent', skillId: skill.id, fileName: mainFile });
                     } else {
                         setActiveFile(message.details.files[0]);
                         vscode.postMessage({ command: 'skills.getFileContent', skillId: skill.id, fileName: message.details.files[0] });
                     }
                }
            }
            if (message.type === 'skill.fileContent' && message.skillId === skill.id && message.fileName === activeFile) {
                setFileContent(message.content || '// No content or failed to read');
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [skill.id, activeFile]);

    // ACTION HANDLERS
    const handleAction = (action: string, e: React.MouseEvent) => {
        e.stopPropagation();
        console.log(`[UI] Triggering action: ${action} for ${skill.id}`);

        switch (action) {
            case 'edit':
                vscode.postMessage({ command: 'navigate', page: 'workshop', skillId: skill.id });
                break;
            case 'config':
                vscode.postMessage({ command: 'skills.config', skillId: skill.id });
                break;
            case 'update':
                vscode.postMessage({ command: 'skills.update', skillId: skill.id });
                break;
            case 'toggle':
                vscode.postMessage({ command: 'skills.toggle', skillId: skill.id, enabled: !skill.enabled });
                break;
            case 'delete':
                vscode.postMessage({ command: 'skills.delete', skillId: skill.id });
                break;
        }
    };

    return (
        <>
            {/* CLICKABLE ROW */}
            <div
                className={`hud-list-row ${expanded ? 'active' : ''}`}
                onClick={onToggle}
                style={{ cursor: 'pointer' }}
            >
                {/* 1. Name & Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ position: 'relative' }}>
                        <IconBox active={expanded} color={iconColor}>
                            {isMcp ? <Plug size={20} /> : <Zap size={20} />}
                        </IconBox>
                        {skill.updateAvailable && (
                            <div style={{
                                position: 'absolute', top: -4, right: -4,
                                width: 10, height: 10, borderRadius: '50%',
                                background: 'var(--neon-green)',
                                boxShadow: '0 0 5px var(--neon-green)'
                            }} title="Update Available" />
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.3px', color: '#fff' }}>
                            {skill.name}
                        </div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: iconColor,
                            marginTop: '3px',
                            opacity: 0.8,
                            fontFamily: 'var(--font-mono)'
                        }}>
                            v{skill.version} • {skill.author || 'Local'}
                        </div>
                    </div>
                </div>

                {/* 2. Badges */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <HudBadge label={skill.type.toUpperCase()} sub={skill.scope} color={isMcp ? 'purple' : 'blue'} />
                    {/* Source Badge */}
                    <HudBadge
                        label={skill.source === 'claude-config' ? 'CLAUDE' :
                            skill.source === 'cursor-rules' ? 'CURSOR' :
                                skill.source === 'global-antigravity' ? 'GLOBAL' :
                                    skill.source === 'workflow-file' ? 'WORKFLOW' : 'LOCAL'}
                        color={skill.source === 'claude-config' ? 'purple' :
                            skill.source === 'cursor-rules' ? 'blue' : 'green'}
                    />
                </div>

                {/* 3. Tools Context */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    <ToolBadge label="VS" color="rgba(0,122,204,0.2)" border="#007acc" />
                    {isMcp && <ToolBadge label="C." color="rgba(255,100,100,0.15)" border="#ff6464" />}
                </div>

                {/* 4. Status Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                        onClick={(e) => handleAction('toggle', e)}
                        title={skill.enabled ? "Click to Disable" : "Click to Enable"}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        {skill.enabled ? (
                            <CheckCircle2 size={16} color="var(--neon-green)" style={{ filter: 'drop-shadow(0 0 4px var(--neon-green))' }} />
                        ) : (
                            <XCircle size={16} color="#666" />
                        )}
                        <span style={{
                            color: skill.enabled ? 'var(--neon-green)' : '#888',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                        }}>
                            {skill.enabled ? 'Active' : 'Disabled'}
                        </span>
                    </div>
                </div>

                {/* 5. Primary Actions */}
                <div style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {expanded ? (
                        <>
                            <Button
                                variant="danger"
                                size="sm"
                                icon={<Trash2 size={14} />}
                                onClick={(e) => handleAction('delete', e)}
                            >
                                Uninstall
                            </Button>
                            {skill.updateAvailable && (
                                <Button
                                    variant="success"
                                    size="sm"
                                    icon={<Download size={14} />}
                                    onClick={(e) => handleAction('update', e)}
                                >
                                    Update
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Eye size={14} />}
                                onClick={(e) => { e.stopPropagation(); onInspect(skill); }}
                            >
                                Inspect
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={<Settings size={14} />}
                                onClick={(e) => handleAction('config', e)}
                            >
                                Config
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Pencil size={14} />}
                                onClick={(e) => handleAction('edit', e)}
                            >
                                Edit
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* EXPANDED DETAILS PANEL */}
            {expanded && (
                <div className="hud-details-panel" onClick={e => e.stopPropagation()}>
                    {/* Left: Documentation & Metadata */}
                    <div style={{ width: '50%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '15px', borderRight: '1px solid #333' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={18} />
                            Documentation
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.85rem', lineHeight: 1.6, color: '#e6edf3', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                             {loadingDetails ? (
                                 <div style={{ opacity: 0.6 }}>Loading details...</div>
                             ) : (
                                 <div style={{ whiteSpace: 'pre-wrap' }}>
                                     {details?.readme || skill.description || 'No documentation available.'}
                                 </div>
                             )}
                        </div>

                        {/* Metadata Tags */}
                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.75rem', opacity: 0.7, paddingTop: '10px', borderTop: '1px solid #333' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                 <FolderGit2 size={12} />
                                 {skill.source}
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                 <Tags size={12} />
                                 {skill.tags?.join(', ') || 'None'}
                             </div>
                        </div>
                    </div>

                    {/* Right: Source Code Preview */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--neon-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileCode size={18} />
                                Source Preview
                            </div>
                            {details?.files && details.files.length > 0 && (
                                <select 
                                    style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}
                                    value={activeFile || ''}
                                    onChange={(e) => {
                                        setActiveFile(e.target.value);
                                        vscode.postMessage({ command: 'skills.getFileContent', skillId: skill.id, fileName: e.target.value });
                                    }}
                                >
                                    {details.files.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            )}
                        </div>
                        
                        <div style={{ flex: 1, background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: '#161b22', padding: '8px 12px', borderBottom: '1px solid #30363d', fontSize: '0.8rem', opacity: 0.7, display: 'flex', justifyContent: 'space-between' }}>
                                <span>{activeFile || 'MANIFEST'}</span>
                                <Button variant="ghost" size="sm" onClick={() => vscode.postMessage({ command: 'skills.openFile', skillId: skill.id, file: activeFile })} icon={<ExternalLink size={12}/>}>Open</Button>
                            </div>
                            <div style={{ padding: '15px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#e6edf3', flex: 1, lineHeight: 1.7, overflowY: 'auto' }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {activeFile ? fileContent : (skill.instructions || JSON.stringify(skill.config, null, 2) || '# No content available')}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export const ConsolePage: React.FC<ConsolePageProps> = ({ skills, loading, isZenMode = false }) => {
    const [installUrl, setInstallUrl] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeSource, setActiveSource] = useState<string>('all');
    const [viewSkill, setViewSkill] = useState<Skill | null>(null);

    const handleInstall = () => {
        if (!installUrl.trim()) return;
        vscode.postMessage({ command: 'skills.install', url: installUrl });
        setInstallUrl('');
    };

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // Filter Logic
    const filteredSkills = skills.filter(s => {
        if (activeSource === 'all') return true;
        if (activeSource === 'local') return s.source === 'local-workspace';
        if (activeSource === 'global') return s.source === 'global-antigravity';
        if (activeSource === 'mcp') return s.source === 'claude-config';
        if (activeSource === 'cursor') return s.source && s.source.includes('cursor');
        if (activeSource === 'workflow') return s.type === 'workflow';
        return true;
    });

    const SourceTab = ({ id, label, icon }: any) => (
        <div
            onClick={() => setActiveSource(id)}
            style={{
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: activeSource === id ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                color: activeSource === id ? '#fff' : '#888',
                fontWeight: activeSource === id ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.9rem'
            }}
        >
            {icon}
            {label}
            <span style={{ fontSize: '0.75em', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '10px' }}>
                {skills.filter(s => {
                    if (id === 'all') return true;
                    if (id === 'local') return s.source === 'local-workspace';
                    if (id === 'global') return s.source === 'global-antigravity';
                    if (id === 'mcp') return s.source === 'claude-config';
                    if (id === 'cursor') return s.source && s.source.includes('cursor');
                    if (id === 'workflow') return s.type === 'workflow';
                    return false;
                }).length}
            </span>
        </div>
    );

    return (
        <div style={{ padding: '30px 40px', maxWidth: '1600px', margin: '0 auto', paddingBottom: '100px' }}>

            {/* HUD HEADER */}
            {!isZenMode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Zap size={28} color="var(--neon-cyan)" style={{ filter: 'drop-shadow(0 0 8px var(--neon-cyan))' }} />
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '1px' }}>
                            SKILL <span style={{ color: 'var(--neon-cyan)', textShadow: '0 0 10px var(--neon-cyan)' }}>COCKPIT</span>
                        </div>
                    </div>

                    {/* FILTER TABS */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <SourceTab id="all" label="ALL" />
                        <SourceTab id="workflow" label="WORKFLOWS" />
                        <SourceTab id="local" label="LOCAL" />
                        <SourceTab id="global" label="GLOBAL" />
                        <SourceTab id="mcp" label="MCP" />
                        <SourceTab id="cursor" label="CURSOR" />
                    </div>
                </div>
            )}

            {/* ZEN MODE FILTERS (Compact) */}
            {isZenMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                     <div style={{ display: 'flex', gap: '4px', transform: 'scale(0.9)', transformOrigin: 'right center' }}>
                        <SourceTab id="all" label="ALL" />
                        <SourceTab id="workflow" label="WORKFLOWS" />
                        <SourceTab id="local" label="LOCAL" />
                        <SourceTab id="global" label="GLOBAL" />
                        <SourceTab id="mcp" label="MCP" />
                        <SourceTab id="cursor" label="CURSOR" />
                    </div>
                </div>
            )}

            {/* INSTALL BAR - Hidden in Zen Mode */}
            {!isZenMode && (
                <div className="hud-glass-panel" style={{ padding: '14px 20px', marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <input
                        placeholder="Paste GitHub URL to Install..."
                        value={installUrl}
                        onChange={e => setInstallUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleInstall()}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1rem',
                            color: '#fff',
                            outline: 'none',
                            fontFamily: 'var(--font-mono)'
                        }}
                    />
                    <Button variant="primary" onClick={handleInstall}>
                        INSTALL
                    </Button>
                </div>
            )}

            {/* TABLE HEADERS */}
            <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '900px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(220px, 1.5fr) minmax(100px, auto) minmax(80px, auto) minmax(100px, auto) minmax(140px, auto)',
                        padding: '0 24px',
                        marginBottom: '10px',
                        opacity: 0.5,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        <div>Skill Name</div>
                        <div>Type</div>
                        <div>Tools</div>
                        <div>Status</div>
                        <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>

                    {/* SKILL LIST */}
                    <div>
                        {loading ? (
                            <div style={{
                                padding: '40px',
                                textAlign: 'center',
                                color: 'var(--vscode-descriptionForeground)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '15px'
                            }}>
                                <div className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: '24px' }}></div>
                                <div>Loading resources...</div>
                            </div>
                        ) : filteredSkills.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px',
                                opacity: 0.5,
                                border: '1px dashed #444',
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <Zap size={32} style={{ opacity: 0.3 }} />
                                <div>No resources found in this category.</div>
                            </div>
                        ) : (
                            filteredSkills.map(skill => (
                                <HudRow
                                    key={skill.id}
                                    skill={skill}
                                    expanded={expandedId === skill.id}
                                    onToggle={() => toggleExpand(skill.id)}
                                    onInspect={(s) => setViewSkill(s)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
            {viewSkill && <SkillDetail skill={viewSkill} onClose={() => setViewSkill(null)} />}
        </div>
    );
};
