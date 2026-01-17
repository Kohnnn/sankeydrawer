'use client';

import { useState, useEffect } from 'react';
import { Database, Palette, Bot, Type, Layout, Settings, FileJson, Table } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import DataEditorTab from './DataEditorTab';
import AppearanceTab from './AppearanceTab';
import AIAssistantTab from './AIAssistantTab';
import CustomLabelsTab from './CustomLabelsTab';

type TabId = 'data' | 'appearance' | 'labels' | 'json' | 'ai';
type CategoryId = 'edit' | 'style';

const categories: { id: CategoryId; icon: React.ReactNode; label: string }[] = [
    { id: 'edit', icon: <Database className="w-5 h-5" />, label: 'Editor' },
    { id: 'style', icon: <Palette className="w-5 h-5" />, label: 'Style' },
];

const tabs: Record<CategoryId, { id: TabId; label: string; icon: React.ReactNode }[]> = {
    edit: [
        { id: 'data', label: 'Data', icon: <Table className="w-4 h-4" /> },
        { id: 'ai', label: 'AI Assistant', icon: <Bot className="w-4 h-4" /> },
    ],
    style: [
        { id: 'appearance', label: 'Appearance', icon: <Layout className="w-4 h-4" /> },
        { id: 'labels', label: 'Labels', icon: <Type className="w-4 h-4" /> },
    ]
};

export default function Sidebar() {
    const { state } = useDiagram();
    const [activeCategory, setActiveCategory] = useState<CategoryId>('edit');
    const [activeTab, setActiveTab] = useState<TabId>('data');

    // Auto-switch to Style -> Appearance when a node is selected
    useEffect(() => {
        if (state.selectedNodeId) {
            setActiveCategory('style');
            setActiveTab('appearance');
        }
    }, [state.selectedNodeId]);

    const currentTabs = tabs[activeCategory];

    return (
        <div className="flex h-full border-l border-[var(--glass-border)] glass-panel w-[30%] min-w-[320px] max-w-[480px] z-20 animate-slide-up">
            {/* Side Rail */}
            <div className="w-14 flex flex-col items-center py-4 gap-4 border-r border-[var(--border)] bg-[var(--card-bg)]">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            setActiveCategory(cat.id);
                            // Default to first tab in category if current tab is not in it
                            const categoryTabs = tabs[cat.id].map(t => t.id);
                            if (!categoryTabs.includes(activeTab)) {
                                setActiveTab(tabs[cat.id][0].id);
                            }
                        }}
                        className={`p-2.5 rounded-lg transition-all ${activeCategory === cat.id
                            ? 'bg-blue-100 text-blue-600   shadow-sm'
                            : 'text-[var(--secondary-text)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary-text)]'
                            }`}
                        title={cat.label}
                    >
                        {cat.icon}
                    </button>
                ))}
            </div>

            {/* Main Panel */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Secondary Tab Bar */}
                <div className="flex items-center gap-1 p-2 border-b border-[var(--border)] bg-[var(--card-bg)] overflow-x-auto">
                    {currentTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-[var(--hover-bg)] text-[var(--primary-text)] shadow-sm border border-[var(--border)]'
                                : 'text-[var(--secondary-text)] hover:text-[var(--primary-text)]'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'data' && <DataEditorTab />}
                    {activeTab === 'ai' && <AIAssistantTab />}
                    {activeTab === 'appearance' && <AppearanceTab />}
                    {activeTab === 'labels' && <CustomLabelsTab />}
                </div>
            </div>
        </div>
    );
}

