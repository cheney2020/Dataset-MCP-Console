import React from 'react';
import { useAppContext } from '../AppContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function Header() {
  const { toast } = useAppContext();

  // Determine toast type based on text content
  const getToastConfig = () => {
    if (!toast) return null;
    const lower = toast.toLowerCase();
    
    const isError = 
      toast.includes('失败') || 
      toast.includes('请填写') || 
      toast.includes('请选择') || 
      toast.includes('错误') || 
      toast.includes('未填') || 
      toast.includes('不能为空') || 
      toast.includes('不存在') || 
      toast.includes('无法');

    const isWarningOrInfo = 
      toast.includes('下线') || 
      toast.includes('删除') || 
      toast.includes('提示') || 
      toast.includes('正在') || 
      toast.includes('未设置');

    if (isError) {
      return {
        borderColor: 'border-red-100',
        barColor: 'bg-red-500',
        icon: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
      };
    } else if (isWarningOrInfo) {
      return {
        borderColor: 'border-amber-100',
        barColor: 'bg-amber-500',
        icon: <Info className="w-5 h-5 text-amber-500 shrink-0" />,
      };
    } else {
      return {
        borderColor: 'border-emerald-100',
        barColor: 'bg-emerald-500',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
      };
    }
  };

  const toastConfig = getToastConfig();

  return (
    <div className="px-8 py-6 border-b border-slate-200 bg-white sticky top-0 z-10 shrink-0">
      <h2 className="text-2xl font-semibold text-slate-900 mb-1">Dataset MCP Console</h2>
      <p className="text-sm text-slate-500 mb-4">
        面向 Agent、App、BI 和 OAP 的受治理数据集服务平台
      </p>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-slate-800 leading-relaxed max-w-5xl">
        <p className="font-medium mb-1">
          Dataset MCP Console 通过 AI 自动补全元数据，由人工确认后发布，将已治理数据集转化为安全、可控、可被 Agent 调用的 MCP Tools。
        </p>
        <p className="opacity-90">
          MVP 版本聚焦单数据集明细查询和轻量聚合，不开放自由 SQL，不支持多表 Join。
        </p>
      </div>

      {toast && toastConfig && (
        <div className="fixed top-6 right-6 bg-white border border-slate-200 shadow-xl rounded-xl p-4 flex items-center gap-3 z-[100] animate-in fade-in slide-in-from-top-4 duration-200 max-w-sm">
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${toastConfig.barColor}`}></div>
          {toastConfig.icon}
          <span className="text-slate-800 font-semibold text-sm leading-tight pl-1.5 pr-2">{toast}</span>
        </div>
      )}
    </div>
  );
}

