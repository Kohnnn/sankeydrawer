# Financial Sankey Builder

A powerful, interactive Sankey diagram builder tailored for financial visualization (Income Statements, Cash Flow, etc.). Built with Next.js, D3.js, and Tailwind CSS.

## Features

- **Interactive Editor**: Drag nodes, adjust flows, and customize layout in real-time.
- **Financial Focus**: Specialized logic for handling revenue, expenses, and net income flows.
- **Advanced Customization**:
  - **Node Styling**: Custom colors, labels, and sizes.
  - **Flow Styling**: Adjustable curvature, opacity, and specific flow colors (gradient or solid).
  - **Custom Elements**: Add free-floating text labels and grouping boxes to annotate your diagram.
- **AI-Assisted Processing**: Integrated AI assistant to parse financial data and suggest diagram structures.
- **Export Options**: Save your work as high-resolution images or export the JSON configuration.

## Getting Started

First, run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1.  **Data Input**: Use the "Data" tab to input your nodes and links, or use the AI Assistant to paste a financial summary.
2.  **Customization**: Click on nodes to edit their properties (color, name). Use the "Style" tab to adjust global settings like flow curvature.
3.  **Annotation**: Use the "Custom Elements" tab to add boxes or text notes to your diagram.
4.  **Save/Export**: Use the Export button to download your diagram image.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [D3.js](https://d3js.org) (Sankey calculations)
- [Tailwind CSS](https://tailwindcss.com) (Styling)
- [Lucide React](https://lucide.dev) (Icons)

