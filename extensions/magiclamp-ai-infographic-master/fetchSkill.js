import fs from "fs";

async function run() {
  const res = await fetch("https://raw.githubusercontent.com/JimLiu/baoyu-skills/main/skills/baoyu-infographic/SKILL.md");
  const text = await res.text();
  fs.writeFileSync("skill.md", text);
}

run();
