const yaml = require('js-yaml');
const assert = require('assert');

// Mock Logic from OrchestrationManager
function parseCrewAI(content) {
    try {
        const parsed = yaml.load(content);
        const steps = [];
        if (parsed.tasks) {
            Object.entries(parsed.tasks).forEach(([key, task]) => {
                steps.push({
                    id: key,
                    name: key,
                    agent: task.agent,
                    params: {
                        description: task.description,
                        expected_output: task.expected_output
                    }
                });
            });
        }
        return {
            id: 'crewai-workflow',
            name: 'CrewAI Workflow',
            steps: steps,
            description: JSON.stringify(parsed.agents || {})
        };
    } catch (e) {
        return { id: 'error', name: 'Error Parsing', steps: [] };
    }
}

// Test Case
const yamlContent = `
agents:
  researcher:
    role: Senior Researcher
    goal: Uncover info
    backstory: Driven by curiosity
tasks:
  research_task:
    description: Find news
    expected_output: A report
    agent: researcher
`;

console.log("Testing Parsing...");
const result = parseCrewAI(yamlContent);
console.log("Result:", JSON.stringify(result, null, 2));

try {
    assert.strictEqual(result.steps.length, 1);
    assert.strictEqual(result.steps[0].id, 'research_task');
    assert.strictEqual(result.steps[0].agent, 'researcher');
    console.log("Parsing Test Passed!");
} catch (e) {
    console.error("Parsing Test Failed:", e);
    process.exit(1);
}

// Test Generation
const agents = JSON.parse(result.description);
const tasks = {};
result.steps.forEach(step => {
    tasks[step.id] = {
        description: step.params.description,
        expected_output: step.params.expected_output,
        agent: step.agent
    };
});
const newYaml = yaml.dump({ agents, tasks });
console.log("Generated YAML:\n", newYaml);

try {
    assert.ok(newYaml.includes('researcher:'));
    assert.ok(newYaml.includes('research_task:'));
    console.log("Generation Test Passed!");
} catch (e) {
    console.error("Generation Test Failed:", e);
    process.exit(1);
}
