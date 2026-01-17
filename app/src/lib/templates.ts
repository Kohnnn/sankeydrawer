// Templates Module
// Save/load styling configurations (not data)

import { DiagramSettings, defaultSettings } from '@/types/sankey';

export interface DiagramTemplate {
    id: string;
    name: string;
    createdAt: string;
    settings: Partial<DiagramSettings>;
    paletteId?: string;
}

const STORAGE_KEY = 'sankey-templates';

// Get all templates from localStorage
export function getTemplates(): DiagramTemplate[] {
    if (typeof window === 'undefined') return [];

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    try {
        return JSON.parse(saved);
    } catch {
        return [];
    }
}

// Save a template
export function saveTemplate(name: string, settings: DiagramSettings, paletteId?: string): DiagramTemplate {
    const templates = getTemplates();

    const template: DiagramTemplate = {
        id: `template_${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        settings: {
            // Only save styling settings, not dimensions
            nodeWidth: settings.nodeWidth,
            nodePadding: settings.nodePadding,
            nodeOpacity: settings.nodeOpacity,
            nodeBorderOpacity: settings.nodeBorderOpacity,
            linkCurvature: settings.linkCurvature,
            linkOpacity: settings.linkOpacity,
            labelPosition: settings.labelPosition,
            labelFontFamily: settings.labelFontFamily,
            labelFontSize: settings.labelFontSize,
            labelBold: settings.labelBold,
            labelItalic: settings.labelItalic,
            labelMargin: settings.labelMargin,
            valuePrefix: settings.valuePrefix,
            valueSuffix: settings.valueSuffix,
            valueDecimals: settings.valueDecimals,
            valueMode: settings.valueMode,
        },
        paletteId,
    };

    templates.push(template);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));

    return template;
}

// Update an existing template
export function updateTemplate(id: string, updates: Partial<DiagramTemplate>): void {
    const templates = getTemplates();
    const index = templates.findIndex(t => t.id === id);

    if (index >= 0) {
        templates[index] = { ...templates[index], ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }
}

// Delete a template
export function deleteTemplate(id: string): void {
    const templates = getTemplates().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// Apply template settings to current settings
export function applyTemplate(template: DiagramTemplate, currentSettings: DiagramSettings): DiagramSettings {
    return {
        ...currentSettings,
        ...template.settings,
    };
}

// Get template by ID
export function getTemplateById(id: string): DiagramTemplate | undefined {
    return getTemplates().find(t => t.id === id);
}

// Built-in template presets
export const PRESET_TEMPLATES: DiagramTemplate[] = [
    {
        id: 'preset_minimal',
        name: 'Minimal',
        createdAt: '2024-01-01',
        settings: {
            nodeWidth: 15,
            nodePadding: 8,
            nodeOpacity: 0.9,
            nodeBorderOpacity: 0,
            linkOpacity: 0.3,
            labelFontSize: 11,
            labelBold: false,
            valueMode: 'hidden',
        },
    },
    {
        id: 'preset_professional',
        name: 'Professional',
        createdAt: '2024-01-01',
        settings: {
            nodeWidth: 20,
            nodePadding: 12,
            nodeOpacity: 1,
            nodeBorderOpacity: 0.5,
            linkOpacity: 0.5,
            labelFontSize: 12,
            labelBold: true,
            valuePrefix: '$',
            valueMode: 'short',
        },
    },
    {
        id: 'preset_bold',
        name: 'Bold',
        createdAt: '2024-01-01',
        settings: {
            nodeWidth: 30,
            nodePadding: 15,
            nodeOpacity: 1,
            nodeBorderOpacity: 1,
            linkOpacity: 0.7,
            labelFontSize: 14,
            labelBold: true,
            valueMode: 'absolute',
        },
    },
];
