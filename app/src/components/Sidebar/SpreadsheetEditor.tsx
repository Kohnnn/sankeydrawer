'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowUpDown, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { parseCSVLine, parseNumber, sanitizeComparisonLabel } from '@/lib/dsl-parser';

interface GridRow {
    source: string;
    target: string;
    value: string; // Keep as string for editing
    comparison: string;
    isValid: boolean;
    error?: string;
}

interface ParsedGridRow {
    source: string;
    target: string;
    value: string;
    comparison: string;
}

function buildLinkComparisonLookup(
    links: Array<{ source: string | number; target: string | number; previousValue?: number; comparisonValue?: string }>,
    nodes: Array<{ id: string; name: string }>,
): Map<string, string> {
    const resolveName = (ref: string | number | null | undefined) => {
        if (typeof ref === 'string') {
            return nodes.find((node) => node.id === ref)?.name || ref;
        }

        if (typeof ref === 'number') {
            return nodes[ref]?.name || '';
        }

        return '';
    };

    const map = new Map<string, string>();

    links.forEach((link) => {
        const sourceName = resolveName(link.source).trim();
        const targetName = resolveName(link.target).trim();
        if (!sourceName || !targetName) {
            return;
        }

        const key = `${sourceName}|${targetName}`;

        if (link.previousValue !== undefined && Number.isFinite(link.previousValue)) {
            map.set(key, String(link.previousValue));
            return;
        }

        const comparison = sanitizeComparisonLabel(link.comparisonValue || '');
        if (comparison) {
            map.set(key, comparison);
        }
    });

    return map;
}

function looksLikeHeader(columns: string[]): boolean {
    const normalized = columns.map((column) => column.trim().toLowerCase());
    const hasFrom = normalized.some((column) => /^(from|source|from node|source node)$/.test(column));
    const hasTo = normalized.some((column) => /^(to|target|to node|target node)$/.test(column));
    const hasAmount = normalized.some((column) => /(amount|value|current)/.test(column));

    return hasFrom && hasTo && hasAmount;
}

function detectColumns(header: string[]) {
    const normalized = header.map((column) => column.trim().toLowerCase());

    const sourceIndex = normalized.findIndex((column) => /^(from|source|from node|source node)$/.test(column));
    const targetIndex = normalized.findIndex((column) => /^(to|target|to node|target node)$/.test(column));
    const valueIndex = normalized.findIndex((column) => /(amount|value|current)/.test(column));
    const comparisonIndex = normalized.findIndex((column) => /(comparison|previous|prior)/.test(column));

    if (sourceIndex < 0 || targetIndex < 0 || valueIndex < 0) {
        return null;
    }

    return {
        sourceIndex,
        targetIndex,
        valueIndex,
        comparisonIndex: comparisonIndex >= 0 ? comparisonIndex : null,
    };
}

function parseTabularRows(input: string): ParsedGridRow[] {
    const lines = input
        .split(/\r\n|\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return [];
    }

    const hasTab = lines.some((line) => line.includes('\t'));
    const rows = lines.map((line) => {
        if (hasTab) {
            return line.split('\t').map((column) => column.trim());
        }

        return parseCSVLine(line).map((column) => column.trim());
    });

    let startIndex = 0;
    let columnMap: ReturnType<typeof detectColumns> | null = null;

    if (rows[0] && looksLikeHeader(rows[0])) {
        columnMap = detectColumns(rows[0]);
        startIndex = 1;
    }

    const parsedRows: ParsedGridRow[] = [];

    for (let i = startIndex; i < rows.length; i += 1) {
        const columns = rows[i];
        if (!columns || columns.length < 2) {
            continue;
        }

        let source = '';
        let target = '';
        let valueToken = '';
        let comparisonToken = '';

        if (columnMap) {
            source = columns[columnMap.sourceIndex] || '';
            target = columns[columnMap.targetIndex] || '';
            valueToken = columns[columnMap.valueIndex] || '';
            comparisonToken = columnMap.comparisonIndex !== null ? (columns[columnMap.comparisonIndex] || '') : '';
        } else {
            source = columns[0] || '';

            if (columns.length >= 3) {
                const secondLooksNumeric = !isNaN(parseNumber(columns[1] || ''));

                if (secondLooksNumeric) {
                    valueToken = columns[1] || '';
                    target = columns[2] || '';
                    comparisonToken = columns[3] || '';
                } else {
                    target = columns[1] || '';
                    valueToken = columns[2] || '';
                    comparisonToken = columns[3] || '';
                }
            }
        }

        const parsedValue = parseNumber(valueToken || '');
        if (!source.trim() || !target.trim() || isNaN(parsedValue) || parsedValue <= 0) {
            continue;
        }

        parsedRows.push({
            source: source.trim(),
            target: target.trim(),
            value: valueToken.trim(),
            comparison: sanitizeComparisonLabel(comparisonToken) || '',
        });
    }

    return parsedRows;
}

export default function SpreadsheetEditor() {
    const { state, dispatch } = useDiagram();
    const [rows, setRows] = useState<GridRow[]>([]);
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

    const formatValuePreview = useCallback((raw: string) => {
        const parsed = parseNumber(raw || '');
        if (isNaN(parsed) || parsed <= 0) {
            return '';
        }

        return parsed.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }, []);

    const formatComparisonPreview = useCallback((rawValue: string, rawComparison: string) => {
        const comparison = sanitizeComparisonLabel(rawComparison || '');
        if (!comparison) {
            return '';
        }

        if (/[%+-]/.test(comparison)) {
            return comparison;
        }

        const currentValue = parseNumber(rawValue || '');
        const previousValue = parseNumber(comparison);
        if (isNaN(currentValue) || currentValue <= 0 || isNaN(previousValue) || previousValue === 0) {
            return '';
        }

        const diff = currentValue - previousValue;
        const sign = diff >= 0 ? '+' : '';
        return `${sign}${((diff / previousValue) * 100).toFixed(1)}%`;
    }, []);

    // specific helper to update data ONLY when blurred or Enter pressed to avoid excessive re-renders
    const commitChanges = useCallback((currentRows: GridRow[]) => {
        const comparisonLookup = buildLinkComparisonLookup(state.data.links, state.data.nodes);

        let nextRows = [...currentRows];

        // Pass 1: use existing flow comparisons to auto-populate missing values.
        nextRows = nextRows.map((row) => {
            if (sanitizeComparisonLabel(row.comparison)) {
                return row;
            }

            const source = row.source.trim();
            const target = row.target.trim();
            if (!source || !target) {
                return row;
            }

            const key = `${source}|${target}`;
            const fallback = comparisonLookup.get(key);
            if (!fallback) {
                return row;
            }

            return {
                ...row,
                comparison: fallback,
            };
        });

        // Pass 2: propagate known comparison values between duplicated source->target rows.
        const rowLookup = new Map<string, string>();
        nextRows.forEach((row) => {
            const comparison = sanitizeComparisonLabel(row.comparison);
            if (!comparison) {
                return;
            }

            const source = row.source.trim();
            const target = row.target.trim();
            if (!source || !target) {
                return;
            }

            rowLookup.set(`${source}|${target}`, comparison);
        });

        nextRows = nextRows.map((row) => {
            if (sanitizeComparisonLabel(row.comparison)) {
                return row;
            }

            const source = row.source.trim();
            const target = row.target.trim();
            if (!source || !target) {
                return row;
            }

            const fallback = rowLookup.get(`${source}|${target}`);
            if (!fallback) {
                return row;
            }

            return {
                ...row,
                comparison: fallback,
            };
        });

        const didAutoPopulate = nextRows.some((row, index) => row.comparison !== currentRows[index]?.comparison);
        if (didAutoPopulate) {
            setRows(nextRows);
        }

        // Filter out empty rows: Source and Target must be present, and Value must be non-empty (0 is allowed if meaningful, but typically links have value > 0)
        // Also ensure we don't save the trailing empty row unless it has partial data
        const validRows = nextRows.filter(r =>
            r.source.trim() !== '' &&
            r.target.trim() !== '' &&
            r.value.trim() !== ''
        );

        const lines = validRows.map(row => {
            const val = row.value;
            const comp = sanitizeComparisonLabel(row.comparison);
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
    }, [dispatch, state.data.links, state.data.nodes]);

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
            const getNodeName = (ref: string | number | { id?: string; name?: string } | null | undefined) => {
                if (typeof ref === 'object' && ref !== null) {
                    return ref.name || ref.id || '';
                }
                if (typeof ref === 'string') {
                    return state.data.nodes.find(n => n.id === ref)?.name || ref;
                }
                if (typeof ref === 'number') {
                    return state.data.nodes[ref]?.name || '';
                }

                return '';
            };

            // Prefer previousValue (raw number) for editing, fall back to comparisonValue (string)
            let compVal = '';
            if (link.previousValue !== undefined) {
                compVal = link.previousValue.toString();
            } else if (link.comparisonValue) {
                compVal = sanitizeComparisonLabel(link.comparisonValue.toString()) || '';
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

        // If editing the trailing row, append a new blank row only once
        if (index === rows.length - 1 && value.trim()) {
            newRows.push({ source: '', target: '', value: '', comparison: '', isValid: true });
        }

        setRows(newRows);
    };

    const handleBlur = () => {
        commitChanges(rows);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
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

    const handleClearTable = () => {
        if (!window.confirm('Clear all flows from the table?')) {
            return;
        }

        const emptyRows: GridRow[] = [{ source: '', target: '', value: '', comparison: '', isValid: true }];
        setRows(emptyRows);
        dispatch({ type: 'SET_DATA', payload: { nodes: [], links: [] } });
        dispatch({ type: 'SET_DSL', payload: '' });
    };

    const handleAddRows = (count: number) => {
        if (!Number.isFinite(count) || count <= 0) {
            return;
        }

        const safeCount = Math.min(100, Math.max(1, Math.floor(count)));
        const emptyRows: GridRow[] = Array.from({ length: safeCount }, () => ({
            source: '',
            target: '',
            value: '',
            comparison: '',
            isValid: true,
        }));

        setRows((prev) => [...prev, ...emptyRows]);

        setTimeout(() => {
            const targetIndex = rows.length + safeCount - 1;
            if (rowRefs.current[targetIndex]) {
                rowRefs.current[targetIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    };

    const handleAddRowsPrompt = () => {
        const input = window.prompt('How many rows do you want to add?', '5');
        if (!input) {
            return;
        }

        const requested = Number(input);
        handleAddRows(requested);
    };

    const handleAutofillComparison = useCallback(() => {
        const lookup = buildLinkComparisonLookup(state.data.links, state.data.nodes);

        const nextRows = rows.map((row) => {
            if (sanitizeComparisonLabel(row.comparison)) {
                return row;
            }

            const source = row.source.trim();
            const target = row.target.trim();
            if (!source || !target) {
                return row;
            }

            const fallback = lookup.get(`${source}|${target}`);
            if (!fallback) {
                return row;
            }

            return {
                ...row,
                comparison: fallback,
            };
        });

        const changed = nextRows.some((row, index) => row.comparison !== rows[index]?.comparison);
        if (!changed) {
            return;
        }

        setRows(nextRows);
        commitChanges(nextRows);
    }, [commitChanges, rows, state.data.links, state.data.nodes]);

    const handleSortAlphabetical = useCallback(() => {
        const resolveNodeName = (ref: string | number) => {
            if (typeof ref === 'string') {
                return state.data.nodes.find((node) => node.id === ref)?.name || ref;
            }

            return state.data.nodes[ref]?.name || '';
        };

        const sortedNodes = [...state.data.nodes].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        );

        const sortedLinks = [...state.data.links].sort((a, b) => {
            const aSource = resolveNodeName(a.source as string | number);
            const bSource = resolveNodeName(b.source as string | number);
            const sourceCompare = aSource.localeCompare(bSource, undefined, { sensitivity: 'base' });
            if (sourceCompare !== 0) {
                return sourceCompare;
            }

            const aTarget = resolveNodeName(a.target as string | number);
            const bTarget = resolveNodeName(b.target as string | number);
            const targetCompare = aTarget.localeCompare(bTarget, undefined, { sensitivity: 'base' });
            if (targetCompare !== 0) {
                return targetCompare;
            }

            return Number(a.value || 0) - Number(b.value || 0);
        });

        dispatch({
            type: 'SET_DATA',
            payload: {
                nodes: sortedNodes,
                links: sortedLinks,
            },
        });
    }, [dispatch, state.data.links, state.data.nodes]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const clipboardData = e.clipboardData.getData('text');
        if (!clipboardData) return;

        const parsedRows = parseTabularRows(clipboardData);
        if (parsedRows.length === 0) {
            return;
        }

        e.preventDefault();

        if (parsedRows.length === 1 && activeRowIndex !== null) {
            const nextRows = [...rows];
            const targetIndex = Math.max(0, Math.min(activeRowIndex, nextRows.length - 1));
            const payload = parsedRows[0];

            nextRows[targetIndex] = {
                source: payload.source,
                target: payload.target,
                value: payload.value,
                comparison: payload.comparison,
                isValid: true,
            };

            if (!nextRows[nextRows.length - 1]?.source && !nextRows[nextRows.length - 1]?.target) {
                // keep one trailing row
            } else {
                nextRows.push({ source: '', target: '', value: '', comparison: '', isValid: true });
            }

            setRows(nextRows);
            commitChanges(nextRows);
            return;
        }

        const nextRows: GridRow[] = parsedRows.map((row) => ({
            ...row,
            isValid: true,
        }));

        nextRows.push({ source: '', target: '', value: '', comparison: '', isValid: true });

        setRows(nextRows);
        setActiveRowIndex(0);
        commitChanges(nextRows);
    }, [rows, commitChanges, activeRowIndex]);

    const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Sync selection from Canvas to Grid
    useEffect(() => {
        if (state.selectedLinkIndex !== null && rowRefs.current[state.selectedLinkIndex]) {
            rowRefs.current[state.selectedLinkIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [state.selectedLinkIndex]);

    const handleFocus = (index: number) => {
        setActiveRowIndex(index);
        if (state.selectedLinkIndex !== index) {
            dispatch({ type: 'SELECT_LINK', payload: index });
        }
    };

    // Resolve selected node name for highlighting
    const selectedNodeName = state.selectedNodeId
        ? state.data.nodes.find(n => n.id === state.selectedNodeId)?.name
        : null;

    const activeRow = activeRowIndex !== null ? rows[activeRowIndex] : null;
    const activeValuePreview = activeRow ? formatValuePreview(activeRow.value) : '';
    const activeComparisonPreview = activeRow ? formatComparisonPreview(activeRow.value, activeRow.comparison) : '';

    return (
        <div className="flex flex-col h-full bg-white  font-sans" onPaste={handlePaste}>
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_110px_130px_40px] gap-0 border-b border-gray-200  bg-white  sticky top-0 z-10">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 ">From</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 ">To</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 ">Amount, current</div>
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount, comparison</div>
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
                            className={`grid grid-cols-[1fr_1fr_110px_130px_40px] gap-0 border-b border-gray-100  items-center group
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
                                    onKeyDown={handleKeyDown}
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
                                    onKeyDown={handleKeyDown}
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
                                    onKeyDown={handleKeyDown}
                                    placeholder="0 or 1k"
                                    className="w-full h-full px-4 py-3 text-sm text-gray-900 font-mono bg-transparent outline-none focus:bg-blue-50/20"
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
                                    onKeyDown={handleKeyDown}
                                    placeholder="Amount OR %"
                                    className="w-full h-full px-4 py-3 text-sm text-green-600  font-medium font-mono bg-transparent outline-none focus:bg-blue-50/20 placeholder-gray-300"
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

            <div className="p-3 border-t border-gray-200  bg-gray-50  text-xs text-gray-500 font-medium flex items-center justify-between gap-2">
                <div className="flex flex-col">
                    <span>{rows.filter(r => r.isValid && r.source).length} Flows</span>
                    {activeRow && (
                        <span className="text-[10px] text-slate-400">
                            {activeValuePreview ? `Value: ${activeValuePreview}` : 'Value: -'}
                            {activeComparisonPreview ? ` • Delta: ${activeComparisonPreview}` : ''}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleClearTable}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-300 text-[11px] font-medium text-gray-600 hover:bg-white transition-colors"
                    >
                        <Trash2 size={12} />
                        Clear all
                    </button>
                    <button
                        type="button"
                        onClick={handleAddRowsPrompt}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-300 text-[11px] font-medium text-gray-600 hover:bg-white transition-colors"
                    >
                        <Plus size={12} />
                        Add N rows
                    </button>
                    <button
                        type="button"
                        onClick={handleAutofillComparison}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-300 text-[11px] font-medium text-gray-600 hover:bg-white transition-colors"
                    >
                        <Sparkles size={12} />
                        Auto-fill comparison
                    </button>
                    <button
                        type="button"
                        onClick={handleSortAlphabetical}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-300 text-[11px] font-medium text-gray-600 hover:bg-white transition-colors"
                    >
                        <ArrowUpDown size={12} />
                        Sort A-Z
                    </button>
                    <span>Press Enter to save • Paste Excel data directly</span>
                </div>
            </div>
        </div>
    );
}

