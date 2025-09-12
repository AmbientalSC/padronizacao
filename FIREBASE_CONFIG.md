# Configuração necessária no Firebase Console

## 1. Autorizar domínio no Firebase Auth

1. Acesse: https://console.firebase.google.com/project/atendimento-f2f9f/authentication/settings
2. Na seção "Authorized domains", clique em "Add domain"
3. Adicione: `ambientalsc.github.io`
4. Salve as alterações

## 2. Verificar regras do Firestore

1. Acesse: https://console.firebase.google.com/project/atendimento-f2f9f/firestore/rules
2. Verifique se as regras estão assim:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura para todos os usuários autenticados
    match /templates/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Bloquear tudo mais por padrão
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 3. Verificar Analytics (opcional)

Se os erros do Google Analytics persistirem, você pode desabilitar temporariamente removendo a inicialização do Analytics no código.

## Erros atuais identificados:

1. ✅ **Tailwind CDN**: Resolvido - migrando para instalação local
2. ❌ **Firebase Auth**: Domínio não autorizado
3. ❌ **Firestore**: Regras muito restritivas ou problemas de autenticação
4. ⚠️ **Google Analytics**: Falhas de rede (secundário)

## Status:
- Configuração local do Tailwind: ✅ Implementada
- Autorização de domínio: ⏳ Pendente (você deve fazer no Console)
- Regras do Firestore: ⏳ Pendente verificação
