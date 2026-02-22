'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { useDiagram } from '@/context/DiagramContext';
import { useStudio } from '@/context/StudioContext';
import { SankeyNode, NodeCustomization } from '@/types/sankey';
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
    const { data, settings, selectedNodeId, selectedLinkIndex, nodeCustomizations } = state;
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [statusText, setStatusText] = useState('Click on any element to edit it');

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
            .attr('fill', '#ffffff')
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

        const extent: [[number, number], [number, number]] = [
            [padding.left, padding.top],
            [width - padding.right, height - padding.bottom],
        ];

        const sankeyGenerator = sankey<any, any>()
            .nodeId((d: any) => d.id)
            .nodeWidth(settings.nodeWidth)
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
        const minPadding = 4;
        const preferredPadding = Math.max(minPadding, settings.nodePadding);
        const paddingCandidates = Array.from(new Set([
            preferredPadding,
            Math.max(minPadding, preferredPadding - 4),
            Math.max(minPadding, preferredPadding - 8),
            12,
            8,
            6,
            4,
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

        // --- Links ---
        const linkPathGenerator = sankeyLinkHorizontal<any, any>();
        const getLinkPath = (d: any) => {
            const sx = Number(d.source.x1);
            const tx = Number(d.target.x0);
            const sy = Number(d.y0);
            const ty = Number(d.y1);

            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) {
                return linkPathGenerator(d) ?? '';
            }

            const bandWidth = Math.max(1.5, Number(d.width) || 0);
            const halfWidth = bandWidth / 2;
            const curvature = Math.max(0.15, Math.min(0.85, settings.linkCurvature || 0.5));
            const interpolateX = d3.interpolateNumber(sx, tx);
            const controlX1 = interpolateX(curvature);
            const controlX2 = interpolateX(1 - curvature);

            const syTop = sy - halfWidth;
            const tyTop = ty - halfWidth;
            const syBottom = sy + halfWidth;
            const tyBottom = ty + halfWidth;

            return [
                `M${sx},${syTop}`,
                `C${controlX1},${syTop} ${controlX2},${tyTop} ${tx},${tyTop}`,
                `L${tx},${tyBottom}`,
                `C${controlX2},${tyBottom} ${controlX1},${syBottom} ${sx},${syBottom}`,
                'Z',
            ].join(' ');
        };

        const getGradientId = (sourceId: string, targetId: string, linkIndex?: number) => {
            const encodeSegment = (value: string) =>
                Array.from(value)
                    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
                    .join('');

            return `grad-${encodeSegment(sourceId)}-${encodeSegment(targetId)}-${linkIndex ?? 0}`;
        };

        defs.selectAll('linearGradient.link-gradient').remove();

        // Gradients
        links.forEach((l: any) => {
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

        const getAutoPlacement = (node: any): 'left' | 'right' => {
            const depth = Number(node.depth ?? 0);
            if (depth <= 0) return 'left';
            if (depth >= maxNodeDepth) return 'right';
            return 'right';
        };

        const resolvePlacement = (node: any, custom?: NodeCustomization): 'left' | 'right' | 'above' | 'below' | 'inside' | 'external' => {
            if (custom?.labelPlacement && custom.labelPlacement !== 'auto') {
                return custom.labelPlacement;
            }

            if (settings.labelPosition === 'auto') {
                return getAutoPlacement(node);
            }

            if (settings.labelPosition === 'external') {
                return getAutoPlacement(node);
            }

            if (settings.labelPosition === 'inside') {
                return 'inside';
            }

            return settings.labelPosition === 'left' || settings.labelPosition === 'right' || settings.labelPosition === 'above'
                ? settings.labelPosition
                : 'above';
        };

        const getLabelCoordinates = (node: any, custom?: NodeCustomization) => {
            const nodeWidth = node.x1 - node.x0;
            const placement = resolvePlacement(node, custom);
            const gap = 8;

            let x = node.x0 + nodeWidth / 2;
            let y = (node.y0 + node.y1) / 2;

            if (placement === 'left') {
                x = node.x0 - gap;
            } else if (placement === 'right') {
                x = node.x1 + gap;
            } else if (placement === 'above') {
                y = node.y0 - gap;
            } else if (placement === 'below') {
                y = node.y1 + gap + 12;
            } else if (placement === 'external') {
                x = node.x0 < width / 2 ? node.x0 - gap : node.x1 + gap;
            } else if (placement === 'inside') {
                x = node.x0 + nodeWidth / 2;
            }

            x += custom?.labelOffsetX || 0;
            y += custom?.labelOffsetY || 0;

            return { x, y, placement };
        };

        const getLabelAnchor = (node: any, placement: string): 'start' | 'middle' | 'end' => {
            if (placement === 'left') return 'end';
            if (placement === 'right') return 'start';
            if (placement === 'external') return node.x0 < width / 2 ? 'end' : 'start';
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
            x: number;
            y: number;
            placement: 'left' | 'right' | 'above' | 'below' | 'inside' | 'external';
            anchor: 'start' | 'middle' | 'end';
            nameText: string;
            valueText: string;
            comparisonText: string;
            nameSize: number;
            valueSize: number;
            comparisonSize: number;
        }

        const intersects = (a: LabelBounds, b: LabelBounds) => {
            return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        };

        const estimateTextWidth = (text: string, size: number) => {
            if (!text) return size * 2;
            return Math.max(size * 2, text.length * size * 0.58);
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
        ): LabelBounds => {
            const labelWidth = Math.max(
                estimateTextWidth(nameText, nameSize),
                estimateTextWidth(valueText, valueSize),
                estimateTextWidth(comparisonText, comparisonSize),
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
                return typeof link.comparisonValue === 'string' && link.comparisonValue.trim().length > 0;
            });

            return match ? String(match.comparisonValue).trim() : '';
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
            const valueText = formatValue(node.value);
            const comparisonText = getNodeComparisonText(node);
            const nameSize = custom?.labelFontSize ?? settings.labelFontSize ?? DEFAULT_LABEL_NAME_SIZE;
            const valueSize = Math.max(DEFAULT_LABEL_VALUE_SIZE, Math.round(nameSize - 1));
            const comparisonSize = 11;

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
                const stepSize = 14;
                while (attempts < 15) {
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
                );
            }

            placedBounds.push(bounds);
            labelLayouts.set(node.id, {
                x,
                y,
                placement,
                anchor,
                nameText,
                valueText,
                comparisonText,
                nameSize,
                valueSize,
                comparisonSize,
            });
        });

        const selectedLink = selectedLinkIndex !== null
            ? links.find((link: any) => link.index === selectedLinkIndex) ?? links[selectedLinkIndex] ?? null
            : null;

        const selectedNodeConnectedIds = new Set<string>();
        if (selectedNodeId) {
            selectedNodeConnectedIds.add(selectedNodeId);

            links.forEach((link: any) => {
                if (link.source.id === selectedNodeId) {
                    selectedNodeConnectedIds.add(link.target.id);
                }
                if (link.target.id === selectedNodeId) {
                    selectedNodeConnectedIds.add(link.source.id);
                }
            });
        }

        const focusModeEnabled = settings.enableFocusMode ?? true;

        const getLinkOpacity = (link: any) => {
            if (!focusModeEnabled) {
                return settings.linkOpacity;
            }

            if (selectedNodeId) {
                return link.source.id === selectedNodeId || link.target.id === selectedNodeId ? settings.linkOpacity : 0.4;
            }

            if (selectedLink) {
                const touchesSelectedNodes =
                    link.source.id === selectedLink.source.id ||
                    link.target.id === selectedLink.source.id ||
                    link.source.id === selectedLink.target.id ||
                    link.target.id === selectedLink.target.id;

                if (link.index === selectedLink.index) {
                    return settings.linkOpacity;
                }

                return touchesSelectedNodes ? Math.max(0.45, settings.linkOpacity * 0.9) : 0.4;
            }

            return settings.linkOpacity;
        };

        const getNodeOpacity = (node: any) => {
            if (!focusModeEnabled) {
                return 1;
            }

            if (selectedNodeId) {
                return selectedNodeConnectedIds.has(node.id) ? 1 : 0.4;
            }

            if (selectedLink) {
                return node.id === selectedLink.source.id || node.id === selectedLink.target.id ? 1 : 0.4;
            }

            return 1;
        };

        const getLabelOpacity = (node: any) => {
            return getNodeOpacity(node);
        };

        const getLinkFill = (d: any) => {
            if (settings.useFinancialTheme) {
                const sourceCategory = d.source.category;
                if (sourceCategory === 'revenue') return COLORS.revenue;
                if (sourceCategory === 'expense') return COLORS.expense;
                if (sourceCategory === 'profit') return COLORS.profit;
                return COLORS.neutral;
            }

            return settings.linkGradient
                ? `url(#${getGradientId(d.source.id, d.target.id, d.index)})`
                : (d.source.flowColor || getNodeColor(d.source, 0));
        };


        // Link Join
        const linkSel = linkLayer.selectAll('.sankey-link')
            .data(links, (d: any) => `${d.source.id}-${d.target.id}-${d.index}`);

        // Exit: Fade out
        linkSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        // Enter: Init opacity 0, d at final pos (prevents flying from 0,0)
        const linkEnter = linkSel.enter().append('path')
            .attr('class', 'sankey-link cursor-pointer')
            .attr('d', getLinkPath)
            .attr('fill', (d: any) => getLinkFill(d))
            .attr('stroke', 'none')
            .attr('opacity', 0);

        const linkUpdate = linkEnter.merge(linkSel as any);

        // Layout Transition (Geometry)
        linkUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('d', getLinkPath);

        // Style Transition (Opacity/Color)
        linkUpdate.transition('style').duration(500)
            .attr('opacity', (d: any) => getLinkOpacity(d))
            .style('mix-blend-mode', settings.linkBlendMode || 'normal')
            .attr('fill', (d: any) => getLinkFill(d))
            .attr('stroke', 'none')
            .style('pointer-events', 'all');

        // Interaction
        linkLayer.selectAll('.sankey-link')
            .on('mouseenter', function (e, d: any) {
                d3.select(this).transition('style').duration(120).attr('opacity', 0.8);
                const formatted = formatValue(d.value, true);
                const sourceOutputTotal = d.source.sourceLinks?.reduce((sum: number, link: any) => sum + link.value, 0) || d.value;
                const percentage = sourceOutputTotal > 0 ? ((d.value / sourceOutputTotal) * 100).toFixed(1) : '0';
                setStatusText('Click to inspect flow value');
                showTooltip(e, `${d.source.name} → ${d.target.name}${formatted ? `: ${formatted}` : ''} (${percentage}%)`);
            })
            .on('mouseleave', function () {
                linkLayer.selectAll('.sankey-link')
                    .transition('style')
                    .duration(120)
                    .attr('opacity', (linkD: any) => getLinkOpacity(linkD));
                setStatusText('Click on any element to edit it');
                hideTooltip();
            })
            .on('click', (e, d: any) => {
                e.stopPropagation();
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
            .attr('class', 'node-rect');


        const nodeUpdate = nodeEnter.merge(nodeSel as any);

        // Layout Transition
        nodeUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

        // Style Transition
        nodeUpdate.transition('style').duration(500)
            .attr('opacity', (d: any) => getNodeOpacity(d));

        nodeUpdate.style('cursor', 'grab');

        nodeUpdate.select('rect')
            .transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('rx', 0)  // FORCE sharp - SankeyArt style
            .attr('ry', 0)
            .attr('width', (d: any) => d.x1 - d.x0)
            .attr('height', (d: any) => d.y1 - d.y0)
            .attr('fill', (d: any, i) => getNodeColor(d, i))
            .attr('fill-opacity', settings.nodeOpacity)
            .attr('stroke', 'none')
            .attr('stroke-opacity', 0)
            .attr('stroke-width', 0);

        nodeUpdate
            .on('mouseenter', function (_e, d: any) {
                setStatusText('Click to edit, drag to move');
                d3.select(this).select('rect').attr('fill-opacity', Math.min(1, settings.nodeOpacity + 0.08));
                linkLayer.selectAll('.sankey-link')
                    .attr('opacity', (linkD: any) =>
                        linkD.source.id === d.id || linkD.target.id === d.id
                            ? 0.8
                            : Math.min(0.4, getLinkOpacity(linkD)),
                    );
            })
            .on('mouseleave', function () {
                setStatusText('Click on any element to edit it');
                d3.select(this).select('rect').attr('fill-opacity', settings.nodeOpacity);
                linkLayer.selectAll('.sankey-link').attr('opacity', (linkD: any) => getLinkOpacity(linkD));
            });


        // Drag (V12: Optimized for 60fps with requestAnimationFrame)
        const drag = d3.drag<any, any>()
            .filter((e) => !e.ctrlKey && !e.button) // Only left-click, no Ctrl
            .subject((e, d) => ({ x: d.x0, y: d.y0 }))
            .on('start', function (e, d) {
                d3.select(this).raise().attr('cursor', 'grabbing').style('will-change', 'transform');
                (d as any)._dragStartX = e.x; (d as any)._dragStartY = e.y;
                (d as any)._dragStartTime = Date.now();
                (d as any)._dragFrameCount = 0;
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
                    newX = Math.max(padding.left, Math.min(width - padding.right - w, e.x));
                }

                newY = Math.max(padding.top, Math.min(height - padding.bottom - h, e.y));

                (d as any)._dragFrame = requestAnimationFrame(() => {
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

                    linkLayer.selectAll('.sankey-link')
                        .filter((linkD: any) => linkD.source.id === d.id || linkD.target.id === d.id)
                        .attr('d', getLinkPath);
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
                linkLayer.selectAll('.sankey-link')
                    .filter((linkD: any) => linkD.source.id === d.id || linkD.target.id === d.id)
                    .transition().duration(150).ease(d3.easeQuadOut)
                    .attr('d', getLinkPath);

                d3.select(this)
                    .attr('cursor', 'grab')
                    .style('will-change', null)
                    .transition()
                    .duration(100)
                    .ease(d3.easeQuadOut);
                setStatusText('Click on any element to edit it');

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
            .data(nodes, (d: any) => d.id);

        labelSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        const labelEnter = labelSel.enter().append('text')
            .attr('class', 'sankey-label')
            .attr('opacity', 0);

        const labelUpdate = labelEnter.merge(labelSel as any);

        const labelDrag = d3.drag<SVGTextElement, any>()
            .on('start', function (e) {
                e.sourceEvent?.stopPropagation();
                d3.select(this).raise().attr('cursor', 'grabbing');
                setStatusText('Drag to reposition label');
            })
            .on('drag', function (e, d) {
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
            .style('pointer-events', 'all')  // Enable dragging
            .style('cursor', 'grab')
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
                const text = d3.select(this);
                text.text(null);

                const layout = labelLayouts.get(d.id);
                if (!layout) {
                    return;
                }

                const custom = getCustomization(d.id);
                const nameColor = custom?.labelColor || '#1f2937';
                const valueColor = custom?.valueColor || '#4b5563';
                const comparisonColor = custom?.thirdLineColor || '#9ca3af';
                const nameWeight = (custom?.labelBold ?? settings.labelBold) ? 700 : 600;
                const nameStyle = (custom?.labelItalic ?? settings.labelItalic) ? 'italic' : 'normal';
                const labelFamily = custom?.labelFontFamily ?? settings.labelFontFamily ?? 'Inter, sans-serif';

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
                    .attr('font-family', labelFamily)
                    .attr('font-size', layout.nameSize)
                    .attr('fill', nameColor);

                if (layout.valueText) {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', '1.15em')
                        .text(layout.valueText)
                        .attr('font-family', labelFamily)
                        .attr('font-size', layout.valueSize)
                        .attr('font-weight', custom?.valueBold ? 700 : 400)
                        .attr('fill', valueColor);
                }

                if (layout.comparisonText) {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', '1.15em')
                        .text(layout.comparisonText)
                        .attr('font-family', labelFamily)
                        .attr('font-size', layout.comparisonSize)
                        .attr('font-weight', 400)
                        .attr('fill', comparisonColor);
                }
            });

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
            svg.on('click', null); // Cleanup click listener
            svg.on('mousedown', null);
            svg.on('mousemove', null);
            svg.on('mouseup', null);
        };

    }, [
        data,
        settings,
        selectedNodeId,
        selectedLinkIndex,
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
        <div ref={containerRef} className="w-full h-full bg-white border border-slate-200 overflow-hidden relative">
            <svg

                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`0 0 ${settings.width} ${settings.height}`}
                className="w-full h-full main-canvas"
                style={{ minHeight: '600px' }}
            />
            <div className="absolute bottom-2 left-3 pointer-events-none select-none text-[11px] text-slate-400 bg-white/70 px-2 py-0.5 rounded">
                {statusText}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none select-none text-[10px] text-slate-300">
                created with SankeyCapCap Studio
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
