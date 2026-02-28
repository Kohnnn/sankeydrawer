import { SankeyData } from '@/types/sankey';

export interface DataTemplate {
    id: string;
    name: string;
    description: string;
    data: SankeyData;
}

export const DATA_TEMPLATES: DataTemplate[] = [
    {
        id: 'cash_flow_template',
        name: 'Cash Flow Template',
        description: 'Operating, investing, and financing flows into ending cash',
        data: {
            nodes: [
                { id: 'cash_from_customers', name: 'Cash From Customers', category: 'revenue', color: '#00a34c', flowColor: '#00a34c' },
                { id: 'operating_cash_flow', name: 'Operating Cash Flow', category: 'profit', color: '#00a34c', flowColor: '#00a34c' },
                { id: 'supplier_payments', name: 'Supplier Payments', category: 'expense', color: '#d1003f', flowColor: '#d1003f' },
                { id: 'payroll', name: 'Payroll', category: 'expense', color: '#d8436a', flowColor: '#d8436a' },
                { id: 'taxes_paid', name: 'Taxes Paid', category: 'expense', color: '#ef476f', flowColor: '#ef476f' },
                { id: 'proceeds_from_asset_sales', name: 'Proceeds From Asset Sales', category: 'revenue', color: '#009fc8', flowColor: '#009fc8' },
                { id: 'investing_cash_flow', name: 'Investing Cash Flow', category: 'neutral', color: '#009fc8', flowColor: '#009fc8' },
                { id: 'capex', name: 'CapEx', category: 'expense', color: '#007ea0', flowColor: '#007ea0' },
                { id: 'acquisitions', name: 'Acquisitions', category: 'expense', color: '#2aa7c9', flowColor: '#2aa7c9' },
                { id: 'new_debt', name: 'New Debt', category: 'revenue', color: '#d1003f', flowColor: '#d1003f' },
                { id: 'equity_issued', name: 'Equity Issued', category: 'revenue', color: '#ff5b8f', flowColor: '#ff5b8f' },
                { id: 'financing_cash_flow', name: 'Financing Cash Flow', category: 'neutral', color: '#d1003f', flowColor: '#d1003f' },
                { id: 'debt_repayment', name: 'Debt Repayment', category: 'expense', color: '#b1003b', flowColor: '#b1003b' },
                { id: 'dividends_paid', name: 'Dividends Paid', category: 'expense', color: '#f43f5e', flowColor: '#f43f5e' },
                { id: 'net_cash_change', name: 'Net Cash Change', category: 'neutral', color: '#64748b', flowColor: '#64748b' },
                { id: 'beginning_cash', name: 'Beginning Cash', category: 'neutral', color: '#475569', flowColor: '#475569' },
                { id: 'ending_cash', name: 'Ending Cash', category: 'profit', color: '#1f2937', flowColor: '#1f2937' },
            ],
            links: [
                { source: 'cash_from_customers', target: 'operating_cash_flow', value: 6200 },
                { source: 'operating_cash_flow', target: 'supplier_payments', value: 2500 },
                { source: 'operating_cash_flow', target: 'payroll', value: 1800 },
                { source: 'operating_cash_flow', target: 'taxes_paid', value: 700 },
                { source: 'operating_cash_flow', target: 'net_cash_change', value: 1200 },
                { source: 'proceeds_from_asset_sales', target: 'investing_cash_flow', value: 900 },
                { source: 'investing_cash_flow', target: 'capex', value: 700 },
                { source: 'investing_cash_flow', target: 'acquisitions', value: 150 },
                { source: 'investing_cash_flow', target: 'net_cash_change', value: 50 },
                { source: 'new_debt', target: 'financing_cash_flow', value: 700 },
                { source: 'equity_issued', target: 'financing_cash_flow', value: 500 },
                { source: 'financing_cash_flow', target: 'debt_repayment', value: 450 },
                { source: 'financing_cash_flow', target: 'dividends_paid', value: 300 },
                { source: 'financing_cash_flow', target: 'net_cash_change', value: 450 },
                { source: 'net_cash_change', target: 'ending_cash', value: 1700 },
                { source: 'beginning_cash', target: 'ending_cash', value: 2300 },
            ],
        },
    },
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
