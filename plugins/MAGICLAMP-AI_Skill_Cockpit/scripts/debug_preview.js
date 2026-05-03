const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

async function debugPreview() {
    console.log('--- Starting Headless Debug Session ---');

    const htmlPath = path.resolve(__dirname, '../preview.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Setup virtual console to capture logs and errors
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("log", (...args) => console.log("[PAGE LOG]", ...args));
    virtualConsole.on("error", (...args) => console.error("[PAGE ERROR]", ...args));
    virtualConsole.on("warn", (...args) => console.warn("[PAGE WARN]", ...args));

    try {
        const dom = new JSDOM(htmlContent, {
            url: "http://localhost:8081/preview.html",
            runScripts: "dangerously",
            resources: "usable",
            virtualConsole,
            pretendToBeVisual: true
        });

        const { window } = dom;

        // Custom Error Trap verification
        window.addEventListener('error', (event) => {
            console.error(' [CAPTURED_ERROR] ', event.error || event.message);
        });

        // Wait a bit for async scripts (webpack bundle)
        console.log('Loading page resources...');

        // Simulating the loading of the external script manually since JSDOM might be tricky with relative file paths if not served
        // We will try to map the script src to local file
        const scriptTags = window.document.querySelectorAll('script[src]');
        for (const script of scriptTags) {
            const src = script.getAttribute('src');
            if (src && src.includes('webview.js')) {
                console.log(`Found bundle script: ${src}. Loading execution...`);
                // Assume dist is sibling to preview.html
                const bundlePath = path.resolve(__dirname, '../dist/webview.js');
                if (fs.existsSync(bundlePath)) {
                    const bundleCode = fs.readFileSync(bundlePath, 'utf8');
                    try {
                        window.eval(bundleCode);
                        console.log('Bundle executed successfully.');
                    } catch (e) {
                        console.error('!!! Bundle Execution Crashed !!!');
                        console.error(e);
                    }
                } else {
                    console.error(`Bundle file not found at ${bundlePath}`);
                }
            }
        }

        // Check if root has content
        setTimeout(() => {
            const root = window.document.getElementById('root');
            console.log('--- Snapshot of #root content ---');
            console.log(root.innerHTML);

            if (root.innerHTML.includes('Loading...')) {
                console.log('STATUS: STUCK AT LOADING');
            } else if (root.innerHTML.trim() === '') {
                console.log('STATUS: BLANK WHITE SCREEN');
            } else {
                console.log('STATUS: RENDERED CONTENT DETECTED');
            }
        }, 1000);

    } catch (e) {
        console.error("Setup failed:", e);
    }
}

debugPreview();
