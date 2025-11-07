#!/usr/bin/env node
/**
 * scripts/create_auth_users.cjs
 * 
 * Script para criar usuários no Firebase Auth e sincronizar com Firestore
 * 
 * Uso:
 *   # Criar um usuário específico
 *   node scripts/create_auth_users.cjs --email admin@ambiental.sc --password senha123 --name "Administrador"
 *   
 *   # Migrar usuários existentes do Firestore para Auth
 *   node scripts/create_auth_users.cjs --migrate-from-firestore
 *   
 *   # Dry run (apenas mostra o que seria feito)
 *   node scripts/create_auth_users.cjs --migrate-from-firestore --dry-run
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const MIGRATE = argv.includes('--migrate-from-firestore');

// Parse command line arguments
function getArgValue(argName) {
    const index = argv.indexOf(argName);
    return index !== -1 && index + 1 < argv.length ? argv[index + 1] : null;
}

const EMAIL = getArgValue('--email');
const PASSWORD = getArgValue('--password');
const DISPLAY_NAME = getArgValue('--name');

// Initialize Admin SDK
function initializeFirebase() {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    try {
        if (credPath) {
            const resolved = path.resolve(credPath);
            if (!fs.existsSync(resolved)) {
                console.error(`❌ Arquivo de credenciais não encontrado em: ${resolved}`);
                console.error('Verifique a variável GOOGLE_APPLICATION_CREDENTIALS');
                process.exit(1);
            }
            const serviceAccount = require(resolved);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        } else {
            // Try default credentials
            admin.initializeApp();
        }
    } catch (err) {
        console.error('❌ Erro ao inicializar Firebase Admin SDK:', err.message);
        console.error('\n💡 Configure a variável de ambiente:');
        console.error('   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\service-account.json"');
        process.exit(1);
    }
}

async function createAuthUser(email, password, displayName) {
    const auth = admin.auth();
    const db = admin.firestore();

    try {
        console.log(`🔄 Criando usuário: ${email}`);

        if (DRY_RUN) {
            console.log(`   [DRY-RUN] Usuário seria criado: ${email} (${displayName || 'Sem nome'})`);
            return { uid: 'dry-run-uid', email };
        }

        // Verificar se usuário já existe
        try {
            const existingUser = await auth.getUserByEmail(email);
            console.log(`   ℹ️  Usuário já existe no Auth: ${existingUser.uid}`);

            // Atualizar Firestore mesmo se usuário já existir
            const userDoc = {
                email: email,
                displayName: displayName || existingUser.displayName || null,
                role: 'gestor',
                active: true,
                syncedAt: new Date().toISOString(),
                createdBy: 'script'
            };

            await db.collection('users').doc(existingUser.uid).set(userDoc, { merge: true });
            console.log(`   ✅ Perfil atualizado no Firestore`);

            return existingUser;
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
        }

        // Criar novo usuário
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: displayName,
            emailVerified: true
        });

        // Criar documento no Firestore
        const userDoc = {
            email: email,
            displayName: displayName || null,
            role: 'gestor',
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: 'script'
        };

        await db.collection('users').doc(userRecord.uid).set(userDoc);

        console.log(`   ✅ Usuário criado com sucesso: ${userRecord.uid}`);
        return userRecord;

    } catch (error) {
        console.error(`   ❌ Erro ao criar usuário ${email}:`, error.message);
        throw error;
    }
}

async function migrateFirestoreUsersToAuth() {
    const db = admin.firestore();
    const auth = admin.auth();

    console.log('🔍 Buscando usuários no Firestore...');

    try {
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log('   ℹ️  Nenhum usuário encontrado na coleção users');
            return [];
        }

        const firestoreUsers = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            firestoreUsers.push({
                uid: doc.id,
                email: data.email,
                displayName: data.displayName,
                role: data.role,
                ...data
            });
        });

        console.log(`📊 Encontrados ${firestoreUsers.length} usuários no Firestore`);

        let migrated = 0;
        let skipped = 0;

        for (const user of firestoreUsers) {
            if (!user.email) {
                console.log(`   ⚠️  Pulando usuário ${user.uid}: sem email`);
                skipped++;
                continue;
            }

            try {
                if (DRY_RUN) {
                    console.log(`   [DRY-RUN] Migraria usuário: ${user.email} (${user.displayName || 'Sem nome'})`);
                    continue;
                }

                // Verificar se já existe no Auth
                let authUser = null;
                try {
                    authUser = await auth.getUserByEmail(user.email);
                    console.log(`   ℹ️  Usuário ${user.email} já existe no Auth`);
                } catch (error) {
                    if (error.code === 'auth/user-not-found') {
                        // Criar usuário no Auth com senha temporária
                        const tempPassword = `temp${Math.random().toString(36).slice(2)}`;
                        authUser = await auth.createUser({
                            uid: user.uid, // Manter mesmo UID se possível
                            email: user.email,
                            displayName: user.displayName,
                            password: tempPassword,
                            emailVerified: false
                        });

                        console.log(`   ✅ Criado no Auth: ${user.email} (senha temporária gerada)`);
                        console.log(`      🔑 Senha temporária: ${tempPassword}`);
                    } else {
                        throw error;
                    }
                }

                // Atualizar documento do Firestore com flag de migração
                await db.collection('users').doc(authUser.uid).update({
                    migratedToAuth: true,
                    migratedAt: new Date().toISOString()
                });

                migrated++;

            } catch (error) {
                console.error(`   ❌ Erro ao migrar ${user.email}:`, error.message);
            }
        }

        if (!DRY_RUN) {
            console.log(`\n📈 Migração concluída:`);
            console.log(`   ✅ Migrados: ${migrated}`);
            console.log(`   ⚠️  Pulados: ${skipped}`);
        }

        return firestoreUsers;

    } catch (error) {
        console.error('❌ Erro durante migração:', error.message);
        throw error;
    }
}

async function main() {
    initializeFirebase();

    try {
        if (MIGRATE) {
            await migrateFirestoreUsersToAuth();
        } else if (EMAIL && PASSWORD) {
            await createAuthUser(EMAIL, PASSWORD, DISPLAY_NAME);
        } else {
            console.log(`
🔧 Uso do script:

1️⃣  Criar usuário específico:
   node scripts/create_auth_users.cjs --email admin@ambiental.sc --password senha123 --name "Admin"

2️⃣  Migrar usuários do Firestore para Auth:
   node scripts/create_auth_users.cjs --migrate-from-firestore

3️⃣  Dry run (apenas simular):
   node scripts/create_auth_users.cjs --migrate-from-firestore --dry-run

⚠️  Configure primeiro: $env:GOOGLE_APPLICATION_CREDENTIALS="caminho\\para\\service-account.json"
      `);
        }

    } catch (error) {
        console.error('💥 Erro fatal:', error.message);
        process.exit(1);
    }
}

main();