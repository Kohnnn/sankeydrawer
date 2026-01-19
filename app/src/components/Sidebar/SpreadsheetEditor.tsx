'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy, AlertCircle } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { parseDSL, parseNumber } from '@/lib/dsl-parser';
import { SankeyLink } from '@/types/sankey';

interface GridRow {
    source: string;
    target: string;
    value: string; // Keep as string for editing
    comparison: string;
    isValid: boolean;
    error?: string;
}

export default function SpreadsheetEditor() {
    const { state, dispatch } = useDiagram();
    const [rows, setRows] = useState<GridRow[]>([]);
    const [focusedCell, setFocusedCell] = useState<{ row: number; col: 'source' | 'target' | 'value' } | null>(null);

    // specific helper to update data ONLY when blurred or Enter pressed to avoid excessive re-renders
    const commitChanges = useCallback((currentRows: GridRow[]) => {
        // Filter out empty rows: Source and Target must be present, and Value must be non-empty (0 is allowed if meaningful, but typically links have value > 0)
        // Also ensure we don't save the trailing empty row unless it has partial data
        const validRows = currentRows.filter(r =>
            r.source.trim() !== '' &&
            r.target.trim() !== '' &&
            r.value.trim() !== ''
        );

        const lines = validRows.map(row => {
            const val = row.value;
            const comp = row.comparison.trim();
            // Format: Source [Value] Target or Source [Value, Comparison] Target
            if (comp) {
                return `${row.source} [${val}, ${comp}] ${row.target}`;
            }
            return `${row.source} [${val}] ${row.target}`;
        });

        // Join
        const dslText = lines.join('\n');

        // Dispatch DSL update (this triggers parsing and validation globally)
        dispatch({ type: 'SET_DSL', payload: dslText });
    }, [dispatch]);

    // Auto-sync rows to canvas with a small debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            // Only sync if rows actually changed from outside or internal edit
            // commitChanges has its own internal filter for valid rows
            commitChanges(rows);
        }, 300);
        return () => clearTimeout(timer);
    }, [rows, commitChanges]);

    const handleValueBlur = (index: number, rawValue: string) => {
        // Auto-format value on blur if valid number
        const num = parseNumber(rawValue);
        if (!isNaN(num) && num > 0) {
            // Check if user originally typed currency symbol or just apply standard format?
            // Let's stick to standard number format with regex check for existing currency?
            // For now, simple reliable logic: k/m/b -> expanded, add commas.
            // If user explicitly typed "$", we could keep it, but dsl-parser strips it anyway.
            // Let's format nicely with toLocaleString()
            // BUT: If config 'valuePrefix' is '$', maybe we should add it? 
            // Accessing settings here might be overkill.
            // Let's just do nice number format "1,200"
            const formatted = num.toLocaleString('en-US', { maximumFractionDigits: 2 });
            handleCellChange(index, 'value', formatted); // Update state
            // The commitChanges call happens in the generic handleBlur which we should call too or instead?
            // Actually handleBlur calls commit(rows). But we just updated rows (async).
            // So we need to call commit with the NEW rows.

            const updatedRows = [...rows];
            updatedRows[index] = { ...updatedRows[index], value: formatted };
            commitChanges(updatedRows);
        } else {
            // Just commit as is
            commitChanges(rows);
        }
    };



    // Initialize rows from diagram data
    useEffect(() => {
        const newRows = state.data.links.map(link => {
            const getNodeName = (ref: string | number | any) => {
                if (typeof ref === 'object' && ref !== null) {
                    return ref.name || ref.id || '';
                }
                if (typeof ref === 'string') {
                    return state.data.nodes.find(n => n.id === ref)?.name || ref;
                }
                return state.data.nodes[ref]?.name || '';
            };

            // Prefer previousValue (raw number) for editing, fall back to comparisonValue (string)
            let compVal = '';
            if (link.previousValue !== undefined) {
                compVal = link.previousValue.toString();
            } else if (link.comparisonValue) {
                compVal = link.comparisonValue.toString();
            }

            return {
                source: getNodeName(link.source),
                target: getNodeName(link.target),
                value: link.value.toString(),
                comparison: compVal,
                isValid: true
            };
        });

        // Add one empty row at the end if none exists or last one is filled
        if (newRows.length === 0 || (newRows[newRows.length - 1].source && newRows[newRows.length - 1].target)) {
            newRows.push({ source: '', target: '', value: '', comparison: '', isValid: true });
        }

        setRows(newRows);
    }, [state.data.links, state.data.nodes]);

    // specific helper to update data ONLY when blurred or Enter pressed to avoid excessive re-renders
    const commitChanges = useCallback((currentRows: GridRow[]) => {
        // Filter out empty rows: Source and Target must be present, and Value must be non-empty (0 is allowed if meaningful, but typically links have value > 0)
        // Also ensure we don't save the trailing empty row unless it has partial data
        const validRows = currentRows.filter(r =>
            r.source.trim() !== '' &&
            r.target.trim() !== '' &&
            r.value.trim() !== ''
        );

        const lines = validRows.map(row => {
            const val = row.value;
            const comp = row.comparison.trim();
            // Format: Source [Value] Target or Source [Value, Comparison] Target
            if (comp) {
                return `${row.source} [${val}, ${comp}] ${row.target}`;
            }
            return `${row.source} [${val}] ${row.target}`;
        });

        // Join
        const dslText = lines.join('\n');

        // Dispatch DSL update (this triggers parsing and validation globally)
        dispatch({ type: 'SET_DSL', payload: dslText });
    }, [dispatch]);

    const handleCellChange = (index: number, field: keyof GridRow, value: string) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };

        // Basic validation visual
        if (field === 'source' && value === newRows[index].target) {
            newRows[index].error = 'Self-loop';
            newRows[index].isValid = false;
        } else {
            newRows[index].error = undefined;
            newRows[index].isValid = true;
        }

        setRows(newRows);

        // If editing the last empty row, add another one
        if (index === rows.length - 1 && value.trim()) {
            setRows(prev => [...prev, { source: '', target: '', value: '', comparison: '', isValid: true }]);
        }
    };

    const handleBlur = () => {
        commitChanges(rows);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Commit immediately
            commitChanges(rows);
            // Move focus to next row same column?
            // For now just blur
            (e.target as HTMLInputElement).blur();
        }
    };

    const handleDeleteRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        commitChanges(newRows);
    };

    const handleAddRow = () => {
        setRows(prev => [...prev, { source: '', target: '', value: '', comparison: '', isValid: true }]);
        // Scroll to bottom?
        setTimeout(() => {
            if (rowRefs.current[rows.length]) {
                rowRefs.current[rows.length]?.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const clipboardData = e.clipboardData.getData('text');
        if (!clipboardData) return;

        e.preventDefault();

        // Parse clipboard data (tab-separated or comma-separated)
        const lines = clipboardData.split(/\r\n|\n|\r/);
        const newRows = [...rows];

        // Remove empty last row if it exists before appending
        if (newRows.length > 0 && !newRows[newRows.length - 1].source && !newRows[newRows.length - 1].target) {
            newRows.pop();
        }

        let addedCount = 0;

        lines.forEach(line => {
            if (!line.trim()) return;

            // Try splitting by tab first, then comma
            let parts = line.split('\t');
            if (parts.length < 2) {
                parts = line.split(',');
            }

            if (parts.length >= 2) {
                const source = parts[0]?.trim() || '';
                // If 3 parts: source, target, value. If 2 parts: assume source, value, target? Or source, target... wait.
                // Standard sankey format often: Source, Target, Value. 
                // Or Source, Value, Target (SDL).

                // Let's guess based on content.
                // If part[1] is numeric, it's likely Source, Value, Target (if 3) or Source, Value (incomplete?)

                let target = '';
                let value = '';

                if (parts.length >= 3) {
                    // Check if middle is number
                    if (!isNaN(parseFloat(parts[1]))) {
                        value = parts[1];
                        target = parts[2];
                    } else {
                        // Maybe Source, Target, Value
                        target = parts[1];
                        value = parts[2];
                    }
                } else if (parts.length === 2) {
                    // Ambiguous. source, value? or source, target?
                    // Usually pasting flow data implies value.
                    // Assume Source, Target and default value? Or Source, Value?
                    // Let's look for numbers.
                    if (!isNaN(parseFloat(parts[1]))) {
                        // Source, Value - missing target
                        value = parts[1];
                    } else {
                        target = parts[1];
                        value = "1"; // Default?
                    }
                }

                newRows.push({
                    source,
                    target: target.trim(),
                    value: value.trim().replace(/[^0-9.]/g, ''),
                    comparison: '',
                    isValid: true
                });
                addedCount++;
            }
        });

        // Always ensure one empty row at end
        newRows.push({ source: '', target: '', value: '', comparison: '', isValid: true });

        setRows(newRows);
        commitChanges(newRows);
    }, [rows, commitChanges]);

    const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Sync selection from Canvas to Grid
    useEffect(() => {
        if (state.selectedLinkIndex !== null && rowRefs.current[state.selectedLinkIndex]) {
            rowRefs.current[state.selectedLinkIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [state.selectedLinkIndex]);

    const handleFocus = (index: number) => {
        if (state.selectedLinkIndex !== index) {
            dispatch({ type: 'SELECT_LINK', payload: index });
        }
    };

    // Resolve selected node name for highlighting
    const selectedNodeName = state.selectedNodeId
        ? state.data.nodes.find(n => n.id === state.selectedNodeId)?.name
        : null;

    return (
        <div className="flex flex-col h-full bg-white  font-sans">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_100px_100px_40px] gap-0 border-b border-gray-200  bg-white  sticky top-0 z-10">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 ">From</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 ">To</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 ">Amount</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Previous / Comp</div>
                <div className="px-2 py-3"></div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
                {rows.map((row, i) => {
                    // Check if row is related to selected node
                    const isRelatedToNode = selectedNodeName && (row.source === selectedNodeName || row.target === selectedNodeName);

                    return (
                        <div
                            key={i}
                            ref={el => { rowRefs.current[i] = el; }}
                            className={`grid grid-cols-[1fr_1fr_100px_100px_40px] gap-0 border-b border-gray-100  items-center group
                            ${state.selectedLinkIndex === i ? 'bg-blue-50 ' : ''}
                            ${!state.selectedLinkIndex && isRelatedToNode ? 'bg-blue-50/30 ' : ''} 
                            ${row.error ? 'bg-red-50/50 ' : ((state.selectedLinkIndex !== i && !isRelatedToNode) ? 'hover:bg-gray-50 :bg-slate-800/50' : '')}`}
                            onClick={() => handleFocus(i)}
                        >
                            {/* Source */}
                            <div className="relative h-full border-r border-gray-100 ">
                                <input
                                    type="text"
                                    value={row.source}
                                    onChange={(e) => handleCellChange(i, 'source', e.target.value)}
                                    onFocus={() => handleFocus(i)}
                                    onBlur={handleBlur}
                                    onKeyDown={(e) => handleKeyDown(e, i, 'source')}
                                    placeholder="Source Node"
                                    className="w-full h-full px-4 py-3 text-sm text-gray-900  bg-transparent outline-none focus:bg-blue-50/20"
                                />
                            </div>

                            {/* Target */}
                            <div className="relative h-full border-r border-gray-100 ">
                                <input
                                    type="text"
                                    value={row.target}
                                    onChange={(e) => handleCellChange(i, 'target', e.target.value)}
                                    onFocus={() => handleFocus(i)}
                                    onBlur={handleBlur}
                                    onKeyDown={(e) => handleKeyDown(e, i, 'target')}
                                    placeholder="Target Node"
                                    className="w-full h-full px-4 py-3 text-sm text-gray-900  bg-transparent outline-none focus:bg-blue-50/20"
                                />
                            </div>

                            {/* Value */}
                            <div className="relative h-full border-r border-gray-100 ">
                                <input
                                    type="text"
                                    value={row.value}
                                    onChange={(e) => handleCellChange(i, 'value', e.target.value)}
                                    onFocus={() => handleFocus(i)}
                                    onBlur={(e) => handleValueBlur(i, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, i, 'value')}
                                    placeholder="0 or 1k"
                                    className="w-full h-full px-4 py-3 text-sm text-gray-900  bg-transparent outline-none focus:bg-blue-50/20"
                                />
                            </div>

                            {/* Comparison (New Column) */}
                            <div className="relative h-full">
                                <input
                                    type="text"
                                    value={row.comparison}
                                    onChange={(e) => handleCellChange(i, 'comparison', e.target.value)}
                                    onFocus={() => handleFocus(i)}
                                    onBlur={handleBlur}
                                    onKeyDown={(e) => handleKeyDown(e, i, 'comparison')}
                                    placeholder="Value OR %"
                                    className="w-full h-full px-4 py-3 text-sm text-green-600  font-medium bg-transparent outline-none focus:bg-blue-50/20 placeholder-gray-300"
                                />
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={() => handleDeleteRow(i)}
                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                    tabIndex={-1}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-3 border-t border-gray-200  bg-gray-50  text-xs text-gray-500 font-medium flex justify-between">
                <span>{rows.filter(r => r.isValid && r.source).length} Flows</span>
                <span>Press Enter to save • Paste Excel data directly</span>
            </div>
        </div>
    );
}

