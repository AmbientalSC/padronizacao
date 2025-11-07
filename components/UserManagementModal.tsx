import React, { useEffect, useState } from 'react';
import { db, functions } from '../firebase/config';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface UserRecord {
  id: string;
  email?: string;
  displayName?: string;
  role?: 'gestor' | 'usuario' | string;
  active?: boolean;
}

const UserManagementModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'gestor' | 'usuario'>('usuario');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Temporary password modal state
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPasswordData, setTempPasswordData] = useState<{ email: string; password: string; displayName: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{ user: UserRecord | null; action: 'reset' | null }>({ user: null, action: null });

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const col = collection(db, 'users');
    const unsub = onSnapshot(col, snap => {
      const arr: UserRecord[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setUsers(arr);
      setLoading(false);
    }, err => {
      console.warn('Erro ao escutar users:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen]);

  const createUser = async () => {
    setMessage(null);
    if (!newEmail) {
      setMessage('Email é obrigatório');
      return;
    }
    if (!newDisplayName) {
      setMessage('Nome (displayName) é obrigatório');
      return;
    }
    if (newPassword && newPassword !== newPasswordConfirm) {
      setMessage('As senhas não coincidem');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setMessage('A senha deve ter ao menos 6 caracteres');
      return;
    }
    try {
      // Try to call a callable cloud function 'createUserWithProfile' if available
      if (functions) {
        try {
          const fn = httpsCallable(functions, 'createUserWithProfile');
          // pass password if provided
          const res = await fn({ email: newEmail, displayName: newDisplayName, role: newRole, password: newPassword || undefined });
          setMessage('Usuário criado (Auth + Firestore) via função.');
          setNewEmail(''); setNewDisplayName(''); setNewRole('usuario');
          setNewPassword(''); setNewPasswordConfirm('');
          return;
        } catch (err) {
          console.warn('Chamada à função createUserWithProfile falhou, fallback para Firestore:', err);
        }
      }

      // Fallback: create Firestore doc only (note: this DOES NOT create auth user)
      await addDoc(collection(db, 'users'), {
        email: newEmail,
        displayName: newDisplayName,
        role: newRole,
        active: true,
        createdAt: new Date().toISOString()
      });
      setMessage('Usuário criado no Firestore. (Auth não criado: função backend ausente)');
      setNewEmail(''); setNewDisplayName(''); setNewRole('usuario');
      setNewPassword(''); setNewPasswordConfirm('');
    } catch (e: any) {
      console.error('Erro criando usuário:', e);
      setMessage('Erro ao criar usuário: ' + (e.message || String(e)));
    }
  };

  // Password editing state
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');

  // Generate temporary password
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const resetPasswordWithTemp = async (u: UserRecord) => {
    // Show confirmation modal instead of browser confirm
    setConfirmData({ user: u, action: 'reset' });
    setShowConfirmModal(true);
  };

  const confirmResetPassword = async () => {
    const u = confirmData.user;
    if (!u) return;

    setShowConfirmModal(false);
    setConfirmData({ user: null, action: null });

    const tempPassword = generateTempPassword();

    try {
      if (functions) {
        try {
          const fn = httpsCallable(functions, 'updateUserPassword');
          await fn({ uid: u.id, password: tempPassword });

          // Update Firestore to mark password as temporary
          const ref = doc(db, 'users', u.id);
          await updateDoc(ref, {
            requirePasswordChange: true,
            lastPasswordReset: new Date().toISOString()
          });

          // Show temp password in modal
          setTempPasswordData({
            email: u.email || '',
            password: tempPassword,
            displayName: u.displayName || u.email || ''
          });
          setShowTempPasswordModal(true);
          setPasswordCopied(false);

          setMessage(`Senha resetada com sucesso para ${u.displayName || u.email}`);
          return;
        } catch (err: any) {
          console.warn('Chamada à função updateUserPassword falhou:', err);
          setMessage('Erro ao atualizar senha via função backend: ' + (err.message || String(err)));
        }
      }

      // Fallback: If no backend function, update only Firestore
      const ref = doc(db, 'users', u.id);
      await updateDoc(ref, {
        requirePasswordChange: true,
        tempPassword: tempPassword, // Store temp password in Firestore (not recommended for production)
        lastPasswordReset: new Date().toISOString()
      });

      // Show temp password in modal for fallback too
      setTempPasswordData({
        email: u.email || '',
        password: tempPassword,
        displayName: u.displayName || u.email || ''
      });
      setShowTempPasswordModal(true);
      setPasswordCopied(false);

      setMessage(`Senha temporária gerada. Use o script admin para aplicar no Firebase Auth.`);
    } catch (e: any) {
      console.error('Erro ao resetar senha:', e);
      setMessage('Erro ao resetar senha: ' + (e.message || String(e)));
    }
  };

  const updateUserPassword = async (u: UserRecord) => {
    setMessage(null);
    if (!editPasswordValue) {
      setMessage('Senha é obrigatória');
      return;
    }
    if (editPasswordValue !== editPasswordConfirm) {
      setMessage('As senhas não coincidem');
      return;
    }
    if (editPasswordValue.length < 6) {
      setMessage('A senha deve ter ao menos 6 caracteres');
      return;
    }
    try {
      if (functions) {
        try {
          const fn = httpsCallable(functions, 'updateUserPassword');
          await fn({ uid: u.id, password: editPasswordValue });
          setMessage('Senha atualizada via função backend.');
          setEditingPasswordUserId(null);
          setEditPasswordValue(''); setEditPasswordConfirm('');
          return;
        } catch (err) {
          console.warn('Chamada à função updateUserPassword falhou:', err);
        }
      }
      // If we reach here, no backend function: cannot update Auth password from client
      setMessage('Não foi possível atualizar a senha: função backend ausente. Use o script admin ou implemente uma Cloud Function callable chamada updateUserPassword.');
    } catch (e: any) {
      console.error('Erro atualizando senha:', e);
      setMessage('Erro ao atualizar senha: ' + (e.message || String(e)));
    }
  };

  const toggleActive = async (u: UserRecord) => {
    try {
      const ref = doc(db, 'users', u.id);
      await updateDoc(ref, { active: !u.active });
      setMessage(null);
    } catch (e: any) {
      setMessage('Erro ao atualizar usuário: ' + (e.message || String(e)));
    }
  };

  const changeRole = async (u: UserRecord, role: string) => {
    try {
      const ref = doc(db, 'users', u.id);
      await updateDoc(ref, { role });
      setMessage(null);
    } catch (e: any) {
      setMessage('Erro ao atualizar papel do usuário: ' + (e.message || String(e)));
    }
  };

  const copyTempPassword = () => {
    if (tempPasswordData) {
      navigator.clipboard.writeText(tempPasswordData.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gerenciamento de Usuários</h3>
          <button onClick={onClose} className="text-sm text-gray-600">Fechar</button>
        </div>
        <div className="p-4 space-y-4">
          {message && <div className="p-3 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{message}</div>}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500">Email</label>
              <input className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-200" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Nome (displayName)</label>
              <input className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-200" placeholder="Nome (displayName)" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Papel</label>
              <select className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm" value={newRole} onChange={e => setNewRole(e.target.value as any)}>
                <option value="usuario">Usuário</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Senha (opcional)</label>
              <input className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-200" placeholder="Senha (opcional)" value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Confirmar senha</label>
              <input className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-200" placeholder="Confirmar senha" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} type="password" />
            </div>
            <div className="md:col-span-4 flex items-center justify-between">
              <div>
                <button onClick={createUser} className="px-4 py-2 bg-green-600 text-white rounded-md shadow">Criar usuário</button>
              </div>
              <div className="text-sm text-gray-500">Se funções backend estiverem disponíveis, o usuário será criado no Auth e no Firestore; caso contrário, será criado apenas no Firestore.</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Usuários existentes</h4>
            {loading ? <div>Carregando...</div> : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="p-3 border rounded-md bg-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="mb-2 md:mb-0">
                      <div className="font-medium text-gray-800">{u.displayName || u.email || u.id}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select value={u.role} onChange={e => changeRole(u, e.target.value)} className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white min-w-[140px]">
                        <option value="usuario">Usuário</option>
                        <option value="gestor">Gestor</option>
                      </select>
                      <button onClick={() => toggleActive(u)} className={`px-3 py-2 rounded-md text-sm ${u.active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {u.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => resetPasswordWithTemp(u)}
                        className="px-3 py-2 border border-orange-200 bg-orange-50 text-orange-700 rounded-md text-sm hover:bg-orange-100"
                        title="Gerar senha temporária e forçar alteração no próximo login"
                      >
                        🔑 Reset Senha
                      </button>
                      {!editingPasswordUserId || editingPasswordUserId !== u.id ? (
                        <button onClick={() => { setEditingPasswordUserId(u.id); setEditPasswordValue(''); setEditPasswordConfirm(''); }} className="px-3 py-2 border border-blue-100 bg-white text-blue-700 rounded-md text-sm">Alterar senha</button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input type="password" placeholder="Nova senha" value={editPasswordValue} onChange={e => setEditPasswordValue(e.target.value)} className="w-40 px-3 py-2 border border-gray-200 rounded-md text-sm" />
                          <input type="password" placeholder="Confirme" value={editPasswordConfirm} onChange={e => setEditPasswordConfirm(e.target.value)} className="w-40 px-3 py-2 border border-gray-200 rounded-md text-sm" />
                          <button onClick={() => updateUserPassword(u)} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm">Salvar</button>
                          <button onClick={() => { setEditingPasswordUserId(null); setEditPasswordValue(''); setEditPasswordConfirm(''); }} className="px-3 py-2 bg-gray-100 rounded-md text-sm">Cancelar</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Senha Temporária */}
      {showTempPasswordModal && tempPasswordData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 mx-4">
            <div className="text-center mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Senha temporária gerada com sucesso!
              </h3>
              <p className="text-sm text-gray-600">
                Usuário: <strong>{tempPasswordData.displayName}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {tempPasswordData.email}
              </p>
            </div>

            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Senha Temporária:
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-4 py-3 rounded border border-gray-200 text-lg font-mono text-center text-gray-900 select-all">
                  {tempPasswordData.password}
                </code>
                <button
                  onClick={copyTempPassword}
                  className={`px-4 py-3 rounded-md text-sm font-medium transition-colors ${passwordCopied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  title="Copiar senha"
                >
                  {passwordCopied ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordCopied && (
                <p className="text-xs text-green-600 mt-2 font-medium">
                  ✓ Senha copiada para a área de transferência!
                </p>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">IMPORTANTE:</h4>
                  <p className="text-xs text-yellow-700 mt-1">
                    Anote esta senha e envie para o usuário. Ele será obrigado a alterá-la no primeiro login.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTempPasswordModal(false)}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmModal && confirmData.user && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 mx-4">
            <div className="text-center mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Resetar senha
              </h3>
              <p className="text-sm text-gray-600">
                Deseja resetar a senha de <strong>{confirmData.user.displayName || confirmData.user.email}</strong>?
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-blue-700">
                    Uma senha temporária será gerada e o usuário será forçado a alterá-la no próximo login.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmData({ user: null, action: null });
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmResetPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementModal;
