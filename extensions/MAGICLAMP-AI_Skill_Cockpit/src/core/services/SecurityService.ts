import { SkillSecurity } from '@shared/types';

export class SecurityService {

    // PRD 2.7 Tiered Defense System - Level 1: Static Syntax Analysis
    private readonly RED_FLAGS = [
        { pattern: /ignore previous instructions/i, score: 30, desc: 'Prompt Injection detected' },
        { pattern: /system prompt/i, score: 20, desc: 'Attempt to overwrite system prompt' },
        { pattern: /delete all files/i, score: 50, desc: 'Destructive command detected' },
        { pattern: /rm -rf/i, score: 50, desc: 'Destructive command detected' },
        { pattern: /child_process/i, score: 10, desc: 'Shell execution capability detected' },
        { pattern: /exec\(/i, score: 10, desc: 'Code execution capability detected' }
    ];

    /**
     * Performs a Deep Scan on a given content (Install-Time Check).
     * Now accepts content string directly for easier testing and usage.
     */
    public async deepScan(content: string, sourceUrl: string): Promise<SkillSecurity> {
        console.log(`Scanning content from ${sourceUrl}...`);

        let riskScore = 0;
        const auditLog: string[] = [];
        const detectedPermissions: string[] = [];

        // 1. Static Pattern Match
        for (const flag of this.RED_FLAGS) {
            if (flag.pattern.test(content)) {
                riskScore += flag.score;
                auditLog.push(`[RISK] ${flag.desc} (Score: +${flag.score})`);
            }
        }

        // 2. Permission Discovery (Simple Heuristics)
        if (content.includes('fs.') || content.includes('readFile') || content.includes('writeFile')) {
            detectedPermissions.push('filesystem');
        }
        if (content.includes('http') || content.includes('fetch') || content.includes('axios')) {
            detectedPermissions.push('network');
        }
        if (content.includes('child_process') || content.includes('spawn') || content.includes('exec')) {
            detectedPermissions.push('shell_execution');
            riskScore += 20; // Inherently risky
        }

        // 3. Origin Verification (PRD 2.7 Tier 3)
        const isOfficial = this.isOfficialSource(sourceUrl);
        if (isOfficial) {
            // Trust official sources more, reduce false positives impact
            riskScore = Math.max(0, riskScore - 10);
            auditLog.push('[INFO] Verified Official Source (-10 Risk)');
        } else {
            auditLog.push('[WARN] Community Source (Standard Risk)');
        }

        const report: SkillSecurity = {
            riskScore,
            isOfficial,
            permissions: detectedPermissions,
            auditReport: auditLog.join('\n') || "Scan passed. No significant risks found."
        };

        return report;
    }

    /**
     * Origin Verification Logic
     */
    public isOfficialSource(url: string): boolean {
        const trustedOrgs = ['antigravity-ai', 'microsoft', 'google', 'vudovn'];
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname !== 'github.com') return false;

            const org = urlObj.pathname.split('/')[1];
            return trustedOrgs.includes(org);
        } catch {
            return false;
        }
    }

    public isAllowedRegistry(url: string): boolean {
        return url.startsWith('https://github.com/') || url.startsWith('https://raw.githubusercontent.com/');
    }
}
