'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { sankey } from 'd3-sankey';
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
    const { data, settings, selectedNodeId, nodeCustomizations } = state;
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [statusText, setStatusText] = useState('Click on any element to edit it');

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
        const labelSideOffset = 6;
        const labelAboveOffset = 6;
        const labelBelowOffset = 6;

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
        const nodeLayer = getLayer('layer-nodes');
        const labelLayer = getLayer('layer-labels');
        const guideLayer = getLayer('layer-guides');
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const smoothLinkPath = (d: any) => {
            const sx = d.source.x1;
            const tx = d.target.x0;
            const sy0 = d.y0;
            const ty1 = d.y1;

            const gap = Math.max(1, tx - sx);
            const curveLength = Math.min(gap * 0.28, 84);
            const flatStartX = sx + curveLength;
            const flatEndX = tx - curveLength;
            const midY = (sy0 + ty1) / 2;

            if (flatEndX <= flatStartX + 2) {
                const c1 = sx + gap * 0.4;
                const c2 = tx - gap * 0.4;
                return `M ${sx},${sy0} C ${c1},${sy0} ${c2},${ty1} ${tx},${ty1}`;
            }

            return [
                `M ${sx},${sy0}`,
                `C ${sx + curveLength * 0.35},${sy0} ${flatStartX - curveLength * 0.2},${midY} ${flatStartX},${midY}`,
                `L ${flatEndX},${midY}`,
                `C ${flatEndX + curveLength * 0.2},${midY} ${tx - curveLength * 0.35},${ty1} ${tx},${ty1}`,
            ].join(' ');
        };

        const getGradientId = (sourceId: string, targetId: string) => {
            const encodeSegment = (value: string) =>
                Array.from(value)
                    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
                    .join('');

            return `grad-${encodeSegment(sourceId)}-${encodeSegment(targetId)}`;
        };

        // Gradients
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        links.forEach((l: any) => {
            const id = getGradientId(l.source.id, l.target.id);
            let g = defs.select<SVGLinearGradientElement>('#' + id);
            if (g.empty()) {
                g = defs.append('linearGradient').attr('id', id).attr('gradientUnits', 'userSpaceOnUse');
                g.append('stop').attr('offset', '0%').attr('class', 's');
                g.append('stop').attr('offset', '100%').attr('class', 't');
            }
            g.attr('x1', l.source.x1)
                .attr('y1', l.y0)
                .attr('x2', l.target.x0)
                .attr('y2', l.y1);

            const sourceColor = l.source.flowColor || getNodeColor(l.source, 0);
            const targetColor = getNodeColor(l.target, 0);
            g.select('.m').remove();
            g.select('.s').attr('stop-color', sourceColor).attr('stop-opacity', 1);
            g.select('.t').attr('stop-color', targetColor).attr('stop-opacity', 1);
        });

        const getAutoPlacement = (node: any): 'left' | 'right' | 'above' => {
            const incoming = node.targetLinks?.length ?? 0;
            const outgoing = node.sourceLinks?.length ?? 0;
            if (incoming === 0 && outgoing > 0) return 'left';
            if (outgoing === 0 && incoming > 0) return 'right';
            return 'above';
        };

        const resolvePlacement = (node: any, custom?: NodeCustomization) => {
            if (custom?.labelPlacement && custom.labelPlacement !== 'auto') {
                return custom.labelPlacement;
            }

            if (settings.labelPosition === 'auto') {
                return getAutoPlacement(node);
            }

            if (settings.labelPosition === 'external') {
                return node.x0 < width / 2 ? 'left' : 'right';
            }

            return settings.labelPosition;
        };

        const getLabelCoordinates = (node: any, custom?: NodeCustomization) => {
            const nodeWidth = node.x1 - node.x0;
            const placement = resolvePlacement(node, custom);

            let x = node.x0 + nodeWidth / 2;
            let y = (node.y0 + node.y1) / 2;

            if (placement === 'above') {
                y = node.y0 - labelAboveOffset;
            } else if (placement === 'below') {
                y = node.y1 + labelBelowOffset;
            } else if (placement === 'left') {
                x = node.x0 - labelSideOffset;
            } else if (placement === 'right') {
                x = node.x1 + labelSideOffset;
            } else if (placement === 'external') {
                x = node.x0 < width / 2 ? node.x0 - labelSideOffset : node.x1 + labelSideOffset;
            }

            x += custom?.labelOffsetX || 0;
            y += custom?.labelOffsetY || 0;

            return { x, y, placement };
        };

        const getLabelAnchor = (node: any, placement: string) => {
            if (placement === 'left') return 'end';
            if (placement === 'right') return 'start';
            if (placement === 'external') return node.x0 < width / 2 ? 'end' : 'start';
            return 'middle';
        };

        const shouldUseLabelHalo = (node: any, placement: string) => {
            const incoming = node.targetLinks?.length ?? 0;
            const outgoing = node.sourceLinks?.length ?? 0;
            const isMiddleNode = incoming > 0 && outgoing > 0;
            return placement === 'inside' || (placement === 'above' && isMiddleNode);
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
            .attr('fill', 'none')
            .attr('opacity', 0);

        const linkUpdate = linkEnter.merge(linkSel as any);

        // Layout Transition (Geometry)
        linkUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('d', smoothLinkPath);

        // Style Transition (Opacity/Color)
        linkUpdate.transition('style').duration(500)
            .attr('opacity', settings.linkOpacity)
            .style('mix-blend-mode', settings.linkBlendMode || 'normal')
            .attr('fill', 'none')
            .attr('stroke-width', (d: any) => Math.max(0.8, d.width))
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .style('pointer-events', 'stroke')
            .attr('stroke', (d: any) => {
                // Smart Financial Theme
                if (settings.useFinancialTheme) {
                    const sourceCategory = d.source.category;
                    if (sourceCategory === 'revenue') return COLORS.revenue;
                    if (sourceCategory === 'expense') return COLORS.expense;
                    if (sourceCategory === 'profit') return COLORS.profit;
                    return COLORS.neutral;
                }

                // Original logic
                return settings.linkGradient
                    ? `url(#${getGradientId(d.source.id, d.target.id)})`
                    : (d.source.flowColor || getNodeColor(d.source, 0));
            });

        // Interaction
        linkLayer.selectAll('.sankey-link')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    .attr('opacity', settings.linkOpacity);
                setStatusText('Click on any element to edit it');
                hideTooltip();
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .on('click', (e, d: any) => {
                e.stopPropagation();
                dispatch({ type: 'SELECT_LINK', payload: links.indexOf(d) });
                const formatted = formatValue(d.value, true);
                showTooltip(e, `${d.source.name} → ${d.target.name}${formatted ? `: ${formatted}` : ''}`);
            });


        // --- Nodes ---
        const nodeSel = nodeLayer.selectAll('.sankey-node')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            .attr('opacity', 1);

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
                        linkD.source.id === d.id || linkD.target.id === d.id ? 0.8 : settings.linkOpacity,
                    );
            })
            .on('mouseleave', function () {
                setStatusText('Click on any element to edit it');
                d3.select(this).select('rect').attr('fill-opacity', settings.nodeOpacity);
                linkLayer.selectAll('.sankey-link').attr('opacity', settings.linkOpacity);
            });


        // Drag (V12: Optimized for 60fps with requestAnimationFrame)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drag = d3.drag<any, any>()
            .filter((e) => !e.ctrlKey && !e.button) // Only left-click, no Ctrl
            .subject((e, d) => ({ x: d.x0, y: d.y0 }))
            .on('start', function (e, d) {
                d3.select(this).raise().attr('cursor', 'grabbing');
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cols = Array.from(new Set(nodes.map((n: any) => n.x0))).sort((a: any, b: any) => a - b);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    newX = cols.reduce((p, c) => Math.abs(c - e.x) < Math.abs(p - e.x) ? c : p);
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
                        .attr('d', smoothLinkPath);

                    labelLayer.selectAll('.sankey-label')
                        .filter((labelD: any) => labelD.id === d.id)
                        .attr('transform', () => {
                            const custom = getCustomization(d.id);
                            const coords = getLabelCoordinates(d, custom);
                            return `translate(${coords.x}, ${coords.y})`;
                        });
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
                    .attr('d', smoothLinkPath);

                d3.select(this)
                    .attr('cursor', 'grab')
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .data(nodes, (d: any) => d.id);

        labelSel.exit().transition('style').duration(500).attr('opacity', 0).remove();

        const labelEnter = labelSel.enter().append('text')
            .attr('class', 'sankey-label')
            .attr('opacity', 0);

        const labelUpdate = labelEnter.merge(labelSel as any);

        // V11: Label Drag Handler (for repositioning)
        const labelDrag = d3.drag<SVGTextElement, any>()
            .on('start', function (e, d) {
                d3.select(this).raise().attr('cursor', 'grabbing');
                setStatusText('Drag to move, double-click to reset');
                // Store initial position
                const transform = d3.select(this).attr('transform');
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (match) {
                    (d as any)._labelDragStartX = parseFloat(match[1]);
                    (d as any)._labelDragStartY = parseFloat(match[2]);
                } else {
                    (d as any)._labelDragStartX = 0;
                    (d as any)._labelDragStartY = 0;
                }
                (d as any)._dragTime = Date.now();
            })
            .on('drag', function (e, d) {
                // V12-style requestAnimationFrame for smooth dragging
                if ((d as any)._labelDragFrame) cancelAnimationFrame((d as any)._labelDragFrame);

                (d as any)._labelDragFrame = requestAnimationFrame(() => {
                    // Update visual position immediately
                    d3.select(this).attr('transform', `translate(${e.x}, ${e.y})`);

                    // Store temp position
                    (d as any)._tempLabelX = e.x;
                    (d as any)._tempLabelY = e.y;
                });
            })
            .on('end', function (e, d) {
                if ((d as any)._labelDragFrame) {
                    cancelAnimationFrame((d as any)._labelDragFrame);
                    (d as any)._labelDragFrame = null;
                }

                d3.select(this).attr('cursor', 'grab');

                // Calculate offset from original position
                const finalX = (d as any)._tempLabelX || (d as any)._labelDragStartX || 0;
                const finalY = (d as any)._tempLabelY || (d as any)._labelDragStartY || 0;

                const deltaX = finalX - ((d as any)._labelDragStartX || 0);
                const deltaY = finalY - ((d as any)._labelDragStartY || 0);

                // Only save if actually dragged (not just clicked)
                const dragDuration = Date.now() - ((d as any)._dragTime || 0);
                const dragDistance = Math.hypot(deltaX, deltaY);

                if (dragDuration > 100 && dragDistance > 3) {
                    const nodeWidth = d.x1 - d.x0;
                    const isLeftSide = d.x0 < width / 2;
                    const snapAnchors = {
                        above: { x: d.x0 + nodeWidth / 2, y: d.y0 - labelAboveOffset },
                        below: { x: d.x0 + nodeWidth / 2, y: d.y1 + labelBelowOffset },
                        left: { x: d.x0 - labelSideOffset, y: (d.y0 + d.y1) / 2 },
                        right: { x: d.x1 + labelSideOffset, y: (d.y0 + d.y1) / 2 },
                        inside: { x: d.x0 + nodeWidth / 2, y: (d.y0 + d.y1) / 2 },
                        external: { x: isLeftSide ? d.x0 - labelSideOffset : d.x1 + labelSideOffset, y: (d.y0 + d.y1) / 2 },
                    };

                    let nearestPlacement: keyof typeof snapAnchors = 'above';
                    let nearestDistance = Number.POSITIVE_INFINITY;

                    (Object.keys(snapAnchors) as Array<keyof typeof snapAnchors>).forEach((placement) => {
                        const anchor = snapAnchors[placement];
                        const dist = Math.hypot(finalX - anchor.x, finalY - anchor.y);
                        if (dist < nearestDistance) {
                            nearestDistance = dist;
                            nearestPlacement = placement;
                        }
                    });

                    if (nearestDistance <= 22) {
                        dispatch({
                            type: 'UPDATE_NODE_CUSTOMIZATION',
                            payload: {
                                nodeId: d.id,
                                updates: {
                                    labelPlacement: nearestPlacement,
                                    labelOffsetX: 0,
                                    labelOffsetY: 0,
                                },
                            },
                        });
                        return;
                    }

                    // Get existing customization
                    const existing = getCustomization(d.id);
                    const currentOffsetX = (existing?.labelOffsetX as number) || 0;
                    const currentOffsetY = (existing?.labelOffsetY as number) || 0;

                    // Save cumulative offset
                    dispatch({
                        type: 'UPDATE_NODE_CUSTOMIZATION',
                        payload: {
                            nodeId: d.id,
                            updates: {
                                labelOffsetX: currentOffsetX + deltaX,
                                labelOffsetY: currentOffsetY + deltaY
                            }
                        }
                    });
                }

                setStatusText('Click on any element to edit it');
            });

        // Apply drag handler and enable pointer events
        labelUpdate.call(labelDrag)
            .style('pointer-events', 'all')  // Enable dragging
            .style('cursor', 'grab')
            .on('mouseenter', function () {
                setStatusText('Drag to move, double-click to reset');
            })
            .on('mouseleave', function () {
                setStatusText('Click on any element to edit it');
            })
            .on('dblclick', function (e, d: any) {
                e.stopPropagation();
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
            .attr('opacity', 1);

        // Move with transition
        labelUpdate.transition('layout').duration(750).ease(d3.easeCubicInOut)
            .attr('transform', (d: any) => {
                const custom = getCustomization(d.id);
                const coords = getLabelCoordinates(d, custom);
                return `translate(${coords.x}, ${coords.y})`;
            })
            .each(function (d: any) {
                const text = d3.select(this);
                text.text(null); // Clear previous

                const custom = getCustomization(d.id);
                const { placement } = getLabelCoordinates(d, custom);

                // Determine Alignment
                let align: 'start' | 'middle' | 'end' = getLabelAnchor(d, placement);

                // Override
                if (custom?.labelAlignment) {
                    align = custom.labelAlignment === 'left' ? 'start' : custom.labelAlignment === 'right' ? 'end' : 'middle';
                }

                text.attr('text-anchor', align);
                const useHalo = shouldUseLabelHalo(d, placement);
                text.attr('paint-order', 'stroke')
                    .attr('stroke', useHalo ? 'rgba(255,255,255,0.9)' : 'none')
                    .attr('stroke-width', useHalo ? 3 : 0)
                    .attr('stroke-linejoin', 'round');

                const line1Size = custom?.labelFontSize ?? settings.labelFontSize;
                const line2Size = Math.max(10, Math.round(line1Size - 1));

                // Line 1: Name
                text.append('tspan')
                    .attr('x', 0)
                    .attr('dy', placement === 'inside' ? '-0.2em' : '0em')
                    .text(custom?.labelText || d.name)
                    .attr('font-weight', (custom?.labelBold ?? settings.labelBold) ? 700 : 600)
                    .attr('font-style', (custom?.labelItalic ?? settings.labelItalic) ? 'italic' : 'normal')
                    .attr('font-family', custom?.labelFontFamily ?? settings.labelFontFamily)
                    .attr('font-size', line1Size)
                    .attr('fill', custom?.labelColor || '#1f2937');
                

                // Line 2: Value
                const formattedValue = formatValue(d.value);
                if (formattedValue) {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', '1.15em')
                        .text(formattedValue)
                        .attr('font-family', custom?.labelFontFamily ?? settings.labelFontFamily)
                        .attr('font-size', line2Size)
                        .attr('font-weight', 400)
                        .attr('fill', custom?.valueColor || '#6b7280');
                }


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
            setDrawingBox({ startX: x, startY: y, currentX: x, currentY: y });
        });

        svg.on('mousemove', (event) => {
            if (!drawingBox) return;
            const [x, y] = d3.pointer(event, mainGroup.node());
            setDrawingBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
        });

        svg.on('mouseup', () => {
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
        };

    }, [data, settings, selectedNodeId, state.customLayout, state.independentLabels, state.selectedLabelId, studioState.currentTool, dispatch, getNodeColor, formatValue, getCustomization, handleNodeClick, setTool]);

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
            <div className="absolute bottom-2 left-3 pointer-events-none select-none text-[11px] text-slate-400 bg-white/70 px-2 py-0.5 rounded">
                {statusText}
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
