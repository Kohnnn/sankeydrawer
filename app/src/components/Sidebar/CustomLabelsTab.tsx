'use client';

import { Plus, Trash2, Type, AlignLeft, AlignCenter, AlignRight, Square, Box } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { IndependentLabel, GOOGLE_FONTS } from '@/types/sankey';

export default function CustomLabelsTab() {
    const { state, dispatch } = useDiagram();
    const { independentLabels, selectedLabelId, settings } = state;

    const selectedLabel = selectedLabelId
        ? independentLabels.find(l => l.id === selectedLabelId)
        : null;

    const handleAddText = () => {
        const newLabel: IndependentLabel = {
            id: `label_${Date.now()}`,
            type: 'text',
            text: 'Text',
            x: settings.width / 2,
            y: settings.height / 2,
            fontSize: 16,
            fontFamily: settings.labelFontFamily,
            color: '#1f2937',
            bold: false,
            italic: false,
        };
        dispatch({ type: 'ADD_INDEPENDENT_LABEL', payload: newLabel });
        dispatch({ type: 'SELECT_LABEL', payload: newLabel.id });
    };

    const handleAddBox = () => {
        const newBox: IndependentLabel = {
            id: `box_${Date.now()}`,
            type: 'box',
            text: 'Box', // Used for list display
            x: settings.width / 2,
            y: settings.height / 2,
            width: 100,
            height: 100,
            backgroundColor: '#e5e7eb',
            backgroundOpacity: 1,
            borderColor: '#9ca3af',
            borderWidth: 1,
            borderRadius: 4,
        };
        dispatch({ type: 'ADD_INDEPENDENT_LABEL', payload: newBox });
        dispatch({ type: 'SELECT_LABEL', payload: newBox.id });
    };

    const handleUpdateLabel = (id: string, updates: Partial<IndependentLabel>) => {
        dispatch({ type: 'UPDATE_INDEPENDENT_LABEL', payload: { id, updates } });
    };

    const handleDeleteLabel = (id: string) => {
        dispatch({ type: 'DELETE_INDEPENDENT_LABEL', payload: id });
        if (selectedLabelId === id) {
            dispatch({ type: 'SELECT_LABEL', payload: null });
        }
    };

    const handleSelectLabel = (id: string) => {
        dispatch({ type: 'SELECT_LABEL', payload: id });
    };

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--primary-text)] flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Custom Elements
                </h3>
                <div className="flex gap-1">
                    <button
                        onClick={handleAddText}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        title="Add Text"
                    >
                        <Plus className="w-3 h-3" />
                        <Type className="w-3 h-3" />
                    </button>
                    <button
                        onClick={handleAddBox}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
                        title="Add Box"
                    >
                        <Plus className="w-3 h-3" />
                        <Square className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Labels List */}
            {independentLabels.length > 0 && (
                <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border)] overflow-hidden">
                    <div className="border-b border-[var(--border)] px-3 py-2 bg-gray-50 ">
                        <span className="text-xs font-medium text-[var(--secondary-text)]">
                            Labels ({independentLabels.length})
                        </span>
                    </div>
                    <div className="divide-y divide-[var(--border)] max-h-48 overflow-y-auto">
                        {independentLabels.map((label) => (
                            <div
                                key={label.id}
                                onClick={() => handleSelectLabel(label.id)}
                                className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 :bg-gray-800 ${selectedLabelId === label.id ? 'bg-blue-50  border-l-2 border-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--primary-text)] truncate flex items-center gap-2">
                                            {label.type === 'box' ? <Square className="w-3 h-3 text-gray-400" /> : <Type className="w-3 h-3 text-gray-400" />}
                                            {label.text || (label.type === 'box' ? 'Box' : 'Untitled')}
                                        </p>
                                        <p className="text-xs text-[var(--secondary-text)] mt-0.5">
                                            Position: ({Math.round(label.x)}, {Math.round(label.y)})
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteLabel(label.id);
                                        }}
                                        className="p-1.5 text-red-500 hover:bg-red-50 :bg-red-900/20 rounded transition-colors"
                                        title="Delete label"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No Labels State */}
            {independentLabels.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                    <Type className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No custom elements yet</p>
                    <p className="text-xs mt-1">Add text or boxes using the buttons above</p>
                </div>
            )}

            {/* Selected Label Editor */}
            {selectedLabel && (
                <div className="bg-blue-50  rounded-lg border border-blue-200  p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-blue-800 ">
                        Edit Label
                    </h4>

                    {/* Text Content - Only for Text or Box Name */}
                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                            {selectedLabel.type === 'box' ? 'Name (Reference)' : 'Text'}
                        </label>
                        <input
                            type="text"
                            value={selectedLabel.text}
                            onChange={(e) => handleUpdateLabel(selectedLabel.id, { text: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            placeholder={selectedLabel.type === 'box' ? "e.g., Header Box" : "Enter label text..."}
                        />
                    </div>

                    {/* Position */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                X Position
                            </label>
                            <input
                                type="number"
                                value={Math.round(selectedLabel.x)}
                                onChange={(e) => handleUpdateLabel(selectedLabel.id, { x: Number(e.target.value) })}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                Y Position
                            </label>
                            <input
                                type="number"
                                value={Math.round(selectedLabel.y)}
                                onChange={(e) => handleUpdateLabel(selectedLabel.id, { y: Number(e.target.value) })}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                    </div>

                    {/* Box Dimensions */}
                    {selectedLabel.type === 'box' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                    Width
                                </label>
                                <input
                                    type="number"
                                    value={Math.round(selectedLabel.width || 100)}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { width: Number(e.target.value) })}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                    Height
                                </label>
                                <input
                                    type="number"
                                    value={Math.round(selectedLabel.height || 100)}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { height: Number(e.target.value) })}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                        </div>
                    )}

                    {/* Font Settings - Text Only */}
                    {(!selectedLabel.type || selectedLabel.type === 'text') && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                    Font Size
                                </label>
                                <input
                                    type="number"
                                    value={selectedLabel.fontSize || 16}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { fontSize: Number(e.target.value) })}
                                    min={8}
                                    max={48}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                    Font Family
                                </label>
                                <select
                                    value={selectedLabel.fontFamily || settings.labelFontFamily}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { fontFamily: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                >
                                    {GOOGLE_FONTS.map((font) => (
                                        <option key={font.value} value={font.value}>
                                            {font.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Text Color - Text Only */}
                    {(!selectedLabel.type || selectedLabel.type === 'text') && (
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                Text Color
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={selectedLabel.color || '#1f2937'}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { color: e.target.value })}
                                    className="w-10 h-8 rounded cursor-pointer border border-[var(--border)]"
                                />
                                <input
                                    type="text"
                                    value={selectedLabel.color || ''}
                                    onChange={(e) => {
                                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                            handleUpdateLabel(selectedLabel.id, { color: e.target.value });
                                        }
                                    }}
                                    placeholder="#1f2937"
                                    className="flex-1 px-2 py-1 text-sm font-mono border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                        </div>
                    )}

                    {/* Bold & Italic - Text Only */}
                    {(!selectedLabel.type || selectedLabel.type === 'text') && (
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedLabel.bold || false}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { bold: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-500"
                                />
                                Bold
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedLabel.italic || false}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { italic: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-500"
                                />
                                Italic
                            </label>
                        </div>
                    )}

                    {/* Alignment - Text Only */}
                    {(!selectedLabel.type || selectedLabel.type === 'text') && (
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                Alignment
                            </label>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleUpdateLabel(selectedLabel.id, { align: 'left' })}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded border transition-colors ${!selectedLabel.align || selectedLabel.align === 'left'
                                        ? 'bg-blue-50 border-blue-500 text-blue-700  '
                                        : 'border-[var(--border)] text-[var(--secondary-text)] hover:bg-gray-50 :bg-gray-800'
                                        }`}
                                >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                    Left
                                </button>
                                <button
                                    onClick={() => handleUpdateLabel(selectedLabel.id, { align: 'center' })}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded border transition-colors ${selectedLabel.align === 'center'
                                        ? 'bg-blue-50 border-blue-500 text-blue-700  '
                                        : 'border-[var(--border)] text-[var(--secondary-text)] hover:bg-gray-50 :bg-gray-800'
                                        }`}
                                >
                                    <AlignCenter className="w-3.5 h-3.5" />
                                    Center
                                </button>
                                <button
                                    onClick={() => handleUpdateLabel(selectedLabel.id, { align: 'right' })}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded border transition-colors ${selectedLabel.align === 'right'
                                        ? 'bg-blue-50 border-blue-500 text-blue-700  '
                                        : 'border-[var(--border)] text-[var(--secondary-text)] hover:bg-gray-50 :bg-gray-800'
                                        }`}
                                >
                                    <AlignRight className="w-3.5 h-3.5" />
                                    Right
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Background Color */}
                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                            {selectedLabel.type === 'box' ? 'Fill Color' : 'Background Color (optional)'}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={selectedLabel.backgroundColor || '#ffffff'}
                                onChange={(e) => handleUpdateLabel(selectedLabel.id, { backgroundColor: e.target.value })}
                                className="w-10 h-8 rounded cursor-pointer border border-[var(--border)]"
                            />
                            <input
                                type="text"
                                value={selectedLabel.backgroundColor || ''}
                                onChange={(e) => {
                                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value) || e.target.value === '') {
                                        handleUpdateLabel(selectedLabel.id, { backgroundColor: e.target.value || undefined });
                                    }
                                }}
                                placeholder="None"
                                className="flex-1 px-2 py-1 text-sm font-mono border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                    </div>

                    {/* Background Opacity */}
                    {selectedLabel.backgroundColor && (
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                {selectedLabel.type === 'box' ? 'Fill Opacity' : 'Background Opacity'}: {Math.round((selectedLabel.backgroundOpacity ?? 1) * 100)}%
                            </label>
                            <input
                                type="range"
                                value={selectedLabel.backgroundOpacity ?? 1}
                                onChange={(e) => handleUpdateLabel(selectedLabel.id, { backgroundOpacity: Number(e.target.value) })}
                                min={0}
                                max={1}
                                step={0.05}
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Border Settings */}
                    <div className="space-y-3 pt-3 border-t border-blue-200 ">
                        <h5 className="text-xs font-semibold text-blue-700  uppercase tracking-wide">
                            Border & Spacing
                        </h5>

                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                {selectedLabel.type === 'box' ? 'Border Color' : 'Border Color (optional)'}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={selectedLabel.borderColor || '#e5e7eb'}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { borderColor: e.target.value })}
                                    className="w-10 h-8 rounded cursor-pointer border border-[var(--border)]"
                                />
                                <input
                                    type="text"
                                    value={selectedLabel.borderColor || ''}
                                    onChange={(e) => {
                                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value) || e.target.value === '') {
                                            handleUpdateLabel(selectedLabel.id, { borderColor: e.target.value || undefined });
                                        }
                                    }}
                                    placeholder="None"
                                    className="flex-1 px-2 py-1 text-sm font-mono border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                    Border Width
                                </label>
                                <input
                                    type="number"
                                    value={selectedLabel.borderWidth ?? 1}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { borderWidth: Number(e.target.value) })}
                                    min={0}
                                    max={10}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                    Radius
                                </label>
                                <input
                                    type="number"
                                    value={selectedLabel.borderRadius ?? 4}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { borderRadius: Number(e.target.value) })}
                                    min={0}
                                    max={20}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                    Padding
                                </label>
                                <input
                                    type="number"
                                    value={selectedLabel.padding ?? 8}
                                    onChange={(e) => handleUpdateLabel(selectedLabel.id, { padding: Number(e.target.value) })}
                                    min={0}
                                    max={32}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

