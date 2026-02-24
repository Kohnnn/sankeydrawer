import { parseDSL, serializeToDSL, parseCSV, parseNumber, parseCSVLine } from './dsl-parser';

describe('parseNumber', () => {
    it('should parse plain numbers', () => {
        expect(parseNumber('100')).toBe(100);
        expect(parseNumber('1234.56')).toBe(1234.56);
    });

    it('should handle comma-separated numbers', () => {
        expect(parseNumber('1,234')).toBe(1234);
        expect(parseNumber('1,234,567')).toBe(1234567);
    });

    it('should handle currency symbols', () => {
        expect(parseNumber('$100')).toBe(100);
        expect(parseNumber('$1,234.56')).toBe(1234.56);
    });

    it('should handle k/m/b suffixes', () => {
        expect(parseNumber('10k')).toBe(10000);
        expect(parseNumber('5m')).toBe(5000000);
        expect(parseNumber('2b')).toBe(2000000000);
        expect(parseNumber('1.5bn')).toBe(1500000000);
    });

    it('should handle million/billion words', () => {
        expect(parseNumber('5 million')).toBe(5000000);
        expect(parseNumber('2 billion')).toBe(2000000000);
    });
});

describe('parseCSVLine', () => {
    it('should parse simple CSV lines', () => {
        expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted values with commas', () => {
        expect(parseCSVLine('"hello, world",test,value')).toEqual(['hello, world', 'test', 'value']);
    });

    it('should trim whitespace', () => {
        expect(parseCSVLine('  a  ,  b  ,  c  ')).toEqual(['a', 'b', 'c']);
    });
});

describe('parseDSL', () => {
    it('should parse simple flow syntax', () => {
        const input = 'Revenue [100] Profit';
        const result = parseDSL(input);

        expect(result).not.toBeNull();
        expect(result!.nodes).toHaveLength(2);
        expect(result!.links).toHaveLength(1);
        expect(result!.links[0].value).toBe(100);
    });

    it('should skip empty lines and comments', () => {
        const input = `
      // This is a comment
      # Another comment
      Revenue [100] Profit
    `;
        const result = parseDSL(input);

        expect(result).not.toBeNull();
        expect(result!.links).toHaveLength(1);
    });

    it('should parse node color definitions', () => {
        const input = `
      Revenue :#4ade80
      Revenue [100] Profit
    `;
        const result = parseDSL(input);

        expect(result).not.toBeNull();
        const revenueNode = result!.nodes.find(n => n.name === 'Revenue');
        expect(revenueNode?.color).toBe('#4ade80');
    });

    it('should parse comparison values', () => {
        const input = 'Revenue [100, 80] Expenses';
        const result = parseDSL(input);

        expect(result).not.toBeNull();
        expect(result!.links[0].previousValue).toBe(80);
        expect(result!.links[0].comparisonValue).toBe('+25%');
    });

    it('should handle string comparison values', () => {
        const input = 'Revenue [100, +10%] Expenses';
        const result = parseDSL(input);

        expect(result).not.toBeNull();
        expect(result!.links[0].comparisonValue).toBe('+10%');
    });

    it('should ignore invalid comparison tokens like NaN', () => {
        const input = 'Revenue [100, NaN] Expenses';
        const result = parseDSL(input);

        expect(result).not.toBeNull();
        expect(result!.links[0].previousValue).toBeUndefined();
        expect(result!.links[0].comparisonValue).toBeUndefined();
    });

    it('should parse tab-separated rows from SankeyArt-style tables', () => {
        const input = [
            'Net income\tCash from operations\t29.998\tNaN',
            'Depreciation & amortization\tNon-cash charges\t2.916\tNaN',
        ].join('\n');

        const result = parseDSL(input);

        expect(result).not.toBeNull();
        expect(result!.links).toHaveLength(2);
        expect(result!.links[0].value).toBeCloseTo(29.998);
        expect(result!.links[0].comparisonValue).toBeUndefined();
    });

    it('should aggregate duplicate links', () => {
        const input = `
      Revenue [100] Profit
      Revenue [50] Profit
    `;
        const result = parseDSL(input);

        expect(result).not.toBeNull();
        expect(result!.links).toHaveLength(1);
        expect(result!.links[0].value).toBe(150);
    });

    it('should prevent cycles (self-loops)', () => {
        const input = 'Revenue [100] Revenue';
        const result = parseDSL(input);

        // Self-loop is filtered out, leaving nodes but empty links
        // parseDSL returns data with nodes and empty links (after cycle filtering)
        expect(result).not.toBeNull();
        expect(result!.nodes).toHaveLength(1);
        expect(result!.links).toHaveLength(0);
    });

    it('should return null for empty input', () => {
        expect(parseDSL('')).toBeNull();
        expect(parseDSL('// only comments')).toBeNull();
    });

    it('should categorize nodes correctly', () => {
        const input = `
      Revenue [100] Gross Profit
      Gross Profit [60] Net Income
      Gross Profit [40] Operating Expenses
    `;
        const result = parseDSL(input);

        expect(result).not.toBeNull();

        const revenue = result!.nodes.find(n => n.name === 'Revenue');
        const profit = result!.nodes.find(n => n.name === 'Net Income');
        const expense = result!.nodes.find(n => n.name === 'Operating Expenses');

        expect(revenue?.category).toBe('revenue');
        expect(profit?.category).toBe('profit');
        expect(expense?.category).toBe('expense');
    });
});

describe('serializeToDSL', () => {
    it('should serialize simple data', () => {
        const data = {
            nodes: [
                { id: 'revenue', name: 'Revenue', category: 'revenue' as const },
                { id: 'profit', name: 'Profit', category: 'profit' as const },
            ],
            links: [
                { source: 'revenue', target: 'profit', value: 100 },
            ],
        };

        const result = serializeToDSL(data);
        expect(result).toContain('Revenue [100] Profit');
    });

    it('should serialize node colors', () => {
        const data = {
            nodes: [
                { id: 'revenue', name: 'Revenue', color: '#4ade80', category: 'revenue' as const },
                { id: 'profit', name: 'Profit', category: 'profit' as const },
            ],
            links: [
                { source: 'revenue', target: 'profit', value: 100 },
            ],
        };

        const result = serializeToDSL(data);
        expect(result).toContain('Revenue :#4ade80');
    });

    it('should serialize previous values', () => {
        const data = {
            nodes: [
                { id: 'a', name: 'A', category: 'neutral' as const },
                { id: 'b', name: 'B', category: 'neutral' as const },
            ],
            links: [
                { source: 'a', target: 'b', value: 100, previousValue: 80 },
            ],
        };

        const result = serializeToDSL(data);
        expect(result).toContain('A [100, 80] B');
    });
});

describe('parseCSV', () => {
    it('should parse CSV with header', () => {
        const input = `From,To,Value
Revenue,Profit,100
Revenue,Expenses,50`;

        const result = parseCSV(input);
        expect(result).not.toBeNull();
        expect(result!.nodes).toHaveLength(3);
        expect(result!.links).toHaveLength(2);
    });

    it('should parse CSV without header', () => {
        const input = `Revenue,Profit,100
Revenue,Expenses,50`;

        const result = parseCSV(input);
        expect(result).not.toBeNull();
        expect(result!.links).toHaveLength(2);
    });

    it('should handle comparison column', () => {
        const input = `From,To,Value,Comparison
Revenue,Profit,100,80`;

        const result = parseCSV(input);
        expect(result).not.toBeNull();
        expect(result!.links[0].previousValue).toBe(80);
        expect(result!.links[0].comparisonValue).toBe('+25%');
    });

    it('should ignore NaN in comparison column', () => {
        const input = `From,To,Value,Comparison
Revenue,Profit,100,NaN`;

        const result = parseCSV(input);
        expect(result).not.toBeNull();
        expect(result!.links[0].previousValue).toBeUndefined();
        expect(result!.links[0].comparisonValue).toBeUndefined();
    });

    it('should return null for insufficient data', () => {
        expect(parseCSV('')).toBeNull();
        expect(parseCSV('Revenue,Profit')).toBeNull(); // Only 2 columns
    });

    it('should skip invalid rows', () => {
        const input = `From,To,Value
Revenue,Profit,100
Invalid,,abc`;

        const result = parseCSV(input);
        expect(result).not.toBeNull();
        expect(result!.links).toHaveLength(1);
    });
});
