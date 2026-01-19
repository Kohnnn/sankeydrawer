'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { sankey } from 'd3-sankey';
import { useDiagram } from '@/context/DiagramContext';
import { useStudio } from '@/context/StudioContext';
import { SankeyNode, NodeCustomization, IndependentLabel } from '@/types/sankey';
import NodeEditPopover from './NodeEditPopover';
import MiniMap from './MiniMap';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Undo, Redo, Download, Image as ImageIcon } from 'lucide-react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Semantic colors
const COLORS: Record<string, string> = {
    revenue: '#22c55e',
    expense: '#ef4444',
    profit: '#3b82f6',
    neutral: '#6b7280',
};

// Particle Geometry
const PARTICLE_SIZE = 3;
const PARTICLE_TRAIL = 6;

const PALETTE = d3.schemeCategory10;

interface PopoverState {
    node: SankeyNode;
    position: { x: number; y: number };
}

export default function SankeyCanvas() {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { state, dispatch } = useDiagram();
    const { state: studioState, dispatch: studioDispatch, setTool } = useStudio();
    const { data, settings, selectedNodeId, selectedLinkIndex, nodeCustomizations, independentLabels, annotationBoxes } = state;
    const [popover, setPopover] = useState<PopoverState | null>(null);

    // In-place editing state
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    // Annotation drawing state
    const [drawingBox, setDrawingBox] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    // Keyboard shortcuts
    useKeyboardShortcuts({ svgRef, dispatch, studioDispatch, state, selectedNodeId });

    // Get customization for a node
    const getCustomization = useCallback((nodeId: string): NodeCustomization | undefined => {
        return nodeCustomizations?.find(c => c.nodeId === nodeId);
    }, [nodeCustomizations]);

    // Get node color based on category or custom color
    const getNodeColor = useCallback((node: SankeyNode, index: number): string => {
        const customization = getCustomization(node.id);
        if (customization?.fillColor) return customization.fillColor;
        if (node.color) return node.color;
        if (node.category && COLORS[node.category]) return COLORS[node.category];
        return PALETTE[index % PALETTE.length];
    }, [getCustomization]);

    // Format value for display
    const formatValue = useCallback((value: number, forceDisplay = false): string => {
        const { valuePrefix, valueSuffix, valueDecimals, valueMode } = settings;

        if (!forceDisplay && valueMode === 'hidden') return '';

        let formatted: string;
        if (valueMode === 'short') {
            if (value >= 1_000_000_000) {
                formatted = (value / 1_000_000_000).toFixed(valueDecimals) + 'B';
            } else if (value >= 1_000_000) {
                formatted = (value / 1_000_000).toFixed(valueDecimals) + 'M';
            } else if (value >= 1_000) {
                formatted = (value / 1_000).toFixed(valueDecimals) + 'K';
            } else {
                formatted = value.toFixed(valueDecimals);
            }
        } else {
            formatted = value.toLocaleString('en-US', {
                minimumFractionDigits: valueDecimals,
                maximumFractionDigits: valueDecimals
            });
        }

        return `${valuePrefix}${formatted}${valueSuffix}`;
    }, [settings]);

    // Handle node click for popover
    const handleNodeClick = useCallback((event: MouseEvent, node: SankeyNode) => {
        event.stopPropagation();
        const rect = (event.target as SVGElement).getBoundingClientRect();
        setPopover({
            node,
            position: { x: rect.right + 10, y: rect.top }
        });
        dispatch({ type: 'SELECT_NODE', payload: node.id });
    }, [dispatch]);

    // Close popover
    const closePopover = useCallback(() => {
        setPopover(null);
    }, []);

    // Render the Sankey diagram
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        const width = settings.width;
        const height = settings.height;
        const { padding } = settings;

        // --- Setup Main Group & Layers (One-time setup) ---
        let mainGroup = svg.select<SVGGElement>('g.main-group');

        if (mainGroup.empty()) {
            mainGroup = svg.append('g').attr('class', 'main-group');
            // Init Zoom
            const zoom = d3.zoom<SVGSVGElement, unknown>()
                .scaleExtent([0.1, 5])
                .filter((event) => {
                    // Don't trigger zoom/pan when dragging nodes
                    const target = event.target as Element;
                    if (target.closest('.sankey-node')) return false;
                    return !event.ctrlKey && !event.button;
                })
                .on('zoom', (event) => {
                    mainGroup.attr('transform', event.transform);
                });
            svg.call(zoom).on('dblclick.zoom', null);
            (svg.node() as any).__zoomBehavior = zoom;
        }

        // --- Setup Definitions (Gradients, Filters) ---
        let defs = svg.select<SVGDefsElement>('defs');
        if (defs.empty()) {
            defs = svg.insert('defs', ':first-child');

            // 1. Drop Shadow for Nodes (Softer)
            const shadow = defs.append('filter')
                .attr('id', 'node-shadow')
                .attr('height', '130%');
            shadow.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 2).attr('result', 'blur');
            shadow.append('feOffset').attr('in', 'blur').attr('dx', 1).attr('dy', 1).attr('result', 'offsetBlur');

            // Soften shadow alpha
            const transfer = shadow.append('feComponentTransfer').attr('in', 'offsetBlur').attr('result', 'softShadow');
            transfer.append('feFuncA').attr('type', 'linear').attr('slope', '0.2');

            const feMerge = shadow.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'softShadow');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');


            // 2. Gloss Gradient (Subtle 3D effect)
            const gloss = defs.append('linearGradient')
                .attr('id', 'node-gloss')
                .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
            gloss.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.15);
            gloss.append('stop').attr('offset', '100%').attr('stop-color', 'white').attr('stop-opacity', 0);
        }

        // Update Grid Pattern
        defs.select('#grid-pattern').remove();
        if (settings.showGrid) {
            const gridSize = settings.gridSize || 20;
            const pattern = defs.append('pattern')
                .attr('id', 'grid-pattern')
                .attr('width', gridSize)
                .attr('height', gridSize)
                .attr('patternUnits', 'userSpaceOnUse');
            pattern.append('circle')
                .attr('cx', 1).attr('cy', 1).attr('r', 0.8)
                .attr('fill', '#e5e7eb')
                .attr('opacity', 1);

        }

        // --- Update Grid Background ---
        mainGroup.select('.grid-background').remove();
        if (settings.showGrid) {
            mainGroup.insert('rect', ':first-child')
                .attr('class', 'grid-background')
                .attr('width', width * 5).attr('height', height * 5)
                .attr('x', -width * 2).attr('y', -height * 2)
                .attr('fill', 'url(#grid-pattern)')
                .style('pointer-events', 'none');
        }

        // --- Data Handling ---
        if (!data.nodes.length || !data.links.length) {
            mainGroup.selectAll('.layer-links, .layer-nodes, .layer-labels, .layer-particles').transition().duration(500).attr('opacity', 0).remove();
            // Empty message...
            const emptyMsg = svg.selectAll('.empty-message').data([1]);
            emptyMsg.enter().append('text')
                .attr('class', 'empty-message')
                .attr('x', width / 2).attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#9ca3af')
                .attr('font-size', '16px')
                .text('No valid flows to display. Add flows in the Data Editor.')
                .attr('opacity', 0).transition().duration(500).attr('opacity', 1);
            return;
        } else {
            svg.select('.empty-message').transition().duration(300).attr('opacity', 0).remove();
        }

        const sankeyGenerator = sankey<any, any>()
            .nodeId((d: any) => d.id)
            .nodeWidth(settings.nodeWidth)
            .nodePadding(settings.nodePadding)
            .extent([[padding.left, padding.top], [width - padding.right, height - padding.bottom]]);

        // Filter & Clone Data
        const validLinks = data.links.filter((l) => {
            const source = typeof l.source === 'string' ? l.source : l.source;
            const target = typeof l.target === 'string' ? l.target : l.target;
            if (!source || !target) return false;
            return data.nodes.some(n => n.id === source) && data.nodes.some(n => n.id === target);
        });

        if (validLinks.length === 0 && data.links.length > 0) {
            // Links exist but none are valid - show empty message
            mainGroup.selectAll('.layer-links, .layer-nodes, .layer-labels, .layer-particles').transition().duration(500).attr('opacity', 0).remove();
            const emptyMsg = svg.selectAll('.empty-message').data([1]);
            emptyMsg.enter().append('text')
                .attr('class', 'empty-message')
                .attr('x', width / 2).attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#9ca3af')
                .attr('font-size', '16px')
                .text('Flows defined but cannot connect to nodes. Check Data Editor.')
                .attr('opacity', 0).transition().duration(500).attr('opacity', 1);
            return;
        }

        let processedGraph;
        try {
            const calcData = {
                nodes: data.nodes.map(n => ({ ...n })),
                links: validLinks.map(l => ({ ...l }))
            };
            processedGraph = sankeyGenerator(calcData);
        } catch (e) { console.error(e); return; }

        const { nodes, links } = processedGraph;

        // Custom Layout Override
        if (state.customLayout && state.customLayout.nodes) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodes.forEach((node: any) => {
                const customPos = state.customLayout.nodes[node.id];
                if (customPos) {
                    const nW = node.x1 - node.x0;
                    const nH = node.y1 - node.y0;
                    node.x0 = customPos.x; node.x1 = customPos.x + nW;
                    node.y0 = customPos.y; node.y1 = customPos.y + nH;
                }
            });
            sankeyGenerator.update(processedGraph);
        }

        // --- Layers ---
        const getLayer = (name: string) => {
            let l = mainGroup.select<SVGGElement>('.' + name);
            if (l.empty()) l = mainGroup.append('g').attr('class', name);
            return l;
        };
        // Creation Order = Z-Index
        const linkLayer = getLayer('layer-links');
        const particleLayer = getLayer('layer-particles'); // New Layer
        const nodeLayer = getLayer('layer-nodes');
        const labelLayer = getLayer('layer-labels');
        const guideLayer = getLayer('layer-guides');
        const leaderLayer = getLayer('layer-leaders');
        const annotationLayer = getLayer('layer-annotations');
        const logoLayer = getLayer('layer-logo');
        const legendLayer = getLayer('layer-legend');

        // --- Logo Overlay ---
        logoLayer.selectAll('*').remove();
        if (settings.logoUrl) {
            const size = settings.logoSize || 80;
            const pos = settings.logoPosition || 'bottom-right';
            let x = 20, y = 20;
            if (pos.includes('right')) x = width - size - 20;
            if (pos.includes('bottom')) y = height - size - 20;

            logoLayer.append('image')
                .attr('href', settings.logoUrl)
                .attr('x', x)
                .attr('y', y)
                .attr('width', size)
                .attr('height', size)
                .attr('opacity', settings.logoOpacity || 0.8)
                .attr('preserveAspectRatio', 'xMidYMid meet');
        }

        // --- Legend ---
        legendLayer.selectAll('*').remove();
        if (settings.showLegend) {
            const legendItems = Array.from(new Set(
                data.nodes.map(n => n.category || 'neutral')
            )).map(cat => ({
                label: cat.charAt(0).toUpperCase() + cat.slice(1),
                color: COLORS[cat] || '#6b7280'
            }));

            const pos = settings.legendPosition || 'top-right';
            const itemHeight = 24;
            const legendWidth = 120;
            const legendHeight = legendItems.length * itemHeight + 16;

            let startX = pos.includes('right') ? width - legendWidth - 20 : 20;
            let startY = pos.includes('bottom') ? height - legendHeight - 20 : 20;

            const legendG = legendLayer.append('g')
                .attr('transform', `translate(${startX}, ${startY})`);

            legendG.append('rect')
                .attr('width', legendWidth)
                .attr('height', legendHeight)
                .attr('fill', 'rgba(255, 255, 255, 0.8)')
                .attr('stroke', '#e2e8f0')
                .attr('rx', 6);

            legendItems.forEach((item, i) => {
                const itemG = legendG.append('g')
                    .attr('transform', `translate(12, ${i * itemHeight + 16})`);

                itemG.append('rect')
                    .attr('width', 12)
                    .attr('height', 12)
                    .attr('fill', item.color)
                    .attr('rx', 2);

                itemG.append('text')
                    .attr('x', 20)
                    .attr('y', 10)
                    .attr('font-size', 10)
                    .attr('font-weight', '600')
                    .attr('fill', '#374151')
                    .text(item.label);
            });

        }

        // --- Annotation Boxes ---
        annotationLayer.lower(); // Keep behind nodes
        const annotationSel = annotationLayer.selectAll('.annotation-box')
            .data(state.annotationBoxes || [], (d: any) => d.id);

        annotationSel.exit().remove();

        const annotationEnter = annotationSel.enter()
            .append('g')
            .attr('class', 'annotation-box cursor-pointer');

        annotationEnter.append('rect')
            .attr('rx', 4).attr('ry', 4)
            .on('click', (e, d: any) => {
                e.stopPropagation();
                if (window.confirm('Delete annotation box?')) {
                    dispatch({ type: 'DELETE_ANNOTATION_BOX', payload: d.id });
                }
            })
            .merge(annotationSel.select('rect') as any)
            .attr('x', (d: any) => d.x)
            .attr('y', (d: any) => d.y)
            .attr('width', (d: any) => d.width)
            .attr('height', (d: any) => d.height)
            .attr('fill', (d: any) => d.backgroundColor || 'transparent')
            .attr('fill-opacity', (d: any) => d.backgroundOpacity || 0)
            .attr('stroke', (d: any) => d.borderColor || '#dc2626')
            .attr('stroke-width', (d: any) => d.borderWidth || 2)
            .attr('stroke-dasharray', (d: any) =>
                d.borderStyle === 'dashed' ? '8 4' :
                    d.borderStyle === 'dotted' ? '2 2' : 'none'
            );

        // Add labels for annotation boxes
        annotationEnter.append('text')
            .attr('class', 'box-label')
            .style('pointer-events', 'none')
            .merge(annotationSel.select('text.box-label') as any)
            .attr('x', (d: any) => d.x + 8)
            .attr('y', (d: any) => d.y - 8)
            .attr('font-size', 10)
            .attr('font-weight', 'bold')
            .attr('fill', (d: any) => d.borderColor || '#dc2626')
            .text((d: any) => d.label || '');

        // Drawing Preview
        annotationLayer.select('.drawing-preview').remove();
        if (drawingBox) {
            annotationLayer.append('rect')
                .attr('class', 'drawing-preview')
                .attr('x', Math.min(drawingBox.startX, drawingBox.currentX))
                .attr('y', Math.min(drawingBox.startY, drawingBox.currentY))
                .attr('width', Math.abs(drawingBox.currentX - drawingBox.startX))
                .attr('height', Math.abs(drawingBox.currentY - drawingBox.startY))
                .attr('fill', 'rgba(59, 130, 246, 0.1)')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '4 2')
                .attr('rx', 4);
        }

        // --- Leader Lines for External Labels ---
        leaderLayer.selectAll('*').remove();
        if (settings.labelPosition === 'external' && settings.showLeaderLines) {
            const leaderData = nodes.map((d: any) => {
                const isLeft = d.x0 < width / 2;
                const midY = (d.y0 + d.y1) / 2;
                return {
                    id: d.id,
                    x1: isLeft ? d.x0 - 4 : d.x1 + 4,
                    x2: isLeft ? d.x0 - 45 : d.x1 + 45,
                    y1: midY,
                    y2: midY,
                };
            });

            const leaderSel = leaderLayer.selectAll('.leader-line')
                .data(leaderData, (d: any) => d.id);

            leaderSel.enter()
                .append('line')
                .attr('class', 'leader-line')
                .merge(leaderSel as any)
                .attr('x1', (d: any) => d.x1)
                .attr('x2', (d: any) => d.x2)
                .attr('y1', (d: any) => d.y1)
                .attr('y2', (d: any) => d.y2)
                .attr('stroke', settings.leaderLineColor || '#9ca3af')
                .attr('stroke-width', settings.leaderLineWidth || 1)
                .attr('stroke-dasharray', '2 2')  // Dashed for professional look
                .attr('opacity', 0.6)
                .attr('stroke-linecap', 'round');
        }

        // --- Tooltip ---
        let tooltip = d3.select('body').select<HTMLDivElement>('.sankey-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select('body').append('div').attr('class', 'sankey-tooltip')
                .style('position', 'fixed').style('visibility', 'hidden')
                .style('background', 'rgba(15,23,42,0.9)').style('color', 'white')
                .style('padding', '8px 12px').style('border-radius', '6px')
                .style('font-size', '12px').style('z-index', '9999');
        }
        function showTooltip(e: any, text: string) {
            tooltip.style('visibility', 'visible').text(text)
                .style('left', (e.clientX + 10) + 'px').style('top', (e.clientY + 10) + 'px');
        }
        function hideTooltip() { tooltip.style('visibility', 'hidden'); }

        const tLayout = svg.transition('layout').duration(750 as any).ease(d3.easeCubicInOut);
        const tStyle = svg.transition('style').duration(500 as any).ease(d3.easeLinear);

        // --- Links ---
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const smoothLinkPath = (d: any) => {
            const curveStyle = settings.linkCurveStyle || 'organic';
            let curvature = settings.linkCurvature ?? 0.5;

            const sx = d.source.x1;
            const tx = d.target.x0;
            const sy0 = d.y0;
            const ty1 = d.y1;
            const w = d.width / 2;

            if (curveStyle === 'sharp') {
                // Right angles
                const mx = (sx + tx) / 2;
                return `M ${sx},${sy0 - w} L ${mx},${sy0 - w} L ${mx},${ty1 - w} L ${tx},${ty1 - w} L ${tx},${ty1 + w} L ${mx},${ty1 + w} L ${mx},${sy0 + w} L ${sx},${sy0 + w} Z`;
            }

            if (curveStyle === 'organic') {
                // SankeyArt-style S-curves with easing
                const dx = tx - sx;
                const dy = ty1 - sy0;

                const tension = 0.4 + (curvature * 0.3);
                const cpx1 = sx + dx * tension;
                const cpx2 = tx - dx * tension;

                const cpyOffset = Math.min(Math.abs(dy) * 0.1, 20);
                const cpy1 = sy0 + (dy > 0 ? cpyOffset : -cpyOffset);
                const cpy2 = ty1 - (dy > 0 ? cpyOffset : -cpyOffset);

                return `M ${sx},${sy0 - w} C ${cpx1},${cpy1 - w} ${cpx2},${cpy2 - w} ${tx},${ty1 - w} L ${tx},${ty1 + w} C ${cpx2},${cpy2 + w} ${cpx1},${cpy1 + w} ${sx},${sy0 + w} Z`;
            }

            // Default: geometric
            curvature = Math.min(0.5, curvature);
            const dx = Math.max(1, tx - sx);
            const dy = ty1 - sy0;
            const ratio = dx / (Math.abs(dy) + 0.1);
            if (ratio < 1) curvature = 0.5 - (0.5 - curvature) * Math.sqrt(ratio);

            const xi = d3.interpolateNumber(sx, tx);
            const x2 = xi(curvature), x3 = xi(1 - curvature);

            return `M ${sx},${sy0 - w} C ${x2},${sy0 - w} ${x3},${ty1 - w} ${tx},${ty1 - w} L ${tx},${ty1 + w} C ${x3},${ty1 + w} ${x2},${sy0 + w} ${sx},${sy0 + w} Z`
                .replace(/\s+/g, ' ').trim();
        };

        // Gradients
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        links.forEach((l: any) => {
            const id = `grad-${l.source.id}-${l.target.id}`;
            let g = defs.select<SVGLinearGradientElement>('#' + id);
            if (g.empty()) {
                g = defs.append('linearGradient').attr('id', id).attr('gradientUnits', 'userSpaceOnUse');
                g.append('stop').attr('offset', '0%').attr('class', 's');
                g.append('stop').attr('offset', '50%').attr('class', 'm'); // Mid point
                g.append('stop').attr('offset', '100%').attr('class', 't');
            }
            g.attr('x1', l.source.x1).attr('x2', l.target.x0);

            const sourceColor = l.source.flowColor || getNodeColor(l.source, 0);
            const targetColor = getNodeColor(l.target, 0);
            const gradType = settings.linkGradientType || 'source-to-target';

            if (gradType === 'both-ends') {
                g.select('.s').attr('stop-color', sourceColor).attr('stop-opacity', 1);
                g.select('.m').attr('stop-color', d3.interpolateRgb(sourceColor, targetColor)(0.5)).attr('stop-opacity', 0.6);
                g.select('.t').attr('stop-color', targetColor).attr('stop-opacity', 1);
            } else {
                g.select('.s').attr('stop-color', sourceColor).attr('stop-opacity', 1);
                g.select('.m').attr('stop-color', d3.interpolateRgb(sourceColor, targetColor)(0.5)).attr('stop-opacity', 1);
                g.select('.t').attr('stop-color', targetColor).attr('stop-opacity', 1);
            }
        });

        // Focus Mode Logic (Path Tracing)
        const connectedIds = new Set<string>();
        const connectedLinks = new Set<string>();

        if (selectedNodeId) {
            // Traverse Upstream
            const traverseUp = (nId: string) => {
                connectedIds.add(nId);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                links.forEach((l: any) => {
                    if (l.target.id === nId) {
                        connectedLinks.add(`${l.source.id}-${l.target.id}`);
                        if (!connectedIds.has(l.source.id)) traverseUp(l.source.id);
                    }
                });
            };
            // Traverse Downstream
            const traverseDown = (nId: string) => {
                connectedIds.add(nId);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                links.forEach((l: any) => {
                    if (l.source.id === nId) {
                        connectedLinks.add(`${l.source.id}-${l.target.id}`);
                        if (!connectedIds.has(l.target.id)) traverseDown(l.target.id);
                    }
                });
            };

            traverseUp(selectedNodeId);
            traverseDown(selectedNodeId);
        }

        const isDimmed = (nId?: string, linkKey?: string) => {
            if (!settings.enableFocusMode) return false;
            if (!selectedNodeId && selectedLinkIndex === null) return false;
            // Link Hover takes precedence
            if (selectedLinkIndex !== null) return true; // Handled by hover logic
            // Node Selection Focus
            if (selectedNodeId) {
                if (nId && !connectedIds.has(nId)) return true;
                if (linkKey && !connectedLinks.has(linkKey)) return true;
            }
            return false;
        };


        // Link Join
        const linkSel = linkLayer.selectAll('.sankey-link')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .data(links, (d: any) => `${d.source.id}-${d.target.id}`);

        // Exit: Fade out
        linkSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        // Enter: Init opacity 0, d at final pos (prevents flying from 0,0)
        const linkEnter = linkSel.enter().append('path')
            .attr('class', 'sankey-link cursor-pointer')
            .attr('d', smoothLinkPath) // Start at correct position
            .attr('opacity', 0);

        const linkUpdate = linkEnter.merge(linkSel as any);

        // Layout Transition (Geometry)
        linkUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('d', smoothLinkPath);

        // Style Transition (Opacity/Color)
        linkUpdate.transition('style').duration(500)
            .attr('opacity', ((d: any, i: number) => {
                // Hover overrides everything
                if (selectedLinkIndex !== null) return selectedLinkIndex === links.indexOf(d) ? 0.9 : 0.1;
                // Focus Mode
                if (isDimmed(undefined, `${d.source.id}-${d.target.id}`)) return 0.1;
                return settings.linkOpacity;
            }) as any)
            .style('mix-blend-mode', settings.linkBlendMode || 'normal')
            .attr('fill', (d: any) => {
                // Smart Financial Theme
                if (settings.useFinancialTheme) {
                    const sourceCategory = d.source.category;
                    if (sourceCategory === 'revenue') return '#10b981'; // Green
                    if (sourceCategory === 'expense') return '#ef4444'; // Red
                    if (sourceCategory === 'profit') return '#3b82f6';  // Blue
                    return '#6b7280'; // Neutral gray
                }

                // Original logic
                return settings.linkGradient ? `url(#grad-${d.source.id}-${d.target.id})` : (d.source.flowColor || getNodeColor(d.source, 0));
            });



        // --- Particles System ---
        particleLayer.selectAll('*').remove(); // Clear previous
        if (settings.showParticles) {
            // ... (Keep existing particle logic, it rebuilds every frame anyway)
            // For brevity, I'm assuming particle logic is re-instantiated or we can just leave it as is.
            // But wait, the previous code block included particles in the middle. I should be careful not to delete logic I'm not viewing.
            // The view showed lines 386+. I am replacing only up to 483.
            // My replacement content ends before particles logic starts?
            // Actually, I need to check line numbers.
            // View was 150-400. And 450-550.
            // My replacement targets lines 275-483 (approx).
            // Wait, I need to be precise.

            // The StartLine I am aiming for is `275`.
            // The EndLine is `483`.

            // BUT, I need to make sure I don't delete the particle logic which starts around line 386.
            // I see `particleLayer` logic in my viewing history around line 386.
            // So I MUST include the particle logic in the ReplacementContent OR split the edit.

            // Splitting is safer. 
            // Chunk 1: Links (Lines 275 - 383)
            // Chunk 2: Nodes (Lines 456 - 483)
        }



        // --- Particles System ---
        particleLayer.selectAll('*').remove(); // Clear previous
        if (settings.showParticles) {
            const particleData: any[] = [];
            // Generate particles based on flow value
            links.forEach((link: any, i: number) => {
                const pathBuffer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathBuffer.setAttribute('d', smoothLinkPath(link));
                const length = pathBuffer.getTotalLength();

                // Density: more particles for wider links, but capped
                const count = Math.min(20, Math.max(3, Math.floor(link.value / d3.max(links, (l: any) => l.value) * 15)));

                for (let j = 0; j < count; j++) {
                    particleData.push({
                        linkIndex: i,
                        path: pathBuffer,
                        length: length,
                        offset: Math.random() * length, // Random start
                        speed: (1 + Math.random()) * (settings.particleSpeed || 1) * 2 // Var speed
                    });
                }
            });

            // Particles
            const particles = particleLayer.selectAll('.particle')
                .data(particleData)
                .enter().append('circle')
                .attr('class', 'particle')
                .attr('r', PARTICLE_SIZE)
                .attr('fill', 'white')
                .attr('opacity', 0.6)
                .attr('pointer-events', 'none');

            // Animation Loop
            const timer = d3.timer((elapsed) => {
                particles.attr('transform', function (d: any) {
                    d.offset += d.speed;
                    if (d.offset > d.length) d.offset = 0;
                    const p = d.path.getPointAtLength(d.offset);
                    return `translate(${p.x},${p.y})`;
                });
            });

            // Cleanup timer on re-render
            (svg.node() as any).__particleTimer = timer;
        } else {
            if ((svg.node() as any).__particleTimer) ((svg.node() as any).__particleTimer as d3.Timer).stop();
        }

        // Interaction
        linkLayer.selectAll('.sankey-link')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .on('mouseenter', function (e, d: any) {
                if (selectedLinkIndex === null) {
                    d3.select(this).transition('style').duration(200).attr('opacity', 0.8);
                    const formatted = formatValue(d.value, true);

                    // Calculate percentage of source node's total output
                    const sourceOutputTotal = d.source.sourceLinks?.reduce((sum: number, link: any) => sum + link.value, 0) || d.value;
                    const percentage = sourceOutputTotal > 0 ? ((d.value / sourceOutputTotal) * 100).toFixed(1) : '0';

                    showTooltip(e, `${d.source.name} → ${d.target.name}${formatted ? `: ${formatted}` : ''} (${percentage}%)`);
                }
            })
            .on('mouseleave', function () {
                if (selectedLinkIndex === null) {
                    linkLayer.selectAll('.sankey-link').transition('style').duration(200).attr('opacity', settings.linkOpacity);
                    hideTooltip();
                }
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .on('click', (e, d: any) => dispatch({ type: 'SELECT_LINK', payload: links.indexOf(d) }));


        // --- Nodes ---
        const nodeSel = nodeLayer.selectAll('.sankey-node')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .data(nodes, (d: any) => d.id);

        nodeSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        const nodeEnter = nodeSel.enter().append('g')
            .attr('class', 'sankey-node cursor-pointer')
            .attr('opacity', 0)
            .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`); // Start at correct pos

        // FORCE sharp corners - SankeyArt style (always 0, no fallback)
        nodeEnter.append('rect')
            .attr('rx', 0)
            .attr('ry', 0)
            .attr('class', 'node-rect');


        const nodeUpdate = nodeEnter.merge(nodeSel as any);

        // Layout Transition
        nodeUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

        // Style Transition
        nodeUpdate.transition('style').duration(500)
            .attr('opacity', (d: any) => isDimmed(d.id) ? 0.1 : 1);

        nodeUpdate.select('rect')
            .transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('rx', 0)  // FORCE sharp - SankeyArt style
            .attr('ry', 0)
            .attr('width', (d: any) => d.x1 - d.x0)
            .attr('height', (d: any) => d.y1 - d.y0)
            .attr('fill', (d: any, i) => getNodeColor(d, i))
            .style('filter', 'none');  // Remove any shadow filter


        // Drag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drag = d3.drag<any, any>()
            .filter((e) => !e.ctrlKey && !e.button) // Only left-click, no Ctrl
            .subject((e, d) => ({ x: d.x0, y: d.y0 }))
            .on('start', function (e, d) {
                d3.select(this).raise().attr('cursor', 'grabbing');
                (d as any)._dragStartX = e.x; (d as any)._dragStartY = e.y;
                (d as any)._dragStartTime = Date.now();
            })
            .on('drag', function (e, d) {
                const w = d.x1 - d.x0, h = d.y1 - d.y0;
                let newX = e.x;

                // Snap Logic
                if (settings.snapToGrid) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cols = Array.from(new Set(nodes.map((n: any) => n.x0))).sort((a: any, b: any) => a - b);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    newX = cols.reduce((p, c) => Math.abs(c - e.x) < Math.abs(p - e.x) ? c : p);
                } else {
                    // Free drag constrained to canvas
                    newX = Math.max(padding.left, Math.min(width - padding.right - w, e.x));
                }

                const newY = Math.max(padding.top, Math.min(height - padding.bottom - h, e.y));

                // Snap-to-Align Guides
                guideLayer.selectAll('*').remove();

                if (!settings.snapToGrid) {
                    const alignThreshold = 5;
                    const guides: { type: 'h' | 'v', value: number }[] = [];

                    // Find alignment guides
                    nodes.forEach((node: any) => {
                        if (node.id === d.id) return;

                        // Vertical alignment (x-axis)
                        const xPositions = [
                            node.x0,                        // Left edge
                            (node.x0 + node.x1) / 2,       // Center
                            node.x1                         // Right edge
                        ];
                        const dragXPositions = [
                            newX,                           // Left edge
                            newX + w / 2,                   // Center
                            newX + w                        // Right edge
                        ];

                        xPositions.forEach((nodeX, i) => {
                            dragXPositions.forEach((dragX, j) => {
                                if (Math.abs(nodeX - dragX) < alignThreshold) {
                                    guides.push({ type: 'v', value: nodeX });
                                    // Snap to alignment
                                    if (j === 0) newX = nodeX;               // Align left
                                    else if (j === 1) newX = nodeX - w / 2;  // Align center
                                    else newX = nodeX - w;                   // Align right
                                }
                            });
                        });

                        // Horizontal alignment (y-axis)
                        const yPositions = [
                            node.y0,                        // Top edge
                            (node.y0 + node.y1) / 2,       // Center
                            node.y1                         // Bottom edge
                        ];
                        const dragYPositions = [
                            newY,                           // Top edge
                            newY + h / 2,                   // Center
                            newY + h                        // Bottom edge
                        ];

                        yPositions.forEach((nodeY, i) => {
                            dragYPositions.forEach((dragY, j) => {
                                if (Math.abs(nodeY - dragY) < alignThreshold) {
                                    guides.push({ type: 'h', value: nodeY });
                                }
                            });
                        });
                    });

                    // Draw guides
                    guides.forEach(guide => {
                        if (guide.type === 'v') {
                            guideLayer.append('line')
                                .attr('x1', guide.value).attr('x2', guide.value)
                                .attr('y1', 0).attr('y2', height)
                                .attr('stroke', '#3b82f6')
                                .attr('stroke-width', 1)
                                .attr('stroke-dasharray', '4 2');
                        } else {
                            guideLayer.append('line')
                                .attr('x1', 0).attr('x2', width)
                                .attr('y1', guide.value).attr('y2', guide.value)
                                .attr('stroke', '#3b82f6')
                                .attr('stroke-width', 1)
                                .attr('stroke-dasharray', '4 2');
                        }
                    });
                } else {
                    // Original grid snap guide
                    guideLayer.append('line').attr('x1', newX + w / 2).attr('x2', newX + w / 2).attr('y1', 0).attr('y2', height)
                        .attr('stroke', '#3b82f6').attr('stroke-dasharray', '4 2');
                }

                d3.select(this).attr('transform', `translate(${newX},${newY})`);

                // Update temp data for links
                d.x0 = newX; d.x1 = newX + w; d.y0 = newY; d.y1 = newY + h;
                sankeyGenerator.update(processedGraph);
                linkLayer.selectAll('.sankey-link').attr('d', smoothLinkPath);
            })
            .on('end', function (e, d) {
                guideLayer.selectAll('*').remove();
                d3.select(this)
                    .attr('cursor', 'pointer')
                    .transition()
                    .duration(100)
                    .ease(d3.easeQuadOut);  // Smooth settle
                const dist = Math.hypot(e.x - (d as any)._dragStartX, e.y - (d as any)._dragStartY);
                if (dist < 3 && (Date.now() - (d as any)._dragStartTime < 500)) {
                    // Click
                    handleNodeClick(e.sourceEvent, d);
                } else {
                    dispatch({ type: 'MOVE_NODE', payload: { id: d.id, x: d.x0, y: d.y0 } });
                }
            });

        // Apply drag to ALL nodes (enter + update), not just new ones
        nodeUpdate.call(drag)
            .on('dblclick', function (e, d: any) {
                e.stopPropagation();
                setEditingNodeId(d.id);
                setEditText(d.name);
                // The input will be focused via useEffect when editingNodeId changes
            });


        // --- Labels ---
        const labelSel = labelLayer.selectAll('.sankey-label')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .data(nodes, (d: any) => d.id);

        labelSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        const labelEnter = labelSel.enter().append('text')
            .attr('class', 'sankey-label')
            .attr('opacity', 0)
            .style('pointer-events', 'none'); // Let clicks pass through to node

        const labelUpdate = labelEnter.merge(labelSel as any);

        // Appear/Disappear
        labelUpdate.transition('style').duration(500)
            .attr('opacity', 1);

        // Move
        labelUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('transform', (d: any) => {
                const nodeWidth = d.x1 - d.x0;

                // Get customization (cached or fresh lookup)
                const custom = getCustomization(d.id);
                const pos = settings.labelPosition;

                let x = 0;
                let y = (d.y0 + d.y1) / 2;

                if (pos === 'external') {
                    const isLeft = d.x0 < width / 2;
                    x = isLeft ? d.x0 - 50 : d.x1 + 50;
                } else if (pos === 'inside') {
                    x = d.x0 + nodeWidth / 2;
                } else if (pos === 'right') {
                    // Standard Right
                    x = d.x1 + 6;
                } else {
                    // Standard Left
                    x = d.x0 - 6;
                }

                // Override if near edges
                if (pos !== 'inside' && pos !== 'external') {
                    if (d.x0 < width / 2) {
                        x = d.x1 + 6; // Force right for left-side nodes usually
                    } else {
                        x = d.x0 - 6; // Force left for right-side nodes
                    }
                }

                return `translate(${x}, ${y})`;
            })
            .each(function (d: any) {
                const text = d3.select(this);
                text.text(null); // Clear previous

                const custom = getCustomization(d.id);
                const pos = settings.labelPosition;

                // Determine Alignment
                let align = 'start';
                if (pos === 'inside') align = 'middle';
                else {
                    // Auto-detect based on canvas side
                    align = (d.x0 < width / 2) ? 'start' : 'end';
                }

                // Override
                if (custom?.labelAlignment) align = custom.labelAlignment === 'left' ? 'start' : custom.labelAlignment === 'right' ? 'end' : 'middle';

                text.attr('text-anchor', align);

                // Line 1: Name
                const nameTspan = text.append('tspan')
                    .attr('x', 0)
                    .attr('dy', pos === 'inside' ? '-0.8em' : '-0.4em') // If inside, shift up to make room
                    .text(custom?.labelText || d.name)
                    .attr('font-weight', (custom?.labelBold ?? settings.labelBold) ? 'bold' : 'normal')
                    .attr('font-style', (custom?.labelItalic ?? settings.labelItalic) ? 'italic' : 'normal')
                    .attr('font-family', custom?.labelFontFamily ?? settings.labelFontFamily)
                    .attr('font-size', custom?.labelFontSize ?? settings.labelFontSize)
                    .attr('fill', custom?.labelColor || '#1f2937'); // Fixed light mode adapt


                // Line 2: Value
                const valueTspan = text.append('tspan')
                    .attr('x', 0)
                    .attr('dy', '1.2em')
                    .text(formatValue(d.value))
                    .attr('font-family', custom?.labelFontFamily ?? settings.labelFontFamily)
                    .attr('font-size', (custom?.labelFontSize ?? settings.labelFontSize) * 0.9) // Slightly smaller
                    .attr('font-weight', 'normal')
                    .attr('fill', custom?.valueColor || '#6b7280');


                // Line 3: Custom Text (e.g. "+12%")
                if (custom?.showSecondLine && custom.secondLineText) {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', '1.2em')
                        .text(custom.secondLineText)
                        .attr('font-size', custom.secondLineFontSize || ((custom?.labelFontSize ?? settings.labelFontSize) * 0.85))
                        .attr('font-weight', custom.secondLineBold ? 'bold' : 'normal')
                        .attr('font-style', custom.secondLineItalic ? 'italic' : 'normal')
                        .attr('fill', custom.secondLineColor || '#10b981'); // Green default
                }

                // Line 4: More Custom Text
                if (custom?.showThirdLine && custom.thirdLineText) {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', '1.2em')
                        .text(custom.thirdLineText)
                        .attr('font-size', custom.thirdLineFontSize || ((custom?.labelFontSize ?? settings.labelFontSize) * 0.75))
                        .attr('font-weight', custom.thirdLineBold ? 'bold' : 'normal')
                        .attr('font-style', custom.thirdLineItalic ? 'italic' : 'normal')
                        .attr('fill', custom.thirdLineColor || '#6b7280');
                }
            });

        // --- Independent Labels (Rich Content) ---
        const independentLayer = getLayer('layer-independent');
        independentLayer.raise(); // Ensure on top

        const indepSel = independentLayer.selectAll('.indep-label')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .data(state.independentLabels || [], (d: any) => d.id);

        indepSel.exit().remove();

        const indepEnter = indepSel.enter().append('g')
            .attr('class', 'indep-label cursor-move');

        const indepUpdate = indepEnter.merge(indepSel as any)
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

        // Render Content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        indepUpdate.each(function (d: any) {
            const g = d3.select(this);
            g.selectAll('*').remove(); // Re-render

            if (d.type === 'image') {
                g.append('image')
                    .attr('href', d.src || '')
                    .attr('width', d.width || 100)
                    .attr('height', d.height || 100)
                    .attr('preserveAspectRatio', 'xMidYMid meet')
                    .attr('opacity', d.opacity ?? 1);
            } else {
                // Text
                g.append('text')
                    .text(d.text)
                    .attr('font-size', d.fontSize || 16)
                    .attr('font-family', d.fontFamily || 'Inter, sans-serif')
                    .attr('font-weight', d.bold ? 'bold' : 'normal')
                    .attr('font-style', d.italic ? 'italic' : 'normal')
                    .attr('fill', d.color || '#333333')
                    .attr('opacity', d.opacity ?? 1);
            }

            // Selection Outline
            if (state.selectedLabelId === d.id) {
                const w = d.width || (d.fontSize || 16) * (d.text?.length || 5) * 0.6;
                const h = d.height || (d.fontSize || 16);
                g.append('rect')
                    .attr('x', d.type === 'image' ? 0 : -5)
                    .attr('y', d.type === 'image' ? 0 : -h)
                    .attr('width', w + 10)
                    .attr('height', h + 10)
                    .attr('fill', 'none')
                    .attr('stroke', '#3b82f6')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4 2');
            }
        });

        // Drag Behavior for Independent Labels
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dragLabel = d3.drag<any, any>()
            .on('start', function () {
                d3.select(this).raise();
            })
            .on('drag', function (e, d) {
                d3.select(this).attr('transform', `translate(${e.x},${e.y})`);
            })
            .on('end', function (e, d) {
                dispatch({ type: 'UPDATE_INDEPENDENT_LABEL', payload: { id: d.id, updates: { x: e.x, y: e.y } } });
            });

        indepEnter.call(dragLabel)
            .on('click', (e, d) => {
                e.stopPropagation();
                dispatch({ type: 'SELECT_LABEL', payload: d.id });
            });


        // --- Canvas Interactions (Add Items) ---
        svg.on('mousedown', (event) => {
            if (studioState.currentTool !== 'annotate') return;
            const [x, y] = d3.pointer(event, mainGroup.node());
            setDrawingBox({ startX: x, startY: y, currentX: x, currentY: y });
        });

        svg.on('mousemove', (event) => {
            if (!drawingBox) return;
            const [x, y] = d3.pointer(event, mainGroup.node());
            setDrawingBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
        });

        svg.on('mouseup', (event) => {
            if (!drawingBox) return;
            const x = Math.min(drawingBox.startX, drawingBox.currentX);
            const y = Math.min(drawingBox.startY, drawingBox.currentY);
            const width = Math.abs(drawingBox.currentX - drawingBox.startX);
            const height = Math.abs(drawingBox.currentY - drawingBox.startY);

            if (width > 5 && height > 5) {
                const label = window.prompt('Label for this box? (Optional)', '');
                dispatch({
                    type: 'ADD_ANNOTATION_BOX',
                    payload: {
                        id: `box-${Date.now()}`,
                        x, y, width, height,
                        label: label || undefined,
                        borderColor: '#dc2626',
                        borderWidth: 2,
                        borderStyle: 'dashed'
                    }
                });
            }
            setDrawingBox(null);
            setTool('select');
        });

        svg.on('click', (event) => {
            // Ignore if handled by children
            if (event.defaultPrevented) return;

            // Only handle if we are in an adding mode
            if (studioState.currentTool === 'select' || studioState.currentTool === 'pan') return;

            const [x, y] = d3.pointer(event, mainGroup.node());

            if (studioState.currentTool === 'addLabel') {
                const id = `label-${Date.now()}`;
                dispatch({
                    type: 'ADD_INDEPENDENT_LABEL', payload: {
                        id, type: 'text', text: 'Double click to edit', x, y, fontSize: 24, fontFamily: 'Inter, sans-serif', color: '#111827', bold: true
                    }
                });
                setTool('select');
            } else if (studioState.currentTool === 'addImage') {
                const url = window.prompt("Enter Image URL (e.g. Logo)", "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg");
                if (url) {
                    const id = `img-${Date.now()}`;
                    dispatch({
                        type: 'ADD_INDEPENDENT_LABEL', payload: {
                            id, type: 'image', text: 'Image', src: url, x, y, width: 80, height: 80
                        }
                    });
                }
                setTool('select');
            }
        });

        return () => {
            if ((svg.node() as any).__particleTimer) ((svg.node() as any).__particleTimer as d3.Timer).stop();
            svg.on('click', null); // Cleanup click listener
        };

    }, [data, settings, selectedNodeId, selectedLinkIndex, state.customLayout, state.independentLabels, state.selectedLabelId, studioState.currentTool, dispatch, getNodeColor, formatValue, getCustomization, handleNodeClick, setTool]);

    return (
        <div ref={containerRef} className="w-full h-full bg-white border-0 overflow-hidden relative">
            <svg

                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`0 0 ${settings.width} ${settings.height}`}
                className="w-full h-full main-canvas"
                style={{ minHeight: '600px' }}
            />
            {/* Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white  p-1.5 rounded-lg shadow-lg border border-gray-200 ">
                <button
                    onClick={() => {
                        const svg = d3.select(svgRef.current);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const zoom = (svg.node() as any).__zoomBehavior;
                        if (zoom) svg.transition().duration(300).call(zoom.scaleBy, 1.2);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-700 "
                    title="Zoom In"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button
                    onClick={() => {
                        const svg = d3.select(svgRef.current);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const zoom = (svg.node() as any).__zoomBehavior;
                        if (zoom) svg.transition().duration(300).call(zoom.scaleBy, 0.8);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-700 "
                    title="Zoom Out"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <div className="h-px bg-gray-200 my-0.5" />
                <button
                    onClick={() => {
                        const svg = d3.select(svgRef.current);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const zoom = (svg.node() as any).__zoomBehavior;
                        if (zoom) svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-700 "
                    title="Reset View"
                >
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>

            {/* Top Toolbar */}
            {/* Top Toolbar - REMOVED (Handled by Toolbar component) */}

            {popover && (
                <NodeEditPopover
                    node={popover.node}
                    position={popover.position}
                    onClose={closePopover}
                    onAIAction={(nodeId, action) => {
                        // Dispatch custom event for AI Assistant to handle
                        const event = new CustomEvent('ai-node-action', {
                            detail: { nodeId, action, nodeName: popover.node.name }
                        });
                        window.dispatchEvent(event);
                    }}
                />
            )}

            {settings.showMiniMap && <MiniMap />}

            {editingNodeId && (
                <div
                    className="absolute z-50 pointer-events-none"
                    style={{
                        left: (data.nodes.find(n => n.id === editingNodeId)?.x0 ?? 0) + 'px',
                        top: (data.nodes.find(n => n.id === editingNodeId)?.y0 ?? 0) + 'px',
                    }}
                >
                    <input
                        autoFocus
                        className="pointer-events-auto px-2 py-1 bg-white border-2 border-blue-500 rounded shadow-lg outline-none text-sm font-medium min-w-[120px]"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => {
                            if (editText.trim()) {
                                dispatch({ type: 'UPDATE_NODE', payload: { id: editingNodeId, updates: { name: editText } } });
                            }
                            setEditingNodeId(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (editText.trim()) {
                                    dispatch({ type: 'UPDATE_NODE', payload: { id: editingNodeId, updates: { name: editText } } });
                                }
                                setEditingNodeId(null);
                            }
                            if (e.key === 'Escape') {
                                setEditingNodeId(null);
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}
