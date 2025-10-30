#!/usr/bin/env node
/**
 * scripts/sync_auth_users_to_firestore.js
 *
 * Lista todos os usuários do Firebase Auth (Admin SDK) e cria/atualiza um documento
 * em Firestore em collection `users/{uid}` definindo `role: 'gestor'` e `active: true`.
 *
 * Uso:
 *   # Dry run (apenas mostra o que seria feito)
 *   node scripts/sync_auth_users_to_firestore.js
 *
 *   # Aplicar as mudanças (escreve no Firestore)
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/sync_auth_users_to_firestore.js --apply
 *
 * Requisitos:
 * - Ter um service account JSON com permissões para Admin SDK (Firestore + Auth).
 * - Ter o pacote firebase-admin instalado (npm i firebase-admin) no ambiente onde rodar.
 *
 * Atenção: este script executa operações administrativas. Teste primeiro em staging.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

async function main() {
  try {
    // Initialize admin SDK (will use GOOGLE_APPLICATION_CREDENTIALS env var if present)
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const auth = admin.auth();
    const db = admin.firestore();

    console.log('Listando usuários do Firebase Auth...');

    let nextPageToken = undefined;
    const allUsers = [];

    do {
      const res = await auth.listUsers(1000, nextPageToken);
      res.users.forEach(u => allUsers.push(u.toJSON()));
      nextPageToken = res.pageToken;
    } while (nextPageToken);

    console.log(`Encontrados ${allUsers.length} usuários no Auth.`);

    if (allUsers.length === 0) return;

    // Summarize
    const summary = allUsers.map(u => ({ uid: u.uid, email: u.email || null, displayName: u.displayName || null }));
    console.log('Amostra de usuários:', summary.slice(0, 5));

    if (!APPLY) {
      console.log('\nDry-run: nenhum documento será criado. Rode com --apply para aplicar as mudanças.');
      return;
    }

    console.log('\nAplicando: escrevendo documentos na coleção users (role: gestor).');
    let created = 0;
    for (const u of allUsers) {
      const docRef = db.collection('users').doc(u.uid);
      const payload = {
        email: u.email || null,
        displayName: u.displayName || null,
        role: 'gestor',
        active: true,
        syncedAt: new Date().toISOString()
      };
      await docRef.set(payload, { merge: true });
      created++;
      if (created % 50 === 0) console.log(`Processados ${created}/${allUsers.length}...`);
    }

    console.log(`Concluído. ${created} documentos criados/atualizados em users/`);
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
}

main();
