'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { DiagramState, DiagramSettings, SankeyData, SankeyNode, SankeyLink, IndependentLabel, NodeCustomization, CustomLayout, defaultSettings, sampleData } from '@/types/sankey';
import { parseDSL, serializeToDSL } from '@/lib/dsl-parser';

// Action types
type DiagramAction =
    | { type: 'SET_DATA'; payload: SankeyData }
    | { type: 'SET_DSL'; payload: string }
    | { type: 'UPDATE_SETTINGS'; payload: Partial<DiagramSettings> }
    | { type: 'SELECT_NODE'; payload: string | null }
    | { type: 'SELECT_LINK'; payload: number | null }
    | { type: 'SELECT_LABEL'; payload: string | null }
    | { type: 'UPDATE_NODE'; payload: { id: string; updates: Partial<SankeyNode> } }
    | { type: 'UPDATE_LINK'; payload: { index: number; updates: Partial<SankeyLink> } }
    | { type: 'MOVE_NODE'; payload: { id: string; x: number; y: number } }
    | { type: 'MOVE_LABEL'; payload: { nodeId: string; x: number; y: number } }
    | { type: 'ADD_NODE'; payload: SankeyNode }
    | { type: 'ADD_LINK'; payload: SankeyLink }
    | { type: 'ADD_INDEPENDENT_LABEL'; payload: IndependentLabel }
    | { type: 'UPDATE_INDEPENDENT_LABEL'; payload: { id: string; updates: Partial<IndependentLabel> } }
    | { type: 'DELETE_INDEPENDENT_LABEL'; payload: string }
    | { type: 'DELETE_NODE'; payload: string }
    | { type: 'DELETE_LINK'; payload: number }
    | { type: 'SET_NODE_CUSTOMIZATION'; payload: NodeCustomization }
    | { type: 'UPDATE_NODE_CUSTOMIZATION'; payload: { nodeId: string; updates: Partial<NodeCustomization> } }
    | { type: 'RESET_NODE_POSITIONS' }
    | { type: 'RESET_LABEL_POSITIONS' }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESET_SESSION' }
    | { type: 'LOAD_STATE'; payload: DiagramState }
    | { type: 'APPLY_AI_CHANGES'; payload: Partial<DiagramState> }
    | { type: 'UPDATE_LAYOUT'; payload: { id: string; type: 'node' | 'label'; x?: number; y?: number } };

interface HistoryState {
    past: DiagramState[];
    present: DiagramState;
    future: DiagramState[];
}

// Initial state
const initialDiagramState: DiagramState = {
    data: sampleData,
    settings: defaultSettings,
    selectedNodeId: null,
    selectedLinkIndex: null,
    selectedLabelId: null,
    dslText: serializeToDSL(sampleData),
    nodeCustomizations: [],
    independentLabels: [],
    customLayout: { nodes: {}, labels: {} },
};

const initialHistoryState: HistoryState = {
    past: [],
    present: initialDiagramState,
    future: [],
};

// Reducer with undo/redo support
function historyReducer(state: HistoryState, action: DiagramAction): HistoryState {
    const { past, present, future } = state;

    if (action.type === 'UNDO') {
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, -1);
        return { past: newPast, present: previous, future: [present, ...future] };
    }

    if (action.type === 'REDO') {
        if (future.length === 0) return state;
        const next = future[0];
        const newFuture = future.slice(1);
        return { past: [...past, present], present: next, future: newFuture };
    }

    if (action.type === 'RESET_SESSION') {
        return initialHistoryState;
    }

    if (action.type === 'LOAD_STATE') {
        // Merge with defaults to handle missing new properties
        const loaded = {
            ...initialDiagramState,
            ...action.payload,
            settings: { ...defaultSettings, ...action.payload.settings, isDarkMode: false },
        };
        return { past: [], present: loaded, future: [] };
    }

    const newPresent = diagramReducer(present, action);
    if (newPresent === present) return state;

    const newPast = [...past, present].slice(-50);
    return { past: newPast, present: newPresent, future: [] };
}

function diagramReducer(state: DiagramState, action: DiagramAction): DiagramState {
    switch (action.type) {
        case 'SET_DATA': {
            const dslText = serializeToDSL(action.payload);
            return { ...state, data: action.payload, dslText };
        }

        case 'SET_DSL': {
            const parsed = parseDSL(action.payload);
            if (parsed) {
                return { ...state, dslText: action.payload, data: parsed };
            }
            return { ...state, dslText: action.payload };
        }

        case 'UPDATE_SETTINGS':
            return { ...state, settings: { ...state.settings, ...action.payload } };

        case 'SELECT_NODE':
            return { ...state, selectedNodeId: action.payload, selectedLinkIndex: null, selectedLabelId: null };

        case 'SELECT_LINK':
            return { ...state, selectedLinkIndex: action.payload, selectedNodeId: null, selectedLabelId: null };

        case 'SELECT_LABEL':
            return { ...state, selectedLabelId: action.payload, selectedNodeId: null, selectedLinkIndex: null };

        case 'UPDATE_NODE': {
            const { id: oldId, updates } = action.payload;

            // If name is being updated, generate new ID (same logic as createNode in dsl-parser.ts)
            const newId = updates.name
                ? updates.name.toLowerCase().replace(/\s+/g, '_')
                : oldId;

            // Update the node with new ID if name changed
            const nodes = state.data.nodes.map((n) =>
                n.id === oldId ? { ...n, ...updates, id: newId } : n
            );

            // Update all links that reference this node
            const links = state.data.links.map((l) => ({
                ...l,
                source: l.source === oldId ? newId : l.source,
                target: l.target === oldId ? newId : l.target,
            }));

            // Update customizations that reference this node
            const nodeCustomizations = state.nodeCustomizations.map((c) =>
                c.nodeId === oldId ? { ...c, nodeId: newId } : c
            );

            // Update custom layout entries
            const customLayout = { ...state.customLayout };
            if (oldId !== newId) {
                // Migrate node position
                if (customLayout.nodes[oldId]) {
                    customLayout.nodes = {
                        ...customLayout.nodes,
                        [newId]: customLayout.nodes[oldId]
                    };
                    delete customLayout.nodes[oldId];
                }
                // Migrate label position
                if (customLayout.labels[oldId]) {
                    customLayout.labels = {
                        ...customLayout.labels,
                        [newId]: customLayout.labels[oldId]
                    };
                    delete customLayout.labels[oldId];
                }
            }

            const newData = { nodes, links };
            const dslText = serializeToDSL(newData);

            return {
                ...state,
                data: newData,
                dslText,
                nodeCustomizations,
                customLayout,
                selectedNodeId: state.selectedNodeId === oldId ? newId : state.selectedNodeId
            };
        }

        case 'UPDATE_LINK': {
            const links = state.data.links.map((l, i) =>
                i === action.payload.index ? { ...l, ...action.payload.updates } : l
            );
            return { ...state, data: { ...state.data, links } };
        }

        case 'MOVE_NODE': {
            const customLayout = {
                ...state.customLayout,
                nodes: {
                    ...state.customLayout.nodes,
                    [action.payload.id]: { x: action.payload.x, y: action.payload.y },
                },
            };
            return { ...state, customLayout };
        }

        case 'MOVE_LABEL': {
            const customLayout = {
                ...state.customLayout,
                labels: {
                    ...state.customLayout.labels,
                    [action.payload.nodeId]: { x: action.payload.x, y: action.payload.y }, // Now storing offsets as x,y
                },
            };
            return { ...state, customLayout };
        }

        case 'ADD_NODE': {
            const nodes = [...state.data.nodes, action.payload];
            return { ...state, data: { ...state.data, nodes } };
        }

        case 'ADD_LINK': {
            // Auto-create nodes for source/target if they don't exist
            let nodes = [...state.data.nodes];
            const sourceId = typeof action.payload.source === 'string' ? action.payload.source : '';
            const targetId = typeof action.payload.target === 'string' ? action.payload.target : '';

            if (sourceId && !nodes.find(n => n.id === sourceId)) {
                nodes.push({ id: sourceId, name: sourceId });
            }
            if (targetId && !nodes.find(n => n.id === targetId)) {
                nodes.push({ id: targetId, name: targetId });
            }

            const links = [...state.data.links, action.payload];
            return { ...state, data: { ...state.data, nodes, links } };
        }

        case 'DELETE_NODE': {
            const nodeId = action.payload;
            const nodes = state.data.nodes.filter(n => n.id !== nodeId);
            // Also remove any links connected to this node
            const links = state.data.links.filter(l => {
                const source = typeof l.source === 'string' ? l.source : state.data.nodes[l.source as number]?.id;
                const target = typeof l.target === 'string' ? l.target : state.data.nodes[l.target as number]?.id;
                return source !== nodeId && target !== nodeId;
            });
            // Remove customizations for this node
            const nodeCustomizations = state.nodeCustomizations.filter(c => c.nodeId !== nodeId);
            // Remove layout entries
            const customLayout = { ...state.customLayout };
            delete customLayout.nodes[nodeId];
            delete customLayout.labels[nodeId];
            return {
                ...state,
                data: { ...state.data, nodes, links },
                nodeCustomizations,
                customLayout,
                selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
            };
        }

        case 'DELETE_LINK': {
            const links = state.data.links.filter((_, i) => i !== action.payload);
            return { ...state, data: { ...state.data, links } };
        }

        case 'SET_NODE_CUSTOMIZATION': {
            const existing = state.nodeCustomizations.findIndex(c => c.nodeId === action.payload.nodeId);
            let nodeCustomizations;
            if (existing >= 0) {
                nodeCustomizations = state.nodeCustomizations.map((c, i) =>
                    i === existing ? { ...c, ...action.payload } : c
                );
            } else {
                nodeCustomizations = [...state.nodeCustomizations, action.payload];
            }
            return { ...state, nodeCustomizations };
        }

        case 'UPDATE_NODE_CUSTOMIZATION': {
            const { nodeId, updates } = action.payload;
            const existing = state.nodeCustomizations.find(c => c.nodeId === nodeId);
            let nodeCustomizations;
            if (existing) {
                nodeCustomizations = state.nodeCustomizations.map(c =>
                    c.nodeId === nodeId ? { ...c, ...updates } : c
                );
            } else {
                nodeCustomizations = [...state.nodeCustomizations, { nodeId, ...updates }];
            }
            return { ...state, nodeCustomizations };
        }

        case 'RESET_NODE_POSITIONS': {
            return {
                ...state,
                customLayout: { ...state.customLayout, nodes: {} }
            };
        }

        case 'RESET_LABEL_POSITIONS': {
            return {
                ...state,
                customLayout: { ...state.customLayout, labels: {} }
            };
        }

        case 'ADD_INDEPENDENT_LABEL': {
            return {
                ...state,
                independentLabels: [...state.independentLabels, action.payload]
            };
        }

        case 'UPDATE_INDEPENDENT_LABEL': {
            const independentLabels = state.independentLabels.map(l =>
                l.id === action.payload.id ? { ...l, ...action.payload.updates } : l
            );
            return { ...state, independentLabels };
        }

        case 'DELETE_INDEPENDENT_LABEL': {
            const independentLabels = state.independentLabels.filter(l => l.id !== action.payload);
            return { ...state, independentLabels };
        }

        // ... intermediate cases ...

        case 'UPDATE_LAYOUT': {
            const { id, type, x, y } = action.payload;
            const newCustomLayout = { ...state.customLayout };

            if (type === 'node') {
                if (x !== undefined && y !== undefined) {
                    newCustomLayout.nodes = { ...newCustomLayout.nodes, [id]: { x, y } };
                } else {
                    // Remove the entry if undefined
                    const { [id]: _, ...rest } = newCustomLayout.nodes;
                    newCustomLayout.nodes = rest;
                }
            } else if (type === 'label') {
                if (x !== undefined && y !== undefined) {
                    newCustomLayout.labels = { ...newCustomLayout.labels, [id]: { x, y } };
                } else {
                    const { [id]: _, ...rest } = newCustomLayout.labels;
                    newCustomLayout.labels = rest;
                }
            }

            return {
                ...state,
                customLayout: newCustomLayout,
            };
        }

        case 'APPLY_AI_CHANGES': {
            return { ...state, ...action.payload };
        }

        default:
            return state;
    }
}

// Context
interface DiagramContextType {
    state: DiagramState;
    history: { canUndo: boolean; canRedo: boolean };
    dispatch: React.Dispatch<DiagramAction>;
    undo: () => void;
    redo: () => void;
    resetSession: () => void;
    resetNodePositions: () => void;
    resetLabelPositions: () => void;
    updateLayout: (id: string, type: 'node' | 'label', x: number, y: number) => void;
    getFullStateForAI: () => object;
}

const DiagramContext = createContext<DiagramContextType | null>(null);

// Provider
export function DiagramProvider({ children }: { children: React.ReactNode }) {
    const [historyState, dispatch] = useReducer(historyReducer, initialHistoryState);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('sankey-diagram-state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                dispatch({ type: 'LOAD_STATE', payload: parsed });
            } catch (e) {
                console.error('Failed to load saved state:', e);
            }
        }
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        localStorage.setItem('sankey-diagram-state', JSON.stringify(historyState.present));
    }, [historyState.present]);

    const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
    const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    dispatch({ type: 'REDO' });
                } else {
                    dispatch({ type: 'UNDO' });
                }
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                dispatch({ type: 'REDO' });
                e.preventDefault();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Delete selected label
                if (historyState.present.selectedLabelId) {
                    dispatch({ type: 'DELETE_INDEPENDENT_LABEL', payload: historyState.present.selectedLabelId });
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyState.present.selectedLabelId]);

    const resetSession = useCallback(() => {
        localStorage.removeItem('sankey-diagram-state');
        localStorage.removeItem('sankey-recent-colors');
        localStorage.removeItem('sankey-custom-palettes');
        localStorage.removeItem('sankey-templates');
        dispatch({ type: 'RESET_SESSION' });
    }, []);

    const resetNodePositions = useCallback(() => {
        dispatch({ type: 'RESET_NODE_POSITIONS' });
    }, []);

    const resetLabelPositions = useCallback(() => {
        dispatch({ type: 'RESET_LABEL_POSITIONS' });
    }, []);

    // Provide full state for AI integration
    const updateLayout = useCallback((id: string, type: 'node' | 'label', x: number, y: number) => {
        dispatch({ type: 'UPDATE_LAYOUT', payload: { id, type, x, y } });
    }, []);

    const getFullStateForAI = useCallback(() => {
        const { data, settings, nodeCustomizations, independentLabels, customLayout } = historyState.present;
        return {
            nodes: data.nodes.map((node) => {
                const customization = nodeCustomizations.find((c) => c.nodeId === node.id);
                const position = customLayout.nodes[node.id];
                const labelPosition = customLayout.labels[node.id];
                return {
                    ...node,
                    customization: customization || null,
                    manualPosition: position || null,
                    labelOffset: labelPosition || null,
                };
            }),
            links: data.links.map((link, index) => ({
                ...link,
                index,
                sourceName: typeof link.source === 'string' ? link.source : data.nodes[link.source as number]?.name,
                targetName: typeof link.target === 'string' ? link.target : data.nodes[link.target as number]?.name,
            })),
            settings,
            independentLabels,
        };
    }, [historyState.present]);

    const value: DiagramContextType = {
        state: historyState.present,
        history: {
            canUndo: historyState.past.length > 0,
            canRedo: historyState.future.length > 0,
        },
        dispatch,
        undo,
        redo,
        resetSession,
        resetNodePositions,
        resetLabelPositions,
        updateLayout,
        getFullStateForAI,
    };

    return <DiagramContext.Provider value={value}>{children}</DiagramContext.Provider>;
}

// Hook
export function useDiagram() {
    const context = useContext(DiagramContext);
    if (!context) {
        throw new Error('useDiagram must be used within a DiagramProvider');
    }
    return context;
}
