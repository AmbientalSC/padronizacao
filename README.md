# Gerador de Descrições de Atendimento

Uma ferramenta interna de produtividade para padronizar os textos de registro de atendimentos, baseando-se em modelos pré-definidos e gerando textos formatados em tempo real.

## 🚀 Funcionalidades

- **Gerador de Textos**: Interface para criar descrições padronizadas de atendimento
- **Histórico de Atendimentos**: Visualização e edição de atendimentos salvos
- **Gerenciamento de Modelos**: CRUD completo para templates (requer login)
- **Autenticação Firebase**: Sistema de login para administradores
- **Armazenamento Híbrido**: localStorage local + Firebase para templates
- **Interface Responsiva**: Design moderno com Tailwind CSS

## 🛠️ Tecnologias

- **Frontend**: React 19.1.1 + TypeScript
- **Build**: Vite 6.2.0
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Auth + Firestore)
- **Deploy**: GitHub Pages

## 🏃‍♂️ Executando Localmente

### Pré-requisitos
- Node.js 18+
- npm

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/AmbientalSC/padronizacao.git
   cd padronizacao
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Execute o projeto:
   ```bash
   npm run dev
   ```

4. Acesse: `http://localhost:5173`

## 🚀 Deploy

### Deploy Manual
```bash
npm run build
npm run deploy
```

### Deploy Automático
O projeto está configurado com GitHub Actions para deploy automático:
- Push na branch `main` → Deploy automático
- URL: https://ambientalsc.github.io/padronizacao

```


## 👥 Como Usar

### Para Usuários (Sem Login)
1. **Gerador**: Selecione um modelo e preencha o formulário
2. **Atendimentos**: Visualize e edite seu histórico local

### Para Administradores (Com Login)
1. Clique em "Gerenciar Modelos"
2. Faça login com credenciais de administrador
3. Crie, edite ou exclua modelos de atendimento
4. Os modelos ficam sincronizados na nuvem

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── Generator.tsx    # Interface principal
│   ├── Manager.tsx      # Gerenciador de modelos
│   ├── Atendimentos.tsx # Histórico
│   ├── LoginModal.tsx   # Modal de login
│   └── ConfirmModal.tsx # Modal de confirmação
├── hooks/               # Hooks customizados
│   ├── useAuth.ts       # Autenticação
│   ├── useLocalStorage.ts
│   └── useFirebaseTemplates.ts
├── firebase/            # Configuração Firebase
├── data/               # Dados iniciais
└── types.ts            # Tipos TypeScript
```

## 🔐 Segurança

- Templates protegidos por autenticação
- Regras de segurança do Firestore
- Armazenamento local para dados pessoais
- Validação de formulários