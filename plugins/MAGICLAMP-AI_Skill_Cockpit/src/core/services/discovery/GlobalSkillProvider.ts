import { DiscoveryProvider } from './DiscoveryProvider';
import { Skill } from '@shared/types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export class GlobalSkillProvider implements DiscoveryProvider {

    // Windows: C:\Users\user\.gemini\antigravity\global_skills
    private getGlobalPath(): string {
        return path.join(os.homedir(), '.gemini', 'antigravity', 'global_skills');
    }

    public async discover(): Promise<Skill[]> {
        const globalPath = this.getGlobalPath();
        const skills: Skill[] = [];

        console.log(`[GlobalProvider] Scanning: ${globalPath}`);

        if (!fs.existsSync(globalPath)) {
            return [];
        }

        try {
            // Read directories in global_skills
            const dirents = await fs.promises.readdir(globalPath, { withFileTypes: true });

            for (const dirent of dirents) {
                if (dirent.isDirectory()) {
                    const skillDir = path.join(globalPath, dirent.name);
                    // Look for SKILL.md or README.md
                    // Heuristic: If SKILL.md exists, use it. Else check README.md

                    let targetFile = path.join(skillDir, 'SKILL.md');
                    let description = `Global Skill at ${skillDir}`;
                    
                    if (fs.existsSync(targetFile)) {
                         try {
                             const content = fs.readFileSync(targetFile, 'utf-8');
                             // Simple frontmatter check or take first paragraph
                             description = content.slice(0, 200).replace(/---[\s\S]*?---/, '').trim(); 
                         } catch (e) {}
                    } else {
                        targetFile = path.join(skillDir, 'README.md');
                        if (fs.existsSync(targetFile)) {
                            try {
                                const content = fs.readFileSync(targetFile, 'utf-8');
                                description = content.slice(0, 200).trim();
                            } catch (e) {}
                        }
                    }

                    // For MVP stability: just reading the folder name as skill name
                    // In phase 2 we will parse the yaml frontmatter
                    skills.push({
                        id: `global.${dirent.name}`,
                        name: dirent.name, // Placeholder, real name comes from YAML later
                        description: description + (description.length >= 200 ? '...' : ''),
                        version: '1.0.0',
                        author: 'Antigravity Global',
                        type: 'skill',
                        scope: 'global',
                        source: 'global-antigravity',
                        realPath: skillDir,
                        status: 'idle',
                        enabled: true,
                        tags: ['global'],
                        security: { riskScore: 0, isOfficial: true, permissions: [] }
                    });
                }
            }
        } catch (e) {
            console.error('[GlobalProvider] Scan error:', e);
        }

        return skills;
    }
}
