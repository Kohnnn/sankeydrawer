// Color Palettes Module
// Default and custom palettes for Sankey nodes

export interface ColorPalette {
    id: string;
    name: string;
    colors: string[];
    isCustom?: boolean;
}

// Default palettes
export const DEFAULT_PALETTES: ColorPalette[] = [
    {
        id: 'categories',
        name: 'Categories',
        colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
    },
    {
        id: 'tableau10',
        name: 'Tableau 10',
        colors: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'],
    },
    {
        id: 'dark',
        name: 'Dark',
        colors: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#f39c12', '#00b894', '#6c5ce7', '#fd79a8', '#00cec9'],
    },
    {
        id: 'varied',
        name: 'Varied',
        colors: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'],
    },
    {
        id: 'financial',
        name: 'Financial',
        colors: ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'],
    },
    {
        id: 'monochrome',
        name: 'Monochrome',
        colors: ['#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6', '#f2f2f2'],
    },
    {
        id: 'brand',
        name: 'Brand Colors',
        colors: ['#DA2B1F', '#00308C', '#00FF00', '#F9C8C5', '#6688C2', '#334EA6', '#EB5F59', '#B3C2E0'],
    },
    {
        id: 'vietnamese',
        name: 'Vietnamese Financial',
        colors: ['#2563eb', '#dc2626', '#16a34a', '#6b7280', '#f59e0b', '#7c3aed', '#db2777', '#0891b2'],
    },
];

const STORAGE_KEY = 'sankey-custom-palettes';
const DEFAULT_PALETTE_KEY = 'sankey-default-palette';

// Get all palettes (default + custom)
export function getAllPalettes(): ColorPalette[] {
    const customPalettes = getCustomPalettes();
    return [...DEFAULT_PALETTES, ...customPalettes];
}

// Get custom palettes from localStorage
export function getCustomPalettes(): ColorPalette[] {
    if (typeof window === 'undefined') return [];

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    try {
        return JSON.parse(saved);
    } catch {
        return [];
    }
}

// Save a custom palette
export function saveCustomPalette(palette: Omit<ColorPalette, 'isCustom'>): void {
    const customs = getCustomPalettes();
    const existing = customs.findIndex(p => p.id === palette.id);

    const newPalette: ColorPalette = { ...palette, isCustom: true };

    if (existing >= 0) {
        customs[existing] = newPalette;
    } else {
        customs.push(newPalette);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
}

// Delete a custom palette
export function deleteCustomPalette(id: string): void {
    const customs = getCustomPalettes().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
}

// Get default palette ID
export function getDefaultPaletteId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(DEFAULT_PALETTE_KEY);
}

// Set default palette
export function setDefaultPalette(id: string | null): void {
    if (id) {
        localStorage.setItem(DEFAULT_PALETTE_KEY, id);
    } else {
        localStorage.removeItem(DEFAULT_PALETTE_KEY);
    }
}

// Get color from palette by index (cyclic)
export function getColorFromPalette(palette: ColorPalette, index: number): string {
    return palette.colors[index % palette.colors.length];
}

// Find palette by ID
export function getPaletteById(id: string): ColorPalette | undefined {
    return getAllPalettes().find(p => p.id === id);
}

// Generate a smart palette based on a base color and harmony mode
export function generateSmartPalette(baseColorHex: string, mode: 'analogous' | 'monochromatic' | 'triadic' | 'complementary', count: number = 8): string[] {
    // Simple HSL conversion helper
    const hexToHsl = (hex: string): [number, number, number] => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0;
        let s;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h * 360, s * 100, l * 100];
    };

    const hslToHex = (h: number, s: number, l: number): string => {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };

    const [h, s, l] = hexToHsl(baseColorHex);
    const colors: string[] = [];

    for (let i = 0; i < count; i++) {
        let newH = h;
        let newS = s;
        let newL = l;

        switch (mode) {
            case 'monochromatic':
                // Vary lightness and saturation
                newL = Math.max(10, Math.min(95, l + (i - count / 2) * 10)); // Spread lightness
                newS = Math.max(20, Math.min(100, s + (i % 2 === 0 ? 10 : -10))); // Alternating saturation
                break;
            case 'analogous':
                // Shift hue slightly
                newH = (h + (i - count / 2) * 15 + 360) % 360;
                break;
            case 'triadic':
                // Shift hue by 120 degrees
                newH = (h + (i % 3) * 120 + 360) % 360;
                // Vary lightness slightly to differentiate same hues
                newL = Math.max(20, Math.min(80, l + (((i / 3) | 0) * 10)));
                break;
            case 'complementary':
                // Shift hue by 180
                newH = (h + (i % 2) * 180 + 360) % 360;
                newL = Math.max(20, Math.min(80, l + (i * 5)));
                break;
        }

        colors.push(hslToHex(newH, newS, newL));
    }

    return colors;
}

// Parse colors from a string (comma or newline separated)
export function parseColorsFromString(input: string): string[] {
    return input
        .split(/[\n,]/)
        .map(c => c.trim())
        .filter(c => /^#[0-9A-Fa-f]{6}$/i.test(c));
}
