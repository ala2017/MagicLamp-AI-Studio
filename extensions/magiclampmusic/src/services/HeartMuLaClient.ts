import * as vscode from 'vscode';
import axios from 'axios';

// 定义接口响应类型
interface HeartMuLaResponse {
    job_id: string;
    status: string;
    audio_uri: string;
    lyrics: string;
    ai_explanation?: string;
}

export class HeartMuLaClient {
    // 您的 Cloud Run 地址
    private static readonly BASE_URL = 'https://heartmula-music-539825519519.us-central1.run.app';

    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * 发送音乐生成请求
     * @param prompt 用户输入的自然语言描述 (如 "赛博朋克风格的编程之歌")
     */
    public async generateMusic(prompt: string): Promise<HeartMuLaResponse> {
        try {
            console.log(`🎵 HeartMuLa Connecting to: ${HeartMuLaClient.BASE_URL}`);

            // 使用 axios 发送 POST 请求
            // 为什么用 axios？比 fetch 更稳定，且自动处理 JSON
            const response = await axios.post<HeartMuLaResponse>(`${HeartMuLaClient.BASE_URL}/generate`, {
                prompt: prompt
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30秒超时，防止云端唤醒太慢
            });

            console.log("✅ HeartMuLa Response:", response.data);
            return response.data;

        } catch (error: any) {
            console.error("❌ HeartMuLa Error:", error);
            const errorMessage = error.response?.data?.detail || error.message || "Unknown Error";

            // 抛出错误给前端捕获，并带有友好提示
            throw new Error(`音乐生成失败 (HeartMuLa Cloud): ${errorMessage}. 请确保 API 地址正确且网络通畅。`);
        }
    }

    /**
     * 测试连接与健康状态
     */
    public async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${HeartMuLaClient.BASE_URL}/`);
            return response.status === 200;
        } catch (e) {
            console.warn("HeartMuLa Health Check Failed:", e);
            return false;
        }
    }
}
