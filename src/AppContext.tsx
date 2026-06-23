import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { initialDatasets, mockFields, initialTopics, initialDataSources } from './data';
import { Dataset, Field, Page, Topic, DataSource } from './types';

interface AppState {
  page: Page;
  setPage: (page: Page) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  topics: Topic[];
  setTopics: (topics: Topic[]) => void;
  datasets: Dataset[];
  setDatasets: (ds: Dataset[]) => void;
  selectedDataset: Dataset | null;
  setSelectedDataset: (ds: Dataset | null) => void;
  fields: Field[];
  setFields: (f: Field[]) => void;
  dataSources: DataSource[];
  setDataSources: (ds: DataSource[]) => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('manage');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Persist topics
  const [topics, setTopics] = useState<Topic[]>(() => {
    const saved = localStorage.getItem('__mcp_topics');
    return saved ? JSON.parse(saved) : initialTopics;
  });
  
  // Persist datasets
  const [datasets, setDatasets] = useState<Dataset[]>(() => {
    const saved = localStorage.getItem('__mcp_datasets');
    return saved ? JSON.parse(saved) : initialDatasets;
  });

  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(null);
  
  // Persist fields
  const [fields, setFields] = useState<Field[]>([]);

  // 1. Switch dataset: load its specific fields
  useEffect(() => {
    if (selectedDataset) {
      if (selectedDataset.id !== prevSelectedId) {
        setPrevSelectedId(selectedDataset.id);
        const storedDatasets = localStorage.getItem('__mcp_datasets');
        let currentDs = selectedDataset;
        if (storedDatasets) {
          try {
            const parsed = JSON.parse(storedDatasets) as Dataset[];
            const found = parsed.find(d => d.id === selectedDataset.id);
            if (found) currentDs = found;
          } catch(e) {}
        }
        setFields(currentDs.fields || mockFields);
      }
    } else {
      setPrevSelectedId(null);
      setFields([]);
    }
  }, [selectedDataset, prevSelectedId]);

  // 2. Edit fields: sync back to selectedDataset and datasets collection
  useEffect(() => {
    if (selectedDataset && fields.length > 0) {
      const isDifferent = JSON.stringify(selectedDataset.fields) !== JSON.stringify(fields);
      if (isDifferent) {
        const updatedDs = { ...selectedDataset, fields, fieldCount: fields.length };
        setSelectedDataset(updatedDs);
        setDatasets(prev => {
          const next = prev.map(d => d.id === updatedDs.id ? updatedDs : d);
          localStorage.setItem('__mcp_datasets', JSON.stringify(next));
          return next;
        });
      }
    }
  }, [fields]);

  const [dataSources, setDataSources] = useState<DataSource[]>(() => {
    const saved = localStorage.getItem('__mcp_datasources');
    return saved ? JSON.parse(saved) : initialDataSources;
  });
  
  const [toast, setToast] = useState<string | null>(null);

  // Sync back to localStorage
  useEffect(() => {
    localStorage.setItem('__mcp_topics', JSON.stringify(topics));
  }, [topics]);

  useEffect(() => {
    localStorage.setItem('__mcp_datasets', JSON.stringify(datasets));
  }, [datasets]);

  useEffect(() => {
    localStorage.setItem('__mcp_fields', JSON.stringify(fields));
  }, [fields]);

  useEffect(() => {
    localStorage.setItem('__mcp_datasources', JSON.stringify(dataSources));
  }, [dataSources]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  return (
    <AppContext.Provider
      value={{
        page,
        setPage,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        topics,
        setTopics,
        datasets,
        setDatasets,
        selectedDataset,
        setSelectedDataset,
        fields,
        setFields,
        dataSources,
        setDataSources,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
