
export interface FieldCondition {
  field: string;
  value: any;
}

export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'select' | 'checkbox' | 'telefone' | 'cpfcnpj' | 'endereco' | 'multiselect' | 'aviso';
  // 'aviso' is a non-interactive label displayed in the dynamic form
  // it does not render an input — only shows the label as informational text.
  // Add it to the allowed types.
  // NOTE: Update code that switches on field.type to handle 'aviso'.
  options?: string[]; // for select and multiselect
  condition?: FieldCondition;
  // If type === 'date', optional format selector
  dateFormat?: 'dd/mm/yyyy' | 'mm/yyyy';
  // If type === 'number', optional decimals setting (e.g. 2 for fixed two decimals)
  numberDecimals?: number | null;
}

export interface TemplateLogicItem {
  condition: FieldCondition;
  text: string;
  // Optional extra fields to inject into the form when this logic block is active
  injectFields?: TemplateField[];
}

export interface Template {
  id: number;
  title: string;
  template: string;
  fields: TemplateField[];
  template_logic?: { [key: string]: TemplateLogicItem };
  // Notas e FAQ para este modelo (opcionais)
  notes?: string;
  faq?: string;
  // Ordem de exibição do modelo (usado para enumeração)
  order?: number;
}

export interface Atendimento {
  id: number;
  templateId: number;
  templateTitle: string;
  formData: { [key: string]: any };
  generatedText: string;
  createdAt: string;
}
