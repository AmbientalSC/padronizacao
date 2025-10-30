#!/usr/bin/env node
/**
 * scripts/sync_auth_users_to_firestore.cjs
 * CommonJS version to run in projects with "type": "module" in package.json
 *
 * Lista todos os usuários do Firebase Auth (Admin SDK) e cria/atualiza um documento
 * em Firestore em collection `users/{uid}` definindo `role: 'gestor'` e `active: true`.
 *
 * Uso:
 *   # Dry run (apenas mostra o que seria feito)
 *   node scripts/sync_auth_users_to_firestore.cjs
 *
 *   # Aplicar as mudanças (escreve no Firestore)
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
 *   node scripts/sync_auth_users_to_firestore.cjs --apply
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

// Initialize Admin SDK using GOOGLE_APPLICATION_CREDENTIALS if provided.
// This script prefers an explicit service account JSON file to avoid default credential issues.
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
try {
  if (credPath) {
    const resolved = path.resolve(credPath);
    if (!fs.existsSync(resolved)) {
      console.error(`Arquivo de credenciais não encontrado em: ${resolved}`);
      console.error('Verifique a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS e o caminho do arquivo JSON da service account.');
      process.exit(1);
    }
    // require the JSON file
    const serviceAccount = require(resolved);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Try default credentials (may fail if not configured)
    try {
      admin.initializeApp();
    } catch (e) {
      console.error('Não foi possível inicializar o Admin SDK automaticamente.');
      console.error('Por favor defina a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS apontando para o JSON da service account.');
      console.error('Exemplo no PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\\\path\\to\\service-account.json"');
      console.error('Erro original:', e.message || e);
      process.exit(1);
    }
  }
} catch (err) {
  console.error('Erro ao inicializar Firebase Admin SDK:', err && err.message ? err.message : err);
  process.exit(1);
}

async function main() {
  try {
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
