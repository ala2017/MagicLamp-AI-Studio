const path = require('path');

// Basic mock for VS Code API to allow running Extension Host logic
module.exports = {
    window: {
        showInformationMessage: (msg) => console.log(`[VSCODE:Info] ${msg}`),
        showErrorMessage: (msg) => console.error(`[VSCODE:Error] ${msg}`),
        registerWebviewViewProvider: (viewId, provider) => {
            console.log(`[VSCODE] WebviewViewProvider Registered: ${viewId}`);
            const view = new MockWebviewView();
            try {
                provider.resolveWebviewView(view);
            } catch (e) {
                console.error('[VSCODE] resolveWebviewView failed:', e);
            }
            return { dispose: () => { } };
        },
        withProgress: async (_options, task) => {
            return task();
        },
        createWebviewPanel: (viewType, title, showOptions, options) => {
            console.log(`[VSCODE] Webview Created: ${title}`);
            return new MockWebviewPanel();
        },
        activeTextEditor: { viewColumn: 1 }
    },
    commands: {
        registerCommand: (id, callback) => {
            console.log(`[VSCODE] Command Registered: ${id}`);
            // Auto-trigger the open command for simulation
            if (id === 'skillCockpit.open') {
                setTimeout(() => {
                    console.log(`[VSCODE] Auto-Triggering Command: ${id}`);
                    callback();
                }, 100);
            }
            return { dispose: () => { } };
        }
    },
    Uri: {
        file: (f) => ({ fsPath: f }),
        joinPath: (...args) => ({ fsPath: args.join('/') }),
        parse: (s) => s
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
        fs: {
            createDirectory: async () => {},
            writeFile: async () => {},
            readFile: async () => Buffer.from(''),
            delete: async () => {},
            stat: async () => ({ type: 1 }), // 1=File, 2=Dir
            readDirectory: async () => []
        },
        createFileSystemWatcher: () => ({ onDidCreate: () => {}, onDidChange: () => {}, onDidDelete: () => {} }),
        getConfiguration: () => ({ get: () => {} })
    },
    ViewColumn: { One: 1 },
    ProgressLocation: { Notification: 15 }
};

class MockWebviewPanel {
    constructor() {
        this.webview = {
            html: '',
            onDidReceiveMessage: (callback) => {
                this._messageCallback = callback;
            },
            asWebviewUri: (u) => `webview://${u.fsPath}`,
            postMessage: (msg) => {
                console.log(`[VSCODE->Webview] PostMessage:`, JSON.stringify(msg).slice(0, 100) + '...');
            }
        };
        this.onDidDispose = () => { };
    }

    dispose() { }
    reveal() { }
}

class MockWebviewView {
    constructor() {
        this.webview = new MockWebview();
        this.onDidDispose = () => { };
    }
}

class MockWebview {
    constructor() {
        this.html = '';
        this.options = {};
        this.cspSource = 'vscode-webview://mock';
        this._messageCallback = undefined;
    }
    onDidReceiveMessage(callback) {
        this._messageCallback = callback;
    }
    asWebviewUri(u) {
        return `webview://${u.fsPath}`;
    }
    postMessage(msg) {
        console.log(`[VSCODE->Webview] PostMessage:`, JSON.stringify(msg).slice(0, 100) + '...');
    }
}
