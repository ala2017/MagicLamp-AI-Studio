import { DiscoveryProvider } from './DiscoveryProvider';
import { Skill } from '@shared/types';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
const yamlFront = require('yaml-front-matter'); // We can use require if import fails, but let's try strict

export class WorkflowProvider implements DiscoveryProvider {

    private getGlobalWorkflowPath(): string {
        return path.join(os.homedir(), '.gemini', 'antigravity', 'global_workflows');
    }

    private getLocalWorkflowPath(): string | null {
        if (!vscode.workspace.workspaceFolders) return null;
        return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.agent', 'workflows');
    }

    public async discover(): Promise<Skill[]> {
        const skills: Skill[] = [];
        const pathsToScan = [
            { path: this.getGlobalWorkflowPath(), scope: 'global' as const },
            { path: this.getLocalWorkflowPath(), scope: 'project' as const }
        ];

        console.log('[WorkflowProvider] Starting scan...');

        for (const { path: dirPath, scope } of pathsToScan) {
            if (!dirPath || !fs.existsSync(dirPath)) continue;

            try {
                const files = await fs.promises.readdir(dirPath);
                for (const file of files) {
                    const fullPath = path.join(dirPath, file);
                    const ext = path.extname(file).toLowerCase();

                    if (ext === '.md') {
                        const content = await fs.promises.readFile(fullPath, 'utf8');

                        // Parse Frontmatter if exists, else basics
                        let parsed: any = {};
                        try {
                            parsed = yamlFront.loadFront(content);
                        } catch (e) {
                            // No frontmatter, just content
                            parsed = { __content: content };
                        }

                        const name = parsed.name || file.replace('.md', '');

                        skills.push({
                            id: `workflow.${scope}.${file.replace('.md', '')}`,
                            name: name,
                            description: parsed.description || `Workflow: ${name}`,
                            type: 'workflow',
                            scope: scope,
                            source: 'workflow-file',
                            realPath: fullPath,
                            version: '1.0.0',
                            author: 'Workflow',
                            tags: ['workflow', scope],
                            status: 'active',
                            enabled: true,
                            instructions: parsed.__content || content,
                            security: { riskScore: 0, isOfficial: false, permissions: [] }
                        });
                    } else if (ext === '.yaml' || ext === '.yml') {
                        // Support raw YAML workflows (CrewAI, etc.)
                        const content = await fs.promises.readFile(fullPath, 'utf8');
                        const name = file.replace(ext, '');
                        
                        skills.push({
                            id: `workflow.${scope}.${name}`,
                            name: name,
                            description: `YAML Workflow: ${name}`,
                            type: 'workflow',
                            scope: scope,
                            source: 'workflow-file',
                            realPath: fullPath,
                            version: '1.0.0',
                            author: 'Workflow',
                            tags: ['workflow', scope, 'yaml'],
                            status: 'active',
                            enabled: true,
                            instructions: content, // Raw YAML content
                            security: { riskScore: 0, isOfficial: false, permissions: [] }
                        });
                    }
                }
            } catch (e) {
                console.error(`[WorkflowProvider] Error scanning ${dirPath}:`, e);
            }
        }

        return skills;
    }
}
