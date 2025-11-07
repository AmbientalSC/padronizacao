#!/usr/bin/env node
/**
 * scripts/check_users.cjs
 * 
 * Script para verificar estado atual dos usuários no Firebase Auth e Firestore
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Admin SDK
function initializeFirebase() {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    try {
        if (credPath) {
            const resolved = path.resolve(credPath);
            if (!fs.existsSync(resolved)) {
                console.error(`❌ Arquivo de credenciais não encontrado em: ${resolved}`);
                process.exit(1);
            }
            const serviceAccount = require(resolved);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        } else {
            admin.initializeApp();
        }
    } catch (err) {
        console.error('❌ Erro ao inicializar Firebase:', err.message);
        process.exit(1);
    }
}

async function checkUsers() {
    const auth = admin.auth();
    const db = admin.firestore();

    console.log('🔍 Verificando estado dos usuários...\n');

    // Buscar usuários do Auth
    console.log('👤 FIREBASE AUTH:');
    try {
        let nextPageToken = undefined;
        const authUsers = [];

        do {
            const res = await auth.listUsers(1000, nextPageToken);
            res.users.forEach(u => authUsers.push(u.toJSON()));
            nextPageToken = res.pageToken;
        } while (nextPageToken);

        if (authUsers.length === 0) {
            console.log('   📭 Nenhum usuário encontrado no Firebase Auth');
        } else {
            console.log(`   👥 ${authUsers.length} usuários encontrados:`);
            authUsers.forEach(user => {
                console.log(`      • ${user.email || 'Sem email'} (${user.uid})`);
                console.log(`        Nome: ${user.displayName || 'Não definido'}`);
                console.log(`        Verificado: ${user.emailVerified ? '✅' : '❌'}`);
                console.log(`        Criado: ${new Date(user.createdAt).toLocaleDateString('pt-BR')}`);
                console.log('');
            });
        }
    } catch (error) {
        console.log('   ❌ Erro ao listar usuários do Auth:', error.message);
    }

    // Buscar usuários do Firestore
    console.log('🗄️  FIRESTORE (coleção users):');
    try {
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log('   📭 Nenhum usuário encontrado na coleção users');
        } else {
            console.log(`   👥 ${usersSnapshot.size} usuários encontrados:`);
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`      • ${data.email || 'Sem email'} (${doc.id})`);
                console.log(`        Nome: ${data.displayName || 'Não definido'}`);
                console.log(`        Role: ${data.role || 'Não definida'}`);
                console.log(`        Ativo: ${data.active ? '✅' : '❌'}`);
                if (data.migratedToAuth) {
                    console.log(`        Migrado: ✅ ${new Date(data.migratedAt).toLocaleDateString('pt-BR')}`);
                }
                console.log('');
            });
        }
    } catch (error) {
        console.log('   ❌ Erro ao listar usuários do Firestore:', error.message);
    }

    console.log('📋 RESUMO:');
    console.log('   Para criar novos usuários no Auth, use:');
    console.log('     node scripts/create_auth_users.cjs --email admin@ambiental.sc --password senha123 --name "Admin"');
    console.log('');
    console.log('   Para migrar usuários existentes do Firestore para Auth, use:');
    console.log('     node scripts/create_auth_users.cjs --migrate-from-firestore --dry-run');
    console.log('     node scripts/create_auth_users.cjs --migrate-from-firestore');
}

async function main() {
    initializeFirebase();
    await checkUsers();
}

main().catch(console.error);