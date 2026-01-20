import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Upload, Sparkles, HelpCircle, FileText, Image as ImageIcon, Copy, Check, Settings, AlertCircle, Loader2, XCircle, Trash2, Palette, Lightbulb } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { aiService } from '@/services/ai-service';
import { useAISettings, Message, Attachment } from '@/context/AISettingsContext';
import { parseDSL } from '@/lib/dsl-parser';
import { callGemini, parseJsonFromResponse } from '@/lib/gemini-api';
import AISettingsPanel from './AISettingsPanel';

export default function AIAssistantTab() {
    const { state, dispatch } = useDiagram();
    const { settings, isConfigured, messages, addMessage, setMessages, clearMessages } = useAISettings();
    // Removed local messages state initialization as it is now handled by context
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convert messages to Gemini format for context
    const getConversationHistory = useCallback(() => {
        return messages.slice(1).map(msg => {
            const parts: any[] = [{ text: msg.content }];

            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach(att => {
                    parts.push({
                        inline_data: {
                            mime_type: att.type,
                            data: att.data.split(',')[1] // Remove base64 header
                        }
                    });
                });
            }

            return {
                role: msg.role === 'user' ? 'user' as const : 'model' as const,
                parts: parts
            };
        });
    }, [messages]);

    // Listen for AI actions from canvas (node context menu)
    useEffect(() => {
        const handleAINodeAction = (e: CustomEvent<{ nodeId: string; action: string; nodeName: string }>) => {
            const { nodeId, action, nodeName } = e.detail;

            let prompt = '';
            switch (action) {
                case 'breakdown':
                    prompt = `Suggest a breakdown for the node "${nodeName}" (ID: ${nodeId}). What sub-categories or components might this node contain?`;
                    break;
                case 'insights':
                    prompt = `Provide insights about the node "${nodeName}" (ID: ${nodeId}). What observations can you make based on its inflows, outflows, and value?`;
                    break;
                case 'optimize':
                    prompt = `Suggest optimizations for the node "${nodeName}" (ID: ${nodeId}). How could this value be improved or balanced?`;
                    break;
                default:
                    prompt = `Tell me about the node "${nodeName}" (ID: ${nodeId}).`;
            }

            // Set the input and trigger send
            setInput(prompt);
        };

        window.addEventListener('ai-node-action', handleAINodeAction as EventListener);
        return () => window.removeEventListener('ai-node-action', handleAINodeAction as EventListener);
    }, []);

    const handleSend = async (textOverride?: string) => {
        // Allow override, otherwise use input state
        const textToSend = typeof textOverride === 'string' ? textOverride : input;

        if ((!textToSend.trim() && pendingFiles.length === 0) || isProcessing) return;

        const userMessage = textToSend.trim();
        const attachmentsToSend = [...pendingFiles];

        // Clear inputs immediately
        setInput('');
        setPendingFiles([]);
        setIsProcessing(true);

        // Add user message to UI immediately
        addMessage({
            id: Date.now().toString(),
            role: 'user',
            content: userMessage,
            attachments: attachmentsToSend,
            timestamp: new Date()
        });

        try {
            // Create settings override with attachments
            const settingsOverride = {
                ...settings,
                attachments: attachmentsToSend
            };

            const response = await aiService.sendMessage(userMessage || (attachmentsToSend.length > 0 ? "Analyze this image" : ""), state, settingsOverride);

            if (response.success) {
                addMessage({
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date()
                });

                // Check for JSON changes in the response
                const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    try {
                        const changes = JSON.parse(jsonMatch[1]);
                        console.log('AI Parsed Changes:', changes); // Debug Log

                        // Handle SETTINGS changes (theming)
                        if (changes.settings) {
                            dispatch({ type: 'UPDATE_SETTINGS', payload: changes.settings });
                            addMessage({
                                id: (Date.now() + 2).toString(),
                                role: 'assistant',
                                content: '✨ Theme applied!',
                                timestamp: new Date()
                            });
                        }
                        // Handle SUGGESTIONS (node breakdown)
                        else if (changes.suggestions) {
                            const { nodeId, breakdown, insight } = changes.suggestions;
                            // For now, just show the insight. Later we can auto-apply breakdown.
                            const breakdownText = breakdown?.map((b: { name: string; value: number }) =>
                                `  • ${b.name}: ${b.value}`
                            ).join('\n') || '';

                            addMessage({
                                id: (Date.now() + 2).toString(),
                                role: 'assistant',
                                content: `💡 **Suggestion for ${nodeId}:**\n${insight}\n\nProposed breakdown:\n${breakdownText}`,
                                timestamp: new Date(),
                                actions: [{
                                    label: 'Apply Breakdown',
                                    type: 'primary',
                                    onClick: async () => {
                                        const { applyBreakdown } = await import('@/lib/ai-utils');
                                        const result = applyBreakdown(state, changes.suggestions);
                                        dispatch({ type: 'SET_DATA', payload: result.data });
                                        addMessage({
                                            id: Date.now().toString(),
                                            role: 'assistant',
                                            content: '✅ Breakdown applied!',
                                            timestamp: new Date()
                                        });
                                    }
                                }]
                            });
                        }
                        // Handle DATA changes (nodes/flows)
                        else if (changes.nodes || changes.flows) {
                            const { applyAIChanges } = await import('@/lib/ai-utils');
                            const result = applyAIChanges(state, changes);
                            console.log('AI Application Result:', result); // Debug Log

                            if (result.success && result.newState) {
                                dispatch({ type: 'SET_DATA', payload: result.newState.data });
                                addMessage({
                                    id: (Date.now() + 2).toString(),
                                    role: 'assistant',
                                    content: '✅ Changes applied successfully!',
                                    timestamp: new Date()
                                });
                            } else {
                                const errorMsg = result.errors?.join('\n') || 'Failed to apply changes';
                                addMessage({
                                    id: (Date.now() + 2).toString(),
                                    role: 'assistant',
                                    content: `⚠️ Could not apply changes:\n${errorMsg}`,
                                    timestamp: new Date()
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse/apply AI changes', e);
                    }
                }
            } else {
                addMessage({
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response.error || 'Sorry, I encountered an error processing your request.',
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('AI Service Error:', error);
            addMessage({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, something went wrong.',
                timestamp: new Date()
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf';

        if (!isImage && !isPDF) {
            alert('Please upload an image (PNG, JPG) or PDF file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target?.result as string;
            setPendingFiles(prev => [...prev, {
                type: file.type,
                data: base64Data,
                name: file.name
            }]);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64Data = e.target?.result as string;
                        setPendingFiles(prev => [...prev, {
                            type: file.type,
                            data: base64Data,
                            name: "Pasted Image"
                        }]);
                    };
                    reader.readAsDataURL(file);
                }
                break;
            }
        }
    }, []);

    const SUGGESTED_QUESTIONS = [
        "Analyze the flow balance",
        "Make the diagram look professional",
        "Explain the cost structure",
        "Highlight the largest expenses"
    ];

    // V9: Demo samples that work without API key
    const DEMO_SAMPLES = [
        {
            name: "💰 Company Budget",
            data: [
                { source: "Revenue", target: "Operating Costs", value: 300 },
                { source: "Revenue", target: "Marketing", value: 200 },
                { source: "Revenue", target: "R&D", value: 150 },
                { source: "Revenue", target: "Net Profit", value: 350 },
                { source: "Operating Costs", target: "Salaries", value: 180 },
                { source: "Operating Costs", target: "Rent", value: 80 },
                { source: "Operating Costs", target: "Utilities", value: 40 },
            ]
        },
        {
            name: "⚡ Energy Flow",
            data: [
                { source: "Solar", target: "Grid", value: 400 },
                { source: "Wind", target: "Grid", value: 300 },
                { source: "Coal", target: "Grid", value: 200 },
                { source: "Grid", target: "Residential", value: 500 },
                { source: "Grid", target: "Commercial", value: 300 },
                { source: "Grid", target: "Industrial", value: 100 },
            ]
        },
        {
            name: "📊 Website Traffic",
            data: [
                { source: "Organic Search", target: "Homepage", value: 450 },
                { source: "Social Media", target: "Homepage", value: 200 },
                { source: "Direct", target: "Homepage", value: 150 },
                { source: "Homepage", target: "Products", value: 400 },
                { source: "Homepage", target: "About", value: 100 },
                { source: "Products", target: "Checkout", value: 250 },
                { source: "Products", target: "Exit", value: 150 },
            ]
        }
    ];

    // V9: Local parser for text input (works without API)
    const handleDemoParse = (text: string) => {
        const lines = text.trim().split('\n');
        const flows: Array<{ source: string; target: string; value: number }> = [];

        lines.forEach(line => {
            // Pattern: "Source VALUE to Target" or "Source to Target VALUE"
            const match1 = line.match(/^(.+?)\s+(\d+)\s+to\s+(.+)$/i);
            const match2 = line.match(/^(.+?)\s+to\s+(.+?)\s+(\d+)$/i);
            const match3 = line.match(/^(.+?)\s*[-→>]\s*(.+?)\s*:\s*(\d+)$/i);
            const match4 = line.match(/^(.+?)\s*,\s*(.+?)\s*,\s*(\d+)$/i); // CSV style

            if (match1) {
                flows.push({ source: match1[1].trim(), target: match1[3].trim(), value: parseInt(match1[2]) });
            } else if (match2) {
                flows.push({ source: match2[1].trim(), target: match2[2].trim(), value: parseInt(match2[3]) });
            } else if (match3) {
                flows.push({ source: match3[1].trim(), target: match3[2].trim(), value: parseInt(match3[3]) });
            } else if (match4) {
                flows.push({ source: match4[1].trim(), target: match4[2].trim(), value: parseInt(match4[3]) });
            }
        });

        return flows;
    };

    const handleApplyDemoSample = (sample: typeof DEMO_SAMPLES[0]) => {
        // Create nodes and links from sample data
        const nodeNames = new Set<string>();
        sample.data.forEach(flow => {
            nodeNames.add(flow.source);
            nodeNames.add(flow.target);
        });

        const nodes = Array.from(nodeNames).map((name, i) => ({
            id: `demo-${i}`,
            name: name,
        }));

        const links = sample.data.map((flow, i) => ({
            id: `demo-link-${i}`,
            source: nodes.find(n => n.name === flow.source)?.id || '',
            target: nodes.find(n => n.name === flow.target)?.id || '',
            value: flow.value,
        }));

        dispatch({ type: 'SET_DATA', payload: { nodes, links } });
        addMessage({
            id: Date.now().toString(),
            role: 'assistant',
            content: `✅ Loaded "${sample.name}" with ${nodes.length} nodes and ${links.length} flows!`,
            timestamp: new Date()
        });
    };

    // V9: Handle local parsing when no API key
    const handleLocalParse = () => {
        if (!input.trim()) return;

        const flows = handleDemoParse(input);
        if (flows.length > 0) {
            // Create nodes and links
            const nodeNames = new Set<string>();
            flows.forEach(flow => {
                nodeNames.add(flow.source);
                nodeNames.add(flow.target);
            });

            const nodes = Array.from(nodeNames).map((name, i) => ({
                id: `parsed-${i}`,
                name: name,
            }));

            const links = flows.map((flow, i) => ({
                id: `parsed-link-${i}`,
                source: nodes.find(n => n.name === flow.source)?.id || '',
                target: nodes.find(n => n.name === flow.target)?.id || '',
                value: flow.value,
            }));

            dispatch({ type: 'SET_DATA', payload: { nodes, links } });
            addMessage({
                id: Date.now().toString(),
                role: 'user',
                content: input,
                timestamp: new Date()
            });
            addMessage({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `✅ Parsed ${flows.length} flows from your text! No API needed.`,
                timestamp: new Date()
            });
            setInput('');
        } else {
            addMessage({
                id: Date.now().toString(),
                role: 'assistant',
                content: `⚠️ Couldn't parse that format. Try:\n• Revenue 1000 to Costs\n• Revenue → Costs: 1000\n• Source, Target, 1000`,
                timestamp: new Date()
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--panel-bg)]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card-bg)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--primary-text)]">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    AI Assistant
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={clearMessages}
                        className="p-1.5 text-[var(--secondary-text)] hover:text-red-500 rounded-md transition-colors"
                        title="Clear History"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className={`p-1.5 rounded-md transition-colors ${!isConfigured ? 'text-amber-500 bg-amber-50 animate-pulse' : 'text-[var(--secondary-text)] hover:text-[var(--primary-text)]'}`}
                        title="Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* API Key Warning */}
            {!isConfigured && (
                <div className="mx-4 mt-3 px-3 py-2 bg-amber-50  border border-amber-200  rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-700 ">
                            <span className="font-medium">API key required</span> for AI features.{' '}
                            <button
                                onClick={() => setShowSettings(true)}
                                className="text-amber-800  underline hover:no-underline"
                            >
                                Configure now →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* V9: Demo Samples (works without API) */}
            {!isConfigured && (
                <div className="mx-4 mt-3 px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs text-blue-700 font-medium mb-2">
                        🎮 Try Demo Samples (No API needed):
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {DEMO_SAMPLES.map((sample, i) => (
                            <button
                                key={i}
                                onClick={() => handleApplyDemoSample(sample)}
                                className="px-2 py-1 bg-white border border-blue-200 text-blue-600 text-xs rounded hover:bg-blue-50 transition-colors"
                            >
                                {sample.name}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-blue-600">
                        Or type: <code className="bg-blue-100 px-1 rounded">Revenue 1000 to Costs</code>
                    </p>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 opacity-80">
                        <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="w-6 h-6 text-purple-400" />
                        </div>
                        <h3 className="text-sm font-medium text-[var(--primary-text)] mb-2">How can I help?</h3>
                        <p className="text-xs text-[var(--secondary-text)] mb-6 max-w-[200px]">
                            Ask me to analyze data, change colors, or explain the flow.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(q)}
                                    className="px-3 py-1.5 bg-white border border-purple-100 text-purple-600 text-xs rounded-full hover:bg-purple-50 transition-colors shadow-sm"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-1 justify-end">
                                    {msg.attachments.map((att, i) => (
                                        <div key={i} className="relative group">
                                            {att.type.startsWith('image/') ? (
                                                <img
                                                    src={att.data}
                                                    alt="Attachment"
                                                    className="h-20 w-auto rounded-lg border border-gray-200 shadow-sm"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg border border-gray-200">
                                                    <FileText className="w-4 h-4 text-gray-500" />
                                                    <span className="text-xs text-gray-600 truncate max-w-[100px]">{att.name || 'File'}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div
                                className={`rounded-lg px-4 py-2 text-sm whitespace-pre-wrap w-full ${msg.role === 'user'
                                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                                    : 'bg-[var(--background)] text-[var(--primary-text)]'
                                    }`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                        <Sparkles className="w-3 h-3" />
                                        AI Assistant
                                    </div>
                                )}
                                {msg.content}
                                {msg.actions && (
                                    <div className="mt-3 flex gap-2">
                                        {msg.actions.map((action, i) => (
                                            <button
                                                key={i}
                                                onClick={action.onClick}
                                                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${action.type === 'primary'
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                                                    }`}
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--background)] rounded-lg px-4 py-3 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="border-t border-[var(--border)] p-4 bg-[var(--card-bg)]">
                {/* Pending Files Staging Area */}
                {pendingFiles.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto py-2">
                        {pendingFiles.map((file, index) => (
                            <div key={index} className="relative group shrink-0">
                                {file.type.startsWith('image/') ? (
                                    <img
                                        src={file.data}
                                        alt="Preview"
                                        className="h-16 w-auto rounded-md border border-gray-200"
                                    />
                                ) : (
                                    <div className="h-16 w-16 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200">
                                        <FileText className="w-6 h-6 text-gray-400" />
                                    </div>
                                )}
                                <button
                                    onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== index))}
                                    className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*,.pdf"
                        className="hidden"
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-[var(--secondary-text)] hover:text-[var(--primary-text)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
                        title="Upload image or PDF"
                    >
                        <ImageIcon className="w-5 h-5" />
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        onPaste={handlePaste}
                        placeholder={isConfigured ? "Ask me anything about your diagram..." : "Type data or configure API key..."}
                        className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-[var(--card-bg)] text-[var(--primary-text)]"
                        disabled={isProcessing}
                    />

                    <button
                        onClick={() => handleSend()} // Fix checking TS strictness
                        disabled={(!input.trim() && pendingFiles.length === 0) || isProcessing}
                        className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>

                <p className="mt-2 text-xs text-[var(--secondary-text)] text-center">
                    {isConfigured ? 'AI-powered • Type or paste data' : 'Paste images or type: Source [Amount] Target'}
                </p>
            </div>

            {/* Settings Modal */}
            <AISettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
}

