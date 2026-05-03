import * as vscode from 'vscode';

import { SkillManager } from './core/managers/SkillManager';
import { AppState, Skill } from '@shared/types';

function getWebviewHtml(extensionUri: vscode.Uri, webview: vscode.Webview) {
    const scriptPathOnDisk = vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js');
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
    const nonce = getNonce();

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https:; script-src 'nonce-${nonce}' ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Skill Cockpit</title>
                <style>
                    body, html, #root { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
                    body { background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
                </style>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
}

function getSidebarLauncherHtml(webview: vscode.Webview) {
    const nonce = getNonce();
    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https:; script-src 'nonce-${nonce}' ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Skill Cockpit</title>
                <style>
                    body { margin: 0; padding: 0; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); }
                    .header { padding: 12px; border-bottom: 1px solid var(--vscode-sideBar-border); display: flex; align-items: center; justify-content: space-between; }
                    .header-title { font-size: 11px; font-weight: 600; text-transform: uppercase; opacity: 0.8; }
                    .icon-btn { background: none; border: none; color: var(--vscode-icon-foreground); cursor: pointer; padding: 4px; border-radius: 4px; }
                    .icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
                    
                    .skill-list { padding: 0; margin: 0; list-style: none; }
                    .skill-item { padding: 8px 12px; border-bottom: 1px solid var(--vscode-sideBar-border); display: flex; align-items: center; gap: 8px; cursor: pointer; }
                    .skill-item:hover { background: var(--vscode-list-hoverBackground); }
                    .skill-icon { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
                    .skill-info { flex: 1; min-width: 0; }
                    .skill-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .skill-status { font-size: 11px; opacity: 0.7; }
                    .skill-status.active { color: var(--vscode-testing-iconPassed); }
                    
                    .actions { padding: 12px; }
                    .primary-btn { width: 100%; padding: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer; }
                    .primary-btn:hover { background: var(--vscode-button-hoverBackground); }
                    
                    .empty-state { padding: 20px; text-align: center; opacity: 0.6; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <span class="header-title">Installed Skills</span>
                    <button class="icon-btn" id="refresh" title="Refresh">↻</button>
                </div>
                
                <ul class="skill-list" id="skillList">
                    <!-- Skills will be rendered here -->
                </ul>
                
                <div id="emptyState" class="empty-state" style="display: none;">
                    No skills installed
                </div>

                <div class="actions">
                    <button class="primary-btn" id="open">Open Dashboard</button>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    // Handle Messages
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'state.update') {
                            renderSkills(message.state.installedSkills || []);
                        }
                    });

                    // Initial Request
                    vscode.postMessage({ command: 'ui.init' });

                    // Actions
                    document.getElementById('open').addEventListener('click', () => {
                        vscode.postMessage({ command: 'ui.openEditor' });
                    });
                    
                    document.getElementById('refresh').addEventListener('click', () => {
                        vscode.postMessage({ command: 'skills.refresh' });
                    });

                    function renderSkills(skills) {
                        const list = document.getElementById('skillList');
                        const empty = document.getElementById('emptyState');
                        
                        list.innerHTML = '';
                        
                        if (skills.length === 0) {
                            empty.style.display = 'block';
                            return;
                        }
                        
                        empty.style.display = 'none';
                        skills.forEach(skill => {
                            const li = document.createElement('li');
                            li.className = 'skill-item';
                            li.innerHTML = \`
                                <div class="skill-icon">\${skill.icon || '📦'}</div>
                                <div class="skill-info">
                                    <div class="skill-name">\${skill.name}</div>
                                    <div class="skill-status \${skill.enabled ? 'active' : ''}">
                                        \${skill.enabled ? '● Active' : '○ Disabled'}
                                    </div>
                                </div>
                            \`;
                            li.onclick = () => {
                                // Open console and focus this skill?
                                vscode.postMessage({ command: 'ui.openEditor', skillId: skill.id });
                            };
                            list.appendChild(li);
                        });
                    }
                </script>
            </body>
            </html>`;
}

function sanitizeSkill(skill: Skill): Skill {
    return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        author: skill.author,
        type: skill.type,
        scope: skill.scope,
        source: skill.source,
        repoUrl: skill.repoUrl,
        icon: skill.icon,
        tags: skill.tags || [],
        status: skill.status,
        enabled: skill.enabled,
        security: skill.security,
        syncStatus: skill.syncStatus
    };
}

function sanitizeState(state: AppState): AppState {
    return {
        installedSkills: (state.installedSkills || []).map(sanitizeSkill),
        availableSkills: (state.availableSkills || []).map(sanitizeSkill),
        registries: state.registries || [],
        globalSecurityLevel: state.globalSecurityLevel,
        activeWorkflows: state.activeWorkflows || []
    };
}

class SkillCockpitManager {
    public static currentPanel: SkillCockpitManager | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _skillManager: SkillManager;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, skillManager: SkillManager) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._skillManager = skillManager;

        // Set the webview's initial html content
        this._update();
        this._broadcastState();
        setTimeout(() => this._broadcastState(), 300);

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'app.init':
                        // 1. Send cached state IMMEDIATELY
                        this._broadcastState();
                        
                        // 2. Refresh in background (don't await)
                        this._skillManager.refresh().then(() => {
                            this._broadcastState();
                        }).catch(e => {
                            console.error('Background refresh failed:', e);
                        });
                        return;

                    case 'skills.refresh':
                        // Explicit refresh button clicked - show progress
                        try {
                            await vscode.window.withProgress({
                                location: vscode.ProgressLocation.Notification,
                                title: "Refreshing Skills...",
                                cancellable: false
                            }, async () => {
                                await this._skillManager.refresh();
                            });
                        } catch (e) {
                            console.error('Refresh failed:', e);
                            vscode.window.showErrorMessage('Skill refresh failed: ' + e);
                        }
                        this._broadcastState();
                        return;
                    case 'skills.install':
                        vscode.window.showInformationMessage(`Installing: ${message.url}`);
                        await this._skillManager.installSkill(message.url, message.scope);
                        this._broadcastState();
                        return;
                    case 'skills.save':
                        vscode.window.showInformationMessage(`Saving skill: ${message.skill.name}`);
                        await this._skillManager.saveSkill(message.skill);
                        this._broadcastState();
                        return;
                    case 'skills.sync':
                        try {
                            await this._skillManager.syncSkill(message.skillId, message.target);
                        } catch (e: any) {
                            vscode.window.showErrorMessage(`Sync Failed: ${e.message}`);
                        }
                        return;
                    case 'skills.update':
                        await this._skillManager.updateSkill(message.skillId);
                        this._broadcastState();
                        return;
                    case 'skills.toggle':
                        await this._skillManager.toggleSkill(message.skillId, message.enabled);
                        this._broadcastState();
                        return;
                    case 'skills.delete':
                        // Optional: Ask for confirmation on Host side, or trust UI did it.
                        // For safety, let's assume UI confirmation or "Undo" pattern.
                        await this._skillManager.deleteSkill(message.skillId);
                        this._broadcastState();
                        return;
                    case 'skills.get':
                        const skill = this._skillManager.getState().installedSkills.find(s => s.id === message.skillId);
                        if (this._panel && this._panel.webview) {
                            this._panel.webview.postMessage({
                                type: 'skill.data',
                                skill: skill ? sanitizeSkill(skill) : null
                            });
                        }
                        return;
                    case 'skills.getDetails':
                        const details = await this._skillManager.getSkillDetails(message.skillId);
                        if (this._panel && this._panel.webview) {
                            this._panel.webview.postMessage({
                                type: 'skill.details',
                                skillId: message.skillId,
                                details: details
                            });
                        }
                        return;
                    case 'skills.openFile':
                        const skillToCheck = this._skillManager.getState().installedSkills.find(s => s.id === message.skillId);
                        if (skillToCheck && skillToCheck.realPath) {
                            const fs = require('fs');
                            const path = require('path');
                            let targetPath = skillToCheck.realPath;
                            
                            // If user requested a specific file inside the skill directory
                            if (message.file) {
                                if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
                                    targetPath = path.join(targetPath, message.file);
                                } else {
                                    // If skill is a file, we ignore message.file or check if it matches
                                }
                            }
                            
                            try {
                                const doc = await vscode.workspace.openTextDocument(targetPath);
                                await vscode.window.showTextDocument(doc);
                            } catch (e) {
                                vscode.window.showErrorMessage(`Failed to open file: ${e}`);
                            }
                        }
                        return;
                    case 'skills.getFileContent':
                        const content = await this._skillManager.getSkillFileContent(message.skillId, message.fileName);
                        if (this._panel && this._panel.webview) {
                            this._panel.webview.postMessage({
                                type: 'skill.fileContent',
                                skillId: message.skillId,
                                fileName: message.fileName,
                                content: content
                            });
                        }
                        return;
                    case 'zen.mode.toggle':
                        console.log('[Extension] Toggling Zen Mode:', message.state);
                        // Force maximize the editor group to ensure panel is large
                        await vscode.commands.executeCommand('workbench.action.maximizeEditor');
                        // Toggle global Zen Mode
                        await vscode.commands.executeCommand('workbench.action.toggleZenMode');
                        return;
                    case 'navigate':
                        // Bounce navigation message back to webview to trigger routing
                        if (this._panel && this._panel.webview) {
                            this._panel.webview.postMessage(message);
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _broadcastState() {
        const state = sanitizeState(this._skillManager.getState());
        const activeWorkflows: any[] = [];

        try {
            this._panel.webview.postMessage({
                type: 'state.update',
                state: { ...state, activeWorkflows }
            });
        } catch (e) {
            console.error('Failed to post state to webview:', e);
        }
    }

    public static createOrShow(extensionUri: vscode.Uri, skillManager: SkillManager) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (SkillCockpitManager.currentPanel) {
            SkillCockpitManager.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'skillMockpitView',
            'Skill Cockpit',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true, // Keep state alive
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist'),
                    extensionUri
                ]
            }
        );

        SkillCockpitManager.currentPanel = new SkillCockpitManager(panel, extensionUri, skillManager);
    }

    public dispose() {
        SkillCockpitManager.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = getWebviewHtml(this._extensionUri, webview);
    }
}

class SkillCockpitViewProvider implements vscode.WebviewViewProvider {
    private _view: vscode.WebviewView | undefined;
    private readonly _extensionUri: vscode.Uri;
    private readonly _skillManager: SkillManager;
    private _disposables: vscode.Disposable[] = [];
    private _autoOpenedEditor = false;

    constructor(extensionUri: vscode.Uri, skillManager: SkillManager) {
        this._extensionUri = extensionUri;
        this._skillManager = skillManager;
    }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        const webview = webviewView.webview;

        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                this._extensionUri
            ]
        };

        webview.html = getSidebarLauncherHtml(webview);

        webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'ui.openEditor':
                    SkillCockpitManager.createOrShow(this._extensionUri, this._skillManager);
                    // If opening specific skill, navigate to it
                    if (message.skillId && SkillCockpitManager.currentPanel) {
                        setTimeout(() => {
                            SkillCockpitManager.currentPanel?._panel.webview.postMessage({
                                command: 'navigate',
                                page: 'console', // or whichever page the skill is on, assuming console for now
                                skillId: message.skillId
                            });
                        }, 500); // Small delay to ensure React is ready
                    }
                    return;
                case 'ui.init':
                    this._broadcastState();
                    return;
                case 'skills.refresh':
                    await this._skillManager.refresh();
                    this._broadcastState();
                    return;
            }
        }, null, this._disposables);

        if (!this._autoOpenedEditor) {
            this._autoOpenedEditor = true;
            SkillCockpitManager.createOrShow(this._extensionUri, this._skillManager);
        }

        webviewView.onDidDispose(() => {
            this._view = undefined;
            while (this._disposables.length) {
                const d = this._disposables.pop();
                if (d) d.dispose();
            }
        });
    }

    private _broadcastState() {
        if (!this._view) return;
        const state = sanitizeState(this._skillManager.getState());
        this._view.webview.postMessage({
            type: 'state.update',
            state: { ...state, activeWorkflows: [] }
        });
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Singleton Instance
let skillManager: SkillManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "Skill Cockpit" is now active!');

    skillManager = new SkillManager();
    // CRITICAL: Start scanning immediately in background
    skillManager.initialize();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'skillMockpitView',
            new SkillCockpitViewProvider(context.extensionUri, skillManager),
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    const disposable = vscode.commands.registerCommand('skillCockpit.open', async () => {
        // Ensure data is fresh when opening UI
        // await skillManager.refresh(); // Moved to Webview app.init to avoid blocking UI
        SkillCockpitManager.createOrShow(context.extensionUri, skillManager);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
