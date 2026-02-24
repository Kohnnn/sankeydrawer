import { SankeyData, SankeyNode, SankeyLink } from '@/types/sankey';

const INVALID_COMPARISON_TOKEN = /^(nan|null|undefined|n\/a|na|none|--?)$/i;

interface ParsedFlowLine {
    sourceName: string;
    targetName: string;
    value: number;
    previousValue?: number;
    comparisonValue?: string;
}

export function sanitizeComparisonLabel(value?: string | null): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || INVALID_COMPARISON_TOKEN.test(trimmed)) {
        return undefined;
    }

    return trimmed;
}

function parseComparisonFields(value: number, rawComparison?: string): { previousValue?: number; comparisonValue?: string } {
    const comparison = sanitizeComparisonLabel(rawComparison);
    if (!comparison) {
        return {};
    }

    const isStringLabel = comparison.startsWith('+') || comparison.endsWith('%') || comparison.startsWith('-');

    if (!isStringLabel) {
        const previous = parseNumber(comparison);
        if (!isNaN(previous) && previous !== 0) {
            const diff = value - previous;
            const percent = ((diff / previous) * 100).toFixed(0);
            const sign = diff >= 0 ? '+' : '';

            return {
                previousValue: previous,
                comparisonValue: `${sign}${percent}%`,
            };
        }

        if (/[a-zA-Z]/.test(comparison)) {
            return { comparisonValue: comparison };
        }

        return {};
    }

    return { comparisonValue: comparison };
}

function parseArrowFlowLine(trimmed: string): ParsedFlowLine | null {
    const arrowMatch = trimmed.match(/^(.+?)\s*->\s*(.+?)\s+([^\s]+)(?:\s+([^\s]+))?$/);
    if (!arrowMatch) {
        return null;
    }

    const sourceName = arrowMatch[1].trim();
    const targetName = arrowMatch[2].trim();
    const value = parseNumber(arrowMatch[3]);

    if (!sourceName || !targetName || isNaN(value) || value <= 0) {
        return null;
    }

    const comparison = parseComparisonFields(value, arrowMatch[4]);
    return {
        sourceName,
        targetName,
        value,
        ...comparison,
    };
}

function parseDelimitedFlowLine(trimmed: string): ParsedFlowLine | null {
    let columns: string[] | null = null;

    if (trimmed.includes('\t')) {
        const tabColumns = trimmed.split('\t').map((value) => value.trim());
        if (tabColumns.length >= 3) {
            columns = tabColumns;
        }
    }

    if (!columns && trimmed.includes(',')) {
        const csvColumns = parseCSVLine(trimmed).map((value) => value.trim());
        if (csvColumns.length >= 3) {
            columns = csvColumns;
        }
    }

    if (!columns) {
        const spacedColumns = trimmed.split(/\s{2,}/).map((value) => value.trim()).filter(Boolean);
        if (spacedColumns.length >= 3) {
            columns = spacedColumns;
        }
    }

    if (!columns) {
        return null;
    }

    const sourceName = columns[0]?.trim() || '';
    const targetName = columns[1]?.trim() || '';
    const value = parseNumber(columns[2] || '');

    if (!sourceName || !targetName || isNaN(value) || value <= 0) {
        return null;
    }

    const comparison = parseComparisonFields(value, columns[3]);
    return {
        sourceName,
        targetName,
        value,
        ...comparison,
    };
}

/**
 * Parse DSL text into SankeyData
 * Format: "Source [Amount] Target" per line
 * Comments start with // or #
 * Node colors: "NodeName :color"
 */
export function parseDSL(text: string): SankeyData | null {
    const nodes = new Map<string, SankeyNode>();
    const links: SankeyLink[] = [];
    const nodeColors = new Map<string, string>();

    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
            continue;
        }

        // Check for node color definition: "NodeName :color"
        // Also supports single word comments or commands if needed
        const colorMatch = trimmed.match(/^(.+?)\s*:\s*#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/);
        if (colorMatch) {
            const nodeName = colorMatch[1].trim();
            const color = colorMatch[2].startsWith('#') ? colorMatch[2] : `#${colorMatch[2]}`;
            nodeColors.set(nodeName, color);
            continue;
        }

        // Parse flow: "Source [Amount] Target" or "Source [Amount, Comparison] Target"
        // Regex explanation:
        // ^(.+?)           -> Source (lazy)
        // \s*\[            -> Space and opening bracket
        // ([^\]]+)         -> Content inside brackets (Amount OR Amount, Comparison)
        // \]\s*            -> Closing bracket and space
        // (.+)$            -> Target
        const flowMatch = trimmed.match(/^(.+?)\s*\[([^\]]+)\]\s*(.+)$/);
        let parsedFlow: ParsedFlowLine | null = null;

        if (flowMatch) {
            const sourceName = flowMatch[1].trim();
            const targetName = flowMatch[3].trim();
            const content = flowMatch[2].trim();

            let value = parseNumber(content);
            let previousValue: number | undefined;
            let comparisonValue: string | undefined;

            if (content.includes(',')) {
                // Split by first comma to separate value and comparison
                const firstComma = content.indexOf(',');
                const valStr = content.substring(0, firstComma).trim();
                const compStr = content.substring(firstComma + 1).trim();

                value = parseNumber(valStr);

                const comparison = parseComparisonFields(value, compStr);
                previousValue = comparison.previousValue;
                comparisonValue = comparison.comparisonValue;
            } else {
                value = parseNumber(content);
            }

            // Allow 0 value if it's a placeholder? But mostly we filter > 0
            if (!isNaN(value) && value > 0) {
                parsedFlow = {
                    sourceName,
                    targetName,
                    value,
                    previousValue,
                    comparisonValue,
                };
            }
        } else {
            parsedFlow = parseArrowFlowLine(trimmed) || parseDelimitedFlowLine(trimmed);
        }

        if (parsedFlow) {
            // Create nodes if they don't exist
            if (!nodes.has(parsedFlow.sourceName)) {
                nodes.set(parsedFlow.sourceName, createNode(parsedFlow.sourceName, nodeColors.get(parsedFlow.sourceName)));
            }
            if (!nodes.has(parsedFlow.targetName)) {
                nodes.set(parsedFlow.targetName, createNode(parsedFlow.targetName, nodeColors.get(parsedFlow.targetName)));
            }

            // Use IDs for links to ensure they match node identifiers
            const sourceNode = nodes.get(parsedFlow.sourceName)!;
            const targetNode = nodes.get(parsedFlow.targetName)!;

            // Create link
            links.push({
                source: sourceNode.id,
                target: targetNode.id,
                value: parsedFlow.value,
                previousValue: parsedFlow.previousValue,
                comparisonValue: parsedFlow.comparisonValue,
            });
        }
    }

    if (nodes.size === 0 || links.length === 0) {
        return null;
    }

    // 1. Aggregate Duplicate Links
    // If user has "A [10] B" and "A [20] B", make it "A [30] B"
    const uniqueLinks = new Map<string, SankeyLink>();

    for (const link of links) {
        const key = `${link.source}|${link.target}`;
        if (uniqueLinks.has(key)) {
            const existing = uniqueLinks.get(key)!;
            existing.value += link.value;
            // Merge previous values if both exist? Or just take latest? 
            // Summing previous makes sense for consistency.
            if (existing.previousValue !== undefined && link.previousValue !== undefined) {
                existing.previousValue += link.previousValue;
                // re-calc string? Too complex for now. Let's just keep the original string or update if possible.
                // Reset comparison string as it might be invalid now.
                existing.comparisonValue = undefined;
            }
        } else {
            uniqueLinks.set(key, link);
        }
    }

    const processedLinks = Array.from(uniqueLinks.values());

    // 2. Remove Cycles (D3 Sankey requires DAG)
    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    for (const link of processedLinks) {
        const s = link.source as string;
        const t = link.target as string;
        if (!adjacency.has(s)) adjacency.set(s, []);
        adjacency.get(s)!.push(t);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cyclicLinks = new Set<string>(); // "source|target"

    function isCyclic(nodeId: string): boolean {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const children = adjacency.get(nodeId) || [];
        for (const childId of children) {
            if (!visited.has(childId)) {
                if (isCyclic(childId)) return true;
            } else if (recursionStack.has(childId)) {
                // Cycle detected: Node -> ... -> Child -> Node
                // We must Identify which link causes this.
                // The current edge Node -> Child is a back edge.
                return true;
            }
        }
        recursionStack.delete(nodeId);
        return false;
    }

    // A simple DFS removal strategy:
    // If adding a link creates a cycle, don't add it.
    // This is better than removing existing valid chains.
    // We re-build the list.
    const safeLinks: SankeyLink[] = [];
    const validGraph = new Map<string, Set<string>>(); // Adjacency for check

    function hasPath(from: string, to: string, visited = new Set<string>()): boolean {
        if (from === to) return true;
        visited.add(from);
        const neighbors = validGraph.get(from);
        if (neighbors) {
            for (const next of neighbors) {
                if (!visited.has(next)) {
                    if (hasPath(next, to, visited)) return true;
                }
            }
        }
        return false;
    }

    for (const link of processedLinks) {
        const s = link.source as string;
        const t = link.target as string;

        // If s == t (Self loop), skip
        if (s === t) continue;

        // If adding s->t creates a cycle (i.e., path t->...->s exists), skip
        if (hasPath(t, s)) {
            // Cycle would be created
            // console.warn(`Cycle detected: ignoring link ${s} -> ${t}`);
            continue;
        }

        // Add to graph
        if (!validGraph.has(s)) validGraph.set(s, new Set());
        validGraph.get(s)!.add(t);
        safeLinks.push(link);
    }

    return {
        nodes: Array.from(nodes.values()),
        links: safeLinks,
    };
}

/**
 * Serialize SankeyData to DSL text
 */
export function serializeToDSL(data: SankeyData): string {
    const lines: string[] = [];

    // Output node colors first
    for (const node of data.nodes) {
        if (node.color) {
            lines.push(`${node.name} :${node.color}`);
        }
    }

    if (lines.length > 0) {
        lines.push(''); // Blank line separator
    }

    // Output flows
    for (const link of data.links) {
        // Resolve names from IDs
        let sourceName = '';
        let targetName = '';

        if (typeof link.source === 'string') {
            const node = data.nodes.find(n => n.id === link.source);
            sourceName = node ? node.name : link.source;
        } else {
            sourceName = data.nodes[link.source as number]?.name || '';
        }

        if (typeof link.target === 'string') {
            const node = data.nodes.find(n => n.id === link.target);
            targetName = node ? node.name : link.target;
        } else {
            targetName = data.nodes[link.target as number]?.name || '';
        }

        // If we have a raw previous value, output that (so it can be re-calculated or edited)
        if (link.previousValue !== undefined) {
            lines.push(`${sourceName} [${link.value}, ${link.previousValue}] ${targetName}`);
        } else if (link.comparisonValue !== undefined && link.comparisonValue !== '') {
            // If comparison is string overridden
            lines.push(`${sourceName} [${link.value}, ${link.comparisonValue}] ${targetName}`);
        } else {
            lines.push(`${sourceName} [${link.value}] ${targetName}`);
        }
    }

    return lines.join('\n');
}

/**
 * Parse CSV data into SankeyData
 * Expected columns: From/Source, To/Target, Amount/Value, [Comparison]
 */
export function parseCSV(text: string): SankeyData | null {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return null;

    const header = lines[0].toLowerCase();
    const hasHeader = header.includes('from') || header.includes('source') || header.includes('to') || header.includes('target');

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const nodes = new Map<string, SankeyNode>();
    const links: SankeyLink[] = [];

    for (const line of dataLines) {
        const cols = parseCSVLine(line);
        if (cols.length < 3) continue;

        const sourceName = cols[0].trim();
        const targetName = cols[1].trim();
        const value = parseNumber(cols[2]);
        const compStr = cols[3]?.trim();

        if (!sourceName || !targetName || isNaN(value) || value <= 0) continue;

        const comparison = parseComparisonFields(value, compStr);

        if (!nodes.has(sourceName)) {
            nodes.set(sourceName, createNode(sourceName));
        }
        if (!nodes.has(targetName)) {
            nodes.set(targetName, createNode(targetName));
        }

        links.push({
            source: sourceName,
            target: targetName,
            value,
            previousValue: comparison.previousValue,
            comparisonValue: comparison.comparisonValue,
        });
    }

    if (nodes.size === 0 || links.length === 0) return null;
    return { nodes: Array.from(nodes.values()), links };
}

// Helper functions
function createNode(name: string, color?: string): SankeyNode {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const category = categorizeNode(name);
    return { id, name, color, category };
}

function categorizeNode(name: string): SankeyNode['category'] {
    const lower = name.toLowerCase();

    // Revenue indicators
    if (lower.includes('revenue') || lower.includes('sales') || lower.includes('income') && !lower.includes('net')) {
        return 'revenue';
    }

    // Expense indicators
    if (lower.includes('cost') || lower.includes('expense') || lower.includes('cogs') ||
        lower.includes('tax') || lower.includes('depreciation') || lower.includes('amortization')) {
        return 'expense';
    }

    // Profit indicators
    if (lower.includes('profit') || lower.includes('net income') || lower.includes('earnings') ||
        lower.includes('ebit') || lower.includes('ebitda')) {
        return 'profit';
    }

    return 'neutral';
}

export function parseNumber(str: string): number {
    // Remove common formatting: $, commas, spaces
    const cleaned = str.replace(/[$,\s]/g, '').trim();

    // Handle suffixes: k, m, b, bn
    const suffixMatch = cleaned.match(/^([\d.]+)\s*(k|m|b|bn|million|billion)?$/i);
    if (suffixMatch) {
        let num = parseFloat(suffixMatch[1]);
        const suffix = (suffixMatch[2] || '').toLowerCase();

        switch (suffix) {
            case 'k': num *= 1_000; break;
            case 'm': case 'million': num *= 1_000_000; break;
            case 'b': case 'bn': case 'billion': num *= 1_000_000_000; break;
        }
        return num;
    }

    return parseFloat(cleaned);
}

export function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
