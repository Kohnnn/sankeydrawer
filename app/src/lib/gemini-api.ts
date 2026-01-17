import { SankeyData, AISettings } from '@/types/sankey';

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message: string;
        code: number;
    };
    promptFeedback?: {
        blockReason?: string;
    };
}

interface Message {
    role: 'user' | 'model';
    parts: Array<{
        text?: string;
        inline_data?: {
            mime_type: string;
            data: string;
        };
    }>;
}

/**
 * Call the Gemini API with the given prompt and conversation history
 */
export async function callGemini(
    settings: AISettings,
    userMessage: string,
    conversationHistory: Message[] = [],
    currentData?: SankeyData | string
): Promise<{ success: boolean; text?: string; error?: string }> {
    if (!settings.apiKey) {
        return { success: false, error: 'API key is not configured. Please add your Gemini API key in Settings.' };
    }

    const baseUrl = settings.baseUrl || 'https://generativelanguage.googleapis.com';
    const apiUrl = `${baseUrl}/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`;

    // Build the system context
    let dataContext = '';
    if (currentData) {
        if (typeof currentData === 'string') {
            // Already formatted rich context
            dataContext = currentData;
        } else {
            // Raw object, stringify it
            dataContext = `
=== CURRENT DIAGRAM DATA ===
The user is currently working on the following diagram. Use this as the baseline for any modifications.
${JSON.stringify(currentData, null, 2)}
============================

If the user asks to modify this data, provide the transformation results as a valid JSON object.
`;
        }
    }

    const systemContext = settings.customPrompt + (dataContext ? `\n${dataContext}` : '');

    // Build contents array with conversation history
    const contents = [
        ...conversationHistory,
        {
            role: 'user' as const,
            parts: [
                { text: userMessage },
                ...(settings.attachments?.map(att => ({
                    inline_data: {
                        mime_type: att.type,
                        data: att.data.split(',')[1] // Remove base64 header
                    }
                })) || [])
            ]
        }
    ];

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemContext }]
                },
                contents,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            }),
        });

        const data: GeminiResponse = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            return { success: false, error: 'No response received from AI' };
        }

        return { success: true, text };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return { success: false, error: `Failed to connect to Gemini API: ${message}` };
    }
}

/**
 * Test the API connection with the given API key
 */
export async function testApiConnection(apiKey: string, model: string, baseUrl?: string): Promise<{ success: boolean; error?: string }> {
    if (!apiKey) {
        return { success: false, error: 'API key is required' };
    }

    const validBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com';
    const apiUrl = `${validBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: 'Hello' }]
                }],
                generationConfig: {
                    maxOutputTokens: 10,
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errMsg = errorData.error?.message || response.statusText || 'Unknown API Error';
            return { success: false, error: `API Error ${response.status}: ${errMsg}` };
        }

        const data: GeminiResponse = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        // Deep check for text in any candidate and any part
        const candidates = data.candidates || [];
        if (candidates.length > 0) {
            return { success: true };
        }

        // If we reached here, the structure is unexpected or candidates are empty
        console.error('Gemini API Unexpected Response:', data);

        if (data.promptFeedback) {
            const blockReason = data.promptFeedback.blockReason || 'Unknown block reason';
            return { success: false, error: `Prompt blocked by Google Safety Filters: ${blockReason}` };
        }

        if (candidates.length === 0) {
            return { success: false, error: 'No candidates returned (Possible Safety Block or Model Capacity reached)' };
        }

        // Return a snippet of the JSON for debugging
        const snippet = JSON.stringify(data).substring(0, 150);
        return { success: false, error: `Unexpected response format: ${snippet}...` };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Connection failed: ${message}. If you are behind a firewall, try configuring a Base URL (Proxy).` };
    }
}

/**
 * Parse JSON data from AI response text
 */
export function parseJsonFromResponse(text: string): SankeyData | null {
    // Try to extract JSON from code blocks first
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : text;

    try {
        const parsed = JSON.parse(jsonStr);

        // Validate the structure
        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.links && Array.isArray(parsed.links)) {
            // Ensure nodes have required fields
            const nodes = parsed.nodes.map((node: Record<string, unknown>) => ({
                id: String(node.id || node.name || '').toLowerCase().replace(/\s+/g, '_'),
                name: String(node.name || node.id || ''),
                color: node.color as string | undefined,
                category: node.category as 'revenue' | 'expense' | 'profit' | 'neutral' | undefined,
            }));

            // Ensure links have required fields
            const links = parsed.links.map((link: Record<string, unknown>) => ({
                source: String(link.source || ''),
                target: String(link.target || ''),
                value: Number(link.value) || 0,
                previousValue: link.previousValue !== undefined ? Number(link.previousValue) : undefined,
                comparisonValue: link.comparisonValue !== undefined ? String(link.comparisonValue) : undefined, // Allow string (e.g. "+10%")
                color: link.color as string | undefined,
            }));

            return { nodes, links };
        }
    } catch {
        // Try to find inline JSON object
        const inlineMatch = text.match(/\{[\s\S]*"nodes"[\s\S]*"links"[\s\S]*\}/);
        if (inlineMatch) {
            try {
                return parseJsonFromResponse(inlineMatch[0]);
            } catch {
                // Failed to parse
            }
        }
    }

    return null;
}

/**
 * Export diagram data as JSON string
 */
export function exportDataAsJson(data: SankeyData): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Parse JSON string into SankeyData
 */
export function importDataFromJson(jsonString: string): SankeyData | null {
    try {
        const parsed = JSON.parse(jsonString);
        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.links && Array.isArray(parsed.links)) {
            return parsed as SankeyData;
        }
    } catch {
        // Invalid JSON
    }
    return null;
}
