import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { NavRail } from './components/layout/NavRail';
import { Button } from './components/ui/Button';
import { ConsolePage } from './pages/Console';
import { WorkshopPage } from './pages/Workshop';
import { Orchestration } from './pages/Orchestration';
import { vscode } from './utils/vscode';
import './styles.css';

const MarketPage = () => <div style={{ padding: 40, color: 'var(--vscode-editor-foreground)' }}>Marketplace Coming Soon...</div>;

const Container = () => {
    const [skills, setSkills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('console');
    const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
    const [isZenMode, setIsZenMode] = useState(false);
    const hasStateRef = useRef(false);

    useEffect(() => {
        // Listen for messages from Host and Internal Components
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            // 1. State Update from Host
            if (message.type === 'state.update') {
                const state = typeof message.state === 'string' ? JSON.parse(message.state) : message.state;
                setSkills(state?.installedSkills || []);
                setLoading(false);
                hasStateRef.current = true;
            }
            // 2. Navigation Request (from Console Page usually)
            else if (message.command === 'navigate') {
                console.log('[Container] Navigating to:', message.page, 'ID:', message.skillId);
                setActiveTab(message.page);
                if (message.skillId) setActiveSkillId(message.skillId);
            }
        };

        window.addEventListener('message', handleMessage);

        // Initial Refresh Request
        setLoading(true);
        if (vscode) {
            vscode.postMessage({ command: 'app.init' });
        } else {
            setLoading(false);
        }

        const fallbackTimer = setTimeout(() => {
            if (!hasStateRef.current) {
                if (vscode) {
                    vscode.postMessage({ command: 'app.init', reason: 'fallback' });
                }
                setLoading(false);
            }
        }, 1500);

        return () => {
            clearTimeout(fallbackTimer);
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const toggleZenMode = () => {
        const newState = !isZenMode;
        setIsZenMode(newState);
        if (vscode) {
            vscode.postMessage({ command: 'zen.mode.toggle', state: newState });
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--hud-bg)' }}>
            {!isZenMode && <NavRail activeTab={activeTab} onTabChange={(tab: string) => { setActiveTab(tab); setActiveSkillId(null); }} />}

            <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 10 }}>
                    <Button
                        variant={isZenMode ? 'primary' : 'ghost'}
                        size="sm"
                        icon={<span>🧘</span>}
                        onClick={toggleZenMode}
                    >
                        {isZenMode ? 'Exit Zen' : 'Zen'}
                    </Button>
                </div>
                {activeTab === 'console' && <ConsolePage skills={skills} loading={loading} isZenMode={isZenMode} />}
                {activeTab === 'marketplace' && <MarketPage />}
                {activeTab === 'workshop' && <WorkshopPage skillId={activeSkillId} />}
                {activeTab === 'orchestration' && <Orchestration />}
                {activeTab === 'settings' && <div style={{ padding: 40 }}>Settings (Coming Soon)</div>}
            </main>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);

// Global Error Handler for Webview
window.onerror = function(message, source, lineno, colno, error) {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        rootEl.innerHTML = `
            <div style="color: red; padding: 20px; font-family: monospace;">
                <h3>Webview Runtime Error</h3>
                <p><strong>Message:</strong> ${message}</p>
                <p><strong>Source:</strong> ${source}:${lineno}:${colno}</p>
                <pre>${error?.stack || ''}</pre>
            </div>
        `;
    }
};

try {
    root.render(<Container />);
} catch (e: any) {
    console.error('React Render Error:', e);
    document.getElementById('root')!.innerHTML = `<div style="color:red">Render Error: ${e.message}</div>`;
}
