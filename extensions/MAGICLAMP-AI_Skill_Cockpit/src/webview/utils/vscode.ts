let vscodeApi: any;

try {
    vscodeApi = (window as any).acquireVsCodeApi();
} catch (e) {
    console.warn('VS Code API not available or already acquired:', e);
    vscodeApi = {
        postMessage: (msg: any) => console.log('VS Code Mock:', msg),
        getState: () => ({}),
        setState: (state: any) => console.log('VS Code Mock State:', state)
    };
}

export const vscode = vscodeApi;
