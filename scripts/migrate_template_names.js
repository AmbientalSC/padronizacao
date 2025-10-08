/*
Node migration script to sanitize field names in Firestore templates collection.

Usage:
  - Install firebase-admin: npm install firebase-admin
  - Provide service account: set env var GOOGLE_APPLICATION_CREDENTIALS to the JSON key path
  - Dry run (preview changes): node scripts/migrate_template_names.js
  - Apply changes: node scripts/migrate_template_names.js --apply

What it does:
  - Reads all documents from `templates` collection
  - For each template, sanitizes field names and template_logic keys and injectFields names using sanitizeName()
  - Updates references inside template text ({{old}} -> {{new}}) and template_logic.condition.field values
  - Prints a summary and, if --apply is passed, writes updates to Firestore (backing up original into a `templates_backup` collection)

Be careful: run dry-run first and inspect output.
*/

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

function usage() {
  console.log('Usage: node scripts/migrate_template_names.js [--apply]');
}

function sanitizeName(raw) {
  if (!raw) return raw;
  // normalize, remove diacritics, replace spaces and slashes with underscore, remove other invalid chars
  return String(raw)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\/]+/g, '_')
    .replace(/[^0-9A-Za-z_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

async function main() {
  const apply = process.argv.includes('--apply');

  // initialize admin
  if (!admin.apps.length) {
    try {
      admin.initializeApp();
    } catch (e) {
      console.error('Failed to initialize firebase-admin. Ensure GOOGLE_APPLICATION_CREDENTIALS is set to a service account json.');
      console.error(e);
      process.exit(1);
    }
  }

  const db = admin.firestore();
  const templatesRef = db.collection('templates');
  const snapshot = await templatesRef.get();
  console.log(`Found ${snapshot.size} templates.`);

  const changes = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const origId = doc.id;
    const orig = JSON.parse(JSON.stringify(data));
    let changed = false;

    // helper map oldName -> newName
    const renameMap = new Map();

    // sanitize fields
    if (Array.isArray(data.fields)) {
      for (const f of data.fields) {
        const old = f.name;
        const cleaned = sanitizeName(old);
        if (old !== cleaned) {
          renameMap.set(old, cleaned);
        }
      }
    }

    // sanitize template_logic keys
    if (data.template_logic && typeof data.template_logic === 'object') {
      Object.keys(data.template_logic).forEach(k => {
        const nk = sanitizeName(k);
        if (k !== nk) {
          renameMap.set(k, nk);
        }
        // also check injectFields names
        const item = data.template_logic[k];
        if (item && Array.isArray(item.injectFields)) {
          for (const inf of item.injectFields) {
            const old = inf.name;
            const cleaned = sanitizeName(old);
            if (old !== cleaned) renameMap.set(old, cleaned);
          }
        }
        // condition.field might reference a field name
        if (item && item.condition && item.condition.field) {
          const old = item.condition.field;
          const cleaned = sanitizeName(old);
          if (old !== cleaned) renameMap.set(old, cleaned);
        }
      });
    }

    // If renameMap empty, skip
    if (renameMap.size === 0) continue;

    // Apply renames to fields array
    if (Array.isArray(data.fields)) {
      data.fields = data.fields.map(f => {
        const newName = renameMap.get(f.name) || f.name;
        if (newName !== f.name) changed = true;
        return { ...f, name: newName };
      });
    }

    // Apply renames to template_logic keys and inner structures
    if (data.template_logic && typeof data.template_logic === 'object') {
      const newLogic = {};
      for (const [k, item] of Object.entries(data.template_logic)) {
        const nk = renameMap.get(k) || k;
        let newItem = JSON.parse(JSON.stringify(item));
        // adjust condition.field
        if (newItem && newItem.condition && newItem.condition.field) {
          newItem.condition.field = renameMap.get(newItem.condition.field) || newItem.condition.field;
        }
        // adjust injectFields
        if (newItem && Array.isArray(newItem.injectFields)) {
          newItem.injectFields = newItem.injectFields.map(inf => ({ ...inf, name: renameMap.get(inf.name) || inf.name }));
        }
        if (nk !== k) changed = true;
        newLogic[nk] = newItem;
      }
      data.template_logic = newLogic;
    }

    // Replace placeholders inside template text: {{old}} -> {{new}}
    if (typeof data.template === 'string') {
      let newTemplateText = data.template;
      for (const [oldName, newName] of renameMap.entries()) {
        const re = new RegExp('{{\\s*' + oldName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\s*}}', 'g');
        const replacement = '{{' + newName + '}}';
        if (re.test(newTemplateText)) {
          newTemplateText = newTemplateText.replace(re, replacement);
          changed = true;
        }
      }
      data.template = newTemplateText;
    }

    // Also update any condition.value references if they refer to option names? (skip for safety)

    if (!changed) continue;

    changes.push({ id: origId, before: orig, after: data });
  }

  if (changes.length === 0) {
    console.log('No changes required.');
    return;
  }

  console.log(`Prepared ${changes.length} documents to update.`);
  changes.forEach(c => console.log(`- ${c.id}: will rename keys referenced.`));

  if (!apply) {
    console.log('\nDry run complete. Run with --apply to perform updates (this will backup original docs to templates_backup).');
    return;
  }

  // Apply updates with backup
  for (const c of changes) {
    const docRef = db.collection('templates').doc(c.id);
    const backupRef = db.collection('templates_backup').doc(c.id + '_' + Date.now());
    try {
      await backupRef.set(c.before);
      await docRef.set(c.after, { merge: false });
      console.log(`Updated ${c.id}`);
    } catch (e) {
      console.error(`Failed to update ${c.id}:`, e);
    }
  }

  console.log('Migration applied. Originals backed up in templates_backup collection.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
