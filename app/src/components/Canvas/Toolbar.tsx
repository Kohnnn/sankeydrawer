'use client';

import React, { useState, useEffect } from 'react';
import {
    Undo2, Redo2, Download, RotateCcw, FileJson, Image, FileCode,
    MousePointer2, Hand, Plus, GitBranch, Type, ZoomIn, ZoomOut,
    Maximize2, RotateCw, RefreshCw, Trash2, ArrowRightLeft, SquareDashed
} from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';
import { useStudio } from '@/context/StudioContext';

export default function Toolbar() {
    const { history, undo, redo, resetSession, resetNodePositions, resetLabelPositions, state, dispatch } = useDiagram();
    const { state: studioState, setTool, zoomIn, zoomOut, zoomReset, dispatch: studioDispatch } = useStudio();
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showResetMenu, setShowResetMenu] = useState(false);

    const handleExportPNG = (scale = 2) => {
        const svg = document.querySelector('svg');
        if (!svg) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = state.settings.width * scale;
        canvas.height = state.settings.height * scale;

        const svgData = new XMLSerializer().serializeToString(svg);
        // Ensure fonts are included or standard ones used
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new window.Image();
        img.onload = () => {
            if (ctx) {
                // Fill background if not transparent
                ctx.fillStyle = state.settings.isDarkMode ? '#0f172a' : '#ffffff';
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
        setShowExportMenu(false);
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
        setShowExportMenu(false);
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
        setShowExportMenu(false);
    };

    // Force Light Mode removed
    /* React.useEffect(() => {
        document.documentElement.classList.remove('dark');
    }, []); */

    const ToolButton = ({
        tool,
        icon: Icon,
        label
    }: {
        tool: 'select' | 'pan' | 'addNode' | 'addFlow' | 'connect' | 'addLabel' | 'addImage' | 'annotate';
        icon: React.ElementType;
        label: string
    }) => (
        <button
            onClick={() => setTool(tool)}
            className={`p-2 rounded-full transition-all ${studioState.currentTool === tool
                ? 'bg-[var(--color-primary)] text-white shadow-md transform scale-105'
                : 'hover:bg-white text-[var(--secondary-text)] hover:text-[var(--primary-text)]'
                }`}
            title={label}
        >
            <Icon className="w-4 h-4" />
        </button>
    );

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1.5 glass-card z-30 transition-all hover:shadow-xl hover:-translate-y-0.5 animate-fade-in">
            {/* Tool Selection */}
            <div className="flex items-center gap-1 bg-[var(--hover-bg)] rounded-full p-1">
                <ToolButton tool="select" icon={MousePointer2} label="Select (V)" />
                <ToolButton tool="pan" icon={Hand} label="Pan (H)" />
                <ToolButton tool="addNode" icon={Plus} label="Add Node (N)" />
                <ToolButton tool="addFlow" icon={GitBranch} label="Add Flow (F)" />
                <ToolButton tool="connect" icon={ArrowRightLeft} label="Connect (C)" />
                <ToolButton tool="addLabel" icon={Type} label="Add Text (T)" />
                <ToolButton tool="addImage" icon={Image} label="Add Image (I)" />
                <ToolButton tool="annotate" icon={SquareDashed} label="Annotate (A)" />
            </div>



            {/* Undo/Redo */}
            <div className="flex items-center gap-1 bg-[var(--hover-bg)] rounded-full p-1 ml-2">
                <button
                    onClick={undo}
                    disabled={!history.canUndo}
                    className="p-2 rounded-full hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-[var(--secondary-text)] transition-all"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 className="w-4 h-4" />
                </button>
                <button
                    onClick={redo}
                    disabled={!history.canRedo}
                    className="p-2 rounded-full hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-[var(--secondary-text)] transition-all"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 className="w-4 h-4" />
                </button>
            </div>

            <div className="w-px h-6 bg-gray-200 mx-2" />

            {/* Export */}
            <div className="flex items-center gap-1 bg-[var(--hover-bg)] rounded-full p-1 ml-2">
                <div className="relative">
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="p-2 text-[var(--primary-text)] rounded-full hover:bg-white transition-all"
                        title="Export"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    {showExportMenu && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 py-1 bg-[var(--card-bg)] rounded-xl shadow-xl border border-[var(--border)] z-50 min-w-[160px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <button
                                onClick={() => handleExportPNG(1)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--primary-text)] hover:bg-[var(--hover-bg)]"
                            >
                                <Image className="w-4 h-4" />
                                PNG (Standard)
                            </button>
                            <button
                                onClick={() => handleExportPNG(3)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--primary-text)] hover:bg-[var(--hover-bg)] font-medium"
                            >
                                <Image className="w-4 h-4 text-blue-500" />
                                PNG (High-Res 3x)
                            </button>
                            <button
                                onClick={handleExportSVG}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--primary-text)] hover:bg-[var(--hover-bg)]"
                            >
                                <FileCode className="w-4 h-4" />
                                SVG Vector
                            </button>
                            <button
                                onClick={handleExportJSON}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--primary-text)] hover:bg-[var(--hover-bg)]"
                            >
                                <FileJson className="w-4 h-4" />
                                JSON Data
                            </button>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowResetMenu(!showResetMenu)}
                        className="p-2 text-[var(--secondary-text)] rounded-full hover:bg-white transition-all hover:text-red-500"
                        title="Reset"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    {/* Reset Menu */}
                    {showResetMenu && (
                        <div className="absolute top-full right-0 mt-2 py-1 bg-[var(--card-bg)] rounded-xl shadow-xl border border-[var(--border)] z-50 min-w-[180px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <button
                                onClick={() => { resetNodePositions(); setShowResetMenu(false); }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--primary-text)] hover:bg-[var(--hover-bg)]"
                            >
                                <RotateCw className="w-4 h-4" />
                                Reset Node Positions
                            </button>
                            <button
                                onClick={() => { resetLabelPositions(); setShowResetMenu(false); }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--primary-text)] hover:bg-[var(--hover-bg)]"
                            >
                                <RotateCw className="w-4 h-4" />
                                Reset Label Positions
                            </button>
                            <div className="border-t border-[var(--border)] my-1" />
                            <button
                                onClick={() => { resetSession(); setShowResetMenu(false); }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Factory Reset
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Click-away handler */}
            {(showExportMenu || showResetMenu) && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                        setShowExportMenu(false);
                        setShowResetMenu(false);
                    }}
                />
            )}
        </div>
    );
}

