import * as vscode from 'vscode';
import axios from 'axios';

export interface SunoClip {
    id: string;
    audio_url: string;
    video_url?: string;
    image_url?: string;
    title: string;
    status: string;
}

export interface SunoGenerateResponse {
    id?: string;
    clips?: SunoClip[];
    status?: string;
    message?: string;
}

export class SunoApiClient {
    private context: vscode.ExtensionContext;
    private static readonly DEFAULT_BASE_URL = 'http://localhost:3001';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    private getBaseUrl(): string {
        const config = vscode.workspace.getConfiguration('magiclampmusic');
        return config.get<string>('sunoBaseUrl') || SunoApiClient.DEFAULT_BASE_URL;
    }

    private async getApiKey(): Promise<string | undefined> {
        return await this.context.secrets.get('suno_api_key');
    }

    public async setApiKey(key: string) {
        await this.context.secrets.store('suno_api_key', key);
    }

    public async generate(
        prompt: string,
        isInstrumental: boolean = false,
        tags?: string,
        title?: string,
        model: string = 'chirp-crow'
    ): Promise<SunoGenerateResponse> {
        const baseUrl = this.getBaseUrl();
        const apiKey = await this.getApiKey();
        const endpoint = `${baseUrl.replace(/\/$/, '')}/api/custom_generate`;

        console.log(`🎵 Suno API: ${endpoint}`);

        try {
            const payload: any = {
                prompt: prompt,
                make_instrumental: isInstrumental,
                wait_audio: false,
                model: model
            };
            if (tags) payload.tags = tags;
            if (title) payload.title = title;

            const headers: any = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

            const response = await axios.post<SunoClip[]>(endpoint, payload, {
                headers,
                timeout: 30000
            });

            console.log("✅ Suno:", response.data);
            return { clips: response.data };

        } catch (error: any) {
            console.error("❌ Suno Error:", error);
            let errMsg = 'Unknown error';
            if (error.code === 'ECONNREFUSED') {
                errMsg = '无法连接到 Suno API 服务，请确保 suno-api-private 正在运行 (localhost:3001)';
            } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                errMsg = '连接超时，请检查网络';
            } else if (error.response) {
                errMsg = `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;
            } else if (error.message) {
                errMsg = error.message;
            }
            throw new Error(errMsg);
        }
    }

    public async getStatus(ids: string[]): Promise<SunoClip[]> {
        const baseUrl = this.getBaseUrl();
        const endpoint = `${baseUrl.replace(/\/$/, '')}/api/get?ids=${ids.join(',')}`;
        const response = await axios.get<SunoClip[]>(endpoint, { timeout: 10000 });
        return response.data;
    }

    public async getQuota() {
        const baseUrl = this.getBaseUrl();
        const endpoint = `${baseUrl.replace(/\/$/, '')}/api/get_limit`;
        const response = await axios.get(endpoint, { timeout: 10000 });
        return response.data;
    }
}
