import { Skill } from '@shared/types';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

/**
 * PRD 2.5 Smart Adapter Engine - Cognitive Analysis Logic
 */
export class RepoAnalysisService {

    /**
     * Determines the type of resource from a repository structure.
     * Uses git ls-remote to inspect the repository without downloading it fully.
     */
    public async analyzeRepo(url: string): Promise<{ type: 'mcp' | 'skill' | 'extension'; confidence: number; evidence: string[] }> {
        const evidence: string[] = [];
        const lowerUrl = url.toLowerCase();
        let files: string[] = [];

        try {
            // Use git ls-remote to get file list (HEAD)
            // Note: This only lists refs, not files. To get files we'd need a sparse checkout or API.
            // For a pure git approach without API keys, we might need to do a shallow clone of depth 1.
            // OR use GitHub API if it's a GitHub URL.
            // Let's try GitHub API for public repos first, fallback to clone analysis.
            
            if (url.includes('github.com')) {
                files = await this.fetchGitHubFileList(url);
            } else {
                // Fallback: heuristic based on URL only for non-github or private
                evidence.push('Cannot inspect non-GitHub repo contents remotely yet');
            }
        } catch (e) {
            console.warn('Failed to inspect remote repo:', e);
        }

        // 1. Check for MCP (High Priority)
        if (files.includes('mcp.json') || files.includes('claude_desktop_config.json')) {
            evidence.push('Found explicit MCP configuration file');
            return { type: 'mcp', confidence: 1.0, evidence };
        }
        if (lowerUrl.includes('mcp') || (lowerUrl.includes('server') && !lowerUrl.includes('extension'))) {
            evidence.push('Repository URL implies Server/MCP');
            return { type: 'mcp', confidence: 0.8, evidence };
        }

        // 2. Check for VS Code Extension
        if (files.includes('vsc-extension-quickstart.md') || (files.includes('package.json') && lowerUrl.includes('vscode'))) {
            evidence.push('Found VS Code extension structure');
            return { type: 'extension', confidence: 0.9, evidence };
        }

        // 3. Default to Skill (Python/JS Script)
        // If it's a raw file URL, it's definitely a skill/script
        if (lowerUrl.endsWith('.py') || lowerUrl.endsWith('.js') || lowerUrl.endsWith('.ts') || lowerUrl.endsWith('.md')) {
            evidence.push('Direct file link detected');
            return { type: 'skill', confidence: 1.0, evidence };
        }

        if (files.includes('main.py') || files.includes('index.js')) {
            evidence.push('Found entry point script');
            return { type: 'skill', confidence: 0.7, evidence };
        }

        return { type: 'skill', confidence: 0.5, evidence: ['Defaulting to generic skill'] };
    }

    /**
     * Fetches file list via GitHub Public API
     */
    private async fetchGitHubFileList(repoUrl: string): Promise<string[]> {
        // Convert https://github.com/user/repo -> https://api.github.com/repos/user/repo/contents/
        try {
            const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
            if (!match) return [];
            
            const api = `https://api.github.com/repos/${match[1]}/contents/`;
            // Note: In a real extension, we should use a proper fetch polyfill or axios.
            // VS Code extension host has 'fetch' in recent versions (Node 18+).
            const response = await fetch(api, { headers: { 'User-Agent': 'Skill-Cockpit' } });
            if (!response.ok) return [];
            
            const data = await response.json();
            if (Array.isArray(data)) {
                return data.map((item: any) => item.name);
            }
        } catch (e) {
            console.warn('GitHub API check failed:', e);
        }
        return [];
    }

    /**
     * PRD 2.5 Adaptive Installation
     * Generates a starter SKILL.md based on analysis
     */
    public generateManifest(url: string, type: 'mcp' | 'skill' | 'extension', repoName: string): Partial<Skill> {
        if (type === 'mcp') {
            return {
                type: 'mcp',
                name: repoName,
                description: `Auto-adapted MCP Server from ${url}`,
                instructions: `
# MCP Server Configuration
This skill adapts a Model Context Protocol server.

## Config
\`\`\`json
{
  "mcpServers": {
    "${repoName}": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-${repoName}"]
    }
  }
}
\`\`\`
`,
                tags: ['mcp', 'auto-generated']
            };
        }

        if (type === 'extension') {
            return {
                type: 'extension',
                name: repoName,
                description: `VS Code Extension from ${url}`,
                instructions: `This is a VS Code extension. Please install it via Marketplace or VSIX.`,
                tags: ['extension', 'vscode']
            };
        }

        // Default Skill
        return {
            type: 'skill',
            name: repoName,
            description: `Imported Skill from ${url}`,
            instructions: `
# Skill Instructions

This skill was imported from ${url}

## Usage
Run the main script via:
\`\`\`bash
python main.py
\`\`\`
`,
            tags: ['skill', 'imported']
        };
    }
}
