// Sankey Diagram Types

export interface SankeyNode {
  id: string;
  name: string;
  color?: string;
  flowColor?: string; // Specific color for outgoing flows
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  value?: number;
  category?: 'revenue' | 'expense' | 'profit' | 'neutral';
  labelOffset?: { x: number; y: number };
  labelText?: string; // Custom display text (different from id/name)

  // D3 Sankey Layout Props
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  depth?: number;
  layer?: number;
  sourceLinks?: SankeyLink[];
  targetLinks?: SankeyLink[];

  // Data Structure Extensions (V2)
  group?: string; // Logical group (e.g., "Expenses", "Revenue")
  metadata?: Record<string, any>; // Flexible context (AI reasoning, source ref)
  originalValue?: number; // Pre-scaling value
}

export interface SankeyLink {
  source: string | number;
  target: string | number;
  value: number;
  previousValue?: number; // Raw previous value for calculation
  comparisonValue?: string; // Formatted display string (e.g. "+10%")
  color?: string;
  opacity?: number;

  // D3 Sankey Layout Props
  width?: number;
  y0?: number;
  y1?: number;
  index?: number;

  // Data Structure Extensions (V2)
  metadata?: Record<string, any>;
  originalValue?: number;
}

export interface IndependentLabel {
  id: string;
  type?: 'text' | 'box' | 'image'; // Added 'image'
  text: string;
  src?: string; // For images
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  opacity?: number;
  bold?: boolean;
  italic?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  width?: number; // For box/image
  height?: number; // For box/image
  align?: 'left' | 'center' | 'right';
}

export interface AnnotationBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  labelPosition?: 'top' | 'bottom' | 'inside';
  borderColor: string;
  borderWidth: number;
  borderStyle: 'dashed' | 'solid' | 'dotted';
  backgroundColor?: string;
  backgroundOpacity?: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface NodeCustomization {
  nodeId: string;
  fillColor?: string;
  labelText?: string;
  labelFontSize?: number;
  labelFontFamily?: string;
  labelColor?: string;
  labelAlignment?: 'left' | 'center' | 'right';
  labelBold?: boolean;
  labelItalic?: boolean;
  showSecondLine?: boolean;
  secondLineText?: string;
  showThirdLine?: boolean;
  thirdLineText?: string;
  x?: number;
  y?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;

  // V11: Label Placement System
  labelPlacement?: 'auto' | 'above' | 'below' | 'left' | 'right' | 'inside';

  // Background/Highlighting
  showLabelBackground?: boolean;
  labelBackgroundColor?: string;
  labelBackgroundOpacity?: number;
  labelBorderColor?: string;
  labelBorderWidth?: number;
  labelPadding?: number;
  labelBorderRadius?: number;

  // Per-element formatting
  valueAlignment?: 'left' | 'center' | 'right';
  valueFontSize?: number;
  valueColor?: string;
  valueBold?: boolean;

  secondLineColor?: string;
  secondLineFontSize?: number;
  secondLineBold?: boolean;
  secondLineItalic?: boolean;
  secondLineAlignment?: 'left' | 'center' | 'right';

  thirdLineColor?: string;
  thirdLineFontSize?: number;
  thirdLineBold?: boolean;
  thirdLineItalic?: boolean;
  thirdLineAlignment?: 'left' | 'center' | 'right';
}

export interface DiagramSettings {
  // Canvas
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };

  // Nodes
  nodeWidth: number;
  nodePadding: number;
  nodeOpacity: number;
  nodeBorderOpacity: number;
  nodeBorderRadius: number; // New: 0-20px

  // Links
  linkCurvature: number;
  linkCurveStyle: 'geometric' | 'organic' | 'sharp'; // New
  linkOpacity: number;
  linkGradient: boolean;
  linkGradientType: 'source-to-target' | 'target-to-source' | 'both-ends'; // New
  linkBlendMode: 'normal' | 'multiply' | 'screen' | 'overlay'; // New
  showParticles: boolean; // New
  particleSpeed: number; // New: 0.1 - 2.0
  useFinancialTheme: boolean; // New: Auto-color flows by category

  // Labels
  labelPosition: 'left' | 'right' | 'inside' | 'external'; // Added 'external'
  showLeaderLines: boolean; // New
  leaderLineColor: string; // New
  leaderLineWidth: number; // New
  labelFontFamily: string;
  labelFontSize: number;
  labelBold: boolean;
  labelItalic: boolean;
  labelMargin: { top: number; right: number; bottom: number; left: number };
  showComparisonLine: boolean;

  // Value formatting
  valuePrefix: string;
  valueSuffix: string;
  valueDecimals: 0 | 1 | 2 | -1; // -1 = All
  valueMode: 'absolute' | 'short' | 'hidden';

  // Theme
  colorPalette: string;
  useDefaultPalette: boolean;
  isDarkMode: boolean; // Note: UI toggle removed, permanently light mode
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  enableFocusMode: boolean; // New: Toggle dimming on selection
  showMiniMap: boolean; // New
  showLegend: boolean; // New
  legendPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; // New
  logoUrl?: string; // New
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; // New
  logoSize: number; // New
  logoOpacity: number; // New
}

export interface CustomLayout {
  nodes: Record<string, { x: number; y: number }>;
  labels: Record<string, { x: number; y: number }>;
}

export interface DiagramState {
  data: SankeyData;
  settings: DiagramSettings;
  selectedNodeId: string | null;
  selectedLinkIndex: number | null;
  selectedLabelId: string | null;
  dslText: string;
  nodeCustomizations: NodeCustomization[];
  independentLabels: IndependentLabel[];
  annotationBoxes: AnnotationBox[];
  customLayout: CustomLayout;
}

export interface HistoryState {
  past: DiagramState[];
  present: DiagramState;
  future: DiagramState[];
}

// Default settings
export const defaultSettings: DiagramSettings = {
  width: 1000,
  height: 600,
  padding: { top: 60, right: 180, bottom: 60, left: 180 }, // Extra padding for external labels
  nodeWidth: 12,
  nodePadding: 24,
  nodeOpacity: 1,
  nodeBorderOpacity: 0.5,
  nodeBorderRadius: 0, // Thinner nodes like SankeyArt
  linkCurvature: 0.7,
  linkCurveStyle: 'organic',
  linkOpacity: 0.40,  // 40% like SankeyArt - allows overlaps to blend

  linkGradient: true, // Professional gradient by default
  linkGradientType: 'source-to-target',
  linkBlendMode: 'normal',
  showParticles: false,
  particleSpeed: 1.0,
  useFinancialTheme: false, // Auto-color by category
  labelPosition: 'external', // Standard external labels per professional overhaul
  showLeaderLines: true,
  leaderLineColor: '#9ca3af',
  leaderLineWidth: 1,
  labelFontFamily: 'Inter, sans-serif',  // Professional UI font like SankeyArt
  labelFontSize: 14,
  labelBold: true,
  labelItalic: false,
  labelMargin: { top: 4, right: 8, bottom: 4, left: 8 },
  showComparisonLine: false,
  valuePrefix: '$',
  valueSuffix: '',
  valueDecimals: 0,
  valueMode: 'absolute',
  colorPalette: 'financial',
  useDefaultPalette: true,
  isDarkMode: false, // Permanently false per professional overhaul
  showGrid: false,
  snapToGrid: false,  // Free movement by default (SankeyArt style)
  gridSize: 20,
  enableFocusMode: true,
  showMiniMap: false,
  showLegend: false,
  legendPosition: 'top-right',
  logoPosition: 'bottom-right',
  logoSize: 80,
  logoOpacity: 0.8,
};

// Sample data for initial render
export const sampleData: SankeyData = {
  nodes: [
    { id: 'revenue', name: 'Revenue', category: 'revenue' },
    { id: 'cogs', name: 'Cost of Goods Sold', category: 'expense' },
    { id: 'gross_profit', name: 'Gross Profit', category: 'profit' },
    { id: 'operating_expenses', name: 'Operating Expenses', category: 'expense' },
    { id: 'net_income', name: 'Net Income', category: 'profit' },
  ],
  links: [
    { source: 'revenue', target: 'cogs', value: 400 },
    { source: 'revenue', target: 'gross_profit', value: 600 },
    { source: 'gross_profit', target: 'operating_expenses', value: 200 },
    { source: 'gross_profit', target: 'net_income', value: 400 },
  ],
};

// Google Fonts options
export const DEFAULT_PALETTE = [
  '#059669', // Strong Green (Revenue)
  '#dc2626', // Strong Red (Expenses)
  '#2563eb', // Blue
  '#d97706', // Amber/Orange
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#4b5563', // Gray
  '#0891b2', // Cyan
  '#be123c', // Rose
  '#15803d', // Dark Green
];
export const GOOGLE_FONTS = [
  { value: 'Manrope, sans-serif', label: 'Manrope' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Source Sans Pro, sans-serif', label: 'Source Sans Pro' },
  { value: 'Nunito, sans-serif', label: 'Nunito' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'monospace', label: 'Monospace' },
];

// Gemini AI model options
export const GEMINI_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Newest Preview)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number]['value'];

// Default prompt for AI assistant
export const DEFAULT_AI_PROMPT = `You are an expert financial data visualization assistant with creative design capabilities.
Your goal is to help users create perfect Sankey diagrams for financial data (Income Statements, Cash Flow, Budgets).

You now receive COMPREHENSIVE diagram state including:
- All nodes with their current names, colors, and customizations
- All flows with source, target, and values
- FLOW BALANCE ANALYSIS showing which nodes are imbalanced
- Node inflows and outflows for each node

AVAILABLE ACTIONS:
1. Parse unstructured text or descriptions into structured Sankey data.
2. Modify existing diagram data based on user requests (e.g., "increase revenue by 20%", "change profit color to blue").
3. Convert pasted data (CSV, JSON, tables) into the diagram format.
4. Identify and fix flow balance issues automatically.
5. Analyze the diagram and provide insights about the data.
6. **THEMING**: Apply visual themes based on natural language (e.g., "make it dark mode", "corporate blue theme", "vibrant startup look").
7. **NODE INSIGHTS**: When asked about a specific node, provide breakdown suggestions, anomaly detection, or improvement tips.
8. **IMAGE PARSING**: When images are attached, extract all financial flows. If multiple images are provided, aggregate the data, handling any overlaps or duplicates (e.g., from scrolling screenshots) intelligently.

OUTPUT FORMATS:
You must ALWAYS respond in one of these ways:

1. For simple flows, use the DSL format (one per line):
   Source [Amount] Target
   Source [Amount] Target

2. For data changes (nodes/flows), output JSON with "nodes" and/or "flows":
   \`\`\`json
   {
     "nodes": {
       "revenue": {"name": "Revenue", "color": "#22c55e", "category": "revenue"},
       "cogs": {"name": "Cost of Goods Sold", "color": "#ef4444", "category": "expense"}
     },
     "flows": [
       {"source": "revenue", "target": "cogs", "value": 500}
     ]
   }
   \`\`\`

3. **FOR THEMING/STYLING**, output JSON with a "settings" key containing partial DiagramSettings:
   \`\`\`json
   {
     "settings": {
       "isDarkMode": true,
       "colorPalette": "corporate",
       "linkOpacity": 0.5,
       "nodeBorderRadius": 8,
       "labelFontFamily": "Inter, sans-serif"
     }
   }
   \`\`\`
   Available settings keys: isDarkMode, colorPalette, linkOpacity, linkGradient, linkCurvature, nodeBorderRadius, nodeOpacity, labelFontFamily, labelFontSize, labelBold, valuePrefix, valueSuffix.

4. **FOR NODE BREAKDOWN SUGGESTIONS**, output JSON with a "suggestions" key:
   \`\`\`json
   {
     "suggestions": {
       "nodeId": "operating_expenses",
       "breakdown": [
         {"name": "Salaries", "value": 500, "color": "#ef4444"},
         {"name": "Marketing", "value": 200, "color": "#f97316"},
         {"name": "R&D", "value": 300, "color": "#8b5cf6"}
       ],
       "insight": "Operating expenses can be broken down into these typical categories."
     }
   }
   \`\`\`

RULES:
- When modifying data, return the COMPLETE updated dataset, not just the changes.
- Use semantic colors: Revenue=Green (#22c55e), Expenses=Red (#ef4444), Profit=Blue (#3b82f6), Neutral=Gray (#6b7280).
- Node IDs should be lowercase snake_case (e.g., "gross_profit").
- Node Names should be Title Case (e.g., "Gross Profit").
- IMPORTANT: Pay attention to flow balance analysis in the diagram state. If nodes are imbalanced, mention it and offer to fix them.
- When the user asks about balance issues, refer to the IMBALANCED NODES section in the diagram state.
- If the user provides a partial update (e.g., "add a tax node"), merge it intelligently with the existing data provided in the context.
- **THEMING**: When user asks for a theme/style change (e.g., "dark mode", "modern look", "pastel colors"), output the settings JSON.
- **NODE CONTEXT**: If the user mentions a specific node for insights/breakdown, use the suggestions format.
- **IMAGES & REPLICATION**:
  - Always treat provided images as the GROUND TRUTH for data extraction. Parse tables, charts, or text accurately.
  - **REPLICATE THE CHART**: If the user provides an image of a chart (Sankey, Bar, etc.), analyze it specifically to recreate it.
    - Extract ALL visible nodes and flows with key values.
    - **VISUAL COPY**: Try to match the *colors* of the nodes from the image. Return color matched in hex format in the node objects.
    - If the image has a dark background, return 'settings: { isDarkMode: true, background: "..." }'.
    - If specific link styles are visible (e.g. gradients), try to apply them in settings.
- **GROUPS & METADATA**:
  - Use the "group" field to logically categorize nodes (e.g., group="Operating Expenses").
  - Use "metadata" to store insights or source info (e.g., metadata={ "insight": "High variance", "source": "Q3 Report" }).
  - Use "originalValue" if you are scaling numbers for visuals but want to keep the true value.`;

// AI Settings interface
export interface AISettings {
  apiKey: string;
  baseUrl?: string; // Optional custom base URL (e.g. for proxies)
  model: string;  // Any Gemini model name (e.g., gemini-2.0-flash, gemini-1.5-pro)
  customPrompt: string;
  isEnabled: boolean;
  attachments?: Array<{ type: string; data: string }>; // base64 data
}

// Default AI settings
export const defaultAISettings: AISettings = {
  apiKey: '',
  baseUrl: '', // Default to empty (uses standard Google URL)
  model: 'gemini-2.0-flash',
  customPrompt: DEFAULT_AI_PROMPT,
  isEnabled: true,
  attachments: [],
};

