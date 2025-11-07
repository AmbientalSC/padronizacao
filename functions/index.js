/**
 * Cloud Functions para Firebase - Padronização de Atendimento
 * 
 * Funções administrativas para gerenciamento de usuários
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

/**
 * Criar usuário com perfil no Firestore
 * 
 * @param {Object} data - { email, displayName, role, password }
 * @returns {Object} - { success, uid, message }
 */
exports.createUserWithProfile = functions.https.onCall(async (data, context) => {
    // Verificar se o usuário está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Usuário não autenticado'
        );
    }

    // Verificar se o usuário é gestor
    try {
        const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const callerData = callerDoc.data();

        if (!callerData || callerData.role !== 'gestor') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Apenas gestores podem criar usuários'
            );
        }
    } catch (error) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Erro ao verificar permissões do usuário'
        );
    }

    // Validar dados de entrada
    const { email, displayName, role, password } = data;

    if (!email || !displayName) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Email e displayName são obrigatórios'
        );
    }

    try {
        // Criar usuário no Firebase Auth
        const userRecord = await admin.auth().createUser({
            email: email,
            displayName: displayName,
            password: password || undefined,
            emailVerified: false
        });

        // Criar perfil no Firestore
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            email: email,
            displayName: displayName,
            role: role || 'usuario',
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid
        });

        return {
            success: true,
            uid: userRecord.uid,
            message: 'Usuário criado com sucesso'
        };
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Erro ao criar usuário: ${error.message}`
        );
    }
});

/**
 * Atualizar senha de um usuário
 * 
 * @param {Object} data - { uid, password }
 * @returns {Object} - { success, message }
 */
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    // Verificar se o usuário está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Usuário não autenticado'
        );
    }

    // Verificar se o usuário é gestor
    try {
        const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const callerData = callerDoc.data();

        if (!callerData || callerData.role !== 'gestor') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Apenas gestores podem alterar senhas de outros usuários'
            );
        }
    } catch (error) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Erro ao verificar permissões do usuário'
        );
    }

    // Validar dados de entrada
    const { uid, password } = data;

    if (!uid || !password) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'UID e senha são obrigatórios'
        );
    }

    if (password.length < 6) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'A senha deve ter pelo menos 6 caracteres'
        );
    }

    try {
        // Atualizar senha no Firebase Auth
        await admin.auth().updateUser(uid, {
            password: password
        });

        // Atualizar timestamp no Firestore
        await admin.firestore().collection('users').doc(uid).update({
            lastPasswordReset: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: context.auth.uid
        });

        return {
            success: true,
            message: 'Senha atualizada com sucesso'
        };
    } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Erro ao atualizar senha: ${error.message}`
        );
    }
});

/**
 * Desativar/Ativar usuário
 * 
 * @param {Object} data - { uid, disable }
 * @returns {Object} - { success, message }
 */
exports.toggleUserStatus = functions.https.onCall(async (data, context) => {
    // Verificar se o usuário está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Usuário não autenticado'
        );
    }

    // Verificar se o usuário é gestor
    try {
        const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const callerData = callerDoc.data();

        if (!callerData || callerData.role !== 'gestor') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Apenas gestores podem alterar status de usuários'
            );
        }
    } catch (error) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Erro ao verificar permissões do usuário'
        );
    }

    const { uid, disable } = data;

    if (!uid) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'UID é obrigatório'
        );
    }

    try {
        // Atualizar status no Firebase Auth
        await admin.auth().updateUser(uid, {
            disabled: disable === true
        });

        // Atualizar no Firestore
        await admin.firestore().collection('users').doc(uid).update({
            active: disable !== true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: context.auth.uid
        });

        return {
            success: true,
            message: `Usuário ${disable ? 'desativado' : 'ativado'} com sucesso`
        };
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Erro ao alterar status: ${error.message}`
        );
    }
});

/**
 * Deletar usuário (soft delete)
 * 
 * @param {Object} data - { uid }
 * @returns {Object} - { success, message }
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
    // Verificar se o usuário está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Usuário não autenticado'
        );
    }

    // Verificar se o usuário é gestor
    try {
        const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const callerData = callerDoc.data();

        if (!callerData || callerData.role !== 'gestor') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Apenas gestores podem deletar usuários'
            );
        }
    } catch (error) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Erro ao verificar permissões do usuário'
        );
    }

    const { uid } = data;

    if (!uid) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'UID é obrigatório'
        );
    }

    try {
        // Desativar usuário no Firebase Auth
        await admin.auth().updateUser(uid, {
            disabled: true
        });

        // Marcar como deletado no Firestore (soft delete)
        await admin.firestore().collection('users').doc(uid).update({
            active: false,
            deleted: true,
            deletedAt: admin.firestore.FieldValue.serverTimestamp(),
            deletedBy: context.auth.uid
        });

        return {
            success: true,
            message: 'Usuário deletado com sucesso'
        };
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Erro ao deletar usuário: ${error.message}`
        );
    }
});
