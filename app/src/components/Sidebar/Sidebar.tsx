'use client';

import { useState, useEffect } from 'react';
import { Database, Palette, Bot, Type, Layout, Settings, FileJson, Table, ChevronLeft, ChevronRight, Sparkles, FileSpreadsheet } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { useStudio } from '@/context/StudioContext';
import DataEditorTab from './DataEditorTab';
import AppearanceTab from './AppearanceTab';
import AIAssistantTab from './AIAssistantTab';
import CustomLabelsTab from './CustomLabelsTab';
import DataTemplatesTab from './DataTemplatesTab';
import JSONEditorTab from './JSONEditorTab';

type TabId = 'data' | 'templates' | 'appearance' | 'labels' | 'json' | 'ai';
type CategoryId = 'edit' | 'style';

const categories: { id: CategoryId; icon: React.ReactNode; label: string }[] = [
    { id: 'edit', icon: <Database className="w-5 h-5" />, label: 'Editor' },
    { id: 'style', icon: <Palette className="w-5 h-5" />, label: 'Style' },
];

const tabs: Record<CategoryId, { id: TabId; label: string; icon: React.ReactNode }[]> = {
    edit: [
        { id: 'data', label: 'Data', icon: <Table className="w-4 h-4" /> },
        { id: 'templates', label: 'Templates', icon: <FileSpreadsheet className="w-4 h-4" /> },
        { id: 'ai', label: 'AI Assistant', icon: <Bot className="w-4 h-4" /> },
        { id: 'json', label: 'JSON', icon: <FileJson className="w-4 h-4" /> },
    ],
    style: [
        { id: 'appearance', label: 'Appearance', icon: <Layout className="w-4 h-4" /> },
        { id: 'labels', label: 'Labels', icon: <Type className="w-4 h-4" /> },
    ]
};

export default function Sidebar() {
    const { state: diagramState } = useDiagram();
    const { state: studioState, dispatch } = useStudio();
    const { isSidebarCollapsed } = studioState;
    const [activeCategory, setActiveCategory] = useState<CategoryId>('edit');
    const [activeTab, setActiveTab] = useState<TabId>('data');

    // Auto-switch to Style -> Appearance when a node is selected
    useEffect(() => {
        if (diagramState.selectedNodeId) {
            setActiveCategory('style');
            setActiveTab('appearance');
            // Auto expand if collapsed
            if (isSidebarCollapsed) {
                dispatch({ type: 'TOGGLE_SIDEBAR' });
            }
        }
    }, [diagramState.selectedNodeId, isSidebarCollapsed, dispatch]);

    const currentTabs = tabs[activeCategory];

    return (
        <div className={`
            relative flex h-full border-l border-[var(--glass-border)] glass-panel z-20 
            transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'w-14' : 'w-[30%] min-w-[320px] max-w-[480px]'}
        `}>
            {/* Collapse Toggle Button */}
            <button
                onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
                className="absolute -left-3 top-6 z-30 w-6 h-6 rounded-full bg-white  border border-gray-200  shadow-md flex items-center justify-center hover:bg-gray-50  transition-colors"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isSidebarCollapsed ? <ChevronLeft className="w-3 h-3 text-gray-600" /> : <ChevronRight className="w-3 h-3 text-gray-600" />}
            </button>

            {/* Side Rail */}
            <div className="w-14 flex flex-col items-center py-4 gap-4 border-r border-[var(--border)] bg-[var(--card-bg)] shrink-0">
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
                            // Expand if collapsed
                            if (isSidebarCollapsed) {
                                dispatch({ type: 'TOGGLE_SIDEBAR' });
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
                
                {isSidebarCollapsed && (
                    <div className="mt-auto flex flex-col items-center gap-4 pb-4">
                        <button className="p-2 text-gray-400 hover:text-blue-500" onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}>
                            <Sparkles className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Main Panel */}
            {!isSidebarCollapsed && (
                <div className="flex-1 flex flex-col min-w-0 animate-in fade-in slide-in-from-right-1 duration-200">
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
                        {activeTab === 'templates' && <DataTemplatesTab />}
                        {activeTab === 'ai' && <AIAssistantTab />}
                        {activeTab === 'json' && <JSONEditorTab />}
                        {activeTab === 'appearance' && <AppearanceTab />}
                        {activeTab === 'labels' && <CustomLabelsTab />}
                    </div>
                </div>
            )}
        </div>
    );
}

