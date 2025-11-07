# Cloud Functions - Padronização de Atendimento

Este diretório contém as Cloud Functions do Firebase para gerenciamento administrativo de usuários.

## 📋 Pré-requisitos

1. **Firebase CLI** instalado globalmente:
```powershell
npm install -g firebase-tools
```

2. **Login no Firebase**:
```powershell
firebase login
```

3. **Inicializar projeto** (se ainda não foi feito):
```powershell
firebase init
```

## 🚀 Deploy das Functions

### 1. Instalar dependências
```powershell
cd functions
npm install
cd ..
```

### 2. Deploy
```powershell
# Deploy todas as functions
firebase deploy --only functions

# Deploy function específica
firebase deploy --only functions:updateUserPassword
firebase deploy --only functions:createUserWithProfile
```

### 3. Verificar deploy
```powershell
firebase functions:log
```

## 🔧 Functions Disponíveis

### 1. `createUserWithProfile`
Cria um usuário no Firebase Auth e perfil no Firestore.

**Parâmetros:**
- `email` (string, obrigatório)
- `displayName` (string, obrigatório)
- `role` (string, opcional, default: "usuario")
- `password` (string, opcional)

**Exemplo de uso:**
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

const createUser = httpsCallable(functions, 'createUserWithProfile');
const result = await createUser({
  email: 'user@example.com',
  displayName: 'Nome do Usuário',
  role: 'gestor',
  password: 'senha123'
});
```

### 2. `updateUserPassword`
Atualiza a senha de um usuário (apenas gestores).

**Parâmetros:**
- `uid` (string, obrigatório)
- `password` (string, obrigatório, mínimo 6 caracteres)

**Exemplo de uso:**
```typescript
const updatePassword = httpsCallable(functions, 'updateUserPassword');
const result = await updatePassword({
  uid: 'user-uid-here',
  password: 'novaSenha123'
});
```

### 3. `toggleUserStatus`
Ativa ou desativa um usuário.

**Parâmetros:**
- `uid` (string, obrigatório)
- `disable` (boolean, obrigatório)

### 4. `deleteUser`
Deleta um usuário (soft delete).

**Parâmetros:**
- `uid` (string, obrigatório)

## 🔐 Segurança

Todas as functions verificam:
1. ✅ Se o usuário está autenticado
2. ✅ Se o usuário tem role = "gestor"
3. ✅ Validação de parâmetros

## 🧪 Teste Local

Para testar localmente antes do deploy:

```powershell
# Iniciar emulador
firebase emulators:start

# Ou apenas functions
firebase emulators:start --only functions
```

## 📝 Logs

Para ver logs das functions em produção:

```powershell
# Logs em tempo real
firebase functions:log

# Logs de uma function específica
firebase functions:log --only updateUserPassword
```

## ⚠️ Troubleshooting

### Erro: "functions is not defined"
**Solução:** Faça o deploy das functions primeiro:
```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Erro: "Permission denied"
**Solução:** Verifique se o usuário logado tem role "gestor" no Firestore.

### Erro: "auth/requires-recent-login"
**Solução:** O usuário precisa fazer login novamente para alterar a senha.

## 🔄 Atualizar Functions

Após modificar o código:

```powershell
firebase deploy --only functions
```

## 📊 Monitoramento

Acesse o console do Firebase:
- https://console.firebase.google.com/project/atendimento-f2f9f/functions

Para ver:
- Execuções
- Erros
- Logs
- Métricas de performance
