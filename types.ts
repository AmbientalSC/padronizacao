
export interface FieldCondition {
  field: string;
  value: any;
}

export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'select' | 'checkbox';
  options?: string[]; // for select
  condition?: FieldCondition;
}

export interface TemplateLogicItem {
  condition: FieldCondition;
  text: string;
}

export interface Template {
  id: number;
  title: string;
  template: string;
  fields: TemplateField[];
  template_logic?: { [key: string]: TemplateLogicItem };
}
