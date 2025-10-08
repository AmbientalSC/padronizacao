
import React, { useState } from 'react';
import { Template, Atendimento } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { useAuth } from './hooks/useAuth';
import { useFirebaseTemplates } from './hooks/useFirebaseTemplates';
import Generator from './components/Generator';
import Manager from './components/Manager';
import Atendimentos from './components/Atendimentos';
import LoginModal from './components/LoginModal';
import { initialTemplates } from './data/initialData';

type Tab = 'generator' | 'manager' | 'atendimentos';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [atendimentos, setAtendimentos] = useLocalStorage<Atendimento[]>('atendimentos-historico', []);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  
  const { user, isAuthenticated, logout } = useAuth();
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate } = useFirebaseTemplates(isAuthenticated);

  const handleManagerTabClick = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
    } else {
      setActiveTab('manager');
    }
  };

  const handleLoginSuccess = () => {
    setActiveTab('manager');
  };

  const handleLogout = async () => {
    await logout();
    if (activeTab === 'manager') {
      setActiveTab('generator');
    }
  };

  const TabButton = ({ tab, children, onClick }: { tab: Tab; children: React.ReactNode; onClick?: () => void }) => (
    <button
      onClick={onClick || (() => setActiveTab(tab))}
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
                <img src="https://ambiental.sc/wp-content/themes/ambiental-03/favicon.ico" alt="Logo" className="h-10 w-10 rounded-full mr-3"/>
                <h1 className="text-2xl font-bold text-gray-800">Relação com o usuário</h1>
            </div>
            <div className="flex items-center space-x-4">
                <nav className="flex space-x-2 bg-gray-100 p-1 rounded-lg items-center">
                    <TabButton tab="generator">Gerador</TabButton>
                    <TabButton tab="atendimentos">Atendimentos</TabButton>
                    <TabButton tab="manager" onClick={handleManagerTabClick}>
                        Gerenciar Modelos
                        {isAuthenticated && <span className="ml-1 text-xs">🔓</span>}
                    </TabButton>
                </nav>
                {/* Botão FAQ colocado à direita do header, próximo ao botão Sair */}
                <div>
                  <button
                    onClick={() => { setActiveTab('generator'); setShowFAQModal(true); }}
                    title="FAQ"
                    className="ml-2 px-2 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-200"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                  </button>
                </div>
                {isAuthenticated && (
                    <button
                        onClick={handleLogout}
                        className="text-sm text-gray-600 hover:text-gray-800"
                    >
                        Sair
                    </button>
                )}
            </div>
        </div>
      </header>
      <main>
        {activeTab === 'generator' && (
          <Generator
            templates={templates}
            atendimentos={atendimentos}
            setAtendimentos={setAtendimentos}
            showFAQModal={showFAQModal}
            setShowFAQModal={setShowFAQModal}
          />
        )}
        {activeTab === 'atendimentos' && <Atendimentos atendimentos={atendimentos} setAtendimentos={setAtendimentos} templates={templates} />}
        {activeTab === 'manager' && <Manager templates={templates} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate} />}
      </main>
      
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
        onSuccess={handleLoginSuccess}
      />
      <footer className="text-center py-4 text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Ambiental Limpeza Urbana e Saneamento LTDA. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default App;
