# Funcionalidade: Campo de Multiseleção

## 📋 Visão Geral

Foi implementado um novo tipo de campo chamado **`multiselect`** (Multiseleção) que permite ao usuário selecionar múltiplas opções usando checkboxes. Todos os itens selecionados aparecem automaticamente no preview do texto gerado.

## 🎯 Como Funciona

### 1. **No Generator (Interface do Usuário)**
- O campo exibe uma lista de checkboxes, um para cada opção configurada
- O usuário pode selecionar e desselecionar múltiplas opções
- Os valores selecionados aparecem no preview separados por vírgula e espaço
- Exemplo de output: `"E-mail, Site, Correios"`

### 2. **No Manager (Gerenciamento de Templates)**
- Ao criar ou editar um campo, selecione o tipo **"Multiseleção"**
- Adicione as opções separadas por vírgula no campo "Opções"
- As opções funcionam da mesma forma que no tipo "Seleção"

## 📝 Exemplo de Uso

### Criando um Campo Multiselect no Manager

1. Vá em "Gerenciar Modelos" e clique em "Editar" em um template
2. Na aba "Conteúdo", adicione um novo campo ou edite um existente
3. Configure da seguinte forma:
   - **Nome do Campo**: `formas_contato`
   - **Label**: `Formas de Contato Disponíveis:`
   - **Tipo de Campo**: `Multiseleção`
   - **Opções**: `E-mail,Telefone,WhatsApp,Presencial,Carta`

4. No template de texto, use o placeholder: `{{formas_contato}}`

### Exemplo de Template

```
REGISTRO DE ATENDIMENTO

Cliente: {{nome_cliente}}
Formas de Contato: {{formas_contato}}

O cliente foi atendido e informado que pode entrar em contato através das seguintes formas: {{formas_contato}}.
```

### Resultado no Preview

Se o usuário selecionar "E-mail", "Telefone" e "WhatsApp", o resultado será:

```
REGISTRO DE ATENDIMENTO

Cliente: JOÃO DA SILVA
Formas de Contato: E-mail, Telefone, WhatsApp

O cliente foi atendido e informado que pode entrar em contato através das seguintes formas: E-mail, Telefone, WhatsApp.
```

## 🔧 Detalhes Técnicos

### Estrutura de Dados

```typescript
// No types.ts
interface TemplateField {
  name: string;
  label: string;
  type: 'multiselect'; // Novo tipo
  options: string[]; // Array de opções
}

// No formData (estado)
{
  formas_contato: ['E-mail', 'Telefone', 'WhatsApp'] // Array de strings
}
```

### Comportamento

1. **Inicialização**: O campo é inicializado com array vazio `[]`
2. **Seleção**: Ao marcar um checkbox, o valor é adicionado ao array
3. **Desseleção**: Ao desmarcar, o valor é removido do array
4. **Preview**: O array é convertido em string usando `.join(', ')`
5. **Formatação**: Não há conversão para uppercase (preserva capitalização original)

## 🎨 Interface

```tsx
// Exemplo de renderização
<div className="mt-2 space-y-2">
  <div className="flex items-center">
    <input type="checkbox" id="field-option1" />
    <label htmlFor="field-option1">Opção 1</label>
  </div>
  <div className="flex items-center">
    <input type="checkbox" id="field-option2" />
    <label htmlFor="field-option2">Opção 2</label>
  </div>
</div>
```

## ✨ Recursos

- ✅ Suporte completo no Generator e Manager
- ✅ Funciona com campos principais e campos injetados
- ✅ Compatível com lógica condicional (pode ser usado como campo de condição)
- ✅ Preview em tempo real
- ✅ Preserva capitalização original das opções
- ✅ Validação automática de opções

## 📊 Casos de Uso Sugeridos

1. **Formas de Contato**: E-mail, Telefone, WhatsApp, Presencial
2. **Canais de Atendimento**: Site, App, Telefone, E-mail, Presencial
3. **Problemas Relatados**: Vazamento, Falta d'água, Conta, Outros
4. **Serviços Solicitados**: Coleta, Limpeza, Manutenção, Vistoria
5. **Documentos Apresentados**: RG, CPF, Comprovante de Residência, IPTU
6. **Formas de Envio**: E-mail, Correios, Pessoalmente, WhatsApp

## 🔄 Diferenças entre Tipos de Campo

| Tipo | Seleção Múltipla | Input Visual | Output |
|------|------------------|--------------|--------|
| `select` | ❌ Não | Dropdown | String única |
| `checkbox` | ❌ Não | Checkbox único | Boolean |
| `multiselect` | ✅ Sim | Lista de checkboxes | String (valores separados por vírgula) |

## 🐛 Troubleshooting

**Problema**: As opções não aparecem
- **Solução**: Certifique-se de que o campo "Opções" está preenchido com valores separados por vírgula

**Problema**: Os valores não aparecem no preview
- **Solução**: Verifique se o placeholder `{{nome_do_campo}}` está correto no template

**Problema**: Os valores aparecem como "Array"
- **Solução**: Este é um bug - certifique-se de que a atualização do código foi aplicada corretamente

## 🚀 Próximas Melhorias

- [ ] Opção de ordenação alfabética das opções
- [ ] Limite máximo de seleções
- [ ] Separador customizável (vírgula, ponto-e-vírgula, quebra de linha)
- [ ] Opção "Selecionar todos" / "Limpar todos"
- [ ] Busca/filtro de opções quando há muitas
