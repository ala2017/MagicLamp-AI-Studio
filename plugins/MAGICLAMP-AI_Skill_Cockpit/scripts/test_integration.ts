// Rig the environment to use our mock vscode
const moduleAlias = require('module');
const originalRequire = moduleAlias.prototype.require;

moduleAlias.prototype.require = function (path: any) {
    if (path === 'vscode') {
        return require('../test/mocks/vscode');
    }
    return originalRequire.apply(this, arguments);
};

// Import the actual Extension Main Entry
import * as extension from '../src/extension';

// Mock Context
const mockContext: any = {
    subscriptions: [],
    extensionUri: { fsPath: '/mock/path' }
};

// Simulation Runner
async function runIntegrationTest() {
    console.log('🚀 Starting "Skill Cockpit" Integration Test (Extension Host)...');

    // 1. Activate Extension
    extension.activate(mockContext);
    console.log('✅ Extension Activated');

    // 2. Wait for auto-trigger (set in mock vscode.js)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Simulate Webview Message 'app.init'
    // We need to access the private panel instance. 
    // Since we can't easily, we will rely on the logs to verify 'app.init' and 'state.update' flow.

    // In a real Playwright test we would control the webview. 
    // Here we are verifying that the Host Logic *attempts* to send data.

    console.log('✅ Integration Test Complete (Check logs for [VSCODE->Webview] PostMessage)');
}

runIntegrationTest();
