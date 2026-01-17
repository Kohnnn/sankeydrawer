'use client';

import { useState, useCallback } from 'react';
import { X, Eye, EyeOff, RotateCcw, Loader2, CheckCircle, XCircle, Settings2 } from 'lucide-react';
import { useAISettings } from '@/context/AISettingsContext';
import { DEFAULT_AI_PROMPT, GEMINI_MODELS } from '@/types/sankey';
import { testApiConnection } from '@/lib/gemini-api';

interface AISettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AISettingsPanel({ isOpen, onClose }: AISettingsPanelProps) {
    const { settings, updateApiKey, updateModel, updateCustomPrompt, updateBaseUrl, resetPrompt, resetAll, isConfigured } = useAISettings();
    const [showApiKey, setShowApiKey] = useState(false);
    const [localApiKey, setLocalApiKey] = useState(settings.apiKey);
    const [localBaseUrl, setLocalBaseUrl] = useState(settings.baseUrl || '');
    const [localModel, setLocalModel] = useState(settings.model);
    const [localPrompt, setLocalPrompt] = useState(settings.customPrompt);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    const handleTestConnection = useCallback(async () => {
        if (!localApiKey.trim()) {
            setTestStatus('error');
            setTestMessage('Please enter an API key first');
            return;
        }

        setTestStatus('testing');
        setTestMessage('');

        const result = await testApiConnection(localApiKey.trim(), localModel, localBaseUrl.trim());

        if (result.success) {
            setTestStatus('success');
            setTestMessage('Connection successful!');
        } else {
            setTestStatus('error');
            setTestMessage(result.error || 'Connection failed');
        }
    }, [localApiKey, localModel, localBaseUrl]);

    const handleSave = useCallback(() => {
        updateApiKey(localApiKey.trim());
        updateBaseUrl(localBaseUrl.trim());
        updateModel(localModel);
        updateCustomPrompt(localPrompt);
        onClose();
    }, [localApiKey, localBaseUrl, localModel, localPrompt, updateApiKey, updateBaseUrl, updateModel, updateCustomPrompt, onClose]);

    const handleResetPrompt = useCallback(() => {
        setLocalPrompt(DEFAULT_AI_PROMPT);
        resetPrompt();
    }, [resetPrompt]);

    const handleResetAll = useCallback(() => {
        setLocalApiKey('');
        setLocalBaseUrl('');
        setLocalModel('gemini-2.0-flash');
        setLocalPrompt(DEFAULT_AI_PROMPT);
        resetAll();
        setTestStatus('idle');
        setTestMessage('');
    }, [resetAll]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                            <Settings2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">AI Settings</h2>
                            <p className="text-xs text-gray-500">Configure your Gemini AI connection</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* API Key */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={localApiKey}
                                onChange={(e) => {
                                    setLocalApiKey(e.target.value);
                                    setTestStatus('idle');
                                }}
                                placeholder="Enter your Gemini API key..."
                                className="w-full px-4 py-2.5 pr-20 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                                    title={showApiKey ? 'Hide' : 'Show'}
                                >
                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Get your API key from{' '}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                Google AI Studio
                            </a>
                        </p>
                    </div>

                    {/* Base URL (Optional) */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Base URL (Optional)
                        </label>
                        <input
                            type="text"
                            value={localBaseUrl}
                            onChange={(e) => {
                                setLocalBaseUrl(e.target.value);
                                setTestStatus('idle');
                            }}
                            placeholder="https://generativelanguage.googleapis.com"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        />
                        <p className="text-xs text-gray-500">
                            Custom API endpoint for proxies or enterprise gateways. Leave empty for default.
                        </p>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Model
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={localModel}
                                onChange={(e) => {
                                    setLocalModel(e.target.value);
                                    setTestStatus('idle');
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                                {GEMINI_MODELS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                                {!GEMINI_MODELS.find(m => m.value === localModel) && (
                                    <option value={localModel}>{localModel}</option>
                                )}
                                <option value="custom">Custom...</option>
                            </select>
                        </div>
                        {localModel === 'custom' && (
                            <input
                                type="text"
                                value={localModel === 'custom' ? '' : localModel}
                                onChange={(e) => setLocalModel(e.target.value)}
                                placeholder="Enter model ID (e.g. gemini-2.0-flash)"
                                className="w-full mt-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                                autoFocus
                            />
                        )}
                        <p className="text-xs text-gray-500">
                            Select a model for AI generation. Newer models like Gemini 2.0 Flash are faster and better at formatting.
                        </p>
                    </div>

                    {/* Test Connection */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTestConnection}
                            disabled={testStatus === 'testing' || !localApiKey.trim()}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            {testStatus === 'testing' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                'Test Connection'
                            )}
                        </button>
                        {testStatus === 'success' && (
                            <div className="flex items-center gap-1.5 text-green-600 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                {testMessage}
                            </div>
                        )}
                        {testStatus === 'error' && (
                            <div className="flex items-center gap-1.5 text-red-600 text-sm">
                                <XCircle className="w-4 h-4" />
                                {testMessage}
                            </div>
                        )}
                    </div>

                    {/* Custom Prompt */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                                Custom System Prompt
                            </label>
                            <button
                                onClick={handleResetPrompt}
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Reset to Default
                            </button>
                        </div>
                        <textarea
                            value={localPrompt}
                            onChange={(e) => setLocalPrompt(e.target.value)}
                            rows={8}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            placeholder="Enter custom system prompt..."
                        />
                        <p className="text-xs text-gray-500">
                            This prompt guides how the AI responds to your requests.
                        </p>
                    </div>

                    {/* Status Indicator */}
                    <div className={`px-4 py-3 rounded-lg text-sm ${localApiKey.trim() ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {localApiKey.trim() ? (
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                API key detected (Save to enable AI features)
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Please add your API key to enable AI features
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleResetAll}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors"
                    >
                        Reset All
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
