import * as vscode from 'vscode';
import { AppState, Skill } from '@shared/types';
import { ManifestService } from '../services/ManifestService';
import { SkillHubBridge } from '../services/SkillHubBridge';
import { SecurityService } from '../services/SecurityService';
import { StorageService } from '../services/StorageService';
import { DiscoveryService } from '../services/DiscoveryService';
import { RepoAnalysisService } from '../services/RepoAnalysisService';
import { SyncManager } from './SyncManager';
import { McpConfigProvider } from '../services/discovery/McpConfigProvider';

import { GitService } from '../services/GitService';

export class SkillManager {
    private _state: AppState = {
        installedSkills: [],
        availableSkills: [],
        registries: [
            { name: 'Official', url: 'default', type: 'official', enabled: true }
        ],
        globalSecurityLevel: 'standard'
    };

    private _manifestService: ManifestService;
    private _skillHubBridge: SkillHubBridge;
    private _securityService: SecurityService;
    private _storageService: StorageService;
    private _repoAnalysis: RepoAnalysisService;
    private _discoveryService: DiscoveryService;
    private _syncManager: SyncManager;
    private _mcpProvider: McpConfigProvider;
    private _gitService: GitService;

    constructor() {
        this._manifestService = new ManifestService();
        this._skillHubBridge = new SkillHubBridge();
        this._securityService = new SecurityService();
        this._storageService = new StorageService();
        this._repoAnalysis = new RepoAnalysisService();
        this._discoveryService = new DiscoveryService();
        this._syncManager = new SyncManager();
        this._mcpProvider = new McpConfigProvider();
        this._gitService = new GitService();
    }

    public async initialize(): Promise<void> {
        console.log('[SkillManager] 🚀 Initializing Core Systems...');
        try {
            await this.refresh();
            console.log(`[SkillManager] ✅ Initialization Complete. Loaded ${this._state.installedSkills.length} local skills.`);
        } catch (error) {
            console.error('[SkillManager] ❌ Initialization Failed:', error);
        }
    }

    public async refresh() {
        // 1. Universal Discovery
        const allSkills = await this._discoveryService.discoverAll();

        // 2. Update State
        this._state.installedSkills = allSkills;
        const marketSkills = await this._manifestService.fetchAllRegistries(this._state.registries);
        const bridgeSkills = await this._skillHubBridge.fetchSkills().catch(_e => []);

        this._state.availableSkills = [...marketSkills, ...bridgeSkills];
        
        // 3. Check for Updates (Debounced or Async)
        this.checkForUpdates();

        console.log(`[SkillManager] Refreshed: ${allSkills.length} assets found across system.`);
    }

    public async checkForUpdates() {
        console.log('[SkillManager] Checking for updates...');
        for (const skill of this._state.installedSkills) {
            // Strategy 1: Git-based update
            if (skill.source === 'global-antigravity' && skill.realPath) {
                const hasUpdate = await this._gitService.checkUpdateAvailable(skill.realPath);
                if (hasUpdate) {
                    skill.updateAvailable = true;
                }
            }
            // Strategy 2: Registry-based update (Not implemented yet, placeholder)
        }
    }

    public async updateSkill(skillId: string) {
        const skill = this._state.installedSkills.find(s => s.id === skillId);
        if (!skill) return;

        if (skill.source === 'global-antigravity' && skill.realPath) {
            try {
                await this._gitService.pullRepo(skill.realPath);
                skill.updateAvailable = false;
                vscode.window.showInformationMessage(`Skill "${skill.name}" updated successfully.`);
                await this.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed to update skill: ${e}`);
            }
        } else {
             vscode.window.showInformationMessage('Update not supported for this skill type yet.');
        }
    }

    public async getSkillDetails(skillId: string): Promise<{ readme: string; files: string[]; type: string } | null> {
        const skill = this._state.installedSkills.find(s => s.id === skillId);
        if (!skill) {
            return null;
        }

        const fs = require('fs');
        const path = require('path');
        const details = { readme: skill.description || '', files: [] as string[], type: 'file' };

        if (skill.realPath && fs.existsSync(skill.realPath)) {
            const stat = fs.statSync(skill.realPath);
            if (stat.isDirectory()) {
                details.type = 'directory';
                // Directory: Find README and list files
                const files = fs.readdirSync(skill.realPath);
                const readmeFile = files.find((f: string) => f.toLowerCase().startsWith('readme'));
                if (readmeFile) {
                    try {
                        details.readme = fs.readFileSync(path.join(skill.realPath, readmeFile), 'utf-8');
                    } catch (e) {
                        console.warn('Failed to read README:', e);
                    }
                }
                // Filter and list files
                details.files = files.filter((f: string) => !['node_modules', '.git', '.DS_Store', 'dist', 'out', '.vscode'].includes(f));
            } else {
                details.type = 'file';
                // Single File: Content as readme/code
                details.files = [path.basename(skill.realPath)];
                // If it's a markdown file, maybe read it as readme
                if (skill.realPath.endsWith('.md')) {
                    try {
                        details.readme = fs.readFileSync(skill.realPath, 'utf-8');
                    } catch (e) { }
                } else if (skill.instructions) {
                    details.readme = skill.instructions;
                }
            }
        } else if (skill.instructions) {
            // Fallback to instructions if no realPath (e.g. from memory/config)
            details.readme = skill.instructions;
        }

        return details;
    }

    public async getSkillFileContent(skillId: string, fileName: string): Promise<string | null> {
        const skill = this._state.installedSkills.find(s => s.id === skillId);
        if (!skill || !skill.realPath) return null;

        const fs = require('fs');
        const path = require('path');
        let targetPath = skill.realPath;

        if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
            targetPath = path.join(targetPath, fileName);
        } else {
            // If skill is a file, we can only read that file
            if (path.basename(targetPath) !== fileName) return null;
        }

        try {
            if (fs.existsSync(targetPath)) {
                return fs.readFileSync(targetPath, 'utf-8');
            }
        } catch (e) {
            console.warn(`Failed to read file ${targetPath}:`, e);
        }
        return null;
    }

    public async installSkill(url: string, scope: 'global' | 'project') {
        console.log(`[Manager] Smart Adapter Installing: ${url} (Scope: ${scope})`);

        const analysis = await this._repoAnalysis.analyzeRepo(url);
        const repoName = url.split('/').pop() || 'Imported-Resource';
        const manifestTemplate = this._repoAnalysis.generateManifest(url, analysis.type, repoName);

        const contentToScan = JSON.stringify(manifestTemplate) + (manifestTemplate.instructions || "");
        const securityReport = await this._securityService.deepScan(contentToScan, url);

        if (securityReport.riskScore > 50) {
            vscode.window.showWarningMessage(`Security Alert: High risk detected (${securityReport.riskScore}). Check audit logs.`);
        }

        const skillId = `${repoName.toLowerCase()}-${Date.now()}`;
        const newSkill: Skill = {
            id: skillId,
            name: manifestTemplate.name || repoName,
            description: manifestTemplate.description || 'Imported via Smart Adapter',
            type: analysis.type,
            scope: scope,
            source: 'local-workspace',
            repoUrl: url,
            version: "1.0.0",
            author: "Smart Adapter",
            tags: [...(manifestTemplate.tags || []), 'auto-adapter'],
            status: "active",
            enabled: true,
            security: securityReport,
            instructions: manifestTemplate.instructions
        };

        try {
            await this._storageService.saveSkill(newSkill);
            this._state.installedSkills.push(newSkill);
            vscode.window.showInformationMessage(`Smart Adapter: Installed ${analysis.type.toUpperCase()} "${newSkill.name}" successfully.`);
            await this.refresh();
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save skill: ${e}`);
        }
    }

    public async saveSkill(skill: Skill) {
        await this._storageService.saveSkill(skill);
        await this.refresh();
    }

    public async syncSkill(id: string, target: 'cursor' | 'claude') {
        const skill = this._state.installedSkills.find(s => s.id === id);
        if (!skill) throw new Error("Skill not found");

        if (target === 'cursor') {
            await this._syncManager.syncToCursor(skill);
        } else {
            await this._syncManager.syncToClaude(skill);
        }
    }

    public getState(): AppState {
        return this._state;
    }

    public async toggleSkill(skillId: string, enabled: boolean) {
        console.log(`[Manager] Toggling Skill ${skillId} to ${enabled}`);
        const skill = this._state.installedSkills.find(s => s.id === skillId);
        if (!skill) return;

        // 1. Update in-memory state
        skill.enabled = enabled;
        skill.status = enabled ? 'active' : 'idle';

        // 2. Persist Change
        // For local files (workflows/skills), we update the frontmatter or file content
        if (skill.source === 'local-workspace' || skill.source === 'workflow-file') {
            await this._storageService.updateSkillState(skill);
        }
        
        // For MCP, we might need to update a config file (future)
        
        await this.refresh();
    }

    public async deleteSkill(skillId: string) {
        console.log(`[Manager] Deleting Skill ${skillId}`);
        const skill = this._state.installedSkills.find(s => s.id === skillId);
        if (!skill) return;

        if (skill.source === 'local-workspace' || skill.source === 'workflow-file') {
            await this._storageService.deleteSkill(skill);
            vscode.window.showInformationMessage(`Skill "${skill.name}" uninstalled.`);
        } else {
            vscode.window.showWarningMessage(`Cannot uninstall external skill "${skill.name}" (Source: ${skill.source})`);
        }

        await this.refresh();
    }
}
