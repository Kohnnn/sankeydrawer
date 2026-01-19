'use client';

import { useDiagram } from '@/context/DiagramContext';
import { DATA_TEMPLATES } from '@/lib/data-templates';
import { FileSpreadsheet, ChevronRight, Zap } from 'lucide-react';

export default function DataTemplatesTab() {
    const { dispatch } = useDiagram();

    const loadTemplate = (id: string) => {
        const template = DATA_TEMPLATES.find(t => t.id === id);
        if (template && window.confirm(`Load "${template.name}"? This will overwrite your current data.`)) {
            dispatch({ type: 'SET_DATA', payload: template.data });
            // Switch to Data tab automatically? (handled by parent or user)
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex gap-3">
                <Zap className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                    Quickly bootstrap your diagram with these common financial structures.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {DATA_TEMPLATES.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => loadTemplate(template.id)}
                        className="group p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all text-left shadow-sm hover:shadow-md"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{template.name}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {template.description}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}
