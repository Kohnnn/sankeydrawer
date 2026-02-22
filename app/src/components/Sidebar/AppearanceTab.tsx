'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Save, Trash2, Check, Plus, Type, Image as ImageIcon } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { getAllPalettes, saveCustomPalette, deleteCustomPalette, getDefaultPaletteId, setDefaultPalette, parseColorsFromString, ColorPalette } from '@/lib/colorPalettes';
import { getTemplates, saveTemplate, deleteTemplate, applyTemplate, PRESET_TEMPLATES, DiagramTemplate } from '@/lib/templates';
import { GOOGLE_FONTS, NodeCustomization, DEFAULT_PALETTE } from '@/types/sankey';

const THEME_PRESETS = {
    standard: {
        name: 'Standard',
        settings: {
            nodeWidth: 12,
            linkCurvature: 0.5,
            linkOpacity: 0.45,
            nodePadding: 24,
            labelPosition: 'external' as const,
        }
    },
    nvidia: {
        name: '✨ Nvidia Style (Pro)',
        settings: {
            nodeWidth: 120,
            linkCurvature: 0.5,
            linkOpacity: 0.6,
            nodePadding: 50,
            labelPosition: 'inside' as const,
            labelFontSize: 14,
            labelBold: true,
        }
    },
    vietnamese: {
        name: '🇻🇳 Vietnamese Financial',
        settings: {
            colorPalette: 'vietnamese',
            linkGradient: true,
            linkOpacity: 0.5,
            nodeBorderRadius: 0,
            labelPosition: 'auto' as const,
            valuePrefix: '',
            valueSuffix: ' tỷ đồng',
            valueMode: 'short' as const,
            useFinancialTheme: true,
        }
    }

};

const CANVAS_PRESETS = [
    { id: 'small', label: 'Small', width: 640, height: 400 },
    { id: 'medium', label: 'Medium', width: 960, height: 600 },
    { id: 'large', label: 'Large', width: 1200, height: 800 },
];

export default function AppearanceTab() {
    const { state, dispatch } = useDiagram();
    const { settings, selectedNodeId, data } = state;
    const selectedNode = selectedNodeId ? data.nodes.find(n => n.id === selectedNodeId) : null;

    const [openSections, setOpenSections] = useState<Set<string>>(new Set(['palette', 'label']));
    const [recentColors, setRecentColors] = useState<string[]>([]);
    const [palettes, setPalettes] = useState<ColorPalette[]>([]);
    const [templates, setTemplates] = useState<DiagramTemplate[]>([]);
    const [defaultPaletteId, setDefaultPaletteIdState] = useState<string | null>(null);
    const [showCustomPaletteModal, setShowCustomPaletteModal] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [newPaletteName, setNewPaletteName] = useState('');
    const [newPaletteColors, setNewPaletteColors] = useState('');
    const [newTemplateName, setNewTemplateName] = useState('');

    // Load palettes, templates, recent colors on mount
    useEffect(() => {
        setPalettes(getAllPalettes());
        setTemplates([...PRESET_TEMPLATES, ...getTemplates()]);
        setDefaultPaletteIdState(getDefaultPaletteId());

        const saved = localStorage.getItem('sankey-recent-colors');
        if (saved) {
            try { setRecentColors(JSON.parse(saved)); } catch { }
        }
    }, []);

    const toggleSection = (section: string) => {
        const newOpen = new Set(openSections);
        if (newOpen.has(section)) newOpen.delete(section);
        else newOpen.add(section);
        setOpenSections(newOpen);
    };

    const updateSetting = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
    }, [dispatch]);

    const updatePadding = useCallback((side: 'top' | 'right' | 'bottom' | 'left', value: number) => {
        dispatch({
            type: 'UPDATE_SETTINGS',
            payload: {
                padding: {
                    ...settings.padding,
                    [side]: value,
                },
            },
        });
    }, [dispatch, settings.padding]);

    const addRecentColor = useCallback((color: string) => {
        const newColors = [color, ...recentColors.filter(c => c !== color)].slice(0, 5);
        setRecentColors(newColors);
        localStorage.setItem('sankey-recent-colors', JSON.stringify(newColors));
    }, [recentColors]);

    const handleNodeColorChange = useCallback((color: string) => {
        if (selectedNodeId) {
            dispatch({ type: 'UPDATE_NODE', payload: { id: selectedNodeId, updates: { color } } });
            addRecentColor(color);
        }
    }, [selectedNodeId, dispatch, addRecentColor]);

    const handlePaletteChange = useCallback((paletteId: string) => {
        updateSetting('colorPalette', paletteId);
    }, [updateSetting]);

    const handleSetDefaultPalette = useCallback((checked: boolean) => {
        if (checked) {
            setDefaultPalette(settings.colorPalette);
            setDefaultPaletteIdState(settings.colorPalette);
        } else {
            setDefaultPalette(null);
            setDefaultPaletteIdState(null);
        }
    }, [settings.colorPalette]);

    const handleSaveCustomPalette = useCallback(() => {
        const colors = parseColorsFromString(newPaletteColors);
        if (newPaletteName && colors.length >= 2) {
            saveCustomPalette({
                id: `custom_${Date.now()}`,
                name: newPaletteName,
                colors,
            });
            setPalettes(getAllPalettes());
            setShowCustomPaletteModal(false);
            setNewPaletteName('');
            setNewPaletteColors('');
        }
    }, [newPaletteName, newPaletteColors]);

    const handleDeletePalette = useCallback((id: string) => {
        deleteCustomPalette(id);
        setPalettes(getAllPalettes());
    }, []);

    const handleSaveTemplate = useCallback(() => {
        if (newTemplateName) {
            saveTemplate(newTemplateName, settings, settings.colorPalette);
            setTemplates([...PRESET_TEMPLATES, ...getTemplates()]);
            setShowSaveTemplateModal(false);
            setNewTemplateName('');
        }
    }, [newTemplateName, settings]);

    const handleApplyTemplate = useCallback((template: DiagramTemplate) => {
        const newSettings = applyTemplate(template, settings);
        dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
        if (template.paletteId) {
            dispatch({ type: 'UPDATE_SETTINGS', payload: { colorPalette: template.paletteId } });
        }
    }, [settings, dispatch]);

    const handleDeleteTemplate = useCallback((id: string) => {
        deleteTemplate(id);
        setTemplates([...PRESET_TEMPLATES, ...getTemplates()]);
    }, []);

    // Get/update node customization
    const getNodeCustomization = useCallback((nodeId: string) => {
        return state.nodeCustomizations?.find(c => c.nodeId === nodeId);
    }, [state.nodeCustomizations]);

    const updateNodeCustomization = useCallback((nodeId: string, updates: Partial<NodeCustomization>) => {
        dispatch({
            type: 'UPDATE_NODE_CUSTOMIZATION',
            payload: { nodeId, updates }
        });
    }, [dispatch]);

    const selectedCustomization = selectedNodeId ? getNodeCustomization(selectedNodeId) : null;

    // Independent Label Logic
    const selectedLabel = state.selectedLabelId ? state.independentLabels?.find(l => l.id === state.selectedLabelId) : null;
    const updateIndependentLabel = useCallback((id: string, updates: import('@/types/sankey').IndependentLabel) => {
        dispatch({ type: 'UPDATE_INDEPENDENT_LABEL', payload: { id, updates } });
    }, [dispatch]);

    const applyThemePreset = useCallback((key: keyof typeof THEME_PRESETS) => {
        const preset = THEME_PRESETS[key];
        dispatch({ type: 'UPDATE_SETTINGS', payload: preset.settings });
    }, [dispatch]);

    return (
        <div className="p-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700 cursor-pointer select-none">
                    <span>Focus Mode (Dim Others)</span>
                    <input
                        type="checkbox"
                        checked={settings.enableFocusMode}
                        onChange={(e) => updateSetting('enableFocusMode', e.target.checked)}
                        className="rounded border-gray-300 text-blue-500"
                    />
                </label>
            </div>

            {/* Selected Node Section */}
            {selectedNode && (
                <div className="bg-blue-50  rounded-lg border border-blue-200  p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-blue-800  flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color || '#6b7280' }} />
                        {selectedNode.name}
                    </h3>

                    {/* Node Color */}
                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Node Color</label>

                        {/* Quick Palette */}
                        <div className="flex gap-1 mb-2 flex-wrap">
                            {DEFAULT_PALETTE.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => handleNodeColorChange(color)}
                                    className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform shadow-sm"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={selectedNode.color || '#6b7280'}
                                onChange={(e) => handleNodeColorChange(e.target.value)}
                                className="w-10 h-8 rounded cursor-pointer border border-[var(--border)]"
                            />
                            <input
                                type="text"
                                value={selectedNode.color || ''}
                                onChange={(e) => {
                                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                        handleNodeColorChange(e.target.value);
                                    }
                                }}
                                placeholder="#000000"
                                className="flex-1 px-2 py-1 text-sm font-mono border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>

                        {recentColors.length > 0 && (
                            <div className="flex gap-1 mt-2">
                                <span className="text-xs text-gray-500 mr-1">Recent:</span>
                                {recentColors.map((color, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleNodeColorChange(color)}
                                        className="w-6 h-6 rounded border border-gray-200 hover:ring-2 hover:ring-blue-300 transition-all"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Per-Node Label Styling */}
                    <div className="border-t border-blue-200  pt-3 space-y-3">
                        <h4 className="text-xs font-semibold text-blue-700  uppercase tracking-wide">Label Overrides</h4>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Font Size</label>
                                <input
                                    type="number"
                                    value={selectedCustomization?.labelFontSize ?? settings.labelFontSize}
                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { labelFontSize: Number(e.target.value) })}
                                    min={8}
                                    max={24}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Font</label>
                                <select
                                    value={selectedCustomization?.labelFontFamily ?? settings.labelFontFamily}
                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { labelFontFamily: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                >
                                    {GOOGLE_FONTS.map((font) => (
                                        <option key={font.value} value={font.value}>{font.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCustomization?.labelBold ?? settings.labelBold}
                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { labelBold: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-500"
                                />
                                Bold
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCustomization?.labelItalic ?? settings.labelItalic}
                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { labelItalic: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-500"
                                />
                                Italic
                            </label>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Label Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={selectedCustomization?.labelColor ?? '#1f2937'}
                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { labelColor: e.target.value })}
                                    className="w-8 h-7 rounded cursor-pointer border border-[var(--border)]"
                                />
                                <input
                                    type="text"
                                    value={selectedCustomization?.labelColor ?? ''}
                                    onChange={(e) => {
                                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                            updateNodeCustomization(selectedNodeId!, { labelColor: e.target.value });
                                        }
                                    }}
                                    placeholder="Default"
                                    className="flex-1 px-2 py-1 text-xs font-mono border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                        </div>

                        {/* Custom Text Lines */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-[var(--secondary-text)] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCustomization?.showSecondLine ?? false}
                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { showSecondLine: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-500 w-3.5 h-3.5"
                                />
                                2nd Line Text
                            </label>
                            {selectedCustomization?.showSecondLine && (
                                <div className="mt-2 space-y-2">
                                    <input
                                        type="text"
                                        value={selectedCustomization?.secondLineText ?? ''}
                                        onChange={(e) => updateNodeCustomization(selectedNodeId!, { secondLineText: e.target.value })}
                                        placeholder="e.g., $1.2M"
                                        className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-500">Color</label>
                                            <div className="flex gap-1">
                                                <input
                                                    type="color"
                                                    value={selectedCustomization?.secondLineColor || '#10b981'}
                                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { secondLineColor: e.target.value })}
                                                    className="w-6 h-6 rounded cursor-pointer border border-gray-200"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Font Size</label>
                                            <input
                                                type="number"
                                                value={selectedCustomization?.secondLineFontSize ?? ''}
                                                placeholder="Default"
                                                onChange={(e) => updateNodeCustomization(selectedNodeId!, { secondLineFontSize: Number(e.target.value) })}
                                                className="w-full px-2 py-0.5 text-xs border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <label className="flex items-center gap-1 text-[10px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomization?.secondLineBold ?? false}
                                                onChange={(e) => updateNodeCustomization(selectedNodeId!, { secondLineBold: e.target.checked })}
                                                className="rounded"
                                            />
                                            Bold
                                        </label>
                                        <label className="flex items-center gap-1 text-[10px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomization?.secondLineItalic ?? false}
                                                onChange={(e) => updateNodeCustomization(selectedNodeId!, { secondLineItalic: e.target.checked })}
                                                className="rounded"
                                            />
                                            Italic
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-[var(--secondary-text)] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCustomization?.showThirdLine ?? false}
                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { showThirdLine: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-500 w-3.5 h-3.5"
                                />
                                3rd Line Text
                            </label>
                            {selectedCustomization?.showThirdLine && (
                                <div className="mt-2 space-y-2">
                                    <input
                                        type="text"
                                        value={selectedCustomization?.thirdLineText ?? ''}
                                        onChange={(e) => updateNodeCustomization(selectedNodeId!, { thirdLineText: e.target.value })}
                                        placeholder="e.g., +15% Y/Y"
                                        className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-500">Color</label>
                                            <div className="flex gap-1">
                                                <input
                                                    type="color"
                                                    value={selectedCustomization?.thirdLineColor || '#6b7280'}
                                                    onChange={(e) => updateNodeCustomization(selectedNodeId!, { thirdLineColor: e.target.value })}
                                                    className="w-6 h-6 rounded cursor-pointer border border-gray-200"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Font Size</label>
                                            <input
                                                type="number"
                                                value={selectedCustomization?.thirdLineFontSize ?? ''}
                                                placeholder="Default"
                                                onChange={(e) => updateNodeCustomization(selectedNodeId!, { thirdLineFontSize: Number(e.target.value) })}
                                                className="w-full px-2 py-0.5 text-xs border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <label className="flex items-center gap-1 text-[10px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomization?.thirdLineBold ?? false}
                                                onChange={(e) => updateNodeCustomization(selectedNodeId!, { thirdLineBold: e.target.checked })}
                                                className="rounded"
                                            />
                                            Bold
                                        </label>
                                        <label className="flex items-center gap-1 text-[10px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomization?.thirdLineItalic ?? false}
                                                onChange={(e) => updateNodeCustomization(selectedNodeId!, { thirdLineItalic: e.target.checked })}
                                                className="rounded"
                                            />
                                            Italic
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Label Section */}
            {selectedLabel && (
                <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                            {selectedLabel.type === 'image' ? <ImageIcon className="w-4 h-4" /> : <Type className="w-4 h-4" />}
                            Edit {selectedLabel.type === 'image' ? 'Image' : 'Text'}
                        </h3>
                        <button
                            onClick={() => dispatch({ type: 'DELETE_INDEPENDENT_LABEL', payload: selectedLabel.id })}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    {selectedLabel.type === 'text' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Text</label>
                                <input
                                    type="text"
                                    value={selectedLabel.text}
                                    onChange={(e) => updateIndependentLabel(selectedLabel.id, { text: e.target.value } as any)}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Font Size</label>
                                    <input
                                        type="number"
                                        value={selectedLabel.fontSize || 16}
                                        onChange={(e) => updateIndependentLabel(selectedLabel.id, { fontSize: Number(e.target.value) } as any)}
                                        className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Color</label>
                                    <div className="flex gap-1">
                                        <input
                                            type="color"
                                            value={selectedLabel.color || '#000000'}
                                            onChange={(e) => updateIndependentLabel(selectedLabel.id, { color: e.target.value } as any)}
                                            className="w-8 h-8 rounded cursor-pointer border border-[var(--border)]"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedLabel.bold || false}
                                        onChange={(e) => updateIndependentLabel(selectedLabel.id, { bold: e.target.checked } as any)}
                                        className="rounded"
                                    />
                                    Bold
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedLabel.italic || false}
                                        onChange={(e) => updateIndependentLabel(selectedLabel.id, { italic: e.target.checked } as any)}
                                        className="rounded"
                                    />
                                    Italic
                                </label>
                            </div>
                        </div>
                    )}

                    {selectedLabel.type === 'image' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Image URL</label>
                                <input
                                    type="text"
                                    value={selectedLabel.src || ''}
                                    onChange={(e) => updateIndependentLabel(selectedLabel.id, { src: e.target.value } as any)}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Width</label>
                                    <input
                                        type="number"
                                        value={selectedLabel.width || 100}
                                        onChange={(e) => updateIndependentLabel(selectedLabel.id, { width: Number(e.target.value) } as any)}
                                        className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Height</label>
                                    <input
                                        type="number"
                                        value={selectedLabel.height || 100}
                                        onChange={(e) => updateIndependentLabel(selectedLabel.id, { height: Number(e.target.value) } as any)}
                                        className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Opacity</label>
                                <input
                                    type="range"
                                    value={selectedLabel.opacity ?? 1}
                                    onChange={(e) => updateIndependentLabel(selectedLabel.id, { opacity: Number(e.target.value) } as any)}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Smart Layout Section */}
            <Section title="Theme Presets" isOpen={openSections.has('smartLayouts')} onToggle={() => toggleSection('smartLayouts')}>
                <div className="space-y-3">
                    <p className="text-xs text-[var(--secondary-text)] mb-2">Apply professional preset styles instantly.</p>
                    <div className="grid grid-cols-1 gap-2">
                        {(Object.entries(THEME_PRESETS) as [keyof typeof THEME_PRESETS, any][]).map(([key, preset]) => (
                            <button
                                key={key}
                                onClick={() => applyThemePreset(key)}
                                className={`p-2.5 text-sm border rounded-lg transition-all text-left flex items-center justify-between group
                                    ${key === 'nvidia' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-indigo-200 text-indigo-700 hover:from-blue-100 hover:to-indigo-100' : 
                                      key === 'vietnamese' ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 text-red-700 hover:from-red-100 hover:to-red-100' :
                                      'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'} shadow-sm hover:shadow`}
                            >
                                <span className="font-medium">{preset.name}</span>
                                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            {/* Global Palette Section */}
            <Section title="Global Colors" isOpen={openSections.has('palette')} onToggle={() => toggleSection('palette')}>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-2">Color Palette</label>
                        <div className="grid grid-cols-2 gap-2">
                            {getAllPalettes().map(palette => (
                                <button
                                    key={palette.id}
                                    onClick={() => {
                                        updateSetting('colorPalette', palette.id);
                                        updateSetting('useDefaultPalette', false);
                                    }}
                                    className={`relative p-2 border rounded-md text-left transition-all ${settings.colorPalette === palette.id ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : 'hover:bg-gray-50 border-[var(--border)]'}`}
                                >
                                    <span className="block text-xs font-medium mb-1 truncate">{palette.name}</span>
                                    <div className="flex h-2 rounded overflow-hidden">
                                        {palette.colors.slice(0, 5).map((c, i) => (
                                            <div key={i} style={{ backgroundColor: c, width: '20%' }} />
                                        ))}
                                    </div>
                                </button>
                            ))}
                            {/* Create Custom */}
                            <button
                                onClick={() => setShowCustomPaletteModal(true)}
                                className="flex flex-col items-center justify-center p-2 border border-dashed border-gray-300 rounded-md text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                            >
                                <Plus className="w-4 h-4 mb-1" />
                                <span className="text-xs">Create Custom</span>
                            </button>
                        </div>
                    </div>

                    {/* Dark Mode Removed */}
                </div>
            </Section>

            {/* Canvas Size Section */}
            <Section title="Canvas Size" isOpen={openSections.has('canvas')} onToggle={() => toggleSection('canvas')}>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Diagram Title</label>
                        <input
                            type="text"
                            value={settings.diagramTitle}
                            onChange={(e) => updateSetting('diagramTitle', e.target.value)}
                            placeholder="Cash Flow Template"
                            className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-2">Presets</label>
                        <div className="grid grid-cols-3 gap-2">
                            {CANVAS_PRESETS.map((preset) => {
                                const isActive = settings.width === preset.width && settings.height === preset.height;
                                return (
                                    <button
                                        key={preset.id}
                                        onClick={() => {
                                            updateSetting('width', preset.width);
                                            updateSetting('height', preset.height);
                                        }}
                                        className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Width (px)</label>
                            <input
                                type="number"
                                value={settings.width}
                                onChange={(e) => updateSetting('width', Number(e.target.value))}
                                min={400}
                                max={2400}
                                step={50}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Height (px)</label>
                            <input
                                type="number"
                                value={settings.height}
                                onChange={(e) => updateSetting('height', Number(e.target.value))}
                                min={300}
                                max={1600}
                                step={50}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-2">Canvas Margins (px)</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Top</label>
                                <input
                                    type="number"
                                    value={settings.padding.top}
                                    onChange={(e) => updatePadding('top', Number(e.target.value))}
                                    min={0}
                                    max={400}
                                    step={5}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Right</label>
                                <input
                                    type="number"
                                    value={settings.padding.right}
                                    onChange={(e) => updatePadding('right', Number(e.target.value))}
                                    min={0}
                                    max={400}
                                    step={5}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Bottom</label>
                                <input
                                    type="number"
                                    value={settings.padding.bottom}
                                    onChange={(e) => updatePadding('bottom', Number(e.target.value))}
                                    min={0}
                                    max={400}
                                    step={5}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Left</label>
                                <input
                                    type="number"
                                    value={settings.padding.left}
                                    onChange={(e) => updatePadding('left', Number(e.target.value))}
                                    min={0}
                                    max={400}
                                    step={5}
                                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100  grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={settings.showGrid}
                                onChange={(e) => updateSetting('showGrid', e.target.checked)}
                                className="rounded border-gray-300 text-blue-500"
                            />
                            Show Grid
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={settings.snapToGrid}
                                onChange={(e) => updateSetting('snapToGrid', e.target.checked)}
                                className="rounded border-gray-300 text-blue-500"
                            />
                            Snap to Grid
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={settings.showMiniMap}
                                onChange={(e) => updateSetting('showMiniMap', e.target.checked)}
                                className="rounded border-gray-300 text-blue-500"
                            />
                            Mini-Map
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={settings.showLegend}
                                onChange={(e) => updateSetting('showLegend', e.target.checked)}
                                className="rounded border-gray-300 text-blue-500"
                            />
                            Show Legend
                        </label>
                    </div>
                </div>
            </Section>

            {/* Node Settings Section */}
            <Section title="Node Settings" isOpen={openSections.has('node')} onToggle={() => toggleSection('node')}>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Width</label>
                            <input
                                type="number"
                                value={settings.nodeWidth}
                                onChange={(e) => updateSetting('nodeWidth', Number(e.target.value))}
                                min={4}
                                max={40}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Padding</label>
                            <input
                                type="number"
                                value={settings.nodePadding}
                                onChange={(e) => updateSetting('nodePadding', Number(e.target.value))}
                                min={4}
                                max={60}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-medium text-[var(--secondary-text)]">Node Width</label>
                                <span className="text-[10px] text-gray-500 font-mono">{settings.nodeWidth}px</span>
                            </div>
                            <input
                                type="range"
                                value={settings.nodeWidth}
                                onChange={(e) => updateSetting('nodeWidth', Number(e.target.value))}
                                min={4}
                                max={40}
                                step={2}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-medium text-[var(--secondary-text)]">Node Spacing</label>
                                <span className="text-[10px] text-gray-500 font-mono">{settings.nodePadding}px</span>
                            </div>
                            <input
                                type="range"
                                value={settings.nodePadding}
                                onChange={(e) => updateSetting('nodePadding', Number(e.target.value))}
                                min={4}
                                max={60}
                                step={5}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                            Opacity: {Math.round(settings.nodeOpacity * 100)}%
                        </label>
                        <input
                            type="range"
                            value={settings.nodeOpacity}
                            onChange={(e) => updateSetting('nodeOpacity', Number(e.target.value))}
                            min={0}
                            max={1}
                            step={0.05}
                            className="w-full"
                        />
                    </div>

                    <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                Radius: {settings.nodeBorderRadius}px
                            </label>
                            <input
                                type="range"
                                value={settings.nodeBorderRadius ?? 0}
                                onChange={(e) => updateSetting('nodeBorderRadius', Number(e.target.value))}
                                min={0}
                                max={20}
                                step={1}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                                Border: {Math.round((settings.nodeBorderOpacity ?? 0) * 100)}%
                            </label>
                            <input
                                type="range"
                                value={settings.nodeBorderOpacity ?? 0}
                                onChange={(e) => updateSetting('nodeBorderOpacity', Number(e.target.value))}
                                min={0}
                                max={1}
                                step={0.1}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            </Section>

            {/* Link Settings Section */}
            <Section title="Link Settings" isOpen={openSections.has('link')} onToggle={() => toggleSection('link')}>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">
                            Curvature: {settings.linkCurvature}
                        </label>
                        <input
                            type="range"
                            value={settings.linkCurvature}
                            onChange={(e) => updateSetting('linkCurvature', Number(e.target.value))}
                            min={0}
                            max={0.9} // At 1 it might overshoot? Standard is usually up to 0.8 or 0.9. Let's allow 0 to 1.
                            step={0.1}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-[var(--secondary-text)]">Link Opacity</label>
                            <span className="text-[10px] text-gray-500 font-mono">
                                {Math.round(settings.linkOpacity * 100)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            value={settings.linkOpacity}
                            onChange={(e) => updateSetting('linkOpacity', Number(e.target.value))}
                            min={0.1}
                            max={1}
                            step={0.05}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-2"
                        />
                        <div className="flex gap-1.5">
                            {[0.3, 0.45, 0.7].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => updateSetting('linkOpacity', val)}
                                    className={`flex-1 py-1 text-[10px] rounded border transition-all ${
                                        Math.abs(settings.linkOpacity - val) < 0.01 
                                            ? 'bg-blue-500 text-white border-blue-600' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {val === 0.3 ? 'Light' : val === 0.45 ? 'Medium' : 'Bold'} ({val * 100}%)
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={settings.linkGradient}
                            onChange={(e) => updateSetting('linkGradient', e.target.checked)}
                            className="rounded"
                        />
                        Use Gradient Links
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={settings.useFinancialTheme ?? false}
                            onChange={(e) => updateSetting('useFinancialTheme', e.target.checked)}
                            className="rounded"
                        />
                        <div>
                            <div>Financial Theme</div>
                            <div className="text-xs text-gray-500">Auto-color by category (Revenue=Green, Expense=Red)</div>
                        </div>
                    </label>

                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Blend Mode</label>
                        <select
                            value={settings.linkBlendMode ?? 'normal'}
                            onChange={(e) => updateSetting('linkBlendMode', e.target.value as any)}
                            className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                        >
                            <option value="normal">Normal</option>
                            <option value="multiply">Multiply (Darker Overlaps)</option>
                            <option value="screen">Screen (Lighter Overlaps)</option>
                            <option value="overlay">Overlay</option>
                        </select>
                    </div>
                </div>
            </Section>

            {/* Label Settings Section */}
            <Section title="Label Settings" isOpen={openSections.has('label')} onToggle={() => toggleSection('label')}>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Font Family</label>
                        <select
                            value={settings.labelFontFamily}
                            onChange={(e) => updateSetting('labelFontFamily', e.target.value)}
                            className="w-full px-2 py-2 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                        >
                            {GOOGLE_FONTS.map((font) => (
                                <option key={font.value} value={font.value}>{font.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Font Size</label>
                            <input
                                type="number"
                                value={settings.labelFontSize}
                                onChange={(e) => updateSetting('labelFontSize', Number(e.target.value))}
                                min={8}
                                max={24}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Position</label>
                            <select
                                value={settings.labelPosition}
                                onChange={(e) => updateSetting('labelPosition', e.target.value as any)}
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            >
                                <option value="auto">Auto (Recommended)</option>
                                <option value="above">Above</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="external">External</option>
                                <option value="inside">Inside</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={settings.labelBold}
                                onChange={(e) => updateSetting('labelBold', e.target.checked)}
                                className="rounded"
                            />
                            Bold
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={settings.labelItalic}
                                onChange={(e) => updateSetting('labelItalic', e.target.checked)}
                                className="rounded"
                            />
                            Italic
                        </label>
                    </div>
                </div>
            </Section>

            {/* Color Palette Section */}
            <Section title="Color Palette" isOpen={openSections.has('palette')} onToggle={() => toggleSection('palette')}>
                <div className="space-y-3">
                    {/* Logo Section */}
                    <div className="pb-3 border-b border-gray-100">
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-2">Logo Overlay</label>
                        <div className="space-y-2">
                            {!settings.logoUrl ? (
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                                updateSetting('logoUrl', ev.target?.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    className="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <img src={settings.logoUrl} className="w-8 h-8 object-contain rounded border border-gray-200" alt="Logo" />
                                            <span className="text-xs text-gray-500">Active Logo</span>
                                        </div>
                                        <button 
                                            onClick={() => updateSetting('logoUrl', undefined)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={settings.logoPosition}
                                            onChange={(e) => updateSetting('logoPosition', e.target.value as any)}
                                            className="text-[10px] p-1 border rounded bg-white"
                                        >
                                            <option value="top-left">Top Left</option>
                                            <option value="top-right">Top Right</option>
                                            <option value="bottom-left">Bottom Left</option>
                                            <option value="bottom-right">Bottom Right</option>
                                        </select>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-gray-400">Size:</span>
                                            <input 
                                                type="range" min="40" max="200" step="10"
                                                value={settings.logoSize}
                                                onChange={(e) => updateSetting('logoSize', Number(e.target.value))}
                                                className="w-full h-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Theme</label>
                        <select
                            value={settings.colorPalette}
                            onChange={(e) => handlePaletteChange(e.target.value)}
                            className="w-full px-2 py-2 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                        >
                            {palettes.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.isCustom ? '(Custom)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Palette Preview */}
                    <div className="flex gap-1 flex-wrap">
                        {palettes.find(p => p.id === settings.colorPalette)?.colors.slice(0, 8).map((color, i) => (
                            <div
                                key={i}
                                className="w-6 h-6 rounded border border-gray-200"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>

                    {/* Use as Default */}
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={defaultPaletteId === settings.colorPalette}
                            onChange={(e) => handleSetDefaultPalette(e.target.checked)}
                            className="rounded"
                        />
                        Use as Default
                    </label>

                    {/* Custom Palette Button */}
                    <button
                        onClick={() => setShowCustomPaletteModal(true)}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                        <Plus className="w-4 h-4" />
                        Create Custom Palette
                    </button>
                </div>
            </Section>

            {/* Templates Section */}
            <Section title="Templates" isOpen={openSections.has('templates')} onToggle={() => toggleSection('templates')}>
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowSaveTemplateModal(true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                            <Save className="w-4 h-4" />
                            Save Current
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {templates.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                <span className="text-sm">{t.name}</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleApplyTemplate(t)}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                        title="Apply"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                    {!t.id.startsWith('preset_') && (
                                        <button
                                            onClick={() => handleDeleteTemplate(t.id)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* Value Formatting Section */}
            <Section title="Value Formatting" isOpen={openSections.has('value')} onToggle={() => toggleSection('value')}>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Prefix</label>
                            <input
                                type="text"
                                value={settings.valuePrefix}
                                onChange={(e) => updateSetting('valuePrefix', e.target.value)}
                                placeholder="$"
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Suffix</label>
                            <input
                                type="text"
                                value={settings.valueSuffix}
                                onChange={(e) => updateSetting('valueSuffix', e.target.value)}
                                placeholder="M"
                                className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Decimal Places</label>
                        <select
                            value={settings.valueDecimals}
                            onChange={(e) => updateSetting('valueDecimals', Number(e.target.value) as 0 | 1 | 2 | -1)}
                            className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                        >
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={-1}>All</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--secondary-text)] mb-1">Value Display</label>
                        <select
                            value={settings.valueMode}
                            onChange={(e) => updateSetting('valueMode', e.target.value as 'absolute' | 'formatted' | 'short' | 'hidden')}
                            className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                        >
                            <option value="formatted">Formatted</option>
                            <option value="absolute">Absolute</option>
                            <option value="short">Short (K/M/B)</option>
                            <option value="hidden">Hidden</option>
                        </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={settings.showComparisonLine}
                            onChange={(e) => updateSetting('showComparisonLine', e.target.checked)}
                            className="rounded"
                        />
                        Show Comparison Line (% of total)
                    </label>
                </div>
            </Section>

            {/* Custom Palette Modal */}
            {showCustomPaletteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--card-bg)] rounded-lg p-6 w-96 max-w-[90vw] border border-[var(--border)]">
                        <h3 className="text-lg font-semibold mb-4 text-[var(--primary-text)]">Create Custom Palette</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--secondary-text)] mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newPaletteName}
                                    onChange={(e) => setNewPaletteName(e.target.value)}
                                    placeholder="My Palette"
                                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--secondary-text)] mb-2">
                                    Colors ({parseColorsFromString(newPaletteColors).length} colors)
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {(() => {
                                        const colors = parseColorsFromString(newPaletteColors);
                                        if (colors.length === 0) {
                                            return (
                                                <p className="text-sm text-gray-400 text-center py-4">
                                                    Click &quot;Add Color&quot; to start
                                                </p>
                                            );
                                        }
                                        return colors.map((color, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={color}
                                                    onChange={(e) => {
                                                        const newColors = [...colors];
                                                        newColors[index] = e.target.value;
                                                        setNewPaletteColors(newColors.join(', '));
                                                    }}
                                                    className="w-10 h-8 rounded cursor-pointer border border-[var(--border)]"
                                                />
                                                <input
                                                    type="text"
                                                    value={color}
                                                    onChange={(e) => {
                                                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                                            const newColors = [...colors];
                                                            newColors[index] = e.target.value;
                                                            setNewPaletteColors(newColors.join(', '));
                                                        }
                                                    }}
                                                    className="flex-1 px-2 py-1 text-sm font-mono border border-[var(--border)] rounded bg-[var(--card-bg)] text-[var(--primary-text)]"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newColors = colors.filter((_, i) => i !== index);
                                                        setNewPaletteColors(newColors.join(', '));
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Remove color"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ));
                                    })()}
                                </div>
                                <button
                                    onClick={() => {
                                        const colors = parseColorsFromString(newPaletteColors);
                                        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                                        setNewPaletteColors([...colors, randomColor].join(', '));
                                    }}
                                    className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100  text-gray-700  rounded hover:bg-gray-200 :bg-gray-600 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    Add Color
                                </button>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        setShowCustomPaletteModal(false);
                                        setNewPaletteName('');
                                        setNewPaletteColors('');
                                    }}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveCustomPalette}
                                    disabled={parseColorsFromString(newPaletteColors).length < 2 || !newPaletteName}
                                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Template Modal */}
            {showSaveTemplateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--card-bg)] rounded-lg p-6 w-96 max-w-[90vw] border border-[var(--border)]">
                        <h3 className="text-lg font-semibold mb-4 text-[var(--primary-text)]">Save Template</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--secondary-text)] mb-1">Template Name</label>
                                <input
                                    type="text"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="My Template"
                                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--card-bg)] text-[var(--primary-text)]"
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                This will save all current styling settings (fonts, colors, sizes) but not the diagram data.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setShowSaveTemplateModal(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Collapsible section component
function Section({
    title,
    isOpen,
    onToggle,
    children
}: {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border)] overflow-hidden">
            <button
                onClick={(e) => { e.preventDefault(); onToggle(); }}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-[var(--primary-text)] hover:bg-[var(--hover-bg)] focus:outline-none"
            >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {title}
            </button>
            <div className={`border-t border-gray-200 transition-all duration-200 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 p-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                {children}
            </div>
        </div>
    );
}
