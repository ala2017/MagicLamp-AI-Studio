import { AppState } from './types';

/**
 * Commands sent FROM Webview (Client) TO Extension (Host).
 * Used for actions like "Install This", "Open File", "Run Test".
 */
export type ClientMessage =
    | { command: 'app.init' }
    | { command: 'skills.refresh' }
    | { command: 'skills.install'; url: string; scope: 'global' | 'project' }
    | { command: 'skills.uninstall'; id: string }
    | { command: 'skills.toggle'; id: string; enabled: boolean }
    | { command: 'security.scanSkill'; id: string } // Manual Deep Scan
    | { command: 'nav.openExternal'; url: string }; // Open browser

/**
 * Messages sent FROM Extension (Host) TO Webview (Client).
 * Used for State Sync, Telemetry Updates, and Toasts.
 */
export type HostMessage =
    | { type: 'state.update'; state: Partial<AppState> }
    | { type: 'security.alert'; level: 'info' | 'warning' | 'error'; message: string }
    | { type: 'task.progress'; taskId: string; percentage: number; message: string };
