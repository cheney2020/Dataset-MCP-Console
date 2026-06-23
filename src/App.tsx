/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useAppContext } from './AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DatasetManager from './components/DatasetManager';
import MCPConsole from './components/MCPConsole';

function AppContent() {
  const { page } = useAppContext();

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans items-start">
      <div className="sticky top-0 h-screen shrink-0 border-r border-slate-800 z-50">
        <Sidebar />
      </div>
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header />
        {page === 'manage' && <DatasetManager />}
        {page === 'console' && <MCPConsole />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

