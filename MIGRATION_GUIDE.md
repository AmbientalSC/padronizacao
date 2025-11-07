# 🔧 Guia de Migração de Usuários - Firebase Auth

Este guia explica como usar os scripts para migrar e gerenciar usuários do Firebase Auth no projeto de Padronização de Atendimento.

## 📋 Pré-requisitos

### 1. Service Account do Firebase
Você precisa de um arquivo JSON de service account do Firebase:

1. Acesse o [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto (`atendimento-f2f9f`)
3. Vá em **Configurações do Projeto** → **Service accounts**
4. Clique em **Gerar nova chave privada**
5. Baixe o arquivo JSON

### 2. Configurar variável de ambiente
No PowerShell:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\para\service-account.json"
```

### 3. Instalar dependências do Admin SDK
```powershell
npm install firebase-admin
```

## 🛠️ Scripts Disponíveis

### 1. `check_users.cjs` - Verificar Estado Atual
Mostra todos os usuários no Firebase Auth e Firestore:

```powershell
node scripts/check_users.cjs
```

**Saída esperada:**
```
🔍 Verificando estado dos usuários...

👤 FIREBASE AUTH:
   📭 Nenhum usuário encontrado no Firebase Auth

🗄️  FIRESTORE (coleção users):
   👥 2 usuários encontrados:
      • admin@ambiental.sc (12345...)
        Nome: Administrador
        Role: gestor
        Ativo: ✅
```

### 2. `create_auth_users.cjs` - Criar/Migrar Usuários

#### Criar usuário específico:
```powershell
node scripts/create_auth_users.cjs --email admin@ambiental.sc --password senha123 --name "Administrador"
```

#### Migrar todos os usuários do Firestore para Auth (dry-run):
```powershell
node scripts/create_auth_users.cjs --migrate-from-firestore --dry-run
```

#### Aplicar migração:
```powershell
node scripts/create_auth_users.cjs --migrate-from-firestore
```

### 3. `sync_auth_users_to_firestore.cjs` - Sincronizar Auth → Firestore
Para usuários já criados no Auth mas sem perfil no Firestore:

```powershell
# Dry run
node scripts/sync_auth_users_to_firestore.cjs

# Aplicar
node scripts/sync_auth_users_to_firestore.cjs --apply
```

## 🔄 Fluxos de Migração

### Cenário 1: Usuários apenas no Firestore
Se você tem usuários na coleção `users` mas não no Firebase Auth:

```powershell
# 1. Verificar estado atual
node scripts/check_users.cjs

# 2. Testar migração (dry-run)
node scripts/create_auth_users.cjs --migrate-from-firestore --dry-run

# 3. Aplicar migração
node scripts/create_auth_users.cjs --migrate-from-firestore
```

### Cenário 2: Usuários apenas no Auth
Se você tem usuários no Firebase Auth mas não no Firestore:

```powershell
# 1. Verificar estado atual
node scripts/check_users.cjs

# 2. Sincronizar Auth para Firestore
node scripts/sync_auth_users_to_firestore.cjs --apply
```

### Cenário 3: Sistema novo (sem usuários)
Para começar do zero:

```powershell
# 1. Criar primeiro administrador
node scripts/create_auth_users.cjs --email admin@ambiental.sc --password MinhaSenh@123 --name "Administrador"

# 2. Verificar se foi criado corretamente
node scripts/check_users.cjs
```

## 🎯 Interface Web para Gerenciar Usuários

Após a migração inicial, você pode usar a interface web:

1. **Faça login** com uma conta de gestor
2. Vá para **Gerenciar Modelos**
3. Clique no botão **👥 Usuários**
4. Use a interface para:
   - ✅ Criar novos usuários
   - 🔄 Ativar/desativar contas
   - 🔑 Enviar email de reset de senha
   - 👀 Visualizar todos os usuários

## ⚠️ Pontos Importantes

### Senhas Temporárias
- Usuários migrados do Firestore recebem **senhas temporárias aleatórias**
- Use a função "Reset Senha" para enviar email de redefinição
- Senhas são mostradas no console durante a migração - anote-as!

### Estrutura de Dados
Os usuários terão os seguintes campos no Firestore:
```json
{
  "email": "usuario@ambiental.sc",
  "displayName": "Nome do Usuário",
  "role": "gestor",
  "active": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "migratedToAuth": true,
  "migratedAt": "2024-01-01T00:00:00Z"
}
```

### Permissões
- Apenas usuários com `role: "gestor"` podem acessar o gerenciador
- Usuários `active: false` não conseguem fazer login
- Todos os gestores podem criar novos usuários

## 🚨 Troubleshooting

### Erro: "Service account not found"
```powershell
# Verifique se o arquivo existe
Test-Path "C:\caminho\para\service-account.json"

# Configure novamente a variável
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\correto\para\service-account.json"
```

### Erro: "Permission denied"
- Verifique se o service account tem permissões de Admin no projeto
- Confirme que está usando o projeto correto (`atendimento-f2f9f`)

### Erro: "Email already in use"
- O usuário já existe no Firebase Auth
- Use `--migrate-from-firestore` para sincronizar dados existentes

## 📝 Log de Migração Recomendado

Mantenha um registro das migrações:

```powershell
# Criar log da migração
node scripts/check_users.cjs > migration-log-before.txt
node scripts/create_auth_users.cjs --migrate-from-firestore > migration-log-process.txt
node scripts/check_users.cjs > migration-log-after.txt
```

---

💡 **Dica:** Sempre execute `check_users.cjs` antes e depois de qualquer migração para confirmar que tudo funcionou corretamente!