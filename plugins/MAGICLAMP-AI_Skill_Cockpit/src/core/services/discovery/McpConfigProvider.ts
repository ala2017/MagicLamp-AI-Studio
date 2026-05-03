import { DiscoveryProvider } from './DiscoveryProvider';
import { Skill } from '@shared/types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export class McpConfigProvider implements DiscoveryProvider {

    private getConfigPath(): string {
        // Windows-specific path for Claude Desktop
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'Claude', 'claude_desktop_config.json');
    }

    public async discover(): Promise<Skill[]> {
        const configPath = this.getConfigPath();
        const skills: Skill[] = [];

        console.log(`[McpProvider] Checking: ${configPath}`);

        if (!fs.existsSync(configPath)) {
            return [];
        }

        try {
            const content = await fs.promises.readFile(configPath, 'utf8');
            const json = JSON.parse(content);

            if (json.mcpServers) {
                for (const [key, config] of Object.entries(json.mcpServers)) {
                    // Check if it's disabled via our convention (e.g., _disabled prefix or separate disabled list)
                    // Currently Claude doesn't support "disabled" natively, so we infer it exists = enabled.
                    // But we can implement "Toggle" by renaming the key to __disabled__key
                    
                    const isEnabled = !key.startsWith('__disabled__');
                    const cleanName = key.replace('__disabled__', '');

                    skills.push({
                        id: `mcp.claude.${cleanName}`,
                        name: cleanName,
                        description: `MCP Server configured in Claude Desktop`,
                        version: '1.0.0',
                        author: 'Claude Config',
                        type: 'mcp',
                        scope: 'app-specific',
                        source: 'claude-config',
                        realPath: configPath,
                        config: config, // We store the MCP config here
                        status: isEnabled ? 'active' : 'idle',
                        enabled: isEnabled,
                        tags: ['mcp', 'claude'],
                        security: { riskScore: 0, isOfficial: false, permissions: [] }
                    });
                }
            }
        } catch (e) {
            console.error('[McpProvider] Parse error:', e);
        }

        return skills;
    }

    public async updateMcpState(skillName: string, enabled: boolean): Promise<void> {
        const configPath = this.getConfigPath();
        if (!fs.existsSync(configPath)) return;

        try {
            const content = await fs.promises.readFile(configPath, 'utf8');
            const json = JSON.parse(content);

            if (!json.mcpServers) return;

            const enabledName = skillName;
            const disabledName = `__disabled__${skillName}`;

            if (enabled) {
                // Enable: Rename disabled key to enabled key
                if (json.mcpServers[disabledName]) {
                    json.mcpServers[enabledName] = json.mcpServers[disabledName];
                    delete json.mcpServers[disabledName];
                }
            } else {
                // Disable: Rename enabled key to disabled key
                if (json.mcpServers[enabledName]) {
                    json.mcpServers[disabledName] = json.mcpServers[enabledName];
                    delete json.mcpServers[enabledName];
                }
            }

            await fs.promises.writeFile(configPath, JSON.stringify(json, null, 2));
        } catch (e) {
            console.error('[McpProvider] Failed to update state:', e);
        }
    }

    public async deleteMcpServer(skillName: string): Promise<void> {
        const configPath = this.getConfigPath();
        if (!fs.existsSync(configPath)) return;

        try {
            const content = await fs.promises.readFile(configPath, 'utf8');
            const json = JSON.parse(content);

            if (!json.mcpServers) return;

            // Try both names
            delete json.mcpServers[skillName];
            delete json.mcpServers[`__disabled__${skillName}`];

            await fs.promises.writeFile(configPath, JSON.stringify(json, null, 2));
        } catch (e) {
            console.error('[McpProvider] Failed to delete server:', e);
        }
    }
}
