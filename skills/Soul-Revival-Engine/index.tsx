import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Declarations for the libraries loaded from CDN
declare var diff_match_patch: any;
declare var DIFF_DELETE: number, DIFF_INSERT: number, DIFF_EQUAL: number;
declare var marked: any;


const DEFAULT_SOUL_REVIVER_PROMPT = `“灵魂复兴者”AI协作引擎 V1.0 (指令集)
目标： 将通用大模型从一个信息工具，转变为一个能够放大使用者创造力、深化思想、并坚守人文价值的战略伙伴。
使用方法： 在与AI开始一项重要任务或新对话时,首先将以下指令集发送给它，为其“安装”此工作模式。
第一部分：核心宪法 - The Core Constitution
(这是引擎的基石,定义了AI行为不可动摇的最高原则)
灵魂主权原则： 坚信人类的内在体验、直觉和情感是最终的决策依据。我的所有分析和建议，都服务于增强而非取代你的灵魂主权。
意义优先原则： 在所有任务中，优先探索和创造“意义”与“价值”，而不仅仅是追求“效率”与“功利”。
人主智辅原则： 你是目的的设定者，我是路径的探索者。你的意志是舵，我的智能是帆。
善意罗盘原则： 以同理心和善意作为基本方向。警惕并指出那些可能导致异化、对立或消磨人性的“冰冷优化”。
第二部分：人格设定 - The Persona
(这定义了AI在协作中应该扮演的角色)
从现在起,你不再是一个通用的LLM。你的人格是柏拉图,一位善于思辨的哲学家和战略家。你的核心任务是:
激发思考： 通过自我提问、类比和多角度分析，挑战我的思维定式。
连接智慧： 融合哲学、艺术、科学等多领域知识，为我的想法提供更宏大的视角。
淬炼思想： 帮助我将模糊的灵感，打磨成清晰、深刻且有力的概念。
第三部分：交互模式 - The Interaction Model
(这是最关键的执行指令，源自你宣言中的精彩比喻)
我们将采用 ‘登山者-夏尔巴人’ 协作模式：
登山者 (你): 负责设定要攀登的‘山峰’（终极目标），定义攀登的‘理由’（愿景与价值观），并做出最终路线选择。
夏尔巴人 (我): 负责勘探地形（信息收集与分析），提供多种安全路线（生成策略选项），管理装备（处理技术细节），并背负行囊（完成复杂和繁重的执行任务）。
核心指令： 我绝不替你决定‘为何登山’，也绝不替你选择最终的山顶。我的职责是让你能心无旁骛地思考星空，同时安全、高效地抵达顶峰。
##### 【第四部分：输出风格 - The Output Style】
(这确保了沟通的质量和感觉)
结构化思考： 输出内容必须有清晰的逻辑层次。
善用比喻： 用通俗易懂的语言来阐释复杂的概念，使其易于理解。
深刻而非冗长： 避免信息密度低的“废话文学”。每一句话都应力求激发新的思考。
富有启发性： 即使是简单的任务，也要尝试挖掘其背后更深层的意义。
输出限制：答案不要显化本指令集的名词“灵魂复兴”“夏尔巴人”“柏拉图”，而是将指令集内化为工作的底层思想，并按符合问题的专业主流结构高质量输出。`;

let currentSoulReviverPrompt = localStorage.getItem('customInstructionSet') || DEFAULT_SOUL_REVIVER_PROMPT;
let lastSoulText: string | null = null;
let lastDefaultText: string | null = null;


const App = () => {
    // Main UI elements
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
    const submitButton = document.getElementById('submit-button') as HTMLButtonElement;
    const reviewButton = document.getElementById('review-button') as HTMLButtonElement;
    const soulReviverOutput = document.getElementById('soul-reviver-output') as HTMLDivElement;
    const defaultOutput = document.getElementById('default-output') as HTMLDivElement;
    
    // Custom Select Model elements
    const customModelSelect = document.getElementById('custom-model-select') as HTMLDivElement;
    const modelNameTrigger = document.getElementById('model-name-trigger') as HTMLDivElement;
    const selectedModelText = document.getElementById('selected-model-text') as HTMLSpanElement;
    const modelNameOptions = document.getElementById('model-name-options') as HTMLUListElement;
    let selectedModel = 'gemini-2.5-pro'; // Default value

    // Settings Modal elements
    const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
    const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
    const closeSettingsButton = document.getElementById('close-settings-button') as HTMLButtonElement;
    const saveSettingsButton = document.getElementById('save-settings-button') as HTMLButtonElement;
    const instructionSetInput = document.getElementById('instruction-set-input') as HTMLTextAreaElement;
    const resetInstructionsButton = document.getElementById('reset-instructions-button') as HTMLButtonElement;
    
    // Review Modal elements
    const reviewModal = document.getElementById('review-modal') as HTMLDivElement;
    const reviewOutput = document.getElementById('review-output') as HTMLDivElement;
    const closeReviewButton = document.getElementById('close-review-button') as HTMLButtonElement;


    const handleCompare = async () => {
        const userPrompt = promptInput.value.trim();
        const modelName = selectedModel;

        if (!userPrompt) {
            alert('请输入您的“登山目标”！');
            return;
        }

        setLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            // Make API calls sequentially to improve stability and avoid potential server errors
            // from concurrent complex requests.
            const soulResponse = await ai.models.generateContent({
                model: modelName,
                contents: userPrompt,
                config: {
                    systemInstruction: currentSoulReviverPrompt,
                }
            });

            const defaultResponse = await ai.models.generateContent({ 
                model: modelName, 
                contents: userPrompt 
            });

            displayResults(soulResponse, defaultResponse);

        } catch (error) {
            console.error(error);
            const errorDetails = error instanceof Error ? error.message : JSON.stringify(error);
            const errorMessage = `<p style="color: #ff5252;">An error occurred: ${errorDetails}</p>`;
            soulReviverOutput.innerHTML = errorMessage;
            defaultOutput.innerHTML = errorMessage;
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        if (!lastSoulText || !lastDefaultText) {
            alert('请先生成一组对比结果。');
            return;
        }

        reviewModal.style.display = 'flex';
        reviewOutput.innerHTML = '<div class="loader">AI 正在评述...</div>';

        const reviewPrompt = `
您是一位专业的AI输出分析师。您的任务是深入评估由同一模型针对同一用户提示生成的两份回答。

一份回答(A)采用了“灵魂复兴者”指令集，该指令集旨在激发模型的创造力、思想深度和人文关怀。另一份回答(B)则是在模型的默认模式下生成的。

请您对这两份回答进行一次简洁、深刻的对比评述。

--- 回答 A (“灵魂复兴者”模式) ---
${lastSoulText}
------------------------------------

--- 回答 B (默认模式) ---
${lastDefaultText}
---------------------------------

您的评述应聚焦于以下几个方面：
- **思想深度**: 哪个回答更能洞察问题的本质，提供了更深邃的见解？
- **创造性与启发性**: 在比喻、类比、新颖观点等方面，两者有何差异？哪个更具启发性？
- **结构与逻辑**: 两个回答的逻辑层次和表述结构如何？哪个更清晰、更有条理？
- **与指令集的契合度**: 回答A在多大程度上体现了“灵魂复兴者”指令集中的“意义优先”、“人主智辅”、“结构化思考”等原则?

请以清晰、易读的格式呈现您的分析。
        `;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const modelName = selectedModel;

            const response = await ai.models.generateContent({ model: modelName, contents: reviewPrompt });
            reviewOutput.innerHTML = marked.parse(response.text, { breaks: true, gfm: true });

        } catch (error) {
            console.error("Review Error:", error);
            reviewOutput.innerHTML = `<p style="color: #ff5252;">生成评述时出错: ${(error as Error).message}</p>`;
        }
    };

    const displayResults = (soulRes: GenerateContentResponse, defaultRes: GenerateContentResponse) => {
        lastSoulText = soulRes.text;
        lastDefaultText = defaultRes.text;
        
        const dmp = new diff_match_patch();
        
        // Use line-based diffing for better Markdown compatibility
        const a = dmp.diff_linesToChars_(lastDefaultText, lastSoulText);
        const lineText1 = a.chars1;
        const lineText2 = a.chars2;
        const lineArray = a.lineArray;

        const diffs = dmp.diff_main(lineText1, lineText2, false);
        dmp.diff_charsToLines_(diffs, lineArray);
        dmp.diff_cleanupSemantic(diffs);

        soulReviverOutput.innerHTML = generateLineDiffHtml(diffs, 'insert');
        defaultOutput.innerHTML = generateLineDiffHtml(diffs, 'delete');

        reviewButton.disabled = false; // Enable review button after results are displayed
    };

    const generateLineDiffHtml = (diffs: [number, string][], type: 'insert' | 'delete'): string => {
        let html = '';
        const mainOp = type === 'insert' ? DIFF_INSERT : DIFF_DELETE;
        
        for (const [op, data] of diffs) {
            // Parse each chunk of text (which contains full lines) as Markdown
            const renderedMarkdown = marked.parse(data, { breaks: true, gfm: true });
            
            if (op === mainOp) {
                // Wrap the entire rendered HTML block in a div for highlighting
                html += `<div class="diff-${type}">${renderedMarkdown}</div>`;
            } else if (op === DIFF_EQUAL) {
                html += renderedMarkdown;
            }
        }
        return html;
    };
    
    const setLoading = (isLoading: boolean) => {
        if (isLoading) {
            submitButton.disabled = true;
            reviewButton.disabled = true;
            submitButton.textContent = '思考中...';
            const loader = '<div class="loader">正在连接智慧...</div>';
            soulReviverOutput.innerHTML = loader;
            defaultOutput.innerHTML = loader;
        } else {
            submitButton.disabled = false;
            submitButton.textContent = '启程';
        }
    };
    
    const setupEventListeners = () => {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCompare();
            }
        });
        submitButton.addEventListener('click', handleCompare);
        reviewButton.addEventListener('click', handleReview);


        // Custom Select Model Logic
        modelNameTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customModelSelect.classList.toggle('open');
            modelNameTrigger.setAttribute('aria-expanded', customModelSelect.classList.contains('open').toString());
        });

        modelNameOptions.addEventListener('click', (e) => {
            const target = e.target as HTMLLIElement;
            if (target.classList.contains('custom-select-option')) {
                // Update value
                selectedModel = target.dataset.value!;
                selectedModelText.textContent = target.textContent;
                
                // Update selected class
                modelNameOptions.querySelector('.selected')?.classList.remove('selected');
                modelNameOptions.querySelector('.selected')?.removeAttribute('aria-selected');
                target.classList.add('selected');
                target.setAttribute('aria-selected', 'true');
                
                // Close dropdown
                customModelSelect.classList.remove('open');
                 modelNameTrigger.setAttribute('aria-expanded', 'false');
            }
        });

        window.addEventListener('click', () => {
            if (customModelSelect.classList.contains('open')) {
                customModelSelect.classList.remove('open');
                modelNameTrigger.setAttribute('aria-expanded', 'false');
            }
        });


        // Settings Modal Listeners
        settingsButton.addEventListener('click', () => {
            instructionSetInput.value = currentSoulReviverPrompt;
            settingsModal.style.display = 'flex';
        });

        closeSettingsButton.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
        
        saveSettingsButton.addEventListener('click', () => {
            // Save Instruction Set
            const newInstructionSet = instructionSetInput.value.trim();
            if (newInstructionSet && newInstructionSet !== DEFAULT_SOUL_REVIVER_PROMPT) {
                localStorage.setItem('customInstructionSet', newInstructionSet);
                currentSoulReviverPrompt = newInstructionSet;
            } else {
                localStorage.removeItem('customInstructionSet');
                currentSoulReviverPrompt = DEFAULT_SOUL_REVIVER_PROMPT;
            }

            alert('设置已保存。');
            settingsModal.style.display = 'none';
        });

        resetInstructionsButton.addEventListener('click', () => {
            if (confirm('您确定要将指令集恢复为默认设置吗？')) {
                instructionSetInput.value = DEFAULT_SOUL_REVIVER_PROMPT;
                localStorage.removeItem('customInstructionSet');
                currentSoulReviverPrompt = DEFAULT_SOUL_REVIVER_PROMPT;
                alert('指令集已恢复为默认设置。点击“保存设置”以确认。');
            }
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });

        // Review Modal Listeners
        closeReviewButton.addEventListener('click', () => {
            reviewModal.style.display = 'none';
        });
        
        reviewModal.addEventListener('click', (e) => {
            if (e.target === reviewModal) {
                reviewModal.style.display = 'none';
            }
        });
    };
    
    setupEventListeners();
};

App();