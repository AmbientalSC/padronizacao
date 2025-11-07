
import React, { useState, useEffect } from 'react';
import { Template, Atendimento } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { useAuth } from './hooks/useAuth';
import { useFirebaseTemplates } from './hooks/useFirebaseTemplates';
import { db } from './firebase/config';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import Generator from './components/Generator';
import Manager from './components/Manager';
import Atendimentos from './components/Atendimentos';
import LoginModal from './components/LoginModal';
import UserManagementModal from './components/UserManagementModal';
import ConfirmModal from './components/ConfirmModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import { initialTemplates } from './data/initialData';

type Tab = 'generator' | 'manager' | 'atendimentos';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [atendimentos, setAtendimentos] = useLocalStorage<Atendimento[]>('atendimentos-historico', []);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const { user, isAuthenticated, logout, profile, isManager } = useAuth() as any;
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate } = useFirebaseTemplates(isAuthenticated);

  // Check if user needs to change password
  useEffect(() => {
    if (isAuthenticated && profile?.requirePasswordChange) {
      setShowChangePassword(true);
    }
  }, [isAuthenticated, profile]);

  // Load atendimentos from Firestore for the logged in user
  useEffect(() => {
    const loadUserAtendimentos = async () => {
      if (!user || !user.uid) return;
      try {
        const colRef = collection(db, 'users', user.uid, 'atendimentos');
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => {
          const data: any = d.data();
          const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString());
          return {
            id: d.id,
            templateId: data.templateId,
            templateTitle: data.templateTitle,
            formData: data.formData || {},
            generatedText: data.generatedText || '',
            createdAt
          } as any;
        });
        if (docs.length > 0) {
          setAtendimentos(docs);
        }
      } catch (e) {
        console.warn('Erro ao carregar atendimentos do Firestore:', e);
      }
    };

    loadUserAtendimentos();
  }, [user]);

  const handleManagerTabClick = () => {
    // Allow opening the manager for all users but editing actions will be
    // disabled for non-managers. If not authenticated the UI will be read-only.
    setActiveTab('manager');
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
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${activeTab === tab
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center">
          <div className="flex items-center flex-none">
            <img src="https://ambiental.sc/wp-content/themes/ambiental-03/favicon.ico" alt="Logo" className="h-10 w-10 rounded-full mr-3" />
            <h1 className="text-2xl font-bold text-gray-800">Relação com o usuário</h1>
          </div>

          {/* Centro do header: displayName do usuário autenticado */}
          <div className="flex-1 text-center">
            {isAuthenticated ? (
              <div className="text-sm text-gray-700">{profile?.displayName || user?.displayName || user?.email}</div>
            ) : null}
          </div>

          <div className="flex items-center space-x-4 flex-none">
            <nav className="flex space-x-2 bg-gray-100 p-1 rounded-lg items-center">
              <TabButton tab="generator">Gerador</TabButton>
              <TabButton tab="atendimentos">Atendimentos</TabButton>
              <TabButton tab="manager" onClick={handleManagerTabClick}>
                Gerenciar Modelos
                {isAuthenticated && <span className="ml-1 text-xs">🔓</span>}
              </TabButton>
            </nav>
            {/* FAQ button removed — use ícone de informação no gerador quando necessário */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {isManager && (
                  <button title="Gerenciar usuários" onClick={() => setShowUserMgmt(true)} className="text-gray-600 hover:text-gray-800" aria-label="Gerenciar usuários">
                    {/* Usar SVG estático em /public para inclusão no build */}
                    <img src={`${(import.meta as any).env.BASE_URL}engrenagem.svg`} alt="Gerenciar usuários" className="h-6 w-6" />
                  </button>
                )}
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-gray-600 hover:bg-red-100 hover:text-red-700"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-gray-600 hover:bg-green-100"
                >
                  Login
                </button>
              </div>
            )}
            <UserManagementModal isOpen={!!(isManager && showUserMgmt)} onClose={() => setShowUserMgmt(false)} />
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
        {activeTab === 'manager' && <Manager templates={templates} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate} isManager={isManager} />}
      </main>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirmar logout"
        message="Tem certeza que deseja sair da aplicação?"
        confirmText="Sair"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={async () => { setShowLogoutConfirm(false); await handleLogout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      {user && (
        <ChangePasswordModal
          isOpen={showChangePassword}
          userEmail={user.email || ''}
          userId={user.uid}
          isRequired={profile?.requirePasswordChange === true}
          onPasswordChanged={() => {
            setShowChangePassword(false);
            // Reload profile to get updated requirePasswordChange status
            window.location.reload();
          }}
        />
      )}
      <footer className="text-center py-4 text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Ambiental Limpeza Urbana e Saneamento LTDA. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default App;
