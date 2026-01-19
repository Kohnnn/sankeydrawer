import { SankeyData } from '@/types/sankey';

export interface DataTemplate {
    id: string;
    name: string;
    description: string;
    data: SankeyData;
}

export const DATA_TEMPLATES: DataTemplate[] = [
    {
        id: 'income_statement',
        name: 'Standard Income Statement',
        description: 'Revenue flow through COGS and OpEx to Net Income',
        data: {
            nodes: [
                { id: 'revenue', name: 'Revenue', category: 'revenue' },
                { id: 'cogs', name: 'Cost of Goods Sold', category: 'expense' },
                { id: 'gross_profit', name: 'Gross Profit', category: 'profit' },
                { id: 'operating_expenses', name: 'Operating Expenses', category: 'expense' },
                { id: 'operating_income', name: 'Operating Income', category: 'profit' },
                { id: 'taxes', name: 'Taxes', category: 'expense' },
                { id: 'net_income', name: 'Net Income', category: 'profit' },
            ],
            links: [
                { source: 'revenue', target: 'cogs', value: 40 },
                { source: 'revenue', target: 'gross_profit', value: 60 },
                { source: 'gross_profit', target: 'operating_expenses', value: 35 },
                { source: 'gross_profit', target: 'operating_income', value: 25 },
                { source: 'operating_income', target: 'taxes', value: 5 },
                { source: 'operating_income', target: 'net_income', value: 20 },
            ]
        }
    },
    {
        id: 'saas_pl',
        name: 'SaaS P&L Breakdown',
        description: 'Recurring revenue with R&D, S&M, and G&A focus',
        data: {
            nodes: [
                { id: 'arr', name: 'Total ARR', category: 'revenue' },
                { id: 'cogs', name: 'COGS (Cloud/Support)', category: 'expense' },
                { id: 'gross_profit', name: 'Gross Profit', category: 'profit' },
                { id: 'rnd', name: 'R&D', category: 'expense' },
                { id: 'snm', name: 'S&M', category: 'expense' },
                { id: 'gna', name: 'G&A', category: 'expense' },
                { id: 'ebitda', name: 'EBITDA', category: 'profit' },
            ],
            links: [
                { source: 'arr', target: 'cogs', value: 20 },
                { source: 'arr', target: 'gross_profit', value: 80 },
                { source: 'gross_profit', target: 'rnd', value: 30 },
                { source: 'gross_profit', target: 'snm', value: 35 },
                { source: 'gross_profit', target: 'gna', value: 10 },
                { source: 'gross_profit', target: 'ebitda', value: 5 },
            ]
        }
    },
    {
        id: 'vietnamese_business',
        name: 'Cơ cấu Doanh thu (Vietnam)',
        description: 'Mẫu cơ cấu doanh thu và lợi nhuận cho doanh nghiệp VN',
        data: {
            nodes: [
                { id: 'doanh_thu', name: 'Tổng Doanh Thu', category: 'revenue' },
                { id: 'gia_von', name: 'Giá vốn hàng bán', category: 'expense' },
                { id: 'lai_gop', name: 'Lợi nhuận gộp', category: 'profit' },
                { id: 'chi_phi_ql', name: 'Chi phí quản lý', category: 'expense' },
                { id: 'chi_phi_bh', name: 'Chi phí bán hàng', category: 'expense' },
                { id: 'lai_rong', name: 'Lợi nhuận ròng', category: 'profit' },
            ],
            links: [
                { source: 'doanh_thu', target: 'gia_von', value: 70 },
                { source: 'doanh_thu', target: 'lai_gop', value: 30 },
                { source: 'lai_gop', target: 'chi_phi_ql', value: 10 },
                { source: 'lai_gop', target: 'chi_phi_bh', value: 12 },
                { source: 'lai_gop', target: 'lai_rong', value: 8 },
            ]
        }
    }
];
