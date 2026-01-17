'use client';

import { useState, useEffect } from 'react';
import { Save, AlertCircle, Check, RotateCcw, Copy } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';

export default function JSONEditorTab() {
    const { state, dispatch, resetSession } = useDiagram();
    const [jsonContent, setJsonContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Sync with state when it changes (unless user is editing)
    useEffect(() => {
        // We only update if the user isn't actively working on it (naive check)
        // Actually, distinct from other editors, we probably want to load on mount
        // and provide a "Refresh" button, to avoid overwriting user's in-progress edits with external state changes.
        // For now, let's just load on mount and provide a refresh.
        setJsonContent(JSON.stringify(state, null, 2));
    }, []); // Only on mount

    const handleRefresh = () => {
        if (confirm('This will overwrite your current edits with the latest diagram state. Continue?')) {
            setJsonContent(JSON.stringify(state, null, 2));
            setError(null);
            setSuccess(false);
        }
    };

    const handleFormat = () => {
        try {
            const parsed = JSON.parse(jsonContent);
            setJsonContent(JSON.stringify(parsed, null, 2));
            setError(null);
        } catch (e) {
            setError('Invalid JSON: ' + (e as Error).message);
        }
    };

    const handleApply = () => {
        try {
            const parsed = JSON.parse(jsonContent);

            // Basic validation
            if (!parsed.data || !Array.isArray(parsed.data.nodes) || !Array.isArray(parsed.data.links)) {
                throw new Error('Invalid state structure: missing data.nodes or data.links');
            }

            dispatch({ type: 'LOAD_STATE', payload: parsed });
            setSuccess(true);
            setError(null);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            setError('Failed to apply: ' + (e as Error).message);
            setSuccess(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(jsonContent);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--card-bg)]">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border)] bg-[var(--hover-bg)]">
                <div className="text-sm font-medium text-[var(--primary-text)]">JSON State Editor</div>
                <div className="flex gap-1">
                    <button
                        onClick={handleRefresh}
                        className="p-1.5 text-[var(--secondary-text)] hover:text-[var(--primary-text)] hover:bg-[var(--hover-bg)] rounded"
                        title="Refresh from current Diagram"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleCopy}
                        className="p-1.5 text-[var(--secondary-text)] hover:text-[var(--primary-text)] hover:bg-[var(--hover-bg)] rounded"
                        title="Copy JSON"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 relative">
                <textarea
                    value={jsonContent}
                    onChange={(e) => {
                        setJsonContent(e.target.value);
                        setError(null);
                        setSuccess(false);
                    }}

                    className="w-full h-full p-4 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-secondary)] bg-[var(--card-bg)] text-[var(--primary-text)]"
                    spellCheck={false}
                />
            </div>

            {error && (
                <div className="p-3 bg-red-50  border-t border-red-200 ">
                    <div className="flex items-start gap-2 text-xs text-red-600 ">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {success && (
                <div className="p-2 bg-green-50  border-t border-green-200  text-center">
                    <div className="inline-flex items-center gap-2 text-xs text-green-700  font-medium">
                        <Check className="w-4 h-4" />
                        <span>Action successful</span>
                    </div>
                </div>
            )}

            <div className="p-4 border-t border-[var(--border)] bg-[var(--hover-bg)] flex gap-3">
                <button
                    onClick={handleFormat}
                    className="flex-1 px-4 py-2 text-sm font-medium text-[var(--primary-text)] bg-[var(--card-bg)] border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)]"
                >
                    Format
                </button>
                <button
                    onClick={handleApply}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-secondary)] rounded-md hover:opacity-90 flex items-center justify-center gap-2"
                >
                    <Save className="w-4 h-4" />
                    Apply Changes
                </button>
            </div>
        </div>
    );
}

