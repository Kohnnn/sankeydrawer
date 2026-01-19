import { DiagramState, SankeyData, SankeyNode, SankeyLink } from '@/types/sankey';

/**
 * Prepares a optimized, token-efficient string representation of the diagram state for the AI.
 * Removes unnecessary UI-related properties like positions, colors (unless semantic), etc.
 */
export function getDiagramStateForAI(state: DiagramState): string {
    const { nodes, links } = state.data;

    // Simplify Nodes: ID, Name, Value, Category, Group, Metadata, OriginalValue (V2)
    const simplifiedNodes = nodes.map(n => ({
        id: n.id,
        name: n.name,
        value: n.value,
        color: n.color,
        ...(n.category ? { category: n.category } : {}),
        ...(n.group ? { group: n.group } : {}),
        ...(n.metadata ? { metadata: n.metadata } : {}),
        ...(n.originalValue !== undefined ? { originalValue: n.originalValue } : {})
    }));

    // Simplify Links: SourceID, TargetID, Value, Metadata, OriginalValue (V2)
    const simplifiedLinks = links.map(l => ({
        s: typeof l.source === 'object' ? (l.source as any).id : l.source,
        t: typeof l.target === 'object' ? (l.target as any).id : l.target,
        v: l.value,
        c: l.comparisonValue, // Add comparison (e.g., "+10%")
        ...(l.metadata ? { metadata: l.metadata } : {}),
        ...(l.originalValue !== undefined ? { originalValue: l.originalValue } : {})
    }));

    const context = {
        nodes: simplifiedNodes,
        flows: simplifiedLinks,
        annotations: state.annotationBoxes || [],
        settings: {
            // Only relevant settings for context
            valueCurrency: state.settings.valuePrefix || '$',
            isDarkMode: state.settings.isDarkMode,
            labelPosition: state.settings.labelPosition,
            totalValue: nodes.reduce((acc, n) => acc + (n.value || 0), 0)
        }
    };

    return JSON.stringify(context, null, 2);
}

/**
 * Applies a partial update or complex change from the AI to the current state.
 * Handles merging nodes, updating flows, and recalculating values.
 */
export function applyAIChanges(currentState: DiagramState, changes: any): { success: boolean; newState?: DiagramState; errors?: string[] } {
    try {
        const newData: SankeyData = JSON.parse(JSON.stringify(currentState.data)); // Deep copy
        const errors: string[] = [];

        // 1. Handle Nodes
        if (changes.nodes) {
            Object.entries(changes.nodes).forEach(([id, attrs]: [string, any]) => {
                const existingNodeIndex = newData.nodes.findIndex(n => n.id === id);
                if (existingNodeIndex >= 0) {
                    // Update existing node, merging in new V2 fields
                    newData.nodes[existingNodeIndex] = {
                        ...newData.nodes[existingNodeIndex],
                        ...attrs,
                        // Explicitly merge V2 fields
                        ...(attrs.group !== undefined ? { group: attrs.group } : {}),
                        ...(attrs.metadata ? { metadata: { ...newData.nodes[existingNodeIndex].metadata, ...attrs.metadata } } : {}),
                        ...(attrs.originalValue !== undefined ? { originalValue: attrs.originalValue } : {})
                    };
                } else {
                    // Create new node with all V2 fields
                    newData.nodes.push({
                        id,
                        name: attrs.name || id,
                        value: 0,
                        ...attrs
                    });
                }
            });
        }

        // 2. Handle Flows
        if (changes.flows) {
            // ... existing flow handling ...
            changes.flows.forEach((flow: any) => {
                const existingLinkIndex = newData.links.findIndex(l =>
                    (typeof l.source === 'object' ? (l.source as any).id : l.source) === flow.source &&
                    (typeof l.target === 'object' ? (l.target as any).id : l.target) === flow.target
                );

                if (existingLinkIndex >= 0) {
                    newData.links[existingLinkIndex] = {
                        ...newData.links[existingLinkIndex],
                        value: flow.value,
                        ...(flow.metadata ? { metadata: { ...newData.links[existingLinkIndex].metadata, ...flow.metadata } } : {}),
                        ...(flow.originalValue !== undefined ? { originalValue: flow.originalValue } : {})
                    };
                } else {
                    newData.links.push({
                        source: flow.source,
                        target: flow.target,
                        value: flow.value,
                        ...(flow.metadata ? { metadata: flow.metadata } : {}),
                        ...(flow.originalValue !== undefined ? { originalValue: flow.originalValue } : {})
                    });
                }
            });
        }

        // 3. Handle Annotations (New)
        let annotationBoxes = currentState.annotationBoxes;
        if (changes.annotations) {
            annotationBoxes = changes.annotations;
        }

        // 4. Handle Settings (New)
        let settings = currentState.settings;
        if (changes.settings) {
            settings = { ...settings, ...changes.settings };
        }

        return { 
            success: true, 
            newState: { 
                ...currentState, 
                data: newData, 
                annotationBoxes, 
                settings 
            } 
        };

    } catch (e) {
        console.error("Error applying AI changes:", e);
        return { success: false, errors: [(e as Error).message] };
    }
}

/**
 * Applies a "Breakdown" suggestion: Replaces one node with multiple children nodes.
 * @param currentState 
 * @param suggestion 
 */
export function applyBreakdown(currentState: DiagramState, suggestion: { nodeId: string; breakdown: { name: string; value: number, color?: string }[] }): DiagramState {
    const newData: SankeyData = JSON.parse(JSON.stringify(currentState.data));
    const { nodeId, breakdown } = suggestion;

    const targetNodeIndex = newData.nodes.findIndex(n => n.id === nodeId);
    if (targetNodeIndex === -1) return currentState;

    const targetNode = newData.nodes[targetNodeIndex];

    // 1. Create new nodes for the breakdown
    const newNodes = breakdown.map((item, i) => ({
        id: `${nodeId}_sub_${i}`,
        name: item.name,
        value: item.value,
        color: item.color || targetNode.color // Inherit or usage specific
    }));
    newData.nodes.push(...newNodes);

    // 2. Redirect flows
    // If the target node was a "Target" (receiving money), we drag flows to it? 
    // Or if it was a "Source" (spending money)?
    // Usually "Breakdown" means "Split this node into smaller components".

    // CASE A: The node acts as a category aggregation (e.g., "Expenses").
    // Break it down means "Replace 'Expenses' with 'Rent', 'Salaries', etc."
    // We need to see what links were going INTO 'Expenses' and redirect them to the new nodes?
    // OR what links were coming OUT of 'Expenses'?

    // Simple logic:
    // 1. Identify all Incoming links to TargetNode.
    // 2. Identify all Outgoing links from TargetNode.

    // For a breakdown, typically we are "expanding" a node. 
    // It's cleaner to keep the TargetNode as a "Group" or "Parent" and flow FROM it TO the new nodes?
    // OR replace it entirely.

    // Let's go with "Flow FROM TargetNode TO NewNodes" (Explode) 
    // IF the TargetNode has NO outgoing links.
    // IF the TargetNode HAS outgoing links (it's intermediate), this is harder.

    // Let's assume the user wants to see what makes up "Expenses".
    // We will keep "Expenses" node, and add flows from "Expenses" -> "Rent", "Expenses" -> "Salaries".
    // This preserves existing structure and just adds detail.

    const newLinks = newNodes.map(n => ({
        source: nodeId,
        target: n.id,
        value: n.value
    }));

    newData.links.push(...newLinks);

    return { ...currentState, data: newData };
}
