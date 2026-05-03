// Rig the environment to use our mock vscode
const moduleAlias = require('module');
const originalRequire = moduleAlias.prototype.require;

moduleAlias.prototype.require = function (path: any) {
    if (path === 'vscode') {
        return require('../test/mocks/vscode');
    }
    return originalRequire.apply(this, arguments);
};

import { SkillManager } from '../src/core/managers/SkillManager';

async function runSimulation() {
    console.log('🚀 Starting "Skill Cockpit" Core Simulation...\n');

    // 1. Initialize Manager
    const manager = new SkillManager();
    console.log('✅ SkillManager Initialized');

    // 2. Refresh (Simulate "Startup" scan)
    console.log('🔄 Triggering Refresh (Fetching Manifests)...');
    const startTime = Date.now();

    await manager.refresh();

    const duration = Date.now() - startTime;
    console.log(`✅ Refresh Complete in ${duration}ms\n`);

    // 3. Inspect State
    const state = manager.getState();
    console.log('📊 Current App State:');
    console.log('---------------------');
    console.log(`Sources Enabled: ${state.registries.length}`);
    console.log(`Skills Found:    ${state.availableSkills.length}`);

    console.log('\n📋 Skill List Sample:');
    state.availableSkills.slice(0, 5).forEach(skill => {
        console.log(` - [${skill.type.toUpperCase()}] ${skill.name}`);
        if (skill.tags.includes('skillhub')) {
            console.log(`   (From SkillHub: ${skill.repoUrl})`);
        }
    });

    if (state.availableSkills.length === 0) {
        console.error('❌ FAIL: No skills found.');
        process.exit(1);
    }
}

runSimulation().catch(err => {
    console.error('❌ Simulation Crashed:', err);
    process.exit(1);
});
