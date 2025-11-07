# 🚀 Guia de Deploy das Cloud Functions

Este guia mostra como fazer o deploy das Cloud Functions para o Firebase.

## ⚙️ Configuração Inicial (apenas uma vez)

### 1. Instalar Firebase CLI
```powershell
npm install -g firebase-tools
```

### 2. Fazer login no Firebase
```powershell
firebase login
```

### 3. Verificar projeto
```powershell
firebase projects:list
```

Certifique-se de que está no projeto `atendimento-f2f9f`.

## 📦 Deploy das Functions

### Opção 1: Deploy Completo (Recomendado para primeira vez)

```powershell
# 1. Instalar dependências das functions
cd functions
npm install
cd ..

# 2. Deploy de tudo (functions + hosting)
firebase deploy
```

### Opção 2: Deploy Apenas das Functions

```powershell
# Instalar dependências (se ainda não instalou)
cd functions
npm install
cd ..

# Deploy apenas das functions
firebase deploy --only functions
```

### Opção 3: Deploy de Function Específica

```powershell
# Deploy apenas da função de atualizar senha
firebase deploy --only functions:updateUserPassword

# Deploy apenas da função de criar usuário
firebase deploy --only functions:createUserWithProfile
```

## ✅ Verificar se o Deploy Funcionou

### 1. Ver logs do deploy
```powershell
firebase functions:log
```

### 2. Acessar console do Firebase
Abra: https://console.firebase.google.com/project/atendimento-f2f9f/functions

Você deve ver as 4 functions listadas:
- ✅ createUserWithProfile
- ✅ updateUserPassword
- ✅ toggleUserStatus
- ✅ deleteUser

## 🧪 Testar as Functions

### Teste 1: Reset de Senha

1. Acesse a aplicação: https://ambientalsc.github.io/padronizacao
2. Faça login como gestor
3. Clique no botão da engrenagem (⚙️)
4. Clique em "🔑 Reset Senha" em algum usuário
5. Deve aparecer um alert com a senha temporária

### Teste 2: Criar Novo Usuário

1. Na tela de gerenciamento de usuários
2. Preencha os campos: email, nome, senha
3. Clique em "Criar usuário"
4. Deve aparecer mensagem de sucesso

## ❌ Problemas Comuns

### Erro: "firebase: command not found"
**Solução:**
```powershell
npm install -g firebase-tools
```

### Erro: "Error: HTTP Error: 403, Permission denied"
**Solução:**
```powershell
firebase login --reauth
```

### Erro: "functions is not defined" na aplicação
**Causa:** As functions ainda não foram deployadas

**Solução:**
```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Erro: "Module not found: firebase-admin"
**Solução:**
```powershell
cd functions
npm install
cd ..
```

## 🔄 Atualizar Functions Após Mudanças

Sempre que modificar o código em `functions/index.js`:

```powershell
firebase deploy --only functions
```

## 📊 Monitorar Functions

### Ver logs em tempo real
```powershell
firebase functions:log
```

### Ver logs de função específica
```powershell
firebase functions:log --only updateUserPassword
```

### Ver logs com mais detalhes
```powershell
firebase functions:log --raw
```

## 🎯 Próximos Passos

Após o deploy bem-sucedido:

1. ✅ Teste o reset de senha na aplicação
2. ✅ Teste criar novo usuário
3. ✅ Verifique os logs no console do Firebase
4. ✅ Configure regras de segurança do Firestore (se necessário)

## 📝 Notas Importantes

- **Billing**: Cloud Functions requer o plano Blaze (pay-as-you-go) do Firebase
- **Quotas**: Até 125.000 invocações gratuitas por mês
- **Região**: Functions são deployadas por padrão em us-central1
- **Runtime**: Node.js 18 (configurado em firebase.json)

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `firebase functions:log`
2. Consulte a documentação: https://firebase.google.com/docs/functions
3. Verifique o console: https://console.firebase.google.com/project/atendimento-f2f9f/functions
