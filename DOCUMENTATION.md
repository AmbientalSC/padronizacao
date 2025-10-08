# Documentação básica — Padronização de Atendimento

Este documento fornece informações básicas sobre o projeto para desenvolvedores e administradores.

## Nome do projeto

Padronização de Atendimento (Gerador de Descrições de Atendimento)

## Objetivo

Fornecer uma ferramenta interna para padronizar textos de registro de atendimentos, com templates gerenciáveis e sincronização com Firebase. Permite que usuários gerem descrições padronizadas e que administradores gerenciem modelos (templates) via interface protegida por autenticação.

## Tecnologias / Bibliotecas utilizadas

- Frontend: React 19 + TypeScript
- Build: Vite
- Estilo: Tailwind CSS
- Autenticação e Banco: Firebase (Auth + Firestore)
- Deploy: GitHub Pages
- Outras dependências visíveis no `package.json`:
  - firebase ^12
  - gh-pages (para deploy)
  - postcss, autoprefixer, tailwindcss

## Onde está hospedado

- Código-fonte: GitHub — repositório: https://github.com/AmbientalSC/padronizacao
- Site/Build (produção): GitHub Pages — https://ambientalsc.github.io/padronizacao

## Tokens, chaves e Onde estão usadas

O projeto utiliza credenciais do Firebase diretamente no código de configuração do cliente. Arquivo onde a configuração é exposta:

- `firebase/config.ts`

Conteúdo (valores expostos no repositório):
- apiKey
- authDomain
- projectId
- storageBucket
- messagingSenderId
- appId
- measurementId

Essas chaves são chaves de configuração do Firebase para a aplicação web. Elas não devem ser tratadas como segredos com restrições de leitura (são necessárias para inicializar o SDK do Firebase no cliente), mas ainda assim você deve:

- Não expor chaves de serviço (service account) no repositório.
- Evitar comitar chaves sensíveis de servidores ou tokens com permissões elevadas.

Recomendações para gerenciar chaves e tokens:

1. Para chaves de frontend (Firebase Web config): é aceitável mantê-las no código do cliente, mas aplique regras de segurança no Firebase (Firestore Rules e Authentication). Verifique regularmente domínios autorizados no Firebase Auth.

2. Para tokens/segredos de backend (não aplicável a este projeto atual): use variáveis de ambiente e serviços secretos (GitHub Secrets) quando for necessário em ações de CI/CD.

3. Para deploy automático via GitHub Actions (se usado): coloque quaisquer chaves/segredos no GitHub Secrets e nunca os inclua no código fonte.

4. Se quiser ocultar a configuração do Firebase do repositório público, mova o objeto `firebaseConfig` para variáveis de ambiente e injete-as em tempo de build (ex.: `.env` + Vite). Lembre-se que o build final (JavaScript servido ao usuário) ainda conterá esses valores.

Exemplo de como usar variáveis de ambiente com Vite (opcional):

- `.env` (não comitar):

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...

- Em `firebase/config.ts`, leia de `import.meta.env.VITE_FIREBASE_API_KEY` etc.

## Onde revisar ou alterar chaves

- `firebase/config.ts`: contém a configuração atual do Firebase (esta configuração está atualmente em código no repositório).
- `FIREBASE_CONFIG.md`: contém instruções para configurar o Firebase Console (domínios autorizados, regras do Firestore, etc.).

## Notas de segurança e boas práticas

- Confirme domínios autorizados no Firebase Auth (FIREBASE_CONFIG.md sugere `ambientalsc.github.io`).
- Use regras do Firestore apropriadas (apenas usuários autenticados podem escrever templates).
- Remova qualquer credencial de servidor de commits públicos.

---

Se quiser, eu posso:
- Mover `firebaseConfig` para variáveis de ambiente e atualizar `firebase/config.ts` para ler dessas variáveis (posso criar `.env.example` e ajustar o código).
- Adicionar instruções de deploy CI/CD com GitHub Actions usando GitHub Secrets.

Diga qual dessas opções prefere que eu implemente a seguir.