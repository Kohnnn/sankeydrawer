import { DiagramState, AISettings, defaultAISettings } from '@/types/sankey';
import { callGemini } from '@/lib/gemini-api';

export interface AIResponse {
    success: boolean;
    content: string;
    error?: string;
}

const STORAGE_KEY = 'sankey-ai-settings';

class AIService {
    private history: Array<{
        role: 'user' | 'model';
        parts: Array<{
            text?: string;
            inline_data?: { mime_type: string; data: string }
        }>
    }> = [];

    private getSettings(): AISettings {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return { ...defaultAISettings, ...JSON.parse(saved) };
            }
        }
        return defaultAISettings;
    }

    async sendMessage(
        userMessage: string,
        currentState: DiagramState,
        settingsOverride?: Partial<AISettings>
    ): Promise<AIResponse> {
        const settings = { ...this.getSettings(), ...settingsOverride };

        // If no API key, return specific error
        if (!settings.apiKey) {
            return {
                success: false,
                content: '', // Content is empty on error
                error: 'API Key missing. Please configure it in settings.'
            };
        }

        // Get rich formatted context for AI
        const { getDiagramStateForAI } = await import('@/lib/ai-utils');
        const richContext = getDiagramStateForAI(currentState);

        const result = await callGemini(
            settings,
            userMessage,
            this.history, // Pass history
            richContext // Pass optimized context string
        );

        if (result.success && result.text) {
            // Update history with text and attachments
            const userParts: Array<{
                text?: string;
                inline_data?: { mime_type: string; data: string }
            }> = [{ text: userMessage }];
            if (settings.attachments && settings.attachments.length > 0) {
                settings.attachments.forEach(att => {
                    userParts.push({
                        inline_data: {
                            mime_type: att.type,
                            data: att.data.split(',')[1] // Remove base64 header
                        }
                    });
                });
            }

            this.history.push({ role: 'user', parts: userParts });
            this.history.push({ role: 'model', parts: [{ text: result.text }] });

            // Keep history manageable
            if (this.history.length > 20) {
                this.history = this.history.slice(-20);
            }

            return {
                success: true,
                content: result.text
            };
        } else {
            return {
                success: false,
                content: '',
                error: result.error || 'Unknown error calling Gemini API'
            };
        }
    }

    clearHistory() {
        this.history = [];
    }
}

export const aiService = new AIService();
