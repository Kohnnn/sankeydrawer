'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Palette, Type, Plus, Trash2, Check, ChevronDown, AlignLeft, AlignCenter, AlignRight, Highlighter, Sparkles, Search, Lightbulb, Zap } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { SankeyNode } from '@/types/sankey';

interface NodeEditPopoverProps {
    node: SankeyNode;
    position: { x: number; y: number };
    onClose: () => void;
    onAIAction?: (nodeId: string, action: string) => void;
}

const PRESET_COLORS = [
    '#22c55e', '#16a34a', // Greens
    '#ef4444', '#dc2626', // Reds
    '#3b82f6', '#2563eb', // Blues
    '#f59e0b', '#d97706', // Ambers
    '#8b5cf6', '#7c3aed', // Purples
    '#ec4899', '#db2777', // Pinks
    '#6b7280', '#4b5563', // Grays
    '#0ea5e9', '#0284c7', // Sky blues
];

export default function NodeEditPopover({ node, position, onClose, onAIAction }: NodeEditPopoverProps) {
    const { state, dispatch } = useDiagram();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [labelText, setLabelText] = useState(node.name);
    const [color, setColor] = useState(node.color || '#6b7280');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [flowColor, setFlowColor] = useState(node.flowColor || node.color || '#6b7280');
    const [showFlowColorPicker, setShowFlowColorPicker] = useState(false);
    const [secondLineText, setSecondLineText] = useState('');
    const [showSecondLine, setShowSecondLine] = useState(false);
    const [thirdLineText, setThirdLineText] = useState('');
    const [showThirdLine, setShowThirdLine] = useState(false);

    // Label formatting state
    const [labelAlignment, setLabelAlignment] = useState<'left' | 'center' | 'right'>('left');
    const [showLabelBackground, setShowLabelBackground] = useState(false);
    const [labelBackgroundColor, setLabelBackgroundColor] = useState('#ffffff');
    const [labelBorderColor, setLabelBorderColor] = useState('#e5e7eb');
    const [valueColor, setValueColor] = useState('#6b7280');
    const [secondLineColor, setSecondLineColor] = useState('#059669');
    const [thirdLineColor, setThirdLineColor] = useState('#6b7280');
    const [showAIMenu, setShowAIMenu] = useState(false);

    // Get existing customization if any
    const existingCustomization = state.nodeCustomizations?.find(c => c.nodeId === node.id);

    useEffect(() => {
        if (existingCustomization) {
            setSecondLineText(existingCustomization.secondLineText || '');
            setShowSecondLine(existingCustomization.showSecondLine || false);
            setThirdLineText(existingCustomization.thirdLineText || '');
            setShowThirdLine(existingCustomization.showThirdLine || false);
            setLabelAlignment(existingCustomization.labelAlignment || 'left');
            setShowLabelBackground(existingCustomization.showLabelBackground || false);
            setLabelBackgroundColor(existingCustomization.labelBackgroundColor || '#ffffff');
            setLabelBorderColor(existingCustomization.labelBorderColor || '#e5e7eb');
            setValueColor(existingCustomization.valueColor || '#6b7280');
            setSecondLineColor(existingCustomization.secondLineColor || '#059669');
            setThirdLineColor(existingCustomization.thirdLineColor || '#6b7280');
        }
    }, [existingCustomization]);

    // Click outside to close
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

    // Calculate position to stay within viewport
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    useEffect(() => {
        if (popoverRef.current) {
            const rect = popoverRef.current.getBoundingClientRect();
            const newPos = { ...position };

            // Adjust if going off right edge
            if (position.x + rect.width > window.innerWidth - 20) {
                newPos.x = position.x - rect.width - 20;
            }

            // Adjust if going off bottom edge
            if (position.y + rect.height > window.innerHeight - 20) {
                newPos.y = window.innerHeight - rect.height - 20;
            }

            setAdjustedPosition(newPos);
        }
    }, [position]);

    const handleSave = useCallback(() => {
        // Update node name if changed
        if (labelText !== node.name) {
            dispatch({ type: 'UPDATE_NODE', payload: { id: node.id, updates: { name: labelText } } });
        }

        // Update node color and flow color
        if (color !== node.color || flowColor !== node.flowColor) {
            dispatch({ type: 'UPDATE_NODE', payload: { id: node.id, updates: { color, flowColor } } });
        }

        // Update customizations
        dispatch({
            type: 'UPDATE_NODE_CUSTOMIZATION',
            payload: {
                nodeId: node.id,
                updates: {
                    secondLineText,
                    showSecondLine,
                    thirdLineText,
                    showThirdLine,
                    labelAlignment,
                    showLabelBackground,
                    labelBackgroundColor,
                    labelBorderColor,
                    valueColor,
                    secondLineColor,
                    thirdLineColor,
                }
            }
        });

        onClose();
    }, [dispatch, node, labelText, color, secondLineText, showSecondLine, thirdLineText, showThirdLine, onClose]);

    const handleDelete = useCallback(() => {
        if (confirm(`Delete node "${node.name}"? This will also remove all connected flows.`)) {
            dispatch({ type: 'DELETE_NODE', payload: node.id });
            onClose();
        }
    }, [dispatch, node, onClose]);

    const handleAddFlow = useCallback(() => {
        dispatch({ type: 'ADD_LINK', payload: { source: node.id, target: '', value: 100 } });
        onClose();
    }, [dispatch, node.id, onClose]);

    const handleAIAction = useCallback((action: string) => {
        setShowAIMenu(false);
        if (onAIAction) {
            onAIAction(node.id, action);
        }
        onClose();
    }, [node.id, onAIAction, onClose]);

    return (
        <div
            ref={popoverRef}
            className="fixed z-50 bg-white  rounded-xl shadow-2xl border border-gray-200  overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
                minWidth: '280px',
                maxWidth: '320px',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50   border-b border-gray-200 ">
                <div className="flex items-center gap-2">
                    <div
                        className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-sm text-gray-700 ">Edit Node</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-200 :bg-gray-700 rounded-md transition-colors"
                >
                    <X className="w-4 h-4 text-gray-500" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Label Input */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600  mb-1.5">
                        <Type className="w-3.5 h-3.5" />
                        Label
                    </label>
                    <input
                        type="text"
                        value={labelText}
                        onChange={(e) => setLabelText(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white  text-gray-900 "
                        placeholder="Node name"
                        autoFocus
                    />
                </div>

                {/* Color Picker */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600  mb-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        Color
                    </label>
                    <div className="relative">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200  rounded-lg hover:bg-gray-50 :bg-gray-800 transition-colors"
                        >
                            <div
                                className="w-5 h-5 rounded-md border border-gray-300 "
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-sm text-gray-700  font-mono">{color}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                        </button>

                        {showColorPicker && (
                            <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white  border border-gray-200  rounded-lg shadow-lg z-10">
                                <div className="grid grid-cols-8 gap-1 mb-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setColor(c);
                                                setShowColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${color === c ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent'
                                                }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={color}
                                        onChange={(e) => {
                                            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                                setColor(e.target.value);
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200  rounded bg-white "
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Flow Color Picker */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600  mb-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        Flow Color (Outgoing)
                    </label>
                    <div className="relative">
                        <button
                            onClick={() => setShowFlowColorPicker(!showFlowColorPicker)}
                            className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200  rounded-lg hover:bg-gray-50 :bg-gray-800 transition-colors"
                        >
                            <div
                                className="w-5 h-5 rounded-md border border-gray-300 "
                                style={{ backgroundColor: flowColor }}
                            />
                            <span className="text-sm text-gray-700  font-mono">{flowColor}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                        </button>

                        {showFlowColorPicker && (
                            <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white  border border-gray-200  rounded-lg shadow-lg z-10">
                                <div className="grid grid-cols-8 gap-1 mb-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setFlowColor(c);
                                                setShowFlowColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${flowColor === c ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent'
                                                }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={flowColor}
                                        onChange={(e) => setFlowColor(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={flowColor}
                                        onChange={(e) => {
                                            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                                setFlowColor(e.target.value);
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200  rounded bg-white "
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Label Alignment */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600  mb-1.5">
                        <Type className="w-3.5 h-3.5" />
                        Text Alignment
                    </label>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setLabelAlignment('left')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${labelAlignment === 'left'
                                ? 'bg-blue-50 border-blue-500 text-blue-700  '
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50  '
                                }`}
                        >
                            <AlignLeft className="w-3.5 h-3.5" />
                            Left
                        </button>
                        <button
                            onClick={() => setLabelAlignment('center')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${labelAlignment === 'center'
                                ? 'bg-blue-50 border-blue-500 text-blue-700  '
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50  '
                                }`}
                        >
                            <AlignCenter className="w-3.5 h-3.5" />
                            Center
                        </button>
                        <button
                            onClick={() => setLabelAlignment('right')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${labelAlignment === 'right'
                                ? 'bg-blue-50 border-blue-500 text-blue-700  '
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50  '
                                }`}
                        >
                            <AlignRight className="w-3.5 h-3.5" />
                            Right
                        </button>
                    </div>
                </div>

                {/* Background Highlighting */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600  cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showLabelBackground}
                            onChange={(e) => setShowLabelBackground(e.target.checked)}
                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <Highlighter className="w-3.5 h-3.5" />
                        Show Label Background
                    </label>
                    {showLabelBackground && (
                        <div className="grid grid-cols-2 gap-2 pl-6">
                            <div>
                                <label className="block text-xs text-gray-500  mb-1">Background</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={labelBackgroundColor}
                                        onChange={(e) => setLabelBackgroundColor(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                    />
                                    <input
                                        type="text"
                                        value={labelBackgroundColor}
                                        onChange={(e) => {
                                            if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                                                setLabelBackgroundColor(e.target.value);
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200  rounded"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500  mb-1">Border</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={labelBorderColor}
                                        onChange={(e) => setLabelBorderColor(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                    />
                                    <input
                                        type="text"
                                        value={labelBorderColor}
                                        onChange={(e) => {
                                            if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                                                setLabelBorderColor(e.target.value);
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200  rounded"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Value Color */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600  mb-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        Value Text Color
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="color"
                            value={valueColor}
                            onChange={(e) => setValueColor(e.target.value)}
                            className="w-10 h-8 rounded cursor-pointer border border-gray-300"
                        />
                        <input
                            type="text"
                            value={valueColor}
                            onChange={(e) => {
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                                    setValueColor(e.target.value);
                                }
                            }}
                            className="flex-1 px-3 py-1.5 text-sm font-mono border border-gray-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                    </div>
                </div>

                {/* Custom Text Lines */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600  cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showSecondLine}
                            onChange={(e) => setShowSecondLine(e.target.checked)}
                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        2nd Line Text
                    </label>
                    {showSecondLine && (
                        <div className="space-y-2 pl-6">
                            <input
                                type="text"
                                value={secondLineText}
                                onChange={(e) => setSecondLineText(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white "
                                placeholder="e.g., +12% Y/Y"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={secondLineColor}
                                    onChange={(e) => setSecondLineColor(e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input
                                    type="text"
                                    value={secondLineColor}
                                    onChange={(e) => {
                                        if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                                            setSecondLineColor(e.target.value);
                                        }
                                    }}
                                    className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200  rounded"
                                    placeholder="Text color"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600  cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showThirdLine}
                            onChange={(e) => setShowThirdLine(e.target.checked)}
                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        3rd Line Text
                    </label>
                    {showThirdLine && (
                        <div className="space-y-2 pl-6">
                            <input
                                type="text"
                                value={thirdLineText}
                                onChange={(e) => setThirdLineText(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white "
                                placeholder="e.g., 29% margin"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={thirdLineColor}
                                    onChange={(e) => setThirdLineColor(e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input
                                    type="text"
                                    value={thirdLineColor}
                                    onChange={(e) => {
                                        if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                                            setThirdLineColor(e.target.value);
                                        }
                                    }}
                                    className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200  rounded"
                                    placeholder="Text color"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50  border-t border-gray-200 ">
                <div className="flex gap-1">
                    <button
                        onClick={handleAddFlow}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Flow
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                    </button>
                    {/* AI Actions */}
                    <div className="relative">
                        <button
                            onClick={() => setShowAIMenu(!showAIMenu)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            AI
                        </button>
                        {showAIMenu && (
                            <div className="absolute bottom-full left-0 mb-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                                <button
                                    onClick={() => handleAIAction('breakdown')}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    Suggest Breakdown
                                </button>
                                <button
                                    onClick={() => handleAIAction('insights')}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                                >
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    Get Insights
                                </button>
                                <button
                                    onClick={() => handleAIAction('optimize')}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    Suggest Optimization
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm transition-colors"
                >
                    <Check className="w-3.5 h-3.5" />
                    Save
                </button>
            </div>
        </div>
    );
}

