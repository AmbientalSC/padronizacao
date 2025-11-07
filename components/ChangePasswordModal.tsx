import React, { useState } from 'react';
import { auth, db } from '../firebase/config';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

interface ChangePasswordModalProps {
    isOpen: boolean;
    userEmail: string;
    userId: string;
    isRequired?: boolean;
    onPasswordChanged: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
    isOpen,
    userEmail,
    userId,
    isRequired = false,
    onPasswordChanged
}) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccessSnack, setShowSuccessSnack] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validations
        if (!newPassword || !confirmPassword) {
            setError('Por favor, preencha todos os campos');
            return;
        }

        if (newPassword.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        setLoading(true);

        try {
            const user = auth.currentUser;

            if (!user) {
                setError('Usuário não autenticado');
                setLoading(false);
                return;
            }

            // Update password in Firebase Auth
            await updatePassword(user, newPassword);

            // Update Firestore to remove the requirePasswordChange flag
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                requirePasswordChange: false,
                lastPasswordChange: new Date().toISOString(),
                tempPassword: null // Remove temp password if it exists
            });

            // Success - show snackbar
            setShowSuccessSnack(true);

            // Wait for user to see the snackbar before closing
            setTimeout(() => {
                setShowSuccessSnack(false);
                onPasswordChanged();
            }, 2000);

        } catch (error: any) {
            console.error('Erro ao alterar senha:', error);

            let errorMessage = 'Erro ao alterar senha';

            switch (error.code) {
                case 'auth/weak-password':
                    errorMessage = 'A senha é muito fraca. Use pelo menos 6 caracteres';
                    break;
                case 'auth/requires-recent-login':
                    errorMessage = 'Por segurança, você precisa fazer login novamente antes de alterar a senha';
                    break;
                default:
                    errorMessage = error.message || 'Erro desconhecido ao alterar senha';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isRequired ? '🔒 Alteração de Senha Obrigatória' : 'Alterar Senha'}
                    </h2>
                    {isRequired && (
                        <p className="text-sm text-red-600 mt-2">
                            Você está usando uma senha temporária. Por segurança, é obrigatório criar uma nova senha.
                        </p>
                    )}
                    <p className="text-sm text-gray-600 mt-2">
                        Usuário: <strong>{userEmail}</strong>
                    </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nova Senha *
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Mínimo 6 caracteres"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirmar Nova Senha *
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Digite a senha novamente"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <div className="text-xs text-gray-500">
                            <ul className="list-disc list-inside">
                                <li>Mínimo 6 caracteres</li>
                                <li>Use letras e números</li>
                                <li>Evite senhas óbvias</li>
                            </ul>
                        </div>
                        <div className="flex gap-2">
                            {!isRequired && (
                                <button
                                    type="button"
                                    onClick={() => onPasswordChanged()}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Alterando...' : 'Alterar Senha'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Snackbar de Sucesso */}
            {showSuccessSnack && (
                <div className="fixed bottom-4 right-4 z-[60] animate-slide-up">
                    <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]">
                        <div className="flex-shrink-0">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold">Senha alterada com sucesso!</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChangePasswordModal;