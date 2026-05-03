const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const ROOT_DIR = path.join(__dirname, '..');

function runCommand(command) {
    console.log(`> ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        process.exit(1);
    }
}

function main() {
    console.log('🚀 Starting Release Process...');

    // 1. Read package.json
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    const oldVersion = packageJson.version;
    console.log(`Current version: ${oldVersion}`);

    // 2. Increment Version (Patch)
    const versionParts = oldVersion.split('.').map(Number);
    versionParts[2] += 1;
    const newVersion = versionParts.join('.');
    console.log(`New version: ${newVersion}`);

    // 3. Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 4));
    console.log(`✅ Updated package.json to ${newVersion}`);

    // 4. Delete old .vsix files
    const files = fs.readdirSync(ROOT_DIR);
    const vsixFiles = files.filter(f => f.endsWith('.vsix'));
    if (vsixFiles.length > 0) {
        vsixFiles.forEach(file => {
            fs.unlinkSync(path.join(ROOT_DIR, file));
            console.log(`🗑️ Deleted old package: ${file}`);
        });
    } else {
        console.log('No old .vsix files found.');
    }

    // 5. Run Package Command (vsce)
    // Using npx to ensure vsce is available
    console.log('📦 Packaging extension...');
    // We also run 'npm run package' (webpack) first to ensure build is fresh
    runCommand('npm run package');
    
    // Check if vsce is installed globally or use npx
    // Using npx @vscode/vsce is the modern standard
    runCommand('npx @vscode/vsce package --no-dependencies'); 

    // 6. Git Commit & Push
    console.log('Commiting and pushing changes...');
    runCommand('git add .');
    runCommand(`git commit -m "chore: release v${newVersion}"`);
    runCommand('git push');

    console.log(`🎉 Release v${newVersion} completed successfully!`);
}

main();
