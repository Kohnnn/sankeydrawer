'use client';

import { useState, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, FileJson, Copy, Table, FileText } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { parseDSL, parseCSV } from '@/lib/dsl-parser';
import { exportDataAsJson, importDataFromJson } from '@/lib/gemini-api';
import SpreadsheetEditor from './SpreadsheetEditor';

type EditorMode = 'grid' | 'dsl';

export default function DataEditorTab() {
    const { state, dispatch } = useDiagram();
    const [mode, setMode] = useState<EditorMode>('grid');
    const [dslError, setDslError] = useState<string | null>(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const jsonInputRef = useRef<HTMLInputElement>(null);

    const handleDSLChange = useCallback((text: string) => {
        dispatch({ type: 'SET_DSL', payload: text });
        const parsed = parseDSL(text);
        if (!parsed && text.trim()) {
            setDslError('Invalid DSL format. Use: Source [Amount] Target');
        } else {
            setDslError(null);
        }
    }, [dispatch]);

    const handleExportJSON = useCallback(() => {
        const jsonContent = exportDataAsJson(state.data);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `sankey-data-${Date.now()}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, [state.data]);

    const handleImportJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const parsed = importDataFromJson(text);
            if (parsed) {
                dispatch({ type: 'SET_DATA', payload: parsed });
                setDslError(null);
            } else {
                setDslError('Could not parse JSON file. Expected {nodes: [], links: []} structure.');
            }
        };
        reader.readAsText(file);

        if (jsonInputRef.current) {
            jsonInputRef.current.value = '';
        }
    }, [dispatch]);

    return (
        <div className="flex flex-col h-full bg-[var(--panel-bg)]">
            {/* Toolbar / Mode Switcher */}
            <div className="flex items-center gap-1 p-2 border-b border-[var(--border)] bg-[var(--card-bg)]">
                <button
                    onClick={() => setMode('grid')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'grid'
                        ? 'bg-blue-100  text-blue-700 '
                        : 'text-[var(--secondary-text)] hover:bg-[var(--hover-bg)]'
                        }`}
                >
                    <Table className="w-4 h-4" />
                    Grid
                </button>
                <button
                    onClick={() => setMode('dsl')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'dsl'
                        ? 'bg-blue-100  text-blue-700 '
                        : 'text-[var(--secondary-text)] hover:bg-[var(--hover-bg)]'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    Text
                </button>

                <div className="mx-auto" />

                <input
                    type="file"
                    ref={jsonInputRef}
                    onChange={handleImportJSON}
                    accept=".json"
                    className="hidden"
                />
                <button
                    onClick={() => jsonInputRef.current?.click()}
                    className="p-1.5 text-[var(--secondary-text)] hover:text-[var(--primary-text)] hover:bg-[var(--hover-bg)] rounded-md"
                    title="Import JSON"
                >
                    <FileJson className="w-4 h-4" />
                </button>
                <button
                    onClick={handleExportJSON}
                    className="p-1.5 text-[var(--secondary-text)] hover:text-[var(--primary-text)] hover:bg-[var(--hover-bg)] rounded-md"
                    title="Export JSON"
                >
                    <FileJson className="w-4 h-4" />
                </button>

                {/* Templates Dropdown */}
                <div className="relative ml-2">
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--secondary-text)] hover:text-[var(--primary-text)]"
                    >
                        Templates <ChevronDown className="w-3 h-3" />
                    </button>

                    {showTemplates && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowTemplates(false)} />
                            <div className="absolute right-0 top-full mt-1 w-64 bg-white  border border-gray-200  rounded-md shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Financial
                                </div>
                                <button
                                    onClick={() => {
                                        handleDSLChange(`// SaaS Logic
Total Revenue : #1d4ed8
Cost of Goods : #0ea5e9
Gross Profit : #1f7ae0
Sales & Marketing : #3b82f6
R&D : #22c55e
G&A : #64748b
Operating Income : #0d9488
Taxes : #f97316
Net Income : #0891b2

Total Revenue [1000] Cost of Goods
Total Revenue [4000] Gross Profit
Gross Profit [1500] Sales & Marketing
Gross Profit [1200] R&D
Gross Profit [500] G&A
Gross Profit [800] Operating Income
Operating Income [200] Taxes
Operating Income [600] Net Income`);
                                        setShowTemplates(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 :bg-slate-700 text-[var(--primary-text)]"
                                >
                                    SaaS P&L Statement
                                </button>
                                <button
                                    onClick={() => {
                                        handleDSLChange(`// Personal Finance
Income : #0ea5e9
Needs : #f97316
Wants : #a855f7
Savings : #22c55e

Salary [5200] Income
Freelance [800, 1200] Income
Income [3000] Needs
Income [1500] Wants
Income [1500] Savings
Needs [1500] Rent
Needs [400] Utilities
Needs [600] Groceries
Needs [500] Transport
Wants [400] Dining Out
Wants [600] Travel
Wants [500, 300] Hobbies
Savings [1000] ETF Portfolio
Savings [500] Emergency Fund`);
                                        setShowTemplates(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 :bg-slate-700 text-[var(--primary-text)]"
                                >
                                    Personal Monthly Budget
                                </button>

                                <div className="px-3 py-2 mt-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-gray-100 ">
                                    Business
                                </div>
                                <button
                                    onClick={() => {
                                        handleDSLChange(`// Startup Burn
Seed Round : #8b5cf6
Revenue : #22c55e
Cash Pool : #3b82f6

Pre-Seed [500] Cash Pool
Seed Range [2000] Cash Pool
Revenue [250] Cash Pool
Cash Pool [1200] Payroll
Cash Pool [400] Server Costs
Cash Pool [600] Marketing Ads
Cash Pool [300] Office
Cash Pool [250] Remaining Runway
Payroll [800] Engineering
Payroll [300] Sales
Payroll [100] Admin`);
                                        setShowTemplates(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 :bg-slate-700 text-[var(--primary-text)]"
                                >
                                    Startup Cash Burn
                                </button>
                                <button
                                    onClick={() => {
                                        handleDSLChange(`// Recruitment Funnel
Applications : #64748b
Screening : #3b82f6
Interview : #8b5cf6
Offer : #f43f5e
Hired : #10b981

Applications [1500] Screening
Screening [1100] Rejected
Screening [400] Interview
Interview [320] Rejected (Tech)
Interview [80] Offer
Offer [20] Declined
Offer [60] Hired`);
                                        setShowTemplates(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 :bg-slate-700 text-[var(--primary-text)]"
                                >
                                    Recruitment Funnel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-hidden relative">
                {mode === 'grid' ? (
                    <SpreadsheetEditor />
                ) : (
                    <div className="absolute inset-0 p-4 flex flex-col">
                        <textarea
                            value={state.dslText}
                            onChange={(e) => handleDSLChange(e.target.value)}
                            placeholder="Revenue [1000] Cost of Goods&#10;Revenue [500] Gross Profit"
                            className={`flex-1 w-full p-4 font-mono text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-[var(--card-bg)] text-[var(--primary-text)] ${dslError
                                ? 'border-red-300 focus:border-red-500'
                                : 'border-[var(--border)] focus:border-blue-500'
                                }`}
                        />
                        {dslError && (
                            <div className="mt-2 p-2 rounded bg-red-50  text-red-600  text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {dslError}
                            </div>
                        )}
                        <p className="mt-2 text-xs text-[var(--secondary-text)]">
                            Format: Source [Amount] Target
                        </p>
                    </div>
                )}
            </div>

            {/* Footer with Balance Status */}
            <div className="border-t border-[var(--border)] bg-[var(--card-bg)] p-2">
                <BalanceIndicator />
            </div>
        </div>
    );
}

function BalanceIndicator() {
    const { state } = useDiagram();
    const { nodes, links } = state.data;

    const nodeBalances = new Map<string, { in: number; out: number }>();

    for (const node of nodes) {
        nodeBalances.set(node.id, { in: 0, out: 0 });
    }

    for (const link of links) {
        // Handle both string IDs and numeric indices for robustness
        const sourceId = typeof link.source === 'string' ? link.source : nodes[link.source as number]?.id;
        const targetId = typeof link.target === 'string' ? link.target : nodes[link.target as number]?.id;

        if (sourceId) {
            const balance = nodeBalances.get(sourceId);
            if (balance) balance.out += link.value;
        }
        if (targetId) {
            const balance = nodeBalances.get(targetId);
            if (balance) balance.in += link.value;
        }
    }

    const imbalanced: { name: string; diff: number }[] = [];
    for (const [id, balance] of nodeBalances) {
        // Only check interior nodes (has both in and out)
        if (balance.in > 0 && balance.out > 0) {
            const diff = balance.in - balance.out;
            if (Math.abs(diff) > 0.1) {
                const node = nodes.find((n) => n.id === id);
                if (node) imbalanced.push({ name: node.name, diff });
            }
        }
    }

    if (imbalanced.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-600 ">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Flows are balanced
            </div>
        );
    }

    return (
        <div className="px-3 py-2 bg-amber-50  rounded border border-amber-100 ">
            <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span className="text-xs font-medium text-amber-700 ">Imbalanced Flows</span>
            </div>
            <ul className="text-[10px] text-amber-600  space-y-0.5 max-h-20 overflow-y-auto">
                {imbalanced.map((item, i) => (
                    <li key={i} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="font-mono">{item.diff > 0 ? '+' : ''}{item.diff.toFixed(0)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

