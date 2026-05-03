import { DiscoveryProvider } from './DiscoveryProvider';
import { Skill } from '@shared/types';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class CursorProvider implements DiscoveryProvider {

    public async discover(): Promise<Skill[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return [];

        const rootPath = workspaceFolders[0].uri.fsPath;
        const skills: Skill[] = [];

        // 1. Check for .cursorrules
        const cursorRulesPath = path.join(rootPath, '.cursorrules');
        if (fs.existsSync(cursorRulesPath)) {
            try {
                const content = await fs.promises.readFile(cursorRulesPath, 'utf8');
                skills.push({
                    id: 'cursor.rules',
                    name: '.cursorrules',
                    description: 'Project-level Cursor Rules',
                    version: '1.0.0',
                    author: 'Project',
                    type: 'cursor-rule',
                    scope: 'project',
                    source: 'cursor-rules',
                    realPath: cursorRulesPath,
                    instructions: content,
                    status: 'active',
                    enabled: true,
                    tags: ['cursor', 'rules'],
                    security: { riskScore: 0, isOfficial: false, permissions: [] }
                });
            } catch (e) {
                console.error('[CursorProvider] Error reading .cursorrules:', e);
            }
        }

        // 2. Future: Check .cursor/rules/*.md (Recursively)

        return skills;
    }
}
