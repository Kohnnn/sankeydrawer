'use client';

import React, { useState, useEffect } from 'react';
import {
    Undo2, Redo2, Download, RotateCcw, FileJson, Image, FileCode,
    MousePointer2, Hand, Plus, GitBranch, Type, ZoomIn, ZoomOut,
    Maximize2, RotateCw, RefreshCw, Trash2, ArrowRightLeft, SquareDashed
} from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { useStudio } from '@/context/StudioContext';

import ToolbarDropdown from './ToolbarDropdown';

export default function Toolbar() {
    const { history, undo, redo, resetSession, resetNodePositions, resetLabelPositions, state, dispatch } = useDiagram();
    const { state: studioState, setTool, zoomIn, zoomOut, zoomReset, dispatch: studioDispatch } = useStudio();

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

    const toolMenuItems = [
        { label: 'Select', icon: MousePointer2, onClick: () => setTool('select') },
        { label: 'Pan', icon: Hand, onClick: () => setTool('pan') },
        { label: 'Add Node', icon: Plus, onClick: () => setTool('addNode') },
        { label: 'Add Flow', icon: GitBranch, onClick: () => setTool('addFlow') },
        { label: 'Connect', icon: ArrowRightLeft, onClick: () => setTool('connect') },
        { label: 'Add Text', icon: Type, onClick: () => setTool('addLabel') },
        { label: 'Add Image', icon: Image, onClick: () => setTool('addImage') },
        { label: 'Annotate', icon: SquareDashed, onClick: () => setTool('annotate') },
    ];

    const CurrentToolIcon = toolMenuItems.find(t => t.label.toLowerCase().replace(' ', '') === studioState.currentTool.toLowerCase())?.icon || MousePointer2;

    return (
        <div className="w-full bg-white border-b border-slate-200 px-4 py-1 flex items-center justify-between z-30 shrink-0">
            <div className="flex items-center gap-2">
                <ToolbarDropdown label="File" items={fileMenuItems} />
                <ToolbarDropdown label="View" items={viewMenuItems} />
                <ToolbarDropdown label="Tools" items={toolMenuItems} />
                
                <div className="w-px h-4 bg-slate-200 mx-2" />
                
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
                    <CurrentToolIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-slate-600 capitalize">
                        {studioState.currentTool.replace(/([A-Z])/g, ' $1').trim()} Tool
                    </span>
                </div>
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


