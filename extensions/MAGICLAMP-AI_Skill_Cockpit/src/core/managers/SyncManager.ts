
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Skill } from '@shared/types';

export class SyncManager {

    /**
     * Syncs a skill to Cursor by writing to .cursorrules
     */
    public async syncToCursor(skill: Skill): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            throw new Error("No active workspace found to sync Cursor rules.");
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const cursorRulesPath = path.join(rootPath, '.cursorrules');

        console.log(`[Sync] Exporting skill ${skill.name} to ${cursorRulesPath}`);

        const markerStart = `# --- SYNCED FROM SKILL COCKPIT: ${skill.name} ---`;
        const markerEnd = `# --- END SYNC: ${skill.name} ---`;
        const newBlock = `\n${markerStart}\n${skill.instructions || ''}\n${markerEnd}\n`;

        try {
            let content = '';
            if (fs.existsSync(cursorRulesPath)) {
                content = await fs.promises.readFile(cursorRulesPath, 'utf8');
            }

            // Regex to match existing block (handling potential newlines)
            // Note: We escape special chars in name just in case
            const escapedName = skill.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\n?# --- SYNCED FROM SKILL COCKPIT: ${escapedName} ---[\\s\\S]*?# --- END SYNC: ${escapedName} ---\\n?`, 'g');

            if (regex.test(content)) {
                // Update existing
                console.log(`[Sync] Updating existing rule for ${skill.name}`);
                content = content.replace(regex, newBlock);
            } else {
                // Append new
                console.log(`[Sync] Appending new rule for ${skill.name}`);
                content += newBlock;
            }

            await fs.promises.writeFile(cursorRulesPath, content);
            vscode.window.showInformationMessage(`Successfully synced "${skill.name}" to .cursorrules`);
        } catch (e) {
            console.error(`[Sync] Failed to sync to Cursor:`, e);
            throw e;
        }
    }

    /**
     * Syncs an MCP skill to Claude Desktop config
     */
    public async syncToClaude(skill: Skill): Promise<void> {
        if (skill.type !== 'mcp' || !skill.config) {
            throw new Error("This skill is not an MCP server and cannot be synced to Claude Desktop.");
        }

        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        const configPath = path.join(appData, 'Claude', 'claude_desktop_config.json');

        console.log(`[Sync] Injecting MCP ${skill.name} into ${configPath}`);

        if (!fs.existsSync(configPath)) {
            // Create a basic one if not exists
            const initialConfig = { mcpServers: {} };
            await fs.promises.writeFile(configPath, JSON.stringify(initialConfig, null, 2));
        }

        const content = await fs.promises.readFile(configPath, 'utf8');
        const json = JSON.parse(content);

        if (!json.mcpServers) json.mcpServers = {};

        // Add or Overwrite
        json.mcpServers[skill.name] = skill.config;

        await fs.promises.writeFile(configPath, JSON.stringify(json, null, 2));
        vscode.window.showInformationMessage(`Successfully injected "${skill.name}" into Claude Desktop config.`);
    }
}
