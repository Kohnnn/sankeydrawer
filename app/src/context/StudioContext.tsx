'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Tool types for the studio
export type StudioTool = 'select' | 'pan' | 'addNode' | 'addFlow' | 'connect' | 'addLabel' | 'addImage' | 'annotate';

// Element types that can be selected
export type SelectedElementType = 'node' | 'flow' | 'label' | 'independentLabel' | 'annotationBox' | null;

export interface SelectedElement {
    type: SelectedElementType;
    id: string | number | null;
}

export interface ViewportTransform {
    x: number;
    y: number;
    scale: number;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface StudioState {
    currentTool: StudioTool;
    selectedElement: SelectedElement;
    viewportTransform: ViewportTransform;
    isPanning: boolean;
    isAddingFlow: boolean;
    flowSourceNode: string | null;
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    isSidebarCollapsed: boolean;
    toasts: Toast[];
}

const initialState: StudioState = {
    currentTool: 'select',
    selectedElement: { type: null, id: null },
    viewportTransform: { x: 0, y: 0, scale: 1 },
    isPanning: false,
    isAddingFlow: false,
    flowSourceNode: null,
    showGrid: false, // Default to false per Phase 02
    snapToGrid: false,
    gridSize: 20,
    isSidebarCollapsed: true, // Default to true per Phase 07
    toasts: [],
};

type StudioAction =
    | { type: 'SET_TOOL'; payload: StudioTool }
    | { type: 'SELECT_ELEMENT'; payload: SelectedElement }
    | { type: 'DESELECT' }
    | { type: 'SET_VIEWPORT'; payload: Partial<ViewportTransform> }
    | { type: 'ZOOM_IN' }
    | { type: 'ZOOM_OUT' }
    | { type: 'ZOOM_RESET' }
    | { type: 'ZOOM_FIT' }
    | { type: 'SET_PANNING'; payload: boolean }
    | { type: 'START_ADD_FLOW'; payload: string }
    | { type: 'COMPLETE_ADD_FLOW' }
    | { type: 'CANCEL_ADD_FLOW' }
    | { type: 'TOGGLE_GRID' }
    | { type: 'TOGGLE_SNAP' }
    | { type: 'TOGGLE_SIDEBAR' }
    | { type: 'ADD_TOAST'; payload: Omit<Toast, 'id'> }
    | { type: 'REMOVE_TOAST'; payload: string };

function studioReducer(state: StudioState, action: StudioAction): StudioState {
    switch (action.type) {
        case 'ADD_TOAST':
            return {
                ...state,
                toasts: [...state.toasts, { ...action.payload, id: Math.random().toString(36).substr(2, 9) }]
            };

        case 'REMOVE_TOAST':
            return {
                ...state,
                toasts: state.toasts.filter(t => t.id !== action.payload)
            };

        case 'SET_TOOL':
            return {
                ...state,
                currentTool: action.payload,
                isAddingFlow: false,
                flowSourceNode: null,
            };

        case 'SELECT_ELEMENT':
            return { ...state, selectedElement: action.payload };

        case 'DESELECT':
            return { ...state, selectedElement: { type: null, id: null } };

        case 'SET_VIEWPORT':
            return {
                ...state,
                viewportTransform: { ...state.viewportTransform, ...action.payload }
            };

        case 'ZOOM_IN':
            return {
                ...state,
                viewportTransform: {
                    ...state.viewportTransform,
                    scale: Math.min(state.viewportTransform.scale * 1.2, 5),
                },
            };

        case 'ZOOM_OUT':
            return {
                ...state,
                viewportTransform: {
                    ...state.viewportTransform,
                    scale: Math.max(state.viewportTransform.scale / 1.2, 0.1),
                },
            };

        case 'ZOOM_RESET':
            return {
                ...state,
                viewportTransform: { x: 0, y: 0, scale: 1 },
            };

        case 'ZOOM_FIT':
            // Will be calculated based on diagram bounds
            return {
                ...state,
                viewportTransform: { x: 0, y: 0, scale: 1 },
            };

        case 'SET_PANNING':
            return { ...state, isPanning: action.payload };

        case 'START_ADD_FLOW':
            return {
                ...state,
                isAddingFlow: true,
                flowSourceNode: action.payload
            };

        case 'COMPLETE_ADD_FLOW':
        case 'CANCEL_ADD_FLOW':
            return {
                ...state,
                isAddingFlow: false,
                flowSourceNode: null
            };

        case 'TOGGLE_GRID':
            return { ...state, showGrid: !state.showGrid };

        case 'TOGGLE_SNAP':
            return { ...state, snapToGrid: !state.snapToGrid };

        case 'TOGGLE_SIDEBAR':
            return { ...state, isSidebarCollapsed: !state.isSidebarCollapsed };

        default:
            return state;
    }
}

// Context
interface StudioContextType {
    state: StudioState;
    dispatch: React.Dispatch<StudioAction>;
    setTool: (tool: StudioTool) => void;
    selectElement: (type: SelectedElementType, id: string | number) => void;
    deselect: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomReset: () => void;
    zoomFit: () => void;
    getCursor: () => string;
}

const StudioContext = createContext<StudioContextType | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(studioReducer, initialState);

    const setTool = useCallback((tool: StudioTool) => {
        dispatch({ type: 'SET_TOOL', payload: tool });
    }, []);

    const selectElement = useCallback((type: SelectedElementType, id: string | number) => {
        dispatch({ type: 'SELECT_ELEMENT', payload: { type, id } });
    }, []);

    const deselect = useCallback(() => {
        dispatch({ type: 'DESELECT' });
    }, []);

    const zoomIn = useCallback(() => dispatch({ type: 'ZOOM_IN' }), []);
    const zoomOut = useCallback(() => dispatch({ type: 'ZOOM_OUT' }), []);
    const zoomReset = useCallback(() => dispatch({ type: 'ZOOM_RESET' }), []);
    const zoomFit = useCallback(() => dispatch({ type: 'ZOOM_FIT' }), []);

    const getCursor = useCallback(() => {
        if (state.isPanning) return 'grabbing';

        switch (state.currentTool) {
            case 'pan': return 'grab';
            case 'addNode': return 'crosshair';
            case 'addFlow':
            case 'connect': return state.isAddingFlow ? 'pointer' : 'crosshair';
            case 'addLabel': return 'text';
            case 'addImage': return 'copy';
            case 'annotate': return 'crosshair';
            default: return 'default';
        }
    }, [state.currentTool, state.isPanning, state.isAddingFlow]);

    const value: StudioContextType = {
        state,
        dispatch,
        setTool,
        selectElement,
        deselect,
        zoomIn,
        zoomOut,
        zoomReset,
        zoomFit,
        getCursor,
    };

    return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
    const context = useContext(StudioContext);
    if (!context) {
        throw new Error('useStudio must be used within a StudioProvider');
    }
    return context;
}
