
import * as vscode from 'vscode';
import { Skill } from '@shared/types';
const yamlFront = require('yaml-front-matter');

export class StorageService {
    private readonly SKILL_DIR = '.agent/skills';

    constructor() {
        this.ensureSkillDir();
    }

    private async ensureSkillDir() {
        if (!vscode.workspace.workspaceFolders) return;

        const rootPath = vscode.workspace.workspaceFolders[0].uri;
        const skillDirUri = vscode.Uri.joinPath(rootPath, this.SKILL_DIR);

        try {
            await vscode.workspace.fs.stat(skillDirUri);
        } catch {
            // Directory doesn't exist, create it
            await vscode.workspace.fs.createDirectory(skillDirUri);
        }
    }

    /**
     * PRD 2.5/3.2 Compliant Discovery Algorithm
     * Scans the .agent/skills directory and identifies Skills vs MCP Servers.
     */
    public async scanLocalSkills(): Promise<Skill[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri;
        const skillDirUri = vscode.Uri.joinPath(rootPath, this.SKILL_DIR);
        const skills: Skill[] = [];

        try {
            const files = await vscode.workspace.fs.readDirectory(skillDirUri);

            for (const [fileName, type] of files) {
                // 1. Markdown Skill Definition
                if (type === vscode.FileType.File && fileName.endsWith('.md')) {
                    const skill = await this.parseMarkdownSkill(skillDirUri, fileName);
                    if (skill) skills.push(skill);
                }
                // 2. JSON MCP Configuration (PRD 2.5: MCP Servers)
                else if (type === vscode.FileType.File && (fileName.endsWith('.json') || fileName.endsWith('config.json'))) {
                    const mcp = await this.parseMcpConfig(skillDirUri, fileName);
                    if (mcp) skills.push(mcp);
                }
            }
        } catch (e) {
            console.warn('Error reading skill directory:', e);
        }

        return skills;
    }

    private async parseMarkdownSkill(dir: vscode.Uri, fileName: string): Promise<Skill | null> {
        try {
            const fileUri = vscode.Uri.joinPath(dir, fileName);
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const contentStr = new TextDecoder().decode(fileContent);
            const parsed = yamlFront.loadFront(contentStr);

            if (parsed) {
                // PRD 2.5: Repo Cognitive Analysis (Lite)
                // If type is explicitly defined, use it. Otherwise default to 'skill'.
                const detectedType = parsed.type === 'mcp' ? 'mcp' : 'skill';

                return {
                    id: fileName.replace('.md', ''),
                    name: parsed.name || fileName.replace('.md', ''),
                    description: parsed.description || 'No description provided',
                    type: detectedType,
                    scope: parsed.scope || 'project',
                    status: 'active',
                    author: parsed.author || 'Local User',
                    version: parsed.version || '0.0.1',
                    tags: parsed.tags || ['local'],
                    repoUrl: parsed.repoUrl || '',
                    enabled: true,
                    source: 'local-workspace',
                    security: { isOfficial: false, riskScore: 0, permissions: [] },
                    ...parsed
                } as Skill;
            }
        } catch (e) {
            console.warn(`Failed to parse markdown skill ${fileName}:`, e);
        }
        return null;
    }

    private async parseMcpConfig(dir: vscode.Uri, fileName: string): Promise<Skill | null> {
        try {
            const fileUri = vscode.Uri.joinPath(dir, fileName);
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const contentStr = new TextDecoder().decode(fileContent);
            const json = JSON.parse(contentStr);

            // Heuristic: Is this an MCP config?
            if (json.mcpServers || json.type === 'mcp') {
                return {
                    id: fileName.replace('.json', ''),
                    name: json.name || fileName.replace('.json', ''),
                    description: json.description || 'Local MCP Configuration',
                    type: 'mcp',
                    scope: 'project',
                    status: 'active',
                    author: 'System',
                    version: json.version || '1.0.0',
                    tags: ['mcp', 'config'],
                    repoUrl: '',
                    enabled: true,
                    source: 'local-workspace',
                    security: { isOfficial: true, riskScore: 0, permissions: ['network'] }
                } as Skill;
            }
        } catch (e) {
            console.warn(`Failed to parse JSON MCP ${fileName}:`, e);
        }
        return null;
    }

    /**
     * Saves a skill to the local .agent/skills directory.
     */
    public async saveSkill(skill: Skill): Promise<void> {
        await this.ensureSkillDir();
        if (!vscode.workspace.workspaceFolders) {
            throw new Error("No workspace open");
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri;
        const safeId = skill.id.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
        const filePath = vscode.Uri.joinPath(rootPath, this.SKILL_DIR, `${safeId}.md`);

        const lines = ['---'];
        lines.push(`name: "${skill.name}"`);
        lines.push(`id: "${skill.id}"`);
        lines.push(`version: "${skill.version}"`);
        lines.push(`type: "${skill.type}"`);
        lines.push(`author: "${skill.author}"`);
        if (skill.repoUrl) lines.push(`repoUrl: "${skill.repoUrl}"`);
        lines.push(`description: "${skill.description || ''}"`);
        if (skill.tags && skill.tags.length > 0) {
            lines.push(`tags: [${skill.tags.map(t => `"${t}"`).join(', ')}]`);
        }
        lines.push('---');
        lines.push('');
        lines.push(skill.instructions || '');

        await vscode.workspace.fs.writeFile(filePath, new TextEncoder().encode(lines.join('\n')));
    }

    public async updateSkillState(skill: Skill): Promise<void> {
        if (!skill.realPath) return;

        try {
            const uri = vscode.Uri.file(skill.realPath);
            const content = await vscode.workspace.fs.readFile(uri);
            let contentStr = new TextDecoder().decode(content);

            // Simple Frontmatter Update Regex
            // Replaces "enabled: false/true" or adds it if missing
            if (/^enabled:\s*(true|false)/m.test(contentStr)) {
                contentStr = contentStr.replace(/^enabled:\s*(true|false)/m, `enabled: ${skill.enabled}`);
            } else {
                // Insert after the first ---
                contentStr = contentStr.replace(/^---(\r\n|\n)/, `---$1enabled: ${skill.enabled}$1`);
            }

            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(contentStr));
        } catch (e) {
            console.error('Failed to update skill state:', e);
        }
    }

    public async deleteSkill(skill: Skill): Promise<void> {
        if (!skill.realPath) return;
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(skill.realPath));
        } catch (e) {
            console.error('Failed to delete skill:', e);
            throw e;
        }
    }
}
