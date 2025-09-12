
import { Template } from '../types';

export const initialTemplates: Template[] = [
  {
    "id": 1,
    "title": "1. ATENDIMENTO PARA RETIRAR A 2ª VIA DO CARNÊ",
    "template": "FONE: ({{ddd}}) {{telefone}} O SR. {{nome_solicitante}} ({{vinculo}}), {{contato_compareceu}} PARA RETIRAR A 2ª VIA DO CARNÊ REFERENTE AO PERÍODO {{periodo}}.{{credito_info}}{{envio_info}}",
    "fields": [
      { "name": "ddd", "label": "DDD", "type": "text" },
      { "name": "telefone", "label": "Telefone", "type": "text" },
      { "name": "nome_solicitante", "label": "Nome do Solicitante", "type": "text" },
      { "name": "vinculo", "label": "Vínculo com Proprietário", "type": "text" },
      { "name": "contato_compareceu", "label": "Tipo de Contato", "type": "select", "options": ["ENTROU EM CONTATO", "COMPARECEU"] },
      { "name": "periodo", "label": "Período", "type": "text" },
      { "name": "possui_credito", "label": "Possui crédito?", "type": "checkbox" },
      { 
        "name": "desconto_valor", 
        "label": "Valor do Desconto (R$)", 
        "type": "number", 
        "condition": { "field": "possui_credito", "value": true } 
      },
      { 
        "name": "desconto_motivo", 
        "label": "Motivo do Crédito", 
        "type": "text", 
        "condition": { "field": "possui_credito", "value": true } 
      },
      { "name": "forma_envio", "label": "Forma de Envio", "type": "select", "options": ["E-mail", "Site", "Correios", "Entregue em mãos"] },
      { 
        "name": "email_cliente", 
        "label": "E-mail do Cliente", 
        "type": "email", 
        "condition": { "field": "forma_envio", "value": "E-mail" } 
      },
      { 
        "name": "ticket", 
        "label": "Ticket", 
        "type": "text", 
        "condition": { "field": "forma_envio", "value": "E-mail" } 
      }
    ],
    "template_logic": {
      "credito_info": {
        "condition": { "field": "possui_credito", "value": true },
        "text": " COM DESCONTO DE R$ {{desconto_valor}} REFERENTE A CRÉDITO GERADO POR {{desconto_motivo}}."
      },
      "envio_info": {
        "condition": { "field": "forma_envio", "value": "E-mail" },
        "text": " CARNE ENVIADO VIA E-MAIL: {{email_cliente}} TICKET: {{ticket}}"
      }
    }
  },
  {
    "id": 2,
    "title": "2. ATENDIMENTO COM DATA - TESTE FORMATO",
    "template": "Em {{data_atendimento}}, o SR. {{nome_cliente}} compareceu para solicitar informações sobre o serviço. Atendimento realizado com sucesso.",
    "fields": [
      { "name": "data_atendimento", "label": "Data do Atendimento", "type": "date" },
      { "name": "nome_cliente", "label": "Nome do Cliente", "type": "text" }
    ],
    "template_logic": {}
  }
];
