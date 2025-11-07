import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

interface UserProfile {
    uid: string;
    email: string;
    displayName?: string;
    role: string;
    active: boolean;
    createdAt?: string;
    lastLogin?: string;
}

interface UserManagerProps {
    currentUser: any;
    onClose: () => void;
}

const UserManager: React.FC<UserManagerProps> = ({ currentUser, onClose }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [newUser, setNewUser] = useState({
        email: '',
        displayName: '',
        password: '',
        role: 'gestor'
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            const usersList: UserProfile[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                usersList.push({
                    uid: doc.id,
                    email: data.email || '',
                    displayName: data.displayName || '',
                    role: data.role || 'user',
                    active: data.active !== false,
                    createdAt: data.createdAt,
                    lastLogin: data.lastLogin
                });
            });

            setUsers(usersList.sort((a, b) => a.email.localeCompare(b.email)));
        } catch (error: any) {
            setMessage({ type: 'error', text: `Erro ao carregar usuários: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const createUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newUser.email || !newUser.password) {
            setMessage({ type: 'error', text: 'Email e senha são obrigatórios' });
            return;
        }

        setCreateLoading(true);
        setMessage(null);

        try {
            // Criar usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                newUser.email,
                newUser.password
            );

            // Criar perfil no Firestore
            const userProfile = {
                email: newUser.email,
                displayName: newUser.displayName || null,
                role: newUser.role,
                active: true,
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.uid || 'system'
            };

            await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);

            setMessage({ type: 'success', text: `Usuário ${newUser.email} criado com sucesso!` });
            setNewUser({ email: '', displayName: '', password: '', role: 'gestor' });
            setShowCreateForm(false);
            loadUsers();

        } catch (error: any) {
            let errorMessage = 'Erro ao criar usuário';

            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Este email já está em uso';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'A senha deve ter pelo menos 6 caracteres';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }

            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setCreateLoading(false);
        }
    };

    const toggleUserStatus = async (user: UserProfile) => {
        try {
            const newStatus = !user.active;
            await updateDoc(doc(db, 'users', user.uid), {
                active: newStatus,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.uid || 'system'
            });

            setMessage({
                type: 'success',
                text: `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso`
            });
            loadUsers();
        } catch (error: any) {
            setMessage({ type: 'error', text: `Erro ao alterar status: ${error.message}` });
        }
    };

    const sendPasswordReset = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage({
                type: 'success',
                text: `Email de redefinição de senha enviado para ${email}`
            });
        } catch (error: any) {
            setMessage({ type: 'error', text: `Erro ao enviar email: ${error.message}` });
        }
    };

    const deleteUser = async (user: UserProfile) => {
        if (!confirm(`Tem certeza que deseja excluir o usuário ${user.email}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            // Nota: Não é possível deletar usuário do Auth via client SDK
            // Apenas desativar no Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                active: false,
                deletedAt: new Date().toISOString(),
                deletedBy: currentUser?.uid || 'system'
            });

            setMessage({
                type: 'success',
                text: 'Usuário desativado. Para remover completamente, use o console do Firebase.'
            });
            loadUsers();
        } catch (error: any) {
            setMessage({ type: 'error', text: `Erro ao desativar usuário: ${error.message}` });
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Usuários</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Mensagens */}
                    {message && (
                        <div className={`mb-4 p-4 rounded-md ${message.type === 'success'
                                ? 'bg-green-50 border border-green-200 text-green-700'
                                : 'bg-red-50 border border-red-200 text-red-700'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    {/* Botão para criar usuário */}
                    <div className="mb-6">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                        >
                            {showCreateForm ? 'Cancelar' : '+ Criar Novo Usuário'}
                        </button>
                    </div>

                    {/* Formulário de criação */}
                    {showCreateForm && (
                        <form onSubmit={createUser} className="bg-gray-50 p-6 rounded-lg mb-6">
                            <h3 className="text-lg font-semibold mb-4">Novo Usuário</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="usuario@ambiental.sc"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nome de Exibição
                                    </label>
                                    <input
                                        type="text"
                                        value={newUser.displayName}
                                        onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="Nome do usuário"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Senha *
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="Mínimo 6 caracteres"
                                        minLength={6}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Função
                                    </label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    >
                                        <option value="gestor">Gestor</option>
                                        <option value="admin">Administrador</option>
                                        <option value="user">Usuário</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                                >
                                    {createLoading ? 'Criando...' : 'Criar Usuário'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Lista de usuários */}
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                            <p className="mt-2 text-gray-600">Carregando usuários...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-600">Nenhum usuário encontrado</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border border-gray-200 rounded-lg">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Função</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Criado</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user, index) => (
                                        <tr key={user.uid} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{user.displayName || '-'}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 text-xs rounded-full ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                        user.role === 'gestor' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 text-xs rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {user.active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => toggleUserStatus(user)}
                                                        className={`px-3 py-1 text-xs rounded ${user.active
                                                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            } transition-colors`}
                                                        title={user.active ? 'Desativar usuário' : 'Ativar usuário'}
                                                    >
                                                        {user.active ? 'Desativar' : 'Ativar'}
                                                    </button>

                                                    <button
                                                        onClick={() => sendPasswordReset(user.email)}
                                                        className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                                        title="Enviar email para redefinir senha"
                                                    >
                                                        Reset Senha
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManager;