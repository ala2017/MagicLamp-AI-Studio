import fs from "fs";

async function run() {
  const res = await fetch("https://raw.githubusercontent.com/JimLiu/baoyu-skills/main/README.zh.md");
  const text = await res.text();
  fs.writeFileSync("readme.md", text);
}

run();
