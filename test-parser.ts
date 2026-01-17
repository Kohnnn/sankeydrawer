
// Mock types
interface SankeyNode { id: string; name: string; color?: string; category?: any; }
interface SankeyLink { source: string | number; target: string | number; value: number; previousValue?: number; comparisonValue?: string; }
interface SankeyData { nodes: SankeyNode[]; links: SankeyLink[]; }

function parseNumber(str: string): number {
    const cleaned = str.replace(/[$,\s]/g, '').trim();
    return parseFloat(cleaned);
}

function createNode(name: string, color?: string): SankeyNode {
    return { id: name.toLowerCase().replace(/\s+/g, '_'), name, color };
}

function parseDSL(text: string): SankeyData | null {
    const nodes = new Map<string, SankeyNode>();
    const links: SankeyLink[] = [];
    const nodeColors = new Map<string, string>();

    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

        const flowMatch = trimmed.match(/^(.+?)\s*\[([^\]]+)\]\s*(.+)$/);
        if (flowMatch) {
            const sourceName = flowMatch[1].trim();
            const targetName = flowMatch[3].trim();
            const content = flowMatch[2].trim();

            let value = 0;
            let comparisonValue: string | undefined;
            let previousValue: number | undefined;

            if (content.includes(',')) {
                const firstComma = content.indexOf(',');
                const valStr = content.substring(0, firstComma).trim();
                const compStr = content.substring(firstComma + 1).trim();

                value = parseNumber(valStr);

                const isStringLabel = compStr.startsWith('+') || compStr.endsWith('%') || compStr.startsWith('-');

                if (!isStringLabel) {
                    const prevVal = parseNumber(compStr);
                    if (!isNaN(prevVal) && prevVal !== 0) {
                        previousValue = prevVal;
                        const diff = value - prevVal;
                        const percent = ((diff / prevVal) * 100).toFixed(0);
                        const sign = diff >= 0 ? '+' : '';
                        comparisonValue = `${sign}${percent}%`;
                    } else {
                        comparisonValue = compStr;
                    }
                } else {
                    comparisonValue = compStr;
                }
            } else {
                value = parseNumber(content);
            }

            if (isNaN(value)) continue;

            if (!nodes.has(sourceName)) nodes.set(sourceName, createNode(sourceName));
            if (!nodes.has(targetName)) nodes.set(targetName, createNode(targetName));

            links.push({
                source: sourceName,
                target: targetName,
                value,
                previousValue,
                comparisonValue,
            });
        }
    }

    if (nodes.size === 0 || links.length === 0) return null;

    return {
        nodes: Array.from(nodes.values()),
        links,
    };
}

const template1 = `Revenue [500] Cost of Goods
Revenue [500] Gross Profit
Gross Profit [150] Marketing`;

console.log("Testing Template 1:");
const result1 = parseDSL(template1);
console.log(result1 ? `Success: ${result1.links.length} links` : "Failed: null");
if (result1) {
    console.log(JSON.stringify(result1.links.slice(0, 1), null, 2));
}
