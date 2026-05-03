import { GoogleGenAI, Type } from "@google/genai";

// --- Type declarations for external libraries ---
declare const pdfjsLib: any;
declare const ePub: any;

// --- DOM Element Selectors ---
const uploader = document.getElementById('uploader') as HTMLElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const fileInfo = document.getElementById('file-info') as HTMLParagraphElement;
const analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
const loader = document.getElementById('loader') as HTMLElement;
const resultsContainer = document.getElementById('results') as HTMLElement;
const mapOut = document.getElementById('map-out') as HTMLElement;
const explainContent = document.getElementById('explain-content') as HTMLElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const errorBox = document.getElementById('error-box') as HTMLElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
const resetFromErrorBtn = document.getElementById('reset-from-error-btn') as HTMLButtonElement;


// --- App State ---
let currentFile: File | null = null;
let panzoomInstance: any = null;

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const model = 'gemini-2.5-flash';

// --- Library Setup ---
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}


// --- Functions ---

/**
 * Resets the UI to its initial state.
 */
function resetUI() {
    uploader.style.display = 'block';
    loader.style.display = 'none';
    resultsContainer.style.display = 'none';
    errorBox.style.display = 'none';

    fileInfo.textContent = '';
    analyzeBtn.disabled = true;
    currentFile = null;
    if (fileInput) fileInput.value = '';

    // Clear previous results
    mapOut.innerHTML = '<p class="placeholder">思维导图将在此处生成...</p>';
    explainContent.innerHTML = '<div class="ph">分析摘要将在此处生成...</div>';
    if (panzoomInstance) {
        panzoomInstance.destroy();
        panzoomInstance = null;
    }
}

/**
 * Displays an error message to the user.
 * @param {string} message The error message to display.
 */
function showError(message: string) {
    loader.style.display = 'none';
    uploader.style.display = 'none';
    resultsContainer.style.display = 'none';
    errorMessage.textContent = message;
    errorBox.style.display = 'block';
}

/**
 * Handles file selection and updates the UI.
 * @param {File} file The selected file.
 */
function handleFileSelect(file: File) {
    if (!file) return;

    const allowedTypes = [
        'text/plain', 
        'text/markdown', 
        'image/png', 
        'image/jpeg',
        'application/pdf',
        'application/epub+zip'
    ];
    // Note: MOBI is intentionally left out of the parsable list but allowed in the file picker for user feedback.
    const allowedExtensions = ['.txt', '.md', '.png', '.jpg', '.jpeg', '.pdf', '.epub'];
    const fileName = file.name.toLowerCase();
    
    // Specific check for MOBI files to provide clear feedback and prevent analysis.
    if (fileName.endsWith('.mobi')) {
        currentFile = file;
        fileInfo.textContent = `MOBI 格式暂不支持在线解析。 (${file.name})`;
        fileInfo.style.color = '#f87171'; // red (dark theme)
        analyzeBtn.disabled = true;
        return;
    }

    // General check for other supported types.
    const fileExtension = '.' + fileName.split('.').pop();
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        fileInfo.textContent = `不支持的文件类型。请选择 TXT, MD, PDF, EPUB, PNG, 或 JPG。`;
        fileInfo.style.color = '#f87171';
        analyzeBtn.disabled = true;
        currentFile = null;
        return;
    }

    // If the file is supported and parsable.
    currentFile = file;
    fileInfo.textContent = `已选择文件: ${file.name}`;
    fileInfo.style.color = 'inherit';
    analyzeBtn.disabled = false;
}

/**
 * Converts a Blob to a base64 encoded string.
 * @param {Blob} blob The blob to convert.
 * @returns {Promise<string>} A promise that resolves with the base64 string.
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                resolve((reader.result as string).split(',')[1]);
            } else {
                reject(new Error("Failed to read blob as base64."));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Parses a PDF file and extracts its text content.
 * @param {File} file The PDF file.
 * @returns {Promise<string>} A promise that resolves with the text content.
 */
async function parsePdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const numPages = pdf.numPages;
    const pageTexts = [];
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        pageTexts.push(pageText);
    }
    return pageTexts.join('\n\n');
}

/**
 * Parses an EPUB file and extracts its text content.
 * @param {File} file The EPUB file.
 * @returns {Promise<string>} A promise that resolves with the text content.
 */
async function parseEpub(file: File): Promise<string> {
    if (typeof ePub === 'undefined' || typeof ePub !== 'function') {
        throw new Error("EPUB 解析库加载失败。请检查您的网络连接并重试。");
    }

    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    
    await book.ready;

    const sectionsText: string[] = [];

    for (const sectionRef of book.spine.items) {
        try {
            const section = book.spine.get(sectionRef);

            if (section) {
                const doc = await section.load();
                if (doc && doc.body) {
                    sectionsText.push(doc.body.innerText || '');
                }
            }
        } catch (e) {
            console.error(`Error loading EPUB section (href: ${sectionRef.href}):`, e);
        }
    }
    return sectionsText.join('\n\n');
}


/**
 * Extracts text content from various file types.
 * @param {File} file The file to process.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
async function extractTextFromFile(file: File): Promise<string> {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.pdf')) {
        return parsePdf(file);
    } 
    
    if (fileName.endsWith('.epub')) {
        return parseEpub(file);
    } 
    
    // This case should not be reached due to the new UI check, but it's a good safeguard.
    if (fileName.endsWith('.mobi')) {
        throw new Error("MOBI 文件格式解析暂不支持，请转换为 EPUB 或 PDF 后再试。");
    }

    if (file.type.startsWith('text/')) {
        return file.text();
    }

    throw new Error(`无法从文件 '${fileName}' 中提取文本。`);
}

/**
 * Highlights a summary item corresponding to a mind map node.
 * @param {string} nodeId The ID of the node to highlight.
 */
function highlightSummaryItem(nodeId: string) {
    // Remove highlight from any previously selected item
    const currentlyHighlighted = document.querySelector('.ei.highlight');
    if (currentlyHighlighted) {
        currentlyHighlighted.classList.remove('highlight');
    }

    // Find and highlight the new item
    const summaryEl = document.getElementById(nodeId);
    if (summaryEl) {
        summaryEl.classList.add('highlight');
        summaryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


/**
 * Renders the mind map SVG using Viz.js and enables pan/zoom.
 * @param {string} dotString The mind map in Graphviz DOT format.
 */
async function renderMindMap(dotString: string) {
    try {
        const viz = new (window as any).Viz();
        const svgElement = await viz.renderSVGElement(dotString);
        mapOut.innerHTML = '';
        mapOut.appendChild(svgElement);
        panzoomInstance = (window as any).Panzoom(svgElement, {
            maxScale: 5,
            minScale: 0.3,
        });
        mapOut.addEventListener('wheel', panzoomInstance.zoomWithWheel);
    } catch (error) {
        console.error('Error rendering mind map:', error);
        mapOut.innerHTML = '<p class="placeholder" style="color: #f87171;">思维导图渲染失败。</p>';
    }
}

/**
 * Renders the summary points in the explanation panel.
 * @param {Array<{nodeId: string, title: string, content: string}>} summaryItems The summary items to display.
 */
function renderSummary(summaryItems: { nodeId: string, title: string, content: string }[]) {
    if (!summaryItems || summaryItems.length === 0) {
        explainContent.innerHTML = '<div class="ph">未能生成分析摘要。</div>';
        return;
    }

    explainContent.innerHTML = '';
    summaryItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'ei';
        itemEl.id = item.nodeId; // Assign ID for interactivity

        const titleContainer = document.createElement('div');
        titleContainer.className = 'eih';
        titleContainer.innerHTML = `<h3>${item.title}</h3>`;

        const contentP = document.createElement('p');
        // Set content for display
        contentP.innerHTML = item.content.replace(/\n/g, '<br>');
        // Store original content for image generation, preserving newlines
        contentP.dataset.originalContent = item.content;

        itemEl.appendChild(titleContainer);
        itemEl.appendChild(contentP);
        
        explainContent.appendChild(itemEl);
    });
}

/**
 * Sets up event listeners for interactive results.
 */
function setupResultInteractivity() {
    mapOut.addEventListener('click', (event) => {
        const target = event.target as SVGElement;
        // Find the parent group element of a node, which should have the ID
        const nodeElement = target.closest('.node');
        if (nodeElement && nodeElement.id) {
            highlightSummaryItem(nodeElement.id);
        }
    });
}


/**
 * Calls the Gemini API to analyze the document content.
 */
async function analyzeDocument() {
    if (!currentFile) {
        showError("未选择文件或文件格式不支持。");
        return;
    }

    // Update UI to loading state
    uploader.style.display = 'none';
    loader.style.display = 'block';
    errorBox.style.display = 'none';
    resultsContainer.style.display = 'none';

    try {
        const parts: any[] = [];
        if (currentFile.type.startsWith('image/')) {
            const base64Data = await blobToBase64(currentFile);
            parts.push({
                inlineData: {
                    mimeType: currentFile.type,
                    data: base64Data,
                },
            });
            parts.push({ text: "分析此图片内容。提供一份包含核心要点的详细摘要，并生成一个总结其主要概念的思维导图（使用Graphviz DOT语言）。思维导图应该结构清晰、视觉上易于理解。为每个摘要要点生成一个唯一的nodeId，并在思维导图的对应节点上使用相同的ID。" });
        } else {
            const textContent = await extractTextFromFile(currentFile);
            parts.push({ text: `分析以下文档内容:\n\n${textContent}\n\n请提供一份包含核心要点的详细摘要，并生成一个总结其主要概念的思维导图（使用Graphviz DOT语言）。思维导图应该结构清晰、视觉上易于理解。为每个摘要要点生成一个唯一的nodeId（例如 'node1', 'node2'），并在思维导图的对应节点上使用相同的ID。` });
        }

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: {
                    type: Type.ARRAY,
                    description: "文档的核心摘要，分为多个要点。",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            nodeId: { type: Type.STRING, description: "此要点的唯一标识符，应与思维导图中的节点ID匹配 (例如 'node1')。" },
                            title: { type: Type.STRING, description: "要点的标题。" },
                            content: { type: Type.STRING, description: "要点的详细内容。" }
                        },
                        required: ["nodeId", "title", "content"]
                    }
                },
                mindMapDot: {
                    type: Type.STRING,
                    description: "Graphviz DOT格式的思维导图字符串。每个节点都必须有一个与摘要中'nodeId'匹配的'id'属性 (例如: node1 [id=\"node1\", label=\"...\"])。应包含graph, node, edge属性以优化视觉效果。"
                }
            },
            required: ["summary", "mindMapDot"]
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonResponse = JSON.parse(response.text);

        if (jsonResponse.mindMapDot) {
            await renderMindMap(jsonResponse.mindMapDot);
        }
        if (jsonResponse.summary) {
            renderSummary(jsonResponse.summary);
        }

        setupResultInteractivity();

        // Show results
        loader.style.display = 'none';
        resultsContainer.style.display = 'block';

    } catch (error: any) {
        console.error("Analysis failed:", error);
        const message = error.message || "分析失败。请检查您的网络连接或文件内容，然后重试。";
        showError(message);
    }
}


/**
 * Wraps and draws text on a canvas, correctly handling paragraphs and word wrapping.
 * @returns The Y position after the text block.
 */
function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    const paragraphs = text.split('\n');
    let currentY = y;

    for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
            currentY += lineHeight; // Add space for empty paragraphs (acts as a line break)
            continue;
        }

        const words = paragraph.split(' ');
        let line = '';

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                context.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        context.fillText(line.trim(), x, currentY);
        currentY += lineHeight * 1.5; // Add extra space after each paragraph
    }
    return currentY; // Return the Y position for the next element
}

/**
 * Generates and downloads a single, mobile-optimized, high-resolution image of the analysis.
 */
async function downloadImage() {
    const svgElement = mapOut.querySelector('svg');
    const summaryItems = Array.from(explainContent.querySelectorAll('.ei'));

    if (!svgElement) {
        alert("没有可下载的思维导图。");
        return;
    }

    // --- 1. Setup Scaling and Constants ---
    const scale = 2; // Use 2x scaling for Retina-quality output
    const BASE_CANVAS_WIDTH = 900;
    const BASE_PADDING = 50;
    const canvasWidth = BASE_CANVAS_WIDTH * scale;
    const padding = BASE_PADDING * scale;
    const contentWidth = canvasWidth - 2 * padding;

    // --- 2. Load SVG into an Image object ---
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();

    try {
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (err) => reject(new Error("无法加载思维导图以生成图片: " + err));
            img.src = url;
        });
    } catch (e: any) {
        alert(e.message);
        return;
    } finally {
        URL.revokeObjectURL(url); // Revoke URL after image is loaded or has failed
    }

    // --- 3. Draw on an oversized temporary canvas to determine final height ---
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    const initialHeight = 30000 * scale; // A very large height to prevent premature clipping

    tempCanvas.width = canvasWidth;
    tempCanvas.height = initialHeight;
    tempCtx.fillStyle = '#20232a'; // Dark theme background
    tempCtx.fillRect(0, 0, canvasWidth, initialHeight);

    let currentY = padding;

    // Draw Title
    tempCtx.font = `bold ${40 * scale}px sans-serif`;
    tempCtx.fillStyle = '#e2e8f0'; // Light primary text
    tempCtx.textAlign = 'center';
    tempCtx.fillText("神灯AI·文档分析报告", canvasWidth / 2, currentY + (25 * scale));
    currentY += 100 * scale;
    tempCtx.textAlign = 'left';

    // Draw Mind Map
    const imgDisplayHeight = (img.height / img.width) * contentWidth;
    tempCtx.filter = 'invert(0.9) hue-rotate(180deg)'; // Apply filter to make SVG readable
    tempCtx.drawImage(img, padding, currentY, contentWidth, imgDisplayHeight);
    tempCtx.filter = 'none'; // Reset filter for subsequent drawing
    currentY += imgDisplayHeight + padding;

    // Draw Summary
    summaryItems.forEach(item => {
        const title = (item.querySelector('h3') as HTMLElement).innerText;
        const pEl = item.querySelector('p') as HTMLParagraphElement;
        // Use original content with preserved newlines for accurate wrapping
        const content = pEl.dataset.originalContent || pEl.innerText;
        
        tempCtx.font = `bold ${30 * scale}px sans-serif`;
        tempCtx.fillStyle = '#818cf8'; // Brand color for titles
        tempCtx.fillText(title, padding, currentY);
        currentY += 50 * scale;

        tempCtx.font = `${24 * scale}px sans-serif`;
        tempCtx.fillStyle = '#94a3b8'; // Light secondary text
        currentY = wrapText(tempCtx, content, padding, currentY, contentWidth, 38 * scale);
        currentY += 15 * scale; // Margin after each summary item
    });
    
    // Final content height is now known
    const finalHeight = currentY + (45 * scale); // Add space for the footer

    // --- 4. Create the final canvas with the correct height and copy the content ---
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvasWidth;
    finalCanvas.height = finalHeight;
    const finalCtx = finalCanvas.getContext('2d')!;
    
    // Copy the rendered part from the oversized canvas to the final one
    finalCtx.drawImage(tempCanvas, 0, 0);

    // --- 5. Draw the footer on the final, correctly-sized canvas ---
    finalCtx.fillStyle = '#94a3b8'; // Light secondary text
    finalCtx.font = `${18 * scale}px sans-serif`;
    finalCtx.textAlign = 'center';
    const brandText = "由 神灯AI·文档分析器 生成 | 作者：神灯智库·天火义王";
    finalCtx.fillText(brandText, canvasWidth / 2, finalHeight - (30 * scale));
    
    // --- 6. Trigger Download ---
    const dataUrl = finalCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    const fileName = currentFile?.name.substring(0, currentFile.name.lastIndexOf('.')) || 'export';
    link.download = `分析报告-${fileName}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Drop Zone events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer?.files[0]) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    dropZone.addEventListener('click', () => fileInput.click());

    // File Input event
    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            handleFileSelect(fileInput.files[0]);
        }
    });

    // Button events
    analyzeBtn.addEventListener('click', analyzeDocument);
    downloadBtn.addEventListener('click', downloadImage);
    resetBtn.addEventListener('click', resetUI);
    resetFromErrorBtn.addEventListener('click', resetUI);


    // Initialize UI
    resetUI();
});