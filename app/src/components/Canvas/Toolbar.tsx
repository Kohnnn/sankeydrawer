'use client';

import React from 'react';
import {
    Undo2, Redo2, FileJson, Image, FileCode,
    Hand, Plus, GitBranch, Type, ZoomIn, ZoomOut,
    Maximize2, RotateCw, RefreshCw, Trash2, ArrowRightLeft, SquareDashed
} from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { useStudio } from '@/context/StudioContext';

import ToolbarDropdown from './ToolbarDropdown';

export default function Toolbar() {
    const { history, undo, redo, resetSession, resetNodePositions, resetLabelPositions, state, dispatch } = useDiagram();
    const { state: studioState, setTool, zoomIn, zoomOut, zoomReset, dispatch: studioDispatch } = useStudio();

    const applyCanvasSize = (width: number, height: number) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { width, height } });
    };

    const handleBackdropColor = () => {
        const colorInput = window.prompt('Canvas background color (hex)', state.settings.canvasBackground || '#ffffff');
        if (!colorInput) return;

        const normalized = colorInput.trim();
        if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
            return;
        }

        dispatch({ type: 'UPDATE_SETTINGS', payload: { canvasBackground: normalized } });
    };

    const handleNodeWidthPrompt = () => {
        const widthInput = window.prompt('Node width (px)', String(state.settings.nodeWidth));
        if (!widthInput) return;

        const value = Number(widthInput);
        if (!Number.isFinite(value)) return;
        dispatch({ type: 'UPDATE_SETTINGS', payload: { nodeWidth: Math.max(6, Math.min(120, Math.round(value))) } });
    };

    const handleNodeSpacingPrompt = () => {
        const spacingInput = window.prompt('Node spacing (px)', String(state.settings.nodePadding));
        if (!spacingInput) return;

        const value = Number(spacingInput);
        if (!Number.isFinite(value)) return;
        dispatch({ type: 'UPDATE_SETTINGS', payload: { nodePadding: Math.max(4, Math.min(80, Math.round(value))) } });
    };

    const handleValuePrefixPrompt = () => {
        const nextPrefix = window.prompt('Value prefix', state.settings.valuePrefix);
        if (nextPrefix === null) return;
        dispatch({ type: 'UPDATE_SETTINGS', payload: { valuePrefix: nextPrefix } });
    };

    const handleValueSuffixPrompt = () => {
        const nextSuffix = window.prompt('Value suffix', state.settings.valueSuffix);
        if (nextSuffix === null) return;
        dispatch({ type: 'UPDATE_SETTINGS', payload: { valueSuffix: nextSuffix } });
    };

    const handleCustomCanvasSize = () => {
        const widthInput = window.prompt('Canvas width (px)', String(state.settings.width));
        if (!widthInput) return;
        const heightInput = window.prompt('Canvas height (px)', String(state.settings.height));
        if (!heightInput) return;

        const width = Number(widthInput);
        const height = Number(heightInput);
        if (!Number.isFinite(width) || !Number.isFinite(height)) return;

        applyCanvasSize(Math.max(400, Math.round(width)), Math.max(300, Math.round(height)));
    };

    const handleExportPNG = (scale = 2) => {
        const svg = document.querySelector('svg');
        if (!svg) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = state.settings.width * scale;
        canvas.height = state.settings.height * scale;

        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new window.Image();
        img.onload = () => {
            if (ctx) {
                ctx.fillStyle = '#ffffff'; // Always white for professional overhaul
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);

                const pngUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `sankey-${scale}x-${Date.now()}.png`;
                link.href = pngUrl;
                link.click();
            }
            URL.revokeObjectURL(url);
        };
        img.src = url;
    };

    const handleExportSVG = () => {
        const svg = document.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `sankey-diagram-${Date.now()}.svg`;
        link.href = url;
        link.click();

        URL.revokeObjectURL(url);
    };

    const handleExportJSON = () => {
        const json = JSON.stringify(state, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `sankey-diagram-${Date.now()}.json`;
        link.href = url;
        link.click();

        URL.revokeObjectURL(url);
    };

    const layoutMenuItems = [
        { label: 'Pan', icon: Hand, onClick: () => setTool('pan') },
        { label: 'Add Node', icon: Plus, onClick: () => setTool('addNode') },
        { label: 'Add Flow', icon: GitBranch, onClick: () => setTool('addFlow') },
        { label: 'Connect', icon: ArrowRightLeft, onClick: () => setTool('connect') },
        { label: 'Add Text', icon: Type, onClick: () => setTool('addLabel') },
        { label: 'Add Image', icon: Image, onClick: () => setTool('addImage') },
        { label: 'Annotate', icon: SquareDashed, onClick: () => setTool('annotate') },
        { label: 'Backdrop Color...', onClick: handleBackdropColor },
        { label: 'Small (640x400)', onClick: () => applyCanvasSize(640, 400) },
        { label: 'Medium (960x600)', onClick: () => applyCanvasSize(960, 600) },
        { label: 'Large (1200x800)', onClick: () => applyCanvasSize(1200, 800) },
        { label: 'HD (1600x900)', onClick: () => applyCanvasSize(1600, 900) },
        { label: 'Node Width...', onClick: handleNodeWidthPrompt },
        { label: 'Node Spacing...', onClick: handleNodeSpacingPrompt },
        { label: 'Align Justify', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { nodeAlignment: 'justify' } }) },
        { label: 'Align Left', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { nodeAlignment: 'left' } }) },
        { label: 'Align Right', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { nodeAlignment: 'right' } }) },
        { label: 'Align Center', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { nodeAlignment: 'center' } }) },
        { label: 'Custom Size...', onClick: handleCustomCanvasSize },
        { label: 'Reset Node Positions', icon: RotateCw, onClick: resetNodePositions },
    ];

    const fileMenuItems = [
        { label: 'Export PNG (Standard)', icon: Image, onClick: () => handleExportPNG(1) },
        { label: 'Export PNG (High-Res 3x)', icon: Image, onClick: () => handleExportPNG(3) },
        { label: 'Export SVG Vector', icon: FileCode, onClick: handleExportSVG },
        { label: 'Export JSON Data', icon: FileJson, onClick: handleExportJSON },
        { label: 'Factory Reset', icon: Trash2, onClick: resetSession, danger: true },
    ];

    const viewMenuItems = [
        { label: 'Zoom In', icon: ZoomIn, onClick: zoomIn },
        { label: 'Zoom Out', icon: ZoomOut, onClick: zoomOut },
        { label: 'Reset Viewport', icon: Maximize2, onClick: zoomReset },
        { label: 'Toggle Grid', icon: RefreshCw, onClick: () => studioDispatch({ type: 'TOGGLE_GRID' }) },
        { label: 'Reset Label Positions', icon: RotateCw, onClick: resetLabelPositions },
    ];

    const labelsMenuItems = [
        { label: 'Auto Labels', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { labelPosition: 'auto' } }) },
        { label: 'Outside Labels', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { labelPosition: 'outside' } }) },
        { label: 'Before Labels', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { labelPosition: 'before' } }) },
        { label: 'After Labels', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { labelPosition: 'after' } }) },
        { label: 'Inside Labels', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { labelPosition: 'inside' } }) },
        { label: 'Above Labels', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { labelPosition: 'above' } }) },
        { label: 'Decimals: 0', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { valueDecimals: 0 } }) },
        { label: 'Decimals: 1', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { valueDecimals: 1 } }) },
        { label: 'Decimals: 2', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { valueDecimals: 2 } }) },
        { label: 'Value Prefix...', onClick: handleValuePrefixPrompt },
        { label: 'Value Suffix...', onClick: handleValueSuffixPrompt },
        { label: 'Comparison: On', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { showComparisonLine: true } }) },
        { label: 'Comparison: Off', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { showComparisonLine: false } }) },
        { label: 'Hide Values', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { valueMode: 'hidden' } }) },
        { label: 'Show Values', onClick: () => dispatch({ type: 'UPDATE_SETTINGS', payload: { valueMode: 'formatted' } }) },
        { label: 'Reset Label Positions', icon: RotateCw, onClick: resetLabelPositions },
    ];


    return (
        <div className="w-full bg-white border-b border-slate-200 px-4 py-1 flex items-center justify-between z-30 shrink-0">
            <div className="flex items-center gap-2">
                <ToolbarDropdown label="File" items={fileMenuItems} />
                <ToolbarDropdown label="View" items={viewMenuItems} />
                <ToolbarDropdown label="Labels" items={labelsMenuItems} />
                <ToolbarDropdown label="Layout" items={layoutMenuItems} />
                
                <div className="w-px h-4 bg-slate-200 mx-2" />
                <span className="text-xs font-medium text-slate-500 capitalize tracking-tight">
                    {studioState.currentTool.replace(/([A-Z])/g, ' $1').trim()}
                </span>
            </div>


            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                    <button
                        onClick={undo}
                        disabled={!history.canUndo}
                        className="p-1.5 rounded-md hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-all"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!history.canRedo}
                        className="p-1.5 rounded-md hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-all"
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="w-px h-4 bg-slate-200 mx-2" />
                
                <div className="flex items-center gap-1">
                    <button onClick={zoomOut} className="p-1.5 text-slate-500 hover:text-slate-900" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-xs font-medium text-slate-400 min-w-[3rem] text-center">
                        {Math.round(studioState.viewportTransform.scale * 100)}%
                    </span>
                    <button onClick={zoomIn} className="p-1.5 text-slate-500 hover:text-slate-900" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}


