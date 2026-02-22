'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Type, Palette, Trash2, Check } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import type { SankeyNode } from '@/types/sankey';

interface NodeEditPopoverProps {
    node: SankeyNode;
    position: { x: number; y: number };
    onClose: () => void;
    onAIAction?: (nodeId: string, action: string) => void;
}

export default function NodeEditPopover({ node, position, onClose }: NodeEditPopoverProps) {
    const { dispatch } = useDiagram();
    const popoverRef = useRef<HTMLDivElement>(null);

    const [labelText, setLabelText] = useState(node.name);
    const [color, setColor] = useState(node.color || '#6b7280');
    const [flowColor, setFlowColor] = useState(node.flowColor || node.color || '#6b7280');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleSave = useCallback(() => {
        dispatch({
            type: 'UPDATE_NODE',
            payload: {
                id: node.id,
                updates: {
                    name: labelText.trim() || node.name,
                    color,
                    flowColor,
                },
            },
        });

        onClose();
    }, [dispatch, node, labelText, color, flowColor, onClose]);

    const handleDelete = useCallback(() => {
        if (!window.confirm(`Delete node "${node.name}"? This removes connected flows.`)) {
            return;
        }

        dispatch({ type: 'DELETE_NODE', payload: node.id });
        onClose();
    }, [dispatch, node, onClose]);

    return (
        <div
            ref={popoverRef}
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
            style={{
                left: position.x,
                top: position.y,
                width: '280px',
                maxWidth: '280px',
            }}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
                <span className="text-sm font-semibold text-slate-700">Edit Node</span>
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-slate-200 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4 text-slate-500" />
                </button>
            </div>

            <div className="p-3 space-y-3">
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                        <Type className="w-3.5 h-3.5" />
                        Label
                    </label>
                    <input
                        type="text"
                        value={labelText}
                        onChange={(e) => setLabelText(e.target.value)}
                        className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                        placeholder="Node name"
                        autoFocus
                    />
                </div>

                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                        <Palette className="w-3.5 h-3.5" />
                        Color
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-9 h-9 rounded cursor-pointer border border-slate-300"
                        />
                        <input
                            type="text"
                            value={color}
                            onChange={(e) => {
                                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                    setColor(e.target.value);
                                }
                            }}
                            className="flex-1 px-2.5 py-2 text-sm border border-slate-300 rounded-md font-mono"
                            placeholder="#000000"
                        />
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                        <Palette className="w-3.5 h-3.5" />
                        Flow Color
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="color"
                            value={flowColor}
                            onChange={(e) => setFlowColor(e.target.value)}
                            className="w-9 h-9 rounded cursor-pointer border border-slate-300"
                        />
                        <input
                            type="text"
                            value={flowColor}
                            onChange={(e) => {
                                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                    setFlowColor(e.target.value);
                                }
                            }}
                            className="flex-1 px-2.5 py-2 text-sm border border-slate-300 rounded-md font-mono"
                            placeholder="#000000"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50">
                <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                </button>
                <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                    <Check className="w-3.5 h-3.5" />
                    Save
                </button>
            </div>
        </div>
    );
}
