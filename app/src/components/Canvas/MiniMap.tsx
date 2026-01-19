'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useDiagram } from '@/context/DiagramContext';

export default function MiniMap() {
    const miniRef = useRef<SVGSVGElement>(null);
    const { state } = useDiagram();
    const { data, settings } = state;
    const [viewport, setViewport] = useState({ x: 0, y: 0, k: 1 });

    const MINI_WIDTH = 150;
    const MINI_HEIGHT = 100;

    // Monitor the main SVG's transform
    useEffect(() => {
        const mainSvg = d3.select('svg.main-canvas'); // We should add this class
        if (mainSvg.empty()) return;

        const interval = setInterval(() => {
            const transform = d3.zoomTransform(mainSvg.node() as any);
            setViewport({ x: transform.x, y: transform.y, k: transform.k });
        }, 100);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!miniRef.current) return;

        const svg = d3.select(miniRef.current);
        svg.selectAll('*').remove();

        // Scale factor
        const scaleX = MINI_WIDTH / settings.width;
        const scaleY = MINI_HEIGHT / settings.height;
        const scale = Math.min(scaleX, scaleY);

        // Background
        svg.append('rect')
            .attr('width', MINI_WIDTH)
            .attr('height', MINI_HEIGHT)
            .attr('fill', settings.isDarkMode ? '#1e293b' : '#f8fafc')
            .attr('stroke', settings.isDarkMode ? '#334155' : '#e2e8f0')
            .attr('rx', 4);

        // Simplified nodes
        data.nodes.forEach((node) => {
            const x0 = node.x0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y0 = node.y0 ?? 0;
            const y1 = node.y1 ?? 0;

            svg.append('rect')
                .attr('x', x0 * scale)
                .attr('y', y0 * scale)
                .attr('width', Math.max(2, (x1 - x0) * scale))
                .attr('height', Math.max(2, (y1 - y0) * scale))
                .attr('fill', node.color || '#3b82f6')
                .attr('rx', 1)
                .attr('opacity', 0.6);
        });

        // Viewport indicator
        // Calculate visible area based on current zoom
        const containerWidth = 800; // Assumption or get from ref
        const containerHeight = 600;

        const visibleWidth = (containerWidth / viewport.k) * scale;
        const visibleHeight = (containerHeight / viewport.k) * scale;
        const visibleX = (-viewport.x / viewport.k) * scale;
        const visibleY = (-viewport.y / viewport.k) * scale;

        svg.append('rect')
            .attr('width', Math.min(MINI_WIDTH, visibleWidth))
            .attr('height', Math.min(MINI_HEIGHT, visibleHeight))
            .attr('x', Math.max(0, visibleX))
            .attr('y', Math.max(0, visibleY))
            .attr('fill', 'rgba(59, 130, 246, 0.1)')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 1.5)
            .attr('rx', 2);

    }, [data, settings, viewport]);

    return (
        <div className="absolute bottom-6 left-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-1.5 shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-none">
            <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 px-1">Navigation</div>
            <svg
                ref={miniRef}
                width={MINI_WIDTH}
                height={MINI_HEIGHT}
                className="rounded overflow-hidden"
            />
        </div>
    );
}
