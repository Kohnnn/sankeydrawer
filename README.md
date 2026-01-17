# Financial Sankey Drawer

A professional-grade Sankey Diagram builder optimized for financial visualization (Income Statements, Cash Flow, etc.). Built with Next.js, D3.js, and TailwindCSS.

## 🚀 Features

*   **Excel-like Data Editor**: Copy/paste compatibility with spreadsheets.
*   **Professional Styling**: Rounded nodes, gradient links, and focus mode.
*   **Smart Templates**: Pre-built financial models (SaaS P&L, Startup Burn, etc.).
*   **Export**: High-resolution PNG and SVG export.
*   **Undo/Redo**: Full history support.
*   **Custom Labels**: Drag-and-drop labels with rich text editing and backgrounds.

## 🛠️ Local Development

You can easily run the application locally using the provided batch file or via command line.

### Option 1: Batch File (Windows)
Double-click `run_local.bat` in the root directory.

### Option 2: Command Line
```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## 🌐 Deployment (Netlify)

This project is configured for easy deployment on Netlify.

1.  Connect your Git repository to Netlify.
2.  Netlify should detect the `netlify.toml` file automatically.
3.  If manual configuration is needed:
    *   **Base directory**: `app`
    *   **Build command**: `npm run build`
    *   **Publish directory**: `.next`

## 📝 License

[MIT](LICENSE)
