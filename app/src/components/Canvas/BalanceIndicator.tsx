'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useDiagram } from '@/context/DiagramContext';

interface NodeBalance {
    id: string;
    name: string;
    totalIn: number;
    totalOut: number;
    delta: number;
    isBalanced: boolean;
}

export default function BalanceIndicator() {
    const { state } = useDiagram();
    const { data } = state;

    // Calculate balance for each node
    const nodeBalances = useMemo(() => {
        const balances: NodeBalance[] = [];

        data.nodes.forEach(node => {
            // Calculate total inflows
            const totalIn = data.links
                .filter(l => {
                    const targetId =
                        typeof l.target === 'string'
                            ? l.target
                            : typeof l.target === 'number'
                                ? data.nodes[l.target]?.id
                                : undefined;
                    return targetId === node.id;
                })
                .reduce((sum, l) => sum + l.value, 0);

            // Calculate total outflows
            const totalOut = data.links
                .filter(l => {
                    const sourceId =
                        typeof l.source === 'string'
                            ? l.source
                            : typeof l.source === 'number'
                                ? data.nodes[l.source]?.id
                                : undefined;
                    return sourceId === node.id;
                })
                .reduce((sum, l) => sum + l.value, 0);

            const delta = totalIn - totalOut;
            const isBalanced = Math.abs(delta) < 0.01 || totalIn === 0 || totalOut === 0;

            balances.push({
                id: node.id,
                name: node.name,
                totalIn,
                totalOut,
                delta,
                isBalanced
            });
        });

        return balances;
    }, [data.nodes, data.links]);

    // Get imbalanced nodes (nodes with both inflows and outflows that don't match)
    const imbalancedNodes = useMemo(() => {
        return nodeBalances.filter(b => !b.isBalanced && b.totalIn > 0 && b.totalOut > 0);
    }, [nodeBalances]);

    const allBalanced = imbalancedNodes.length === 0;

    // Format currency value
    const formatValue = (value: number) => {
        const absValue = Math.abs(value);
        if (absValue >= 1_000_000) {
            return `$${(value / 1_000_000).toFixed(1)}M`;
        } else if (absValue >= 1_000) {
            return `$${(value / 1_000).toFixed(1)}K`;
        }
        return `$${value.toFixed(0)}`;
    };

    if (data.nodes.length === 0) return null;

    return (
        <div className="absolute bottom-4 left-4 z-20 animate-fade-in">
            {allBalanced ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md shadow-sm text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-slate-500 font-medium">Flows Balanced</span>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-sm">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-800">
                            Imbalanced Nodes
                        </span>
                    </div>


                    {/* Table */}
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-[var(--secondary-text)]">
                                <th className="text-left py-1 font-medium"></th>
                                <th className="text-right py-1 font-medium">Total In</th>
                                <th className="text-right py-1 font-medium">Total Out</th>
                                <th className="text-right py-1 font-medium">Difference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {imbalancedNodes.slice(0, 5).map(node => (
                                <tr key={node.id} className="border-t border-[var(--border)]">
                                    <td className="py-1.5 text-[var(--primary-text)] font-medium truncate max-w-[100px]">
                                        {node.name}
                                    </td>
                                    <td className="py-1.5 text-right text-green-600 font-mono">
                                        {formatValue(node.totalIn)}
                                    </td>
                                    <td className="py-1.5 text-right text-red-500 font-mono">
                                        {formatValue(node.totalOut)}
                                    </td>
                                    <td className={`py-1.5 text-right font-mono font-medium ${node.delta > 0 ? 'text-green-600' : 'text-red-500'
                                        }`}>
                                        {node.delta > 0 ? '+' : ''}{formatValue(node.delta)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {imbalancedNodes.length > 5 && (
                        <p className="text-xs text-[var(--secondary-text)] mt-2 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            +{imbalancedNodes.length - 5} more imbalanced nodes
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
