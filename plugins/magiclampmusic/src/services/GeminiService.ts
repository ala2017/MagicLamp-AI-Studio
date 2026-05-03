import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
    private genAI: GoogleGenerativeAI | undefined;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initialize();
    }

    private async initialize() {
        const apiKey = await this.context.secrets.get('google_gemini_api_key');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    public async setApiKey(key: string) {
        await this.context.secrets.store('google_gemini_api_key', key);
        this.genAI = new GoogleGenerativeAI(key);
    }

    public async checkApiKey(): Promise<boolean> {
        return !!this.genAI;
    }

    // --- Core Feature: Optimize Lyrics ---
    public async optimizeLyrics(originalLyrics: string, instructions: string): Promise<string> {
        if (!this.genAI) throw new Error("API Key not set");

        const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
        Role: World-class Rap/Hip-hop Lyricist and Editor.
        Task: Polish and optimize the following lyrics based on the user's instructions.
        
        User Instructions: "${instructions}"
        
        Original Lyrics:
        ${originalLyrics}
        
        Requirements:
        1. Output ONLY the polish lyrics. No introductions, no explanations.
        2. Maintain the original structure (Verse/Chorus) unless asked to change.
        3. Make the flow tighter and the rhymes more complex (multisyllabic rhymes).
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Error:", error);
            throw new Error("Failed to generate lyrics. Please check your API Key or Network.");
        }
    }

    // --- Core Feature: Generate Style Prompt ---
    public async generateStylePrompt(tags: string[], baseDescription: string): Promise<string> {
        if (!this.genAI) throw new Error("API Key not set");

        const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
        Role: Music Producer Expert in AI Music Generation (Suno AI / Udio).
        Task: Create a high-quality prompt for a text-to-music AI based on the user's vibe tags and description.
        
        User Tags: [${tags.join(', ')}]
        User Description: "${baseDescription}"
        
        Requirements:
        1. Output ONLY the prompt string.
        2. Include specific genres, instruments (e.g., '808 bass', 'distorted guitar'), vocal styles (e.g., 'raspy male vocals'), and BPM.
        3. Format: Comma-separated concise tags + short descriptive sentences.
        4. Max length: 200 characters.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Error:", error);
            throw new Error("Failed to generate style prompt.");
        }
    }
}
