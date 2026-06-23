import React from 'react';
import { useAppContext } from '../AppContext';
import { Database, TerminalSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Page } from '../types';

export default function Sidebar() {
  const { page, setPage, isSidebarCollapsed, setIsSidebarCollapsed } = useAppContext();

  const menuItems: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: 'manage', label: '数据集管理', icon: <Database className="w-5 h-5" /> },
    { id: 'console', label: 'MCP 调试台', icon: <TerminalSquare className="w-5 h-5" /> },
  ];

  return (
    <div className={`bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
      <div className={`p-4 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} h-[72px]`}>
        {!isSidebarCollapsed && (
          <h1 className="text-xl font-bold text-white flex items-center gap-2 overflow-hidden truncate">
            <Database className="w-6 h-6 text-yellow-400 shrink-0" />
            MCP Console
          </h1>
        )}
        {isSidebarCollapsed && (
          <Database className="w-6 h-6 text-yellow-400 shrink-0" />
        )}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors ${isSidebarCollapsed ? 'hidden' : ''}`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {isSidebarCollapsed && (
        <div className="flex justify-center p-2 border-b border-slate-800 hidden">
           <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

       {isSidebarCollapsed && (
         <div className="flex justify-center py-2">
            <button 
              onClick={() => setIsSidebarCollapsed(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
         </div>
       )}

      <nav className="flex-1 py-4 flex flex-col gap-2 px-2.5 overflow-hidden">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            title={isSidebarCollapsed ? item.label : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium whitespace-nowrap ${
              page === item.id
                ? 'bg-yellow-400 text-black'
                : 'hover:bg-slate-800 hover:text-white'
            } ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <div className="shrink-0">{item.icon}</div>
            {!isSidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className={`p-4 border-t border-slate-800 text-xs text-slate-500 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 h-0 p-0 border-0' : 'opacity-100 h-auto'}`}>
        Dataset MCP Engine v1.0.0
      </div>
    </div>
  );
}
