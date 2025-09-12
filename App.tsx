
import React, { useState } from 'react';
import { Template } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import Generator from './components/Generator';
import Manager from './components/Manager';
import { initialTemplates } from './data/initialData';

type Tab = 'generator' | 'manager';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [templates, setTemplates] = useLocalStorage<Template[]>('atendimento-templates', initialTemplates);

  const TabButton = ({ tab, children }: { tab: Tab; children: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
        activeTab === tab
          ? 'bg-green-600 text-white shadow'
          : 'text-gray-600 hover:bg-green-100'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
                <img src="https://picsum.photos/40/40" alt="Logo" className="h-10 w-10 rounded-full mr-3"/>
                <h1 className="text-2xl font-bold text-gray-800">Gerador de Descrições de Atendimento</h1>
            </div>
            <nav className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                <TabButton tab="generator">Gerador</TabButton>
                <TabButton tab="manager">Gerenciar Modelos</TabButton>
            </nav>
        </div>
      </header>
      <main>
        {activeTab === 'generator' && <Generator templates={templates} />}
        {activeTab === 'manager' && <Manager templates={templates} setTemplates={setTemplates} />}
      </main>
      <footer className="text-center py-4 text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Ferramenta Interna de Produtividade. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default App;
