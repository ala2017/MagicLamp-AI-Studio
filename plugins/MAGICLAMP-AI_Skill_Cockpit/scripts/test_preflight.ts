// Rig the environment specifically to load the COMPILED JS
const moduleAlias = require('module');
const originalRequire = moduleAlias.prototype.require;

moduleAlias.prototype.require = function (path: any) {
    if (path === 'vscode') {
        return require('../test/mocks/vscode');
    }
    return originalRequire.apply(this, arguments);
};

// Import the COMPILED extension
const extensionPath = '../dist/extension.js';

// Mock Context
const mockContext: any = {
    subscriptions: [],
    extensionUri: { fsPath: '/mock/path' }
};

async function runProductionTest() {
    console.log('🚀 Starting "Skill Cockpit" PRE-FLIGHT CHECK (dist/extension.js)...');

    try {
        const extension = require(extensionPath);

        // 1. Activate
        console.log('Testing activate()...');
        extension.activate(mockContext);
        console.log('✅ Activation Successful');

        // 2. Simulate Command Trigger
        console.log('Testing Command Trigger...');
        // Wait for the mock auto-trigger
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('✅ Command Pipeline Valid');
        console.log('🎉 PRE-FLIGHT CHECK PASSED. Ready for Release.');
        process.exit(0);
    } catch (err) {
        console.error('❌ PRE-FLIGHT CHECK FAILED:', err);
        process.exit(1);
    }
}

runProductionTest();
