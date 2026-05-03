import { Skill } from '@shared/types';
import * as https from 'https';

/**
 * Bridge adapter for extracting skills from the "SkillHub Awesome Skills" README.
 * Source: https://raw.githubusercontent.com/keyuyuan/skillhub-awesome-skills/main/README.md
 */
export class SkillHubBridge {
    private static README_URL = 'https://raw.githubusercontent.com/keyuyuan/skillhub-awesome-skills/main/README.md';

    public async fetchSkills(): Promise<Skill[]> {
        console.log(`[Bridge] Fetching SkillHub data from ${SkillHubBridge.README_URL}...`);

        const rawMarkdown = await this._fetchUrl(SkillHubBridge.README_URL);
        return this._parseMarkdown(rawMarkdown);
    }

    private _parseMarkdown(markdown: string): Skill[] {
        const skills: Skill[] = [];
        // Regex to match: [name](url)
        // We look for links that look like skill repos
        const linkRegex = /\[([^\]]+)\]\((https:\/\/www\.skillhub\.club\/skill\/[^)]+)\)/g;

        let match;
        let count = 0;

        while ((match = linkRegex.exec(markdown)) !== null) {
            const name = match[1];
            const skillHubUrl = match[2];

            // SkillHub URLs are proxies, we need to try and guess the real repo or just use it as is.
            // For now, we treat the SkillHub URL as the ID.

            skills.push({
                id: `skillhub.${count++}`,
                name: name,
                description: "Imported from SkillHub Awesome List",
                version: "1.0.0",
                author: "Community",
                type: "skill",
                scope: "global",
source: 'global-antigravity',
                repoUrl: skillHubUrl,
                tags: ["community", "skillhub"],
                status: "not-installed",
                enabled: false,
                security: {
                    riskScore: 50, // High risk by default for community items
                    isOfficial: false,
                    permissions: [],
                    auditReport: "Pending Scan"
                }
            });

            // Limit for demo/perf
            if (skills.length >= 50) break;
        }

        console.log(`[Bridge] Parsed ${skills.length} skills from SkillHub.`);
        return skills;
    }

    private _fetchUrl(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }
}
