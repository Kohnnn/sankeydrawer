import { useEffect, RefObject } from 'react';
import * as d3 from 'd3';

interface KeyboardShortcutsProps {
    svgRef: RefObject<SVGSVGElement | null>;
    dispatch: any;
    studioDispatch?: any;
    state: any;
    selectedNodeId: string | null;
}

export function useKeyboardShortcuts({
    svgRef,
    dispatch,
    studioDispatch,
    state,
    selectedNodeId
}: KeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                return;
            }

            const ctrl = e.ctrlKey || e.metaKey;

            // Toggle Sidebar (Ctrl+B)
            if (ctrl && e.key === 'b' && studioDispatch) {
                studioDispatch({ type: 'TOGGLE_SIDEBAR' });
                e.preventDefault();
                return;
            }

            // Delete selected node
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNodeId) {
                    dispatch({ type: 'DELETE_NODE', payload: selectedNodeId });
                    e.preventDefault();
                }
                return;
            }

            // Undo
            if (ctrl && e.key === 'z' && !e.shiftKey) {
                dispatch({ type: 'UNDO' });
                e.preventDefault();
                return;
            }

            // Redo
            if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                dispatch({ type: 'REDO' });
                e.preventDefault();
                return;
            }

            // Duplicate node
            if (ctrl && e.key === 'd') {
                if (selectedNodeId) {
                    const node = state.data.nodes.find((n: any) => n.id === selectedNodeId);
                    if (node) {
                        const newNode = {
                            ...node,
                            id: `${node.id}_copy_${Date.now()}`,
                            name: `${node.name} (Copy)`
                        };
                        dispatch({ type: 'ADD_NODE', payload: newNode });
                        // Update custom layout to offset position
                        if (state.customLayout?.nodes?.[node.id]) {
                            const pos = state.customLayout.nodes[node.id];
                            dispatch({
                                type: 'MOVE_NODE',
                                payload: { id: newNode.id, x: pos.x + 50, y: pos.y + 50 }
                            });
                        }
                    }
                }
                e.preventDefault();
                return;
            }

            // Zoom shortcuts
            if (!svgRef.current) return;

            const svg = d3.select(svgRef.current);
            const zoomBehavior = (svg.node() as any)?.__zoomBehavior;
            if (!zoomBehavior) return;

            // Zoom in
            if (e.key === '+' || e.key === '=') {
                svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.2);
                e.preventDefault();
                return;
            }

            // Zoom out
            if (e.key === '-' || e.key === '_') {
                svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.8);
                e.preventDefault();
                return;
            }

            // Reset zoom
            if (e.key === '0') {
                svg.transition().duration(300).call(zoomBehavior.scaleTo, 1);
                e.preventDefault();
                return;
            }

            // Fit to screen
            if (e.key === 'f' || e.key === 'F') {
                const mainGroup = svg.select('g.main-group');
                if (mainGroup.empty()) return;

                const bounds = (mainGroup.node() as any)?.getBBox();
                if (!bounds) return;

                const width = state.settings.width;
                const height = state.settings.height;
                const scale = Math.min(
                    width / bounds.width,
                    height / bounds.height,
                    2 // Max zoom
                ) * 0.9; // 90% to add padding

                const transform = d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(scale)
                    .translate(-bounds.x - bounds.width / 2, -bounds.y - bounds.height / 2);

                svg.transition().duration(500).call(zoomBehavior.transform, transform);
                e.preventDefault();
                return;
            }

            // Toggle grid
            if (e.key === 'g' || e.key === 'G') {
                dispatch({
                    type: 'UPDATE_SETTINGS',
                    payload: { showGrid: !state.settings.showGrid }
                });
                e.preventDefault();
                return;
            }

            // Deselect
            if (e.key === 'Escape') {
                if (selectedNodeId) {
                    dispatch({ type: 'SELECT_NODE', payload: null });
                }
                e.preventDefault();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [svgRef, dispatch, state, selectedNodeId]);
}
