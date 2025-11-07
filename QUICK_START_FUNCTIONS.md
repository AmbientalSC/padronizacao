# 🚀 Deploy Rápido - Cloud Functions

## Passo a Passo Simplificado

### 1️⃣ Instalar Firebase CLI (uma vez)
```powershell
npm install -g firebase-tools
```

### 2️⃣ Fazer Login no Firebase (uma vez)
```powershell
firebase login
```

### 3️⃣ Instalar Dependências das Functions
```powershell
npm run functions:install
```
**Ou manualmente:**
```powershell
cd functions
npm install
cd ..
```

### 4️⃣ Deploy das Functions
```powershell
npm run functions:deploy
```
**Ou com o script:**
```powershell
.\deploy-functions.ps1
```
**Ou manualmente:**
```powershell
firebase deploy --only functions
```

### 5️⃣ Verificar Deploy
```powershell
npm run functions:logs
```

## ✅ Pronto!

Agora quando você clicar em "🔑 Reset Senha" na aplicação, a senha será atualizada automaticamente no Firebase Auth!

## 🧪 Testar

1. Acesse: https://ambientalsc.github.io/padronizacao
2. Faça login como gestor
3. Clique na engrenagem (⚙️)
4. Clique em "🔑 Reset Senha" em algum usuário
5. Copie a senha temporária mostrada no alert
6. Envie para o usuário

Quando o usuário fizer login com a senha temporária, ele será forçado a alterá-la!

## 📝 Comandos Úteis

```powershell
# Ver logs
npm run functions:logs

# Deploy completo (app + functions)
npm run deploy:all

# Deploy apenas functions
npm run functions:deploy

# Ver logs em tempo real
firebase functions:log
```

## ❓ Problemas?

Consulte: `FUNCTIONS_DEPLOY.md` para guia completo.
