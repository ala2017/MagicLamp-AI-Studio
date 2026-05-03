const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml'); // Need simple frontmatter parser

// Simple Frontmatter Parser (regex based to avoid dependency hell in this script)
function parseFrontMatter(content) {
    const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (match) {
        try {
            return yaml.load(match[1]);
        } catch (e) {
            return {};
        }
    }
    return {};
}

const skillsDir = path.resolve(__dirname, '../.agent/skills');
const outputFile = path.resolve(__dirname, '../dist/real_skills.json');

// Ensure dist exists
if (!fs.existsSync(path.dirname(outputFile))) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}

console.log(`[Scanner] Scanning directory: ${skillsDir}`);

if (!fs.existsSync(skillsDir)) {
    console.error(`[Scanner] Directory not found! Creating mock for demonstration...`);
    // If directory missing, create it and a sample file so user sees SOMETHING real
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'demo_local.md'),
        `---
name: "Local Demo Skill"
type: "skill"
version: "0.0.1"
description: "This is a real file on your disk."
scope: "project"
enabled: true
tags: ["local", "real"]
---
This is the content.`);
}

const skills = [];
const files = fs.readdirSync(skillsDir);

files.forEach(file => {
    if (file.endsWith('.md')) {
        const content = fs.readFileSync(path.join(skillsDir, file), 'utf8');
        const meta = parseFrontMatter(content);

        skills.push({
            id: file.replace('.md', ''),
            name: meta.name || file,
            description: meta.description || 'No description',
            type: meta.type || 'skill',
            version: meta.version || '1.0.0',
            scope: meta.scope || 'local',
            enabled: meta.enabled !== false,
            repoUrl: 'Local File',
            tags: meta.tags || ['local'],
            author: meta.author || 'You'
        });
    }
});

console.log(`[Scanner] Found ${skills.length} skills.`);
fs.writeFileSync(outputFile, JSON.stringify(skills, null, 2));
console.log(`[Scanner] Wrote data to ${outputFile}`);
