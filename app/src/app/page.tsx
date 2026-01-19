'use client';

import dynamic from 'next/dynamic';
import { GitBranch } from 'lucide-react';
import Toolbar from '@/components/Canvas/Toolbar';

import Sidebar from '@/components/Sidebar/Sidebar';
import BalanceIndicator from '@/components/Canvas/BalanceIndicator';

// Dynamic import to avoid SSR issues with D3
const SankeyCanvas = dynamic(() => import('@/components/Canvas/SankeyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[var(--card-bg)] rounded-lg shadow-sm border border-[var(--border)] flex items-center justify-center">
      <div className="text-[var(--secondary-text)] animate-pulse">Loading diagram...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      {/* Header - Integrated */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between z-20 sticky top-0 shrink-0">
        <div className="flex items-center gap-2 animate-fade-in">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-white rotate-90" />
          </div>
          <h1 className="text-sm font-bold text-slate-800 tracking-tight">SankeyCapCap <span className="text-blue-600">Studio</span></h1>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-bold uppercase tracking-wider">V2.0</span>
        </div>
      </header>


      {/* Main Content - Split Pane */}
      <main className="flex flex-1 overflow-hidden relative">
        {/* Canvas Area (70%) */}
        <div className="flex-1 p-0 flex flex-col min-w-0 relative bg-[var(--background)]">
          <Toolbar />
          <SankeyCanvas />
          <BalanceIndicator />
        </div>

        {/* Sidebar (30%) */}
        <Sidebar />
      </main>
    </div>
  );
}

