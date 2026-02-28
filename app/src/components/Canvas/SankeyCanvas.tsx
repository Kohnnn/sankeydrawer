'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyCenter, sankeyJustify, sankeyLeft, sankeyRight } from 'd3-sankey';
import { useDiagram } from '@/context/DiagramContext';
import { useStudio } from '@/context/StudioContext';
import { SankeyNode, NodeCustomization } from '@/types/sankey';
import { sanitizeComparisonLabel } from '@/lib/dsl-parser';
import NodeEditPopover from './NodeEditPopover';
import MiniMap from './MiniMap';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Semantic colors
const COLORS: Record<string, string> = {
    revenue: '#00a34c',
    expense: '#d1003f',
    profit: '#00a34c',
    neutral: '#94a3b8',
};

const LINK_COLORS: Record<string, string> = {
    revenue: '#7fc8a4',
    expense: '#d88aa5',
    profit: '#8ec0dd',
    neutral: '#bcc7d6',
};

const PALETTE = d3.schemeTableau10;

interface PopoverState {
    node: SankeyNode;
    position: { x: number; y: number };
}

export default function SankeyCanvas() {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { state, dispatch } = useDiagram();
    const { state: studioState, dispatch: studioDispatch, setTool } = useStudio();
    const { data, settings, selectedNodeId, nodeCustomizations } = state;
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [statusText, setStatusText] = useState('Click on any element to edit it');

    const balanceSummary = useMemo(() => {
        const nodeBalanceMap = new Map<string, { incoming: number; outgoing: number }>();

        data.nodes.forEach((node) => {
            nodeBalanceMap.set(node.id, { incoming: 0, outgoing: 0 });
        });

        const resolveNodeId = (ref: string | number) => {
            if (typeof ref === 'string') {
                return ref;
            }

            return data.nodes[ref]?.id;
        };

        data.links.forEach((link) => {
            const sourceId = resolveNodeId(link.source);
            const targetId = resolveNodeId(link.target);
            if (!sourceId || !targetId) {
                return;
            }

            const sourceBalance = nodeBalanceMap.get(sourceId);
            const targetBalance = nodeBalanceMap.get(targetId);

            if (sourceBalance) {
                sourceBalance.outgoing += Number(link.value || 0);
            }

            if (targetBalance) {
                targetBalance.incoming += Number(link.value || 0);
            }
        });

        let imbalancedCount = 0;

        nodeBalanceMap.forEach((balance) => {
            if (balance.incoming > 0 && balance.outgoing > 0 && Math.abs(balance.incoming - balance.outgoing) > 0.1) {
                imbalancedCount += 1;
            }
        });

        return {
            allBalanced: imbalancedCount === 0,
            imbalancedCount,
        };
    }, [data.links, data.nodes]);

    // In-place editing state
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    // Annotation drawing state (ref-based to avoid full re-render on pointer move)
    const drawingBoxRef = useRef<{
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

        const outgoingCount = node.sourceLinks?.length ?? 0;
        const incomingCount = node.targetLinks?.length ?? 0;
        if (outgoingCount > 0 && incomingCount === 0) return COLORS.revenue;
        if (incomingCount > 0 && outgoingCount === 0) return COLORS.expense;
        if (incomingCount > 0 && outgoingCount > 0) return COLORS.profit;

        return PALETTE[index % PALETTE.length];
    }, [getCustomization]);

    // Format value for display
    const formatValue = useCallback((value: number, forceDisplay = false): string => {
        const { valuePrefix, valueSuffix, valueDecimals, valueMode } = settings;

        if (!forceDisplay && valueMode === 'hidden') return '';

        const decimals = valueDecimals === -1 ? 2 : valueDecimals;
        let formatted: string;
        if (valueMode === 'short') {
            if (value >= 1_000_000_000) {
                formatted = (value / 1_000_000_000).toFixed(decimals) + 'B';
            } else if (value >= 1_000_000) {
                formatted = (value / 1_000_000).toFixed(decimals) + 'M';
            } else if (value >= 1_000) {
                formatted = (value / 1_000).toFixed(decimals) + 'K';
            } else {
                formatted = value.toFixed(decimals);
            }
        } else {
            formatted = value.toLocaleString('en-US', {
                minimumFractionDigits: valueDecimals === -1 ? 0 : valueDecimals,
                maximumFractionDigits: valueDecimals === -1 ? 20 : valueDecimals
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
        const DEFAULT_LABEL_NAME_SIZE = 13;
        const DEFAULT_LABEL_VALUE_SIZE = 12;

        const frame = svg.selectAll<SVGRectElement, null>('rect.canvas-frame').data([null]);
        frame
            .enter()
            .insert('rect', ':first-child')
            .attr('class', 'canvas-frame')
            .merge(frame as any)
            .attr('x', 0.5)
            .attr('y', 0.5)
            .attr('width', Math.max(0, width - 1))
            .attr('height', Math.max(0, height - 1))
            .attr('fill', settings.canvasBackground || '#ffffff')
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none');

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
                    if (target.closest('.sankey-node') || target.closest('.sankey-label') || target.closest('.indep-label')) return false;
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
            mainGroup.selectAll('.layer-links, .layer-nodes, .layer-labels').transition().duration(500).attr('opacity', 0).remove();
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

        const horizontalBreathingRoom = Math.min(26, Math.max(12, settings.nodeWidth * 1.35));
        const verticalBreathingRoom = Math.min(16, Math.max(8, settings.nodePadding * 0.2));
        const extent: [[number, number], [number, number]] = [
            [padding.left + horizontalBreathingRoom, padding.top + verticalBreathingRoom],
            [width - padding.right - horizontalBreathingRoom, height - padding.bottom - verticalBreathingRoom],
        ];

        const alignStrategy =
            settings.nodeAlignment === 'left'
                ? sankeyLeft
                : settings.nodeAlignment === 'right'
                    ? sankeyRight
                    : settings.nodeAlignment === 'center'
                        ? sankeyCenter
                        : sankeyJustify;

        const sankeyGenerator = sankey<any, any>()
            .nodeId((d: any) => d.id)
            .nodeWidth(settings.nodeWidth)
            .nodeAlign(alignStrategy)
            .extent(extent);

        // Filter & Clone Data
        const validLinks = data.links.filter((l) => {
            const source = typeof l.source === 'string' ? l.source : l.source;
            const target = typeof l.target === 'string' ? l.target : l.target;
            if (!source || !target) return false;
            return data.nodes.some(n => n.id === source) && data.nodes.some(n => n.id === target);
        });

        if (validLinks.length === 0 && data.links.length > 0) {
            // Links exist but none are valid - show empty message
            mainGroup.selectAll('.layer-links, .layer-nodes, .layer-labels').transition().duration(500).attr('opacity', 0).remove();
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

        const buildGraphInput = () => ({
            nodes: data.nodes.map((node) => ({ ...node })),
            links: validLinks.map((link) => ({ ...link })),
        });

        let processedGraph: any | null = null;
        const minPadding = 8;
        const preferredPadding = Math.max(minPadding, settings.nodePadding);
        const paddingCandidates = Array.from(new Set([
            preferredPadding,
            Math.max(minPadding, preferredPadding - 4),
            Math.max(minPadding, preferredPadding - 8),
            Math.max(minPadding, preferredPadding - 12),
            16,
            12,
            10,
            8,
        ]));

        for (const nodePadding of paddingCandidates) {
            sankeyGenerator.nodePadding(nodePadding);

            try {
                const candidateGraph = sankeyGenerator(buildGraphInput());
                const hasOverflow = candidateGraph.nodes.some((node: any) =>
                    node.x0 < extent[0][0] ||
                    node.x1 > extent[1][0] ||
                    node.y0 < extent[0][1] ||
                    node.y1 > extent[1][1],
                );

                processedGraph = candidateGraph;
                if (!hasOverflow) {
                    break;
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (!processedGraph) {
            return;
        }

        const { nodes, links } = processedGraph;

        const clampNodeToExtent = (node: any) => {
            const nodeWidth = node.x1 - node.x0;
            const nodeHeight = node.y1 - node.y0;
            const minX = extent[0][0];
            const maxX = extent[1][0];
            const minY = extent[0][1];
            const maxY = extent[1][1];

            const clampedX = Math.max(minX, Math.min(Math.max(minX, maxX - nodeWidth), node.x0));
            const clampedY = Math.max(minY, Math.min(Math.max(minY, maxY - nodeHeight), node.y0));

            node.x0 = clampedX;
            node.x1 = clampedX + nodeWidth;
            node.y0 = clampedY;
            node.y1 = clampedY + nodeHeight;
        };

        nodes.forEach((node: any) => clampNodeToExtent(node));
        sankeyGenerator.update(processedGraph);

        // Custom Layout Override
        if (state.customLayout && state.customLayout.nodes) {
            nodes.forEach((node: any) => {
                const customPos = state.customLayout.nodes[node.id];
                if (customPos) {
                    const nW = node.x1 - node.x0;
                    const nH = node.y1 - node.y0;

                    node.x0 = customPos.x;
                    node.x1 = customPos.x + nW;
                    node.y0 = customPos.y;
                    node.y1 = customPos.y + nH;

                    clampNodeToExtent(node);
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
        const nodeLayer = getLayer('layer-nodes');
        const labelLayer = getLayer('layer-labels');
        const guideLayer = getLayer('layer-guides');
        const annotationLayer = getLayer('layer-annotations');
        const logoLayer = getLayer('layer-logo');
        const legendLayer = getLayer('layer-legend');
        const titleLayer = getLayer('layer-title');
        labelLayer.raise();

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

            const startX = pos.includes('right') ? width - legendWidth - 20 : 20;
            const startY = pos.includes('bottom') ? height - legendHeight - 20 : 20;

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

        // --- Diagram Title ---
        titleLayer.selectAll('*').remove();
        if (settings.diagramTitle.trim()) {
            titleLayer
                .append('text')
                .attr('x', width / 2)
                .attr('y', 35)
                .attr('text-anchor', 'middle')
                .attr('font-family', 'Inter, sans-serif')
                .attr('font-weight', 600)
                .attr('font-size', 20)
                .attr('fill', '#1f2937')
                .style('pointer-events', 'none')
                .text(settings.diagramTitle);
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

        // --- Links (Stroke-based, SankeyArt-style) ---
        const getLinkStrokeWidth = (d: any) => Math.max(1.25, Number(d.width) || 0);

        const getLinkPath = (d: any) => {
            const sx = Number(d.source.x1);
            const tx = Number(d.target.x0);
            const sy = Number(d.y0);
            const ty = Number(d.y1);

            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) {
                return '';
            }

            const curvature = Math.max(0.18, Math.min(0.82, settings.linkCurvature || 0.45));
            const deltaX = tx - sx;
            const direction = deltaX >= 0 ? 1 : -1;
            const controlStrength = Math.max(0.2, Math.min(0.46, curvature * 0.72 + 0.08));
            const controlOffset = Math.max(8, Math.abs(deltaX) * controlStrength);
            const controlX1 = sx + controlOffset * direction;
            const controlX2 = tx - controlOffset * direction;

            return `M${sx},${sy} C${controlX1},${sy} ${controlX2},${ty} ${tx},${ty}`;
        };

        const getGradientId = (sourceId: string, targetId: string, linkIndex?: number) => {
            const encodeSegment = (value: string) =>
                Array.from(value)
                    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
                    .join('');

            return `grad-${encodeSegment(sourceId)}-${encodeSegment(targetId)}-${linkIndex ?? 0}`;
        };

        const renderLinks = [...links].sort((a: any, b: any) => {
            return Number(b.width || 0) - Number(a.width || 0);
        });

        defs.selectAll('linearGradient.link-gradient').remove();

        // Gradients
        renderLinks.forEach((l: any) => {
            const id = getGradientId(l.source.id, l.target.id, l.index);
            const g = defs
                .append('linearGradient')
                .attr('id', id)
                .attr('class', 'link-gradient')
                .attr('gradientUnits', 'userSpaceOnUse')
                .attr('x1', l.source.x1)
                .attr('y1', l.y0)
                .attr('x2', l.target.x0)
                .attr('y2', l.y1);

            const sourceColor = l.source.flowColor || getNodeColor(l.source, 0);
            const targetColor = getNodeColor(l.target, 0);

            g.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', sourceColor)
                .attr('stop-opacity', 1);

            g.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', targetColor)
                .attr('stop-opacity', 1);
        });

        const maxNodeDepth = nodes.reduce((maxDepth: number, node: any) => {
            return Math.max(maxDepth, Number(node.depth ?? 0));
        }, 0);

        type ResolvedLabelPlacement = 'left' | 'right' | 'above' | 'below' | 'inside' | 'external';

        const getAutoPlacement = (node: any): 'left' | 'right' => {
            const depth = Number(node.depth ?? 0);
            if (depth <= 0) return 'left';
            if (depth >= maxNodeDepth) return 'right';
            return 'right';
        };

        const normalizePlacement = (placement: string, node: any): ResolvedLabelPlacement => {
            if (placement === 'before') return 'left';
            if (placement === 'after') return 'right';
            if (placement === 'outside') return node.x0 < width / 2 ? 'left' : 'right';
            if (placement === 'external') return node.x0 < width / 2 ? 'left' : 'right';
            if (placement === 'inside') return 'inside';
            if (placement === 'above') return 'above';
            if (placement === 'below') return 'below';
            if (placement === 'left') return 'left';
            if (placement === 'right') return 'right';
            return getAutoPlacement(node);
        };

        const resolvePlacement = (node: any, custom?: NodeCustomization): ResolvedLabelPlacement => {
            if (custom?.labelPlacement && custom.labelPlacement !== 'auto') {
                return normalizePlacement(custom.labelPlacement, node);
            }

            if (settings.labelPosition === 'auto') {
                return getAutoPlacement(node);
            }

            return normalizePlacement(settings.labelPosition, node);
        };

        const getLabelCoordinates = (node: any, custom?: NodeCustomization) => {
            const nodeWidth = node.x1 - node.x0;
            const placement = resolvePlacement(node, custom);
            const gap = Math.max(12, settings.nodeWidth * 0.42);

            let x = node.x0 + nodeWidth / 2;
            let y = (node.y0 + node.y1) / 2;

            if (placement === 'left') {
                x = node.x0 - gap;
            } else if (placement === 'right') {
                x = node.x1 + gap;
            } else if (placement === 'above') {
                const maxIncomingWidth = Math.max(
                    0,
                    ...((node.targetLinks || []).map((link: any) => Number(link.width || 0))),
                );
                const flowClearance = Math.max(6, Math.min(24, maxIncomingWidth * 0.5));
                y = node.y0 - gap - flowClearance;
            } else if (placement === 'below') {
                y = node.y1 + gap + 12;
            } else if (placement === 'inside') {
                x = node.x0 + nodeWidth / 2;
            }

            x += custom?.labelOffsetX || 0;
            y += custom?.labelOffsetY || 0;

            return { x, y, placement };
        };

        const getLabelAnchor = (_node: any, placement: string): 'start' | 'middle' | 'end' => {
            if (placement === 'left') return 'end';
            if (placement === 'right') return 'start';
            return 'middle';
        };

        interface LabelBounds {
            x0: number;
            x1: number;
            y0: number;
            y1: number;
        }

        interface NodeBounds extends LabelBounds {
            id: string;
        }

        interface LabelLayout {
            nodeId: string;
            x: number;
            y: number;
            placement: ResolvedLabelPlacement;
            isManual: boolean;
            anchor: 'start' | 'middle' | 'end';
            nameText: string;
            valueText: string;
            comparisonText: string;
            nameSize: number;
            valueSize: number;
            comparisonSize: number;
            labelFamily: string;
            bounds: LabelBounds;
        }

        const intersects = (a: LabelBounds, b: LabelBounds) => {
            return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        };

        const textMeasureCanvas = document.createElement('canvas');
        const textMeasureContext = textMeasureCanvas.getContext('2d');

        const estimateTextWidth = (text: string, size: number, fontFamily: string, fontWeight = 500, fontStyle = 'normal') => {
            if (!text) return size * 2;
            if (!textMeasureContext) return Math.max(size * 2, text.length * size * 0.56);
            textMeasureContext.font = `${fontStyle} ${fontWeight} ${Math.max(8, size)}px ${fontFamily}`;
            return Math.max(size * 2, textMeasureContext.measureText(text).width);
        };

        const createLabelBounds = (
            x: number,
            y: number,
            anchor: 'start' | 'middle' | 'end',
            placement: string,
            nameText: string,
            valueText: string,
            comparisonText: string,
            nameSize: number,
            valueSize: number,
            comparisonSize: number,
            labelFamily: string,
        ): LabelBounds => {
            const labelWidth = Math.max(
                estimateTextWidth(nameText, nameSize, labelFamily, 600),
                estimateTextWidth(valueText, valueSize, labelFamily, 400),
                estimateTextWidth(comparisonText, comparisonSize, labelFamily, 400),
            );
            const labelHeight =
                nameSize +
                (valueText ? valueSize + 4 : 0) +
                (comparisonText ? comparisonSize + 3 : 0);

            let x0 = x - labelWidth / 2;
            if (anchor === 'start') {
                x0 = x;
            } else if (anchor === 'end') {
                x0 = x - labelWidth;
            }

            const y0 = placement === 'above' ? y - nameSize : y - labelHeight / 2;
            const paddingPx = 2;

            return {
                x0: x0 - paddingPx,
                x1: x0 + labelWidth + paddingPx * 2,
                y0: y0 - paddingPx,
                y1: y0 + labelHeight + paddingPx * 2,
            };
        };

        const getNodeComparisonText = (node: any): string => {
            const linksWithComparison = [...(node.sourceLinks || []), ...(node.targetLinks || [])];
            const match = linksWithComparison.find((link: any) => {
                return Boolean(sanitizeComparisonLabel(String(link.comparisonValue || '')));
            });

            if (!match) {
                return '';
            }

            const comparison = sanitizeComparisonLabel(String(match.comparisonValue || '')) || '';
            if (comparison.length <= 28) {
                return comparison;
            }

            return `${comparison.slice(0, 25)}...`;
        };

        const nodeBounds: NodeBounds[] = nodes.map((node: any) => ({
            id: node.id,
            x0: node.x0,
            x1: node.x1,
            y0: node.y0,
            y1: node.y1,
        }));

        const orderedNodes = [...nodes].sort((a: any, b: any) => a.y0 - b.y0);
        const placedBounds: LabelBounds[] = [];
        const labelLayouts = new Map<string, LabelLayout>();

        orderedNodes.forEach((node: any) => {
            const custom = getCustomization(node.id);
            const manualLabelPosition = state.customLayout?.labels?.[node.id];
            const { placement: computedPlacement } = getLabelCoordinates(node, custom);
            let placement = computedPlacement;
            let x = getLabelCoordinates(node, custom).x;
            let y = getLabelCoordinates(node, custom).y;

            const nameText = custom?.labelText || node.name;
            const defaultValueText = formatValue(node.value);
            const valueText = custom?.showSecondLine === false
                ? ''
                : (custom?.secondLineText?.trim() || defaultValueText);
            const defaultComparisonText = getNodeComparisonText(node);
            const comparisonText = custom?.showThirdLine === false
                ? ''
                : (custom?.thirdLineText?.trim() || defaultComparisonText);
            const nameSize = custom?.labelFontSize ?? settings.labelFontSize ?? DEFAULT_LABEL_NAME_SIZE;
            const valueSize = Math.max(DEFAULT_LABEL_VALUE_SIZE, Math.round(nameSize - 1));
            const comparisonSize = 11;
            const labelFamily = custom?.labelFontFamily ?? settings.labelFontFamily ?? 'Inter, sans-serif';

            if (manualLabelPosition) {
                x = manualLabelPosition.x;
                y = manualLabelPosition.y;
                placement = x < node.x0 ? 'left' : x > node.x1 ? 'right' : 'above';
            }

            const baseAnchor = getLabelAnchor(node, placement);
            let anchor: 'start' | 'middle' | 'end' = custom?.labelAlignment
                ? custom.labelAlignment === 'left'
                    ? 'start'
                    : custom.labelAlignment === 'right'
                        ? 'end'
                        : 'middle'
                : baseAnchor;

            let bounds = createLabelBounds(
                x,
                y,
                anchor,
                placement,
                nameText,
                valueText,
                comparisonText,
                nameSize,
                valueSize,
                comparisonSize,
                labelFamily,
            );

            if (!manualLabelPosition) {
                if ((placement === 'left' || placement === 'right') && (!custom?.labelPlacement || custom.labelPlacement === 'auto')) {
                    const collidesInitialNode = nodeBounds.some((entry: NodeBounds) => entry.id !== node.id && intersects(bounds, entry));
                    const collidesInitialLabel = placedBounds.some((entry: LabelBounds) => intersects(bounds, entry));

                    if (collidesInitialNode || collidesInitialLabel) {
                        const alternatePlacement: 'left' | 'right' = placement === 'left' ? 'right' : 'left';
                        const alternateX = alternatePlacement === 'left' ? node.x0 - 8 : node.x1 + 8;
                        const alternateAnchor = getLabelAnchor(node, alternatePlacement);
                        const alternateBounds = createLabelBounds(
                            alternateX,
                            y,
                            alternateAnchor,
                            alternatePlacement,
                            nameText,
                            valueText,
                            comparisonText,
                            nameSize,
                            valueSize,
                            comparisonSize,
                            labelFamily,
                        );

                        const collidesAlternateNode = nodeBounds.some(
                            (entry: NodeBounds) => entry.id !== node.id && intersects(alternateBounds, entry),
                        );
                        const collidesAlternateLabel = placedBounds.some(
                            (entry: LabelBounds) => intersects(alternateBounds, entry),
                        );

                        if (!collidesAlternateNode && !collidesAlternateLabel) {
                            placement = alternatePlacement;
                            x = alternateX;
                            anchor = alternateAnchor;
                            bounds = alternateBounds;
                        }
                    }
                }

                let attempts = 0;
                const originalY = y;
                const stepSize = 18;
                while (attempts < 24) {
                    const collidesNode = nodeBounds.some((entry: NodeBounds) => entry.id !== node.id && intersects(bounds, entry));
                    const collidesLabel = placedBounds.some((entry: LabelBounds) => intersects(bounds, entry));

                    if (!collidesNode && !collidesLabel) {
                        break;
                    }

                    attempts += 1;

                    if (placement === 'above') {
                        y = originalY - attempts * stepSize;
                    } else {
                        const distance = Math.ceil(attempts / 2) * stepSize;
                        y = originalY + (attempts % 2 === 0 ? distance : -distance);
                    }

                    bounds = createLabelBounds(
                        x,
                        y,
                        anchor,
                        placement,
                        nameText,
                        valueText,
                        comparisonText,
                        nameSize,
                        valueSize,
                        comparisonSize,
                        labelFamily,
                    );
                }
            }

            if (bounds.x0 < 10) {
                const delta = 10 - bounds.x0;
                x += delta;
                bounds = createLabelBounds(
                    x,
                    y,
                    anchor,
                    placement,
                    nameText,
                    valueText,
                    comparisonText,
                    nameSize,
                    valueSize,
                    comparisonSize,
                    labelFamily,
                );
            }

            if (bounds.x1 > width - 10) {
                const delta = bounds.x1 - (width - 10);
                x -= delta;
                bounds = createLabelBounds(
                    x,
                    y,
                    anchor,
                    placement,
                    nameText,
                    valueText,
                    comparisonText,
                    nameSize,
                    valueSize,
                    comparisonSize,
                    labelFamily,
                );
            }

            if (bounds.y0 < 10) {
                const delta = 10 - bounds.y0;
                y += delta;
                bounds = createLabelBounds(
                    x,
                    y,
                    anchor,
                    placement,
                    nameText,
                    valueText,
                    comparisonText,
                    nameSize,
                    valueSize,
                    comparisonSize,
                    labelFamily,
                );
            }

            if (bounds.y1 > height - 10) {
                const delta = bounds.y1 - (height - 10);
                y -= delta;
                bounds = createLabelBounds(
                    x,
                    y,
                    anchor,
                    placement,
                    nameText,
                    valueText,
                    comparisonText,
                    nameSize,
                    valueSize,
                    comparisonSize,
                    labelFamily,
                );
            }

            placedBounds.push(bounds);
            labelLayouts.set(node.id, {
                nodeId: node.id,
                x,
                y,
                placement,
                isManual: Boolean(manualLabelPosition),
                anchor,
                nameText,
                valueText,
                comparisonText,
                nameSize,
                valueSize,
                comparisonSize,
                labelFamily,
                bounds,
            });
        });

        const SAFE_MARGIN = 10;

        const clampLayoutToViewport = (layout: LabelLayout) => {
            let nextX = layout.x;
            let nextY = layout.y;

            if (layout.bounds.x0 < SAFE_MARGIN) {
                nextX += SAFE_MARGIN - layout.bounds.x0;
            }
            if (layout.bounds.x1 > width - SAFE_MARGIN) {
                nextX -= layout.bounds.x1 - (width - SAFE_MARGIN);
            }
            if (layout.bounds.y0 < SAFE_MARGIN) {
                nextY += SAFE_MARGIN - layout.bounds.y0;
            }
            if (layout.bounds.y1 > height - SAFE_MARGIN) {
                nextY -= layout.bounds.y1 - (height - SAFE_MARGIN);
            }

            if (nextX !== layout.x || nextY !== layout.y) {
                layout.x = nextX;
                layout.y = nextY;
                layout.bounds = createLabelBounds(
                    layout.x,
                    layout.y,
                    layout.anchor,
                    layout.placement,
                    layout.nameText,
                    layout.valueText,
                    layout.comparisonText,
                    layout.nameSize,
                    layout.valueSize,
                    layout.comparisonSize,
                    layout.labelFamily,
                );
            }
        };

        const repulsableLayouts = Array.from(labelLayouts.values()).filter((layout) => {
            return !layout.isManual && layout.placement !== 'inside';
        });

        const refreshBounds = (layout: LabelLayout) => {
            layout.bounds = createLabelBounds(
                layout.x,
                layout.y,
                layout.anchor,
                layout.placement,
                layout.nameText,
                layout.valueText,
                layout.comparisonText,
                layout.nameSize,
                layout.valueSize,
                layout.comparisonSize,
                layout.labelFamily,
            );
        };

        for (let pass = 0; pass < 36; pass += 1) {
            let movedAny = false;

            for (let i = 0; i < repulsableLayouts.length; i += 1) {
                const current = repulsableLayouts[i];

                const collidingNode = nodeBounds.find((nodeBound) => {
                    return nodeBound.id !== current.nodeId && intersects(current.bounds, nodeBound);
                });

                if (collidingNode) {
                    const labelCenterY = (current.bounds.y0 + current.bounds.y1) / 2;
                    const nodeCenterY = (collidingNode.y0 + collidingNode.y1) / 2;
                    const nudgeDirection = labelCenterY <= nodeCenterY ? -1 : 1;
                    current.y += nudgeDirection * 8;
                    refreshBounds(current);
                    clampLayoutToViewport(current);
                    movedAny = true;
                }
            }

            for (let i = 0; i < repulsableLayouts.length; i += 1) {
                for (let j = i + 1; j < repulsableLayouts.length; j += 1) {
                    const a = repulsableLayouts[i];
                    const b = repulsableLayouts[j];

                    if (!intersects(a.bounds, b.bounds)) {
                        continue;
                    }

                    const overlapY = Math.min(a.bounds.y1, b.bounds.y1) - Math.max(a.bounds.y0, b.bounds.y0);
                    if (overlapY <= 0) {
                        continue;
                    }

                    const shift = overlapY / 2 + 4;
                    if (a.y <= b.y) {
                        a.y -= shift;
                        b.y += shift;
                    } else {
                        a.y += shift;
                        b.y -= shift;
                    }

                    refreshBounds(a);
                    refreshBounds(b);
                    clampLayoutToViewport(a);
                    clampLayoutToViewport(b);
                    movedAny = true;
                }
            }

            if (!movedAny) {
                break;
            }
        }

        const focusModeEnabled = settings.enableFocusMode ?? false;

        const baseLinkOpacity = Math.max(0.05, Math.min(1, settings.linkOpacity));
        const dimmedLinkOpacity = 0.25;
        const dimmedNodeOpacity = 0.5;
        const dimmedLabelOpacity = 0.45;

        const getLinkKey = (link: any) => {
            const indexValue = Number(link.index);
            const stableIndex = Number.isFinite(indexValue)
                ? String(indexValue)
                : `${Math.round(Number(link.y0 || 0) * 100)}-${Math.round(Number(link.y1 || 0) * 100)}`;

            return `${link.source.id}->${link.target.id}->${stableIndex}`;
        };

        const outgoingLinksByNode = new Map<string, any[]>();
        const incomingLinksByNode = new Map<string, any[]>();
        const linkByKey = new Map<string, any>();

        links.forEach((link: any) => {
            const sourceId = String(link.source.id);
            const targetId = String(link.target.id);

            const sourceLinks = outgoingLinksByNode.get(sourceId) || [];
            sourceLinks.push(link);
            outgoingLinksByNode.set(sourceId, sourceLinks);

            const targetLinks = incomingLinksByNode.get(targetId) || [];
            targetLinks.push(link);
            incomingLinksByNode.set(targetId, targetLinks);

            linkByKey.set(getLinkKey(link), link);
        });

        const collectConnectedGraph = (seedNodeIds: string[]) => {
            const nodeIds = new Set<string>();
            const linkKeys = new Set<string>();
            const queue: string[] = [];

            seedNodeIds.forEach((nodeId) => {
                if (!nodeId) return;
                if (nodeIds.has(nodeId)) return;
                nodeIds.add(nodeId);
                queue.push(nodeId);
            });

            while (queue.length > 0) {
                const nodeId = queue.shift() as string;
                const connectedLinks = [
                    ...(outgoingLinksByNode.get(nodeId) || []),
                    ...(incomingLinksByNode.get(nodeId) || []),
                ];

                connectedLinks.forEach((link) => {
                    linkKeys.add(getLinkKey(link));

                    const sourceId = String(link.source.id);
                    const targetId = String(link.target.id);

                    if (!nodeIds.has(sourceId)) {
                        nodeIds.add(sourceId);
                        queue.push(sourceId);
                    }

                    if (!nodeIds.has(targetId)) {
                        nodeIds.add(targetId);
                        queue.push(targetId);
                    }
                });
            }

            return { nodeIds, linkKeys };
        };

        let hoveredNodeId: string | null = null;
        let hoveredLinkKey: string | null = null;
        let activeFocus: { nodeIds: Set<string>; linkKeys: Set<string> } | null = null;
        let isNodeDragging = false;

        const computeActiveFocus = () => {
            if (!focusModeEnabled) {
                return null;
            }

            if (hoveredNodeId) {
                return collectConnectedGraph([hoveredNodeId]);
            }

            if (hoveredLinkKey) {
                const hoveredLink = linkByKey.get(hoveredLinkKey);
                if (hoveredLink) {
                    return collectConnectedGraph([String(hoveredLink.source.id), String(hoveredLink.target.id)]);
                }
            }

            return null;
        };

        const refreshActiveFocus = () => {
            activeFocus = computeActiveFocus();
        };

        refreshActiveFocus();

        const getLinkOpacity = (link: any) => {
            if (!focusModeEnabled || !activeFocus) {
                return baseLinkOpacity;
            }

            return activeFocus.linkKeys.has(getLinkKey(link)) ? Math.min(0.95, baseLinkOpacity + 0.22) : dimmedLinkOpacity;
        };

        const getRenderedLinkWidth = (link: any) => {
            const baseWidth = getLinkStrokeWidth(link);
            if (!focusModeEnabled || !activeFocus) {
                return baseWidth;
            }

            return activeFocus.linkKeys.has(getLinkKey(link)) ? baseWidth * 1.04 : baseWidth;
        };

        const getNodeOpacity = (node: any) => {
            if (!focusModeEnabled || !activeFocus) {
                return 1;
            }

            return activeFocus.nodeIds.has(node.id) ? 1 : dimmedNodeOpacity;
        };

        const getLabelOpacity = (node: any) => {
            if (!focusModeEnabled || !activeFocus) {
                return 1;
            }

            return activeFocus.nodeIds.has(node.id) ? 1 : dimmedLabelOpacity;
        };

        const getLinkStroke = (d: any) => {
            if (settings.useFinancialTheme) {
                const sourceCategory = d.source.category;
                if (sourceCategory === 'revenue') return LINK_COLORS.revenue;
                if (sourceCategory === 'expense') return LINK_COLORS.expense;
                if (sourceCategory === 'profit') return LINK_COLORS.profit;
                return LINK_COLORS.neutral;
            }

            return settings.linkGradient
                ? `url(#${getGradientId(d.source.id, d.target.id, d.index)})`
                : (d.source.flowColor || getNodeColor(d.source, 0));
        };


        // Link Join
        const linkSel = linkLayer.selectAll('.sankey-link')
            .data(renderLinks, (d: any) => `${d.source.id}-${d.target.id}-${d.index}`);

        // Exit: Fade out
        linkSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        // Enter: Init opacity 0, d at final pos (prevents flying from 0,0)
        const linkEnter = linkSel.enter().append('path')
            .attr('class', 'sankey-link cursor-pointer')
            .attr('d', getLinkPath)
            .attr('fill', 'none')
            .attr('stroke', (d: any) => getLinkStroke(d))
            .attr('stroke-width', (d: any) => getRenderedLinkWidth(d))
            .attr('stroke-linecap', 'butt')
            .attr('stroke-linejoin', 'round')
            .attr('opacity', 0);

        const linkUpdate = linkEnter.merge(linkSel as any);

        linkUpdate.sort((a: any, b: any) => Number(b.width || 0) - Number(a.width || 0));

        // Layout Transition (Geometry)
        linkUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('d', getLinkPath);

        // Style Transition (Opacity/Color)
        linkUpdate.transition('style').duration(500)
            .attr('opacity', (d: any) => getLinkOpacity(d))
            .attr('stroke-width', (d: any) => getRenderedLinkWidth(d))
            .style('mix-blend-mode', settings.linkBlendMode || 'multiply')
            .attr('fill', 'none')
            .attr('stroke', (d: any) => getLinkStroke(d))
            .attr('stroke-linecap', 'butt')
            .attr('stroke-linejoin', 'round')
            .style('pointer-events', 'stroke');

        const applyFocusStyles = (animate = true) => {
            if (isNodeDragging && animate) {
                return;
            }

            refreshActiveFocus();

            const linksSelection = linkLayer.selectAll<SVGPathElement, any>('.sankey-link');
            const nodesSelection = nodeLayer.selectAll<SVGGElement, any>('.sankey-node');
            const labelsSelection = labelLayer.selectAll<SVGGElement, any>('.sankey-label');

            if (animate) {
                linksSelection
                    .interrupt('focus')
                    .transition('focus')
                    .duration(140)
                    .attr('opacity', (d: any) => getLinkOpacity(d))
                    .attr('stroke-width', (d: any) => getRenderedLinkWidth(d));

                nodesSelection
                    .interrupt('focus')
                    .transition('focus')
                    .duration(140)
                    .attr('opacity', (d: any) => getNodeOpacity(d));

                labelsSelection
                    .interrupt('focus')
                    .transition('focus')
                    .duration(140)
                    .attr('opacity', (d: any) => getLabelOpacity(d));
            } else {
                linksSelection
                    .attr('opacity', (d: any) => getLinkOpacity(d))
                    .attr('stroke-width', (d: any) => getRenderedLinkWidth(d));

                nodesSelection.attr('opacity', (d: any) => getNodeOpacity(d));
                labelsSelection.attr('opacity', (d: any) => getLabelOpacity(d));
            }
        };

        // Interaction
        linkLayer.selectAll('.sankey-link')
            .on('mouseenter', function (e, d: any) {
                if (isNodeDragging) {
                    return;
                }

                hoveredLinkKey = getLinkKey(d);
                hoveredNodeId = null;
                applyFocusStyles();
                if (!focusModeEnabled) {
                    d3.select(this)
                        .interrupt('focus')
                        .transition('focus')
                        .duration(120)
                        .attr('opacity', Math.min(0.9, baseLinkOpacity + 0.24));
                }
                const formatted = formatValue(d.value, true);
                const sourceOutputTotal = d.source.sourceLinks?.reduce((sum: number, link: any) => sum + link.value, 0) || d.value;
                const percentage = sourceOutputTotal > 0 ? ((d.value / sourceOutputTotal) * 100).toFixed(1) : '0';
                setStatusText('Click to inspect flow value');
                showTooltip(e, `${d.source.name} → ${d.target.name}${formatted ? `: ${formatted}` : ''} (${percentage}%)`);
            })
            .on('mouseleave', function () {
                if (isNodeDragging) {
                    return;
                }

                hoveredLinkKey = null;
                applyFocusStyles();
                if (!focusModeEnabled) {
                    linkLayer.selectAll('.sankey-link')
                        .interrupt('focus')
                        .transition('focus')
                        .duration(120)
                        .attr('opacity', baseLinkOpacity);
                }
                setStatusText('Click on any element to edit it');
                hideTooltip();
            })
            .on('click', (e, d: any) => {
                e.stopPropagation();
                hoveredLinkKey = null;
                const selectedIndex = Number.isFinite(d.index) ? Number(d.index) : links.indexOf(d);
                dispatch({ type: 'SELECT_LINK', payload: selectedIndex >= 0 ? selectedIndex : null });
                const formatted = formatValue(d.value, true);
                showTooltip(e, `${d.source.name} → ${d.target.name}${formatted ? `: ${formatted}` : ''}`);
            });


        // --- Nodes ---
        const nodeSel = nodeLayer.selectAll('.sankey-node')
            .data(nodes, (d: any) => d.id);

        nodeSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        const nodeEnter = nodeSel.enter().append('g')
            .attr('class', 'sankey-node cursor-grab')
            .attr('opacity', 0)
            .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`); // Start at correct pos

        // FORCE sharp corners - SankeyArt style (always 0, no fallback)
        nodeEnter.append('rect')
            .attr('rx', 0)
            .attr('ry', 0)
            .attr('class', 'node-hit-area')
            .attr('fill', 'transparent')
            .attr('stroke', 'none')
            .style('pointer-events', 'all');

        nodeEnter.append('rect')
            .attr('rx', 0)
            .attr('ry', 0)
            .attr('class', 'node-rect');

        nodeEnter.append('circle')
            .attr('class', 'node-imbalance-indicator')
            .attr('r', 0)
            .attr('fill', '#dc2626')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.25)
            .attr('opacity', 0);


        const nodeUpdate = nodeEnter.merge(nodeSel as any);

        // Layout Transition
        nodeUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

        // Style Transition
        nodeUpdate.transition('style').duration(500)
            .attr('opacity', (d: any) => getNodeOpacity(d));

        nodeUpdate.style('cursor', 'grab');

        nodeUpdate.select('rect.node-hit-area')
            .attr('x', (d: any) => {
                const nodeWidth = d.x1 - d.x0;
                const hitWidth = Math.max(14, nodeWidth);
                return (nodeWidth - hitWidth) / 2;
            })
            .attr('y', (d: any) => {
                const nodeHeight = d.y1 - d.y0;
                const hitHeight = Math.max(14, nodeHeight);
                return (nodeHeight - hitHeight) / 2;
            })
            .attr('width', (d: any) => Math.max(14, d.x1 - d.x0))
            .attr('height', (d: any) => Math.max(14, d.y1 - d.y0));

        nodeUpdate.select('rect.node-rect')
            .transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('rx', 0)  // FORCE sharp - SankeyArt style
            .attr('ry', 0)
            .attr('width', (d: any) => d.x1 - d.x0)
            .attr('height', (d: any) => d.y1 - d.y0)
            .attr('fill', (d: any, i) => getNodeColor(d, i))
            .attr('fill-opacity', Math.max(0.82, settings.nodeOpacity))
            .attr('stroke', 'none')
            .attr('stroke-opacity', 0)
            .attr('stroke-width', 0);

        const getNodeImbalance = (node: any) => {
            const incoming = (node.targetLinks || []).reduce((sum: number, link: any) => sum + Number(link.value || 0), 0);
            const outgoing = (node.sourceLinks || []).reduce((sum: number, link: any) => sum + Number(link.value || 0), 0);
            const hasBothSides = (node.targetLinks?.length || 0) > 0 && (node.sourceLinks?.length || 0) > 0;
            const diff = incoming - outgoing;
            const threshold = Math.max(0.0001, Math.max(incoming, outgoing) * 0.01);
            return {
                isImbalanced: hasBothSides && Math.abs(diff) > threshold,
                diff,
            };
        };

        nodeUpdate.select<SVGCircleElement>('circle.node-imbalance-indicator')
            .attr('cx', (d: any) => Math.max(4, d.x1 - d.x0 - 4))
            .attr('cy', 4)
            .attr('r', (d: any) => (getNodeImbalance(d).isImbalanced ? 3.6 : 0))
            .attr('opacity', (d: any) => (getNodeImbalance(d).isImbalanced ? 0.95 : 0));

        nodeUpdate.select<SVGCircleElement>('circle.node-imbalance-indicator')
            .selectAll('title')
            .data((d: any) => {
                const imbalance = getNodeImbalance(d);
                if (!imbalance.isImbalanced) {
                    return [];
                }

                const value = formatValue(Math.abs(imbalance.diff), true);
                const direction = imbalance.diff > 0 ? 'more incoming than outgoing' : 'more outgoing than incoming';
                return [`Imbalance: ${value} (${direction})`];
            })
            .join('title')
            .text((d: string) => d);

        nodeUpdate
            .on('mouseenter', function (_e, d: any) {
                if (isNodeDragging) {
                    return;
                }

                hoveredNodeId = d.id;
                hoveredLinkKey = null;
                applyFocusStyles();
                setStatusText('Click to edit, drag to move, double-click to reset');
                d3.select(this).select('rect.node-rect').attr('fill-opacity', Math.min(1, settings.nodeOpacity + 0.08));
            })
            .on('mouseleave', function () {
                if (isNodeDragging) {
                    return;
                }

                hoveredNodeId = null;
                applyFocusStyles();
                setStatusText('Click on any element to edit it');
                d3.select(this).select('rect.node-rect').attr('fill-opacity', Math.max(0.82, settings.nodeOpacity));
            });


        // Drag (V12: Optimized for 60fps with requestAnimationFrame)
        const drag = d3.drag<any, any>()
            .filter((e) => !e.ctrlKey && !e.button) // Only left-click, no Ctrl
            .subject((e, d) => ({ x: d.x0, y: d.y0 }))
            .on('start', function (e, d) {
                isNodeDragging = true;
                hoveredNodeId = null;
                hoveredLinkKey = null;
                d3.select(this).raise().attr('cursor', 'grabbing').style('will-change', 'transform');
                (d as any)._dragStartX = e.x; (d as any)._dragStartY = e.y;
                (d as any)._nodeStartX = d.x0;
                (d as any)._nodeStartY = d.y0;
                (d as any)._dragFrameCount = 0;
                (d as any)._lastRenderX = null;
                (d as any)._lastRenderY = null;
                (d as any)._manualLabelStart = state.customLayout?.labels?.[d.id] || null;
                (d as any)._tempManualLabelX = null;
                (d as any)._tempManualLabelY = null;
                (d as any)._connectedLinks = linkLayer
                    .selectAll('.sankey-link')
                    .filter((linkD: any) => linkD.source.id === d.id || linkD.target.id === d.id);
                (d as any)._draggedLabel = labelLayer
                    .selectAll('.sankey-label')
                    .filter((labelD: any) => labelD.id === d.id);
                setStatusText('Click to edit, drag to move');
                linkLayer.selectAll('.sankey-link').interrupt();
                nodeLayer.selectAll('.sankey-node').interrupt();
                labelLayer.selectAll('.sankey-label').interrupt();
            })
            .on('drag', function (e, d) {
                // V12: Use requestAnimationFrame for smooth 60fps updates
                if ((d as any)._dragFrame) cancelAnimationFrame((d as any)._dragFrame);

                const w = d.x1 - d.x0, h = d.y1 - d.y0;
                let newX = e.x;
                let newY = e.y;

                // Snap Logic
                if (settings.snapToGrid) {
                    const cols: number[] = Array.from(new Set<number>(nodes.map((n: any) => Number(n.x0)))).sort((a, b) => a - b);
                    newX = cols.reduce((closest, candidate) =>
                        Math.abs(candidate - e.x) < Math.abs(closest - e.x) ? candidate : closest,
                    );
                } else {
                    // Free drag constrained to canvas
                    newX = Math.max(extent[0][0], Math.min(extent[1][0] - w, e.x));
                }

                newX = Math.max(extent[0][0], Math.min(extent[1][0] - w, newX));
                newY = Math.max(extent[0][1], Math.min(extent[1][1] - h, e.y));

                (d as any)._dragFrame = requestAnimationFrame(() => {
                    if ((d as any)._lastRenderX === newX && (d as any)._lastRenderY === newY) {
                        return;
                    }

                    (d as any)._lastRenderX = newX;
                    (d as any)._lastRenderY = newY;

                    // Visual-only update using CSS transform (GPU accelerated, no layout recalc)
                    d3.select(this).attr('transform', `translate(${newX},${newY})`);

                    // Store position for later
                    (d as any)._tempX = newX;
                    (d as any)._tempY = newY;

                    // Throttle guide drawing, but keep flow geometry updates every frame
                    (d as any)._dragFrameCount++;
                    if ((d as any)._dragFrameCount % 3 === 0) {
                        guideLayer.selectAll('*').remove();

                        if (settings.snapToGrid) {
                            guideLayer.append('line').attr('x1', newX + w / 2).attr('x2', newX + w / 2).attr('y1', 0).attr('y2', height)
                                .attr('stroke', '#3b82f6').attr('stroke-dasharray', '4 2');
                        }

                    }

                    const previousY = d.y0;
                    const deltaY = newY - previousY;
                    d.x0 = newX;
                    d.x1 = newX + w;
                    d.y0 = newY;
                    d.y1 = newY + h;

                    if (deltaY !== 0) {
                        (d.sourceLinks || []).forEach((link: any) => {
                            link.y0 += deltaY;
                        });
                        (d.targetLinks || []).forEach((link: any) => {
                            link.y1 += deltaY;
                        });
                    }

                    const connectedLinks = (d as any)._connectedLinks;
                    if (connectedLinks) {
                        connectedLinks.attr('d', getLinkPath);
                    }

                    const draggedLabel = (d as any)._draggedLabel;
                    const manualLabelStart = (d as any)._manualLabelStart;
                    if (draggedLabel && manualLabelStart) {
                        const deltaX = newX - ((d as any)._nodeStartX ?? newX);
                        const deltaY = newY - ((d as any)._nodeStartY ?? newY);
                        const nextLabelX = Number(manualLabelStart.x) + deltaX;
                        const nextLabelY = Number(manualLabelStart.y) + deltaY;
                        draggedLabel.attr('transform', `translate(${nextLabelX}, ${nextLabelY})`);
                        (d as any)._tempManualLabelX = nextLabelX;
                        (d as any)._tempManualLabelY = nextLabelY;
                    }
                });
            })
            .on('end', function (e, d) {
                // Cancel any pending animation frame
                if ((d as any)._dragFrame) {
                    cancelAnimationFrame((d as any)._dragFrame);
                    (d as any)._dragFrame = null;
                }

                guideLayer.selectAll('*').remove();

                // Final position update with smooth transition
                const finalX = (d as any)._tempX || d.x0;
                const finalY = (d as any)._tempY || d.y0;
                const w = d.x1 - d.x0, h = d.y1 - d.y0;

                d.x0 = finalX; d.x1 = finalX + w; d.y0 = finalY; d.y1 = finalY + h;
                sankeyGenerator.update(processedGraph);

                // Smooth transition to final link positions
                const connectedLinks = (d as any)._connectedLinks;
                if (connectedLinks) {
                    connectedLinks
                        .transition().duration(120).ease(d3.easeQuadOut)
                        .attr('d', getLinkPath);
                }

                const draggedLabel = (d as any)._draggedLabel;
                const hasManualLabelPosition = Boolean(state.customLayout?.labels?.[d.id]);
                if (draggedLabel && !hasManualLabelPosition) {
                    const custom = getCustomization(d.id);
                    const coords = getLabelCoordinates(d, custom);
                    draggedLabel.attr('transform', `translate(${coords.x}, ${coords.y})`);
                }

                const finalManualLabelX = Number((d as any)._tempManualLabelX);
                const finalManualLabelY = Number((d as any)._tempManualLabelY);
                if (Number.isFinite(finalManualLabelX) && Number.isFinite(finalManualLabelY)) {
                    dispatch({
                        type: 'MOVE_LABEL',
                        payload: { nodeId: d.id, x: finalManualLabelX, y: finalManualLabelY },
                    });
                }

                d3.select(this)
                    .attr('cursor', 'grab')
                    .style('will-change', null)
                    .transition()
                    .duration(100)
                    .ease(d3.easeQuadOut);
                setStatusText('Click on any element to edit it');

                const dist = Math.hypot(e.x - (d as any)._dragStartX, e.y - (d as any)._dragStartY);
                if (dist >= 3) {
                    dispatch({ type: 'MOVE_NODE', payload: { id: d.id, x: d.x0, y: d.y0 } });
                } else if (e.sourceEvent) {
                    handleNodeClick(e.sourceEvent as MouseEvent, d);
                }

                isNodeDragging = false;
                applyFocusStyles(false);

                (d as any)._connectedLinks = null;
                (d as any)._draggedLabel = null;
                (d as any)._lastRenderX = null;
                (d as any)._lastRenderY = null;
                (d as any)._manualLabelStart = null;
                (d as any)._tempManualLabelX = null;
                (d as any)._tempManualLabelY = null;
            });

        // Apply drag to ALL nodes (enter + update), not just new ones
        nodeUpdate.call(drag)
            .on('click', function (e, d: any) {
                if (e.defaultPrevented) {
                    return;
                }

                handleNodeClick(e as unknown as MouseEvent, d);
            })
            .on('dblclick', function (e, d: any) {
                e.stopPropagation();

                if (!e.shiftKey) {
                    dispatch({ type: 'UPDATE_LAYOUT', payload: { id: d.id, type: 'node' } });
                    dispatch({ type: 'UPDATE_LAYOUT', payload: { id: d.id, type: 'label' } });
                    dispatch({
                        type: 'UPDATE_NODE_CUSTOMIZATION',
                        payload: {
                            nodeId: d.id,
                            updates: {
                                labelPlacement: 'auto',
                                labelOffsetX: 0,
                                labelOffsetY: 0,
                            },
                        },
                    });
                    setStatusText('Node and label reset to auto layout');
                    return;
                }

                setEditingNodeId(d.id);
                setEditText(d.name);
                // The input will be focused via useEffect when editingNodeId changes
            });


        // --- Labels ---
        labelLayer.selectAll('text.sankey-label').remove();

        const labelSel = labelLayer.selectAll('.sankey-label')
            .data(nodes, (d: any) => d.id);

        labelSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        const labelEnter = labelSel.enter().append('g')
            .attr('class', 'sankey-label')
            .attr('opacity', 0);

        labelEnter.append('rect')
            .attr('class', 'label-hit-area')
            .attr('fill', 'transparent')
            .attr('stroke', 'none');

        labelEnter.append('text')
            .attr('class', 'label-text');

        const labelUpdate = labelEnter.merge(labelSel as any);

        const labelDrag = d3.drag<SVGGElement, any>()
            .on('start', function (e, d) {
                e.sourceEvent?.stopPropagation();
                e.sourceEvent?.preventDefault();
                d3.select(this).raise().attr('cursor', 'grabbing');
                setStatusText('Drag to reposition label');
                labelLayer.selectAll('.sankey-label').interrupt();

                const currentLayout = labelLayouts.get(d.id);
                (d as any)._tempLabelX = currentLayout?.x ?? d.x0;
                (d as any)._tempLabelY = currentLayout?.y ?? d.y0;
            })
            .on('drag', function (e, d) {
                e.sourceEvent?.stopPropagation();
                e.sourceEvent?.preventDefault();
                d3.select(this).attr('transform', `translate(${e.x}, ${e.y})`);
                (d as any)._tempLabelX = e.x;
                (d as any)._tempLabelY = e.y;
            })
            .on('end', function (_e, d) {
                d3.select(this).attr('cursor', 'grab');

                const finalX = Number((d as any)._tempLabelX);
                const finalY = Number((d as any)._tempLabelY);

                if (Number.isFinite(finalX) && Number.isFinite(finalY)) {
                    dispatch({ type: 'MOVE_LABEL', payload: { nodeId: d.id, x: finalX, y: finalY } });
                }

                setStatusText('Click on any element to edit it');
            });

        // Apply drag handler and enable pointer events
        labelUpdate.call(labelDrag)
            .style('cursor', 'grab')
            .style('pointer-events', 'all')
            .on('mouseenter', function () {
                setStatusText('Drag to reposition label');
            })
            .on('mouseleave', function () {
                setStatusText('Click on any element to edit it');
            })
            .on('dblclick', function (e, d: any) {
                e.stopPropagation();
                dispatch({
                    type: 'UPDATE_LAYOUT',
                    payload: {
                        id: d.id,
                        type: 'label',
                    },
                });

                dispatch({
                    type: 'UPDATE_NODE_CUSTOMIZATION',
                    payload: {
                        nodeId: d.id,
                        updates: {
                            labelPlacement: 'auto',
                            labelOffsetX: 0,
                            labelOffsetY: 0,
                        },
                    },
                });
            });

        labelUpdate.select('rect.label-hit-area')
            .style('pointer-events', 'all');

        labelUpdate.select('text.label-text')
            .style('pointer-events', 'none');

        // Appear/Disappear
        labelUpdate.transition('style').duration(500)
            .attr('opacity', (d: any) => getLabelOpacity(d));

        // Move with transition
        labelUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('transform', (d: any) => {
                const layout = labelLayouts.get(d.id);
                if (!layout) {
                    return `translate(${d.x0}, ${d.y0})`;
                }

                return `translate(${layout.x}, ${layout.y})`;
            })
            .each(function (d: any) {
                const group = d3.select(this);
                const text = group.select<SVGTextElement>('text.label-text');
                const hitArea = group.select<SVGRectElement>('rect.label-hit-area');
                text.text(null);

                const layout = labelLayouts.get(d.id);
                if (!layout) {
                    return;
                }

                const custom = getCustomization(d.id);
                const nameColor = custom?.labelColor || '#000000';
                const valueColor = custom?.valueColor || '#000000';
                const comparisonColor = custom?.thirdLineColor || '#000000';
                const nameWeight = (custom?.labelBold ?? settings.labelBold) ? 700 : 600;
                const nameStyle = (custom?.labelItalic ?? settings.labelItalic) ? 'italic' : 'normal';

                text
                    .attr('text-anchor', layout.anchor)
                    .attr('paint-order', 'normal')
                    .attr('stroke', 'none')
                    .attr('stroke-width', 0)
                    .attr('stroke-linejoin', 'round');

                text.append('tspan')
                    .attr('x', 0)
                    .attr('dy', layout.placement === 'inside' ? '-0.15em' : '0em')
                    .text(layout.nameText)
                    .attr('font-weight', nameWeight)
                    .attr('font-style', nameStyle)
                    .attr('font-family', layout.labelFamily)
                    .attr('font-size', layout.nameSize)
                    .attr('fill', nameColor);

                if (layout.valueText) {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', '1.15em')
                        .text(layout.valueText)
                        .attr('font-family', layout.labelFamily)
                        .attr('font-size', layout.valueSize)
                        .attr('font-weight', custom?.valueBold ? 700 : 400)
                        .attr('fill', valueColor);
                }

                if (layout.comparisonText) {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', '1.15em')
                        .text(layout.comparisonText)
                        .attr('font-family', layout.labelFamily)
                        .attr('font-size', layout.comparisonSize)
                        .attr('font-weight', 400)
                        .attr('fill', comparisonColor);
                }

                const localX = layout.bounds.x0 - layout.x;
                const localY = layout.bounds.y0 - layout.y;
                const hitPadding = 20;
                const localWidth = Math.max(14, layout.bounds.x1 - layout.bounds.x0);
                const localHeight = Math.max(14, layout.bounds.y1 - layout.bounds.y0);

                hitArea
                    .attr('x', localX - hitPadding)
                    .attr('y', localY - hitPadding)
                    .attr('width', localWidth + hitPadding * 2)
                    .attr('height', localHeight + hitPadding * 2);
            });

        applyFocusStyles(false);

        // --- Independent Labels (Rich Content) ---
        const independentLayer = getLayer('layer-independent');
        independentLayer.raise(); // Ensure on top

        const indepSel = independentLayer.selectAll('.indep-label')
            .data(state.independentLabels || [], (d: any) => d.id);

        indepSel.exit().remove();

        const indepEnter = indepSel.enter().append('g')
            .attr('class', 'indep-label cursor-move');

        const indepUpdate = indepEnter.merge(indepSel as any)
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

        // Render Content
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
        const dragLabel = d3.drag<any, any>()
            .on('start', function () {
                d3.select(this).raise();
            })
            .on('drag', function (e) {
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
            drawingBoxRef.current = { startX: x, startY: y, currentX: x, currentY: y };

            annotationLayer.select('.drawing-preview').remove();
            annotationLayer.append('rect')
                .attr('class', 'drawing-preview')
                .attr('x', x)
                .attr('y', y)
                .attr('width', 0)
                .attr('height', 0)
                .attr('fill', 'rgba(59, 130, 246, 0.1)')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '4 2')
                .attr('rx', 4)
                .style('pointer-events', 'none');
        });

        svg.on('mousemove', (event) => {
            if (!drawingBoxRef.current) return;

            const [x, y] = d3.pointer(event, mainGroup.node());

            drawingBoxRef.current.currentX = x;
            drawingBoxRef.current.currentY = y;

            annotationLayer.select<SVGRectElement>('.drawing-preview')
                .attr('x', Math.min(drawingBoxRef.current.startX, x))
                .attr('y', Math.min(drawingBoxRef.current.startY, y))
                .attr('width', Math.abs(x - drawingBoxRef.current.startX))
                .attr('height', Math.abs(y - drawingBoxRef.current.startY));
        });

        svg.on('mouseup', () => {
            const drawingBox = drawingBoxRef.current;
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

            drawingBoxRef.current = null;
            annotationLayer.select('.drawing-preview').remove();
            setTool('select');
        });

        svg.on('click', (event) => {
            const target = event.target as Element;
            const clickedInteractive = Boolean(
                target.closest('.sankey-node') ||
                target.closest('.sankey-link') ||
                target.closest('.sankey-label') ||
                target.closest('.indep-label') ||
                target.closest('.annotation-box')
            );

            if (studioState.currentTool === 'select' || studioState.currentTool === 'pan') {
                if (!clickedInteractive) {
                    hoveredNodeId = null;
                    hoveredLinkKey = null;
                    dispatch({ type: 'SELECT_NODE', payload: null });
                    dispatch({ type: 'SELECT_LINK', payload: null });
                    dispatch({ type: 'SELECT_LABEL', payload: null });
                    setPopover(null);
                    setStatusText('Click on any element to edit it');
                    hideTooltip();
                }
                return;
            }

            const [x, y] = d3.pointer(event, mainGroup.node());

            if (studioState.currentTool === 'addLabel') {
                const id = `label-${Date.now()}`;
                dispatch({
                    type: 'ADD_INDEPENDENT_LABEL', payload: {
                        id, type: 'text', text: 'Text', x, y, fontSize: 24, fontFamily: 'Inter, sans-serif', color: '#111827', bold: true
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
            svg.on('click', null); // Cleanup click listener
            svg.on('mousedown', null);
            svg.on('mousemove', null);
            svg.on('mouseup', null);
        };

    }, [
        data,
        settings,
        selectedNodeId,
        state.annotationBoxes,
        state.customLayout,
        state.independentLabels,
        state.selectedLabelId,
        studioState.currentTool,
        dispatch,
        getNodeColor,
        formatValue,
        getCustomization,
        handleNodeClick,
        setTool,
    ]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full border border-slate-200 overflow-hidden relative"
            style={{ backgroundColor: settings.canvasBackground || '#ffffff' }}
        >
            <svg

                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`0 0 ${settings.width} ${settings.height}`}
                className="w-full h-full main-canvas"
                style={{ minHeight: '600px' }}
            />
            <div className="absolute bottom-8 left-3 pointer-events-none select-none text-[11px] text-slate-400 bg-white/70 px-2 py-0.5 rounded">
                {statusText}
            </div>
            <div className="absolute bottom-8 right-3 pointer-events-none select-none text-[10px] text-slate-400 bg-white/70 px-2 py-0.5 rounded uppercase tracking-wide">
                Q {Math.round((studioState.viewportTransform?.scale || 1) * 100)}%
            </div>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none select-none text-[10px] text-slate-300">
                created with SankeyCapCap Studio
            </div>
            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 px-3 py-1.5 pointer-events-none select-none">
                <span className={`text-[11px] font-medium ${balanceSummary.allBalanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {balanceSummary.allBalanced
                        ? 'All nodes are balanced'
                        : `${balanceSummary.imbalancedCount} nodes are imbalanced`}
                </span>
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
