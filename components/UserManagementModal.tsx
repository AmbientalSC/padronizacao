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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gerenciamento de Usuários</h3>
          <button onClick={onClose} className="text-sm text-gray-600">Fechar</button>
        </div>
        <div className="p-4 space-y-4">
          {message && <div className="p-2 bg-yellow-100 text-yellow-800 rounded">{message}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="px-2 py-1 border rounded" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            <input className="px-2 py-1 border rounded" placeholder="Nome" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} />
            <select className="px-2 py-1 border rounded" value={newRole} onChange={e => setNewRole(e.target.value as any)}>
              <option value="usuario">Usuário</option>
              <option value="gestor">Gestor</option>
            </select>
            <input className="px-2 py-1 border rounded" placeholder="Senha (opcional)" value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" />
            <input className="px-2 py-1 border rounded" placeholder="Confirmar senha" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} type="password" />
            <div className="md:col-span-3 flex items-center space-x-2">
              <button onClick={createUser} className="px-3 py-1 bg-green-600 text-white rounded">Criar usuário</button>
              <div className="text-sm text-gray-500">Se funções backend estiverem disponíveis, o usuário será criado no Auth e no Firestore; caso contrário, será criado apenas no Firestore.</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Usuários existentes</h4>
            {loading ? <div>Carregando...</div> : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="p-2 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{u.displayName || u.email || u.id}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select value={u.role} onChange={e => changeRole(u, e.target.value)} className="px-2 py-1 border rounded text-sm">
                        <option value="usuario">Usuário</option>
                        <option value="gestor">Gestor</option>
                      </select>
                      <button onClick={() => toggleActive(u)} className={`px-2 py-1 rounded ${u.active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {u.active ? 'Desativar' : 'Ativar'}
                      </button>
                      {!editingPasswordUserId || editingPasswordUserId !== u.id ? (
                        <button onClick={() => { setEditingPasswordUserId(u.id); setEditPasswordValue(''); setEditPasswordConfirm(''); }} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">Alterar senha</button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <input type="password" placeholder="Nova senha" value={editPasswordValue} onChange={e => setEditPasswordValue(e.target.value)} className="px-2 py-1 border rounded text-sm" />
                          <input type="password" placeholder="Confirme" value={editPasswordConfirm} onChange={e => setEditPasswordConfirm(e.target.value)} className="px-2 py-1 border rounded text-sm" />
                          <button onClick={() => updateUserPassword(u)} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Salvar</button>
                          <button onClick={() => { setEditingPasswordUserId(null); setEditPasswordValue(''); setEditPasswordConfirm(''); }} className="px-2 py-1 bg-gray-200 rounded text-sm">Cancelar</button>
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
    </div>
  );
};

export default UserManagementModal;
