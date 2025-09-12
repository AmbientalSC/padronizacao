# Instruções para Deploy no GitHub Pages

## 1. Configuração do Repositório GitHub

### Passo 1: Configurar GitHub Pages
1. Acesse o repositório no GitHub: `https://github.com/AmbientalSC/padronizacao`
2. Vá em **Settings** → **Pages**
3. Em **Source**, selecione: **GitHub Actions**

### Passo 2: Configurar Secrets
1. Vá em **Settings** → **Secrets and variables** → **Actions**
2. Adicione o secret: `GEMINI_API_KEY` com sua chave do Gemini

## 2. Deploy Manual (Primeira vez)

Execute os comandos na pasta do projeto:

```bash
# 1. Fazer commit das mudanças
git add .
git commit -m "Configuração para GitHub Pages"

# 2. Push para o repositório
git push origin main

# 3. (Opcional) Deploy manual
npm run deploy
```

## 3. Deploy Automático

Após configurar, o deploy será automático:
- **Trigger**: Push na branch `main`
- **URL final**: https://ambientalsc.github.io/padronizacao
- **Tempo**: ~2-3 minutos para estar online

## 4. Estrutura Criada

### Arquivos de Configuração:
- `.github/workflows/deploy.yml` - GitHub Actions
- `public/.nojekyll` - Configuração GitHub Pages
- `vite.config.ts` - Base path para produção
- `package.json` - Scripts de deploy

### Scripts Disponíveis:
```bash
npm run dev      # Desenvolvimento local
npm run build    # Build de produção
npm run preview  # Preview do build
npm run deploy   # Deploy manual via gh-pages
```

## 5. Verificação Pós-Deploy

1. **Verificar Actions**: GitHub → Actions (deve estar verde ✅)
2. **Testar URL**: https://ambientalsc.github.io/padronizacao
3. **Funcionalidades**:
   - ✅ Gerador de textos
   - ✅ Histórico de atendimentos (localStorage)
   - ✅ Login de administrador (Firebase)
   - ✅ Gerenciamento de modelos (Firebase)

## 6. Troubleshooting

### Se algo não funcionar:
1. **Verificar Actions**: GitHub → Actions → Ver logs de erro
2. **Verificar base path**: Todos os assets devem carregar com `/padronizacao/`
3. **Verificar Firebase**: Configurações de domínio autorizado
4. **Forçar redeploy**: Novo commit → push

## 7. Firebase - Configuração Adicional

### Domínios Autorizados:
No Firebase Console → Authentication → Settings → Authorized domains:
- Adicionar: `ambientalsc.github.io`

### URL de Produção:
- **Local**: http://localhost:5173
- **Produção**: https://ambientalsc.github.io/padronizacao

---

Está tudo pronto para ir ao ar! 🚀
