import { DiscoveryProvider } from './DiscoveryProvider';
import { Skill } from '@shared/types';
import * as vscode from 'vscode';
const yamlFront = require('yaml-front-matter');

export class LocalSkillProvider implements DiscoveryProvider {
    private readonly SKILL_DIR = '.agent/skills';

    public async discover(): Promise<Skill[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri;
        const skillDirUri = vscode.Uri.joinPath(rootPath, this.SKILL_DIR);
        const skills: Skill[] = [];

        console.log(`[LocalProvider] Scanning: ${skillDirUri.fsPath}`);

        try {
            // Check if dir exists first
            try {
                await vscode.workspace.fs.stat(skillDirUri);
            } catch {
                return []; // Dir doesn't exist
            }

            const files = await vscode.workspace.fs.readDirectory(skillDirUri);

            for (const [fileName, type] of files) {
                if (type === vscode.FileType.File && fileName.endsWith('.md')) {
                    const skill = await this.parseMarkdownSkill(skillDirUri, fileName);
                    if (skill) skills.push(skill);
                }
            }
        } catch (e) {
            console.warn('[LocalProvider] Error reading skill directory:', e);
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
                return {
                    id: fileName.replace('.md', ''),
                    name: parsed.name || fileName.replace('.md', ''),
                    description: parsed.description || 'No description provided',
                    type: parsed.type === 'mcp' ? 'mcp' : 'skill',
                    scope: parsed.scope || 'project',
                    source: 'local-workspace',
                    status: 'active',
                    author: parsed.author || 'Local User',
                    version: parsed.version || '0.0.1',
                    tags: parsed.tags || ['local'],
                    repoUrl: parsed.repoUrl || '',
                    realPath: fileUri.fsPath,
                    enabled: true,
                    security: { isOfficial: false, riskScore: 0, permissions: [] },
                    instructions: parsed.__content,
                    ...parsed
                } as Skill;
            }
        } catch (e) {
            console.warn(`[LocalProvider] Failed to parse ${fileName}:`, e);
        }
        return null;
    }
}
