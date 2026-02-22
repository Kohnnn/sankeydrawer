'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AISettings, defaultAISettings } from '@/types/sankey';

const STORAGE_KEY = 'sankey-ai-settings';

interface AISettingsContextType {
    settings: AISettings;
    updateSettings: (updates: Partial<AISettings>) => void;
    updateApiKey: (key: string) => void;
    updateModel: (model: string) => void;
    updateCustomPrompt: (prompt: string) => void;
    updateBaseUrl: (url: string) => void;
    resetPrompt: () => void;
    resetAll: () => void;
    isConfigured: boolean;
    // Chat History Persistence
    messages: Message[];
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    clearMessages: () => void;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: Attachment[];
    actions?: {
        label: string;
        onClick: () => void;
        type: 'primary' | 'secondary';
    }[];
}

export interface Attachment {
    type: string;
    data: string;
    name: string;
}

const AISettingsContext = createContext<AISettingsContextType | null>(null);

function loadInitialSettings(): AISettings {
    if (typeof window === 'undefined') {
        return defaultAISettings;
    }

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...defaultAISettings, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load AI settings:', e);
    }

    return defaultAISettings;
}

export function AISettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AISettings>(loadInitialSettings);
    const [messages, setMessagesState] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hi! I can help you create Sankey diagrams from financial data. Try:\n\n• Paste an image of a financial statement\n• Type data like "Revenue [1000] Expenses"\n• Ask me to modify colors or layout\n• Request changes to your current diagram',
            timestamp: new Date(),
        },
    ]);
    // Save to localStorage on change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save AI settings:', e);
        }
    }, [settings]);

    const updateSettings = useCallback((updates: Partial<AISettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    const updateApiKey = useCallback((key: string) => {
        setSettings(prev => ({ ...prev, apiKey: key }));
    }, []);

    const updateModel = useCallback((model: string) => {
        setSettings(prev => ({ ...prev, model }));
    }, []);

    const updateCustomPrompt = useCallback((prompt: string) => {
        setSettings(prev => ({ ...prev, customPrompt: prompt }));
    }, []);

    const updateBaseUrl = useCallback((url: string) => {
        setSettings(prev => ({ ...prev, baseUrl: url }));
    }, []);

    const resetPrompt = useCallback(() => {
        setSettings(prev => ({ ...prev, customPrompt: defaultAISettings.customPrompt }));
    }, []);

    const resetAll = useCallback(() => {
        setSettings(defaultAISettings);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const addMessage = useCallback((message: Message) => {
        setMessagesState(prev => [...prev, message]);
    }, []);

    const setMessages = useCallback((messages: Message[]) => {
        setMessagesState(messages);
    }, []);

    const clearMessages = useCallback(() => {
        setMessagesState([
            {
                id: '1',
                role: 'assistant',
                content: 'Hi! I can help you create Sankey diagrams from financial data. Try:\n\n• Paste an image of a financial statement\n• Type data like "Revenue [1000] Expenses"\n• Ask me to modify colors or layout\n• Request changes to your current diagram',
                timestamp: new Date(),
            },
        ]);
    }, []);

    const isConfigured = settings.apiKey.trim().length > 0;

    const value: AISettingsContextType = {
        settings,
        updateSettings,
        updateApiKey,
        updateModel,
        updateCustomPrompt,
        updateBaseUrl,
        resetPrompt,
        resetAll,
        isConfigured,
        messages,
        addMessage,
        setMessages,
        clearMessages
    };

    return <AISettingsContext.Provider value={value}>{children}</AISettingsContext.Provider>;
}

export function useAISettings() {
    const context = useContext(AISettingsContext);
    if (!context) {
        throw new Error('useAISettings must be used within an AISettingsProvider');
    }
    return context;
}
