import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Template, TemplateField, TemplateLogicItem, FieldCondition } from '../types';
import ConfirmModal from './ConfirmModal';

interface ManagerProps {
  templates: Template[];
  addTemplate: (template: Omit<Template, 'id'>) => Promise<{ success: boolean; error?: any }>;
  updateTemplate: (templateId: string | number, updatedData: Partial<Template>) => Promise<{ success: boolean; error?: any }>;
  deleteTemplate: (templateId: string | number) => Promise<{ success: boolean; error?: any }>;
}

const emptyTemplate: Omit<Template, 'id'> = {
  title: '',
  template: '',
  fields: [],
  template_logic: {}
};

const Manager: React.FC<ManagerProps> = ({ templates, addTemplate, updateTemplate, deleteTemplate }) => {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateTextBuffer, setTemplateTextBuffer] = useState<string>(''); // buffer for debounced template text
  const templateTextTimerRef = React.useRef<any>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [activeTab, setActiveTab] = useState<'content' | 'notes' | 'test' | 'organize'>('content');
  const [testFormData, setTestFormData] = useState<Record<string, any>>({});
  const [validationState, setValidationState] = useState<{ open: boolean; errors: string[]; fieldErrors: Record<string, string[]> }>({ open: false, errors: [], fieldErrors: {} });
  const [draggedItem, setDraggedItem] = useState<Template | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (templateTextTimerRef.current) {
        clearTimeout(templateTextTimerRef.current);
      }
    };
  }, []);

  // Templates ordenados por order (enumeração) ou alfabeticamente se não tiver order
  const sortedTemplates = useMemo(() => {
    return [...templates]
      .map((template, index) => ({
        ...template,
        order: template.order ?? index + 1
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [templates]);

  const handleCreateNew = () => {
    // Calcula o próximo número da sequência
    const maxOrder = Math.max(0, ...templates.map(t => t.order || 0));
    const nextOrder = maxOrder + 1;
    
    // Use negative timestamp for local-only new templates to avoid colliding with Firestore positive ids
    setEditingTemplate({ 
      ...emptyTemplate, 
      id: -Date.now(), 
      template_logic: {},
      order: nextOrder 
    });
  };

  const handleSelectForEdit = (template: Template) => {
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
  };
  
  const handleCancel = () => {
    setEditingTemplate(null);
  };

  // Client-side validation helper for templates
  const validateTemplate = (tpl: Template | null): { valid: boolean; errors: string[]; fieldErrors: Record<string, string[]> } => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string[]> = {};
    const addFieldError = (key: string, msg: string) => {
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(msg);
      errors.push(msg);
    };

    if (!tpl) {
      errors.push('Template inválido.');
      return { valid: false, errors, fieldErrors };
    }

    if (!tpl.title || tpl.title.trim() === '') {
      addFieldError('title', 'Título do modelo é obrigatório.');
    }

    // fields validation
    const names = new Set<string>();
    tpl.fields?.forEach((f, idx) => {
      const key = `field:${f.name || idx}`;
      if (!f.name || String(f.name).trim() === '') {
        addFieldError(key, `Campo #${idx + 1}: nome (name) é obrigatório.`);
      } else {
        const validName = /^[a-zA-Z0-9_]+$/.test(String(f.name));
        if (!validName) addFieldError(key, `Campo '${f.name}': o nome deve conter apenas letras, números ou underscore.`);
        if (names.has(f.name)) addFieldError(key, `Campo '${f.name}': nome duplicado.`);
        names.add(f.name);
      }

      if (!f.label || String(f.label).trim() === '') {
        addFieldError(key, `Campo '${f.name || idx + 1}': label é obrigatório.`);
      }

      if (f.type === 'select') {
        if (!Array.isArray(f.options) || f.options.length === 0 || f.options.every(o => String(o).trim() === '')) {
          addFieldError(key, `Campo '${f.name}': seleções devem ter pelo menos uma opção não vazia.`);
        }
      }
    });

    // template_logic validation
    if (tpl.template_logic) {
      // Collect all valid field names: base fields + injected fields from all logic items
      const allValidFieldNames = new Set<string>();
      tpl.fields?.forEach(f => allValidFieldNames.add(f.name));
      Object.values(tpl.template_logic).forEach((li: any) => {
        if (Array.isArray(li.injectFields)) {
          li.injectFields.forEach((inf: any) => {
            if (inf.name) allValidFieldNames.add(inf.name);
          });
        }
      });

      Object.entries(tpl.template_logic).forEach(([key, item]) => {
        const logicKey = `logic:${key}`;
        if (!key || String(key).trim() === '' || key === 'true' || key === 'false') {
          addFieldError(logicKey, `Chave de bloco inválida: '${key}'.`);
        }
        if (!item || !item.condition) {
          addFieldError(logicKey, `Bloco '${key}': condição é obrigatória.`);
        } else {
          const condField = item.condition.field;
          if (!condField || String(condField).trim() === '') {
            addFieldError(logicKey, `Bloco '${key}': condição deve referenciar um campo válido.`);
          }
          // Note: We do NOT validate if condField exists in fields/injected fields.
          // This allows placeholders to be used for conditional text insertion without
          // requiring a corresponding field definition. The condition.field can be any
          // identifier that will be evaluated at runtime based on formData.
        }

        if (item.injectFields) {
          item.injectFields.forEach((inf, i) => {
            const infKey = `inject:${key}:${inf.name || i}`;
            if (!inf.name || String(inf.name).trim() === '') addFieldError(infKey, `Bloco '${key}': injected field #${i + 1} precisa de um nome.`);
            if (!inf.label || String(inf.label).trim() === '') addFieldError(infKey, `Bloco '${key}': injected field '${inf.name || i + 1}' precisa de um label.`);
            if (inf.type === 'select') {
              if (!Array.isArray(inf.options) || inf.options.length === 0) addFieldError(infKey, `Bloco '${key}': injected field '${inf.name}' do tipo select precisa de opções.`);
            }
          });
        }
      });
    }

    return { valid: errors.length === 0, errors, fieldErrors };
  };

  // Funções de drag & drop
  const handleDragStart = (e: React.DragEvent, template: Template) => {
    setDraggedItem(template);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (!draggedItem) return;

    const reorderedTemplates = [...sortedTemplates];
    const draggedIndex = reorderedTemplates.findIndex(t => t.id === draggedItem.id);
    
    if (draggedIndex === targetIndex) return;

    // Remove item da posição original
    reorderedTemplates.splice(draggedIndex, 1);
    // Insere na nova posição
    reorderedTemplates.splice(targetIndex, 0, draggedItem);

    // Atualiza as ordens
    for (let i = 0; i < reorderedTemplates.length; i++) {
      const template = reorderedTemplates[i];
      const newOrder = i + 1;
      if (template.order !== newOrder) {
        await updateTemplate(template.id, { order: newOrder });
      }
    }

    setDraggedItem(null);
  };

  const handleDelete = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Modelo',
      message: 'Tem certeza que deseja excluir este modelo? Esta ação não pode ser desfeita e o modelo será removido permanentemente.',
      onConfirm: async () => {
  const result = await deleteTemplate(id);
        if (result.success) {
          if (editingTemplate?.id === id) {
            setEditingTemplate(null);
          }
        } else {
          alert('Erro ao excluir template. Tente novamente.');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleClone = (template: Template) => {
    // cria uma cópia local do template para edição; usa id negativo temporário
    const maxOrder = Math.max(0, ...templates.map(t => t.order || 0));
    const nextOrder = maxOrder + 1;
    const clone = JSON.parse(JSON.stringify(template));
    clone.id = -Date.now();
    clone.title = `${clone.title} (clone)`;
    clone.order = nextOrder;
    setEditingTemplate(clone);
  };

  const handleSave = async () => {
    if (!editingTemplate || !editingTemplate.title) {
        alert("O título do modelo é obrigatório.");
        return;
    }
    // Client-side validation before attempting to persist
    const validateResult = validateTemplate(editingTemplate);
    if (!validateResult.valid) {
      // open modal listing errors and mark fields
      setValidationState({ open: true, errors: validateResult.errors, fieldErrors: validateResult.fieldErrors });
      return;
    }
  // Determine se é novo: se o id não existe nos templates carregados
  const exists = templates.some(t => t.id.toString() === editingTemplate.id.toString());
  const isNewTemplate = !exists;

  if (isNewTemplate) {
      const { id, ...templateData } = editingTemplate;
      // Trim options values (remove leading/trailing spaces) before saving
      const sanitized = JSON.parse(JSON.stringify(templateData));
      if (sanitized.fields) {
        sanitized.fields = sanitized.fields.map((f: TemplateField) => ({
          ...f,
          options: Array.isArray(f.options) ? f.options.map((o: string) => (typeof o === 'string' ? o.trim() : o)) : f.options
        }));
      }
      const result = await addTemplate(sanitized);
      if (!result.success) {
        console.error('Erro ao criar template:', result.error);
        alert(`Erro ao criar template: ${result.error?.message || String(result.error) || 'Tente novamente.'}`);
        return;
      }
    } else {
      // Trim options values before updating
      const sanitizedUpdate = JSON.parse(JSON.stringify(editingTemplate));
      if (sanitizedUpdate.fields) {
        sanitizedUpdate.fields = sanitizedUpdate.fields.map((f: TemplateField) => ({
          ...f,
          options: Array.isArray(f.options) ? f.options.map((o: string) => (typeof o === 'string' ? o.trim() : o)) : f.options
        }));
      }
      const result = await updateTemplate(editingTemplate.id, sanitizedUpdate);
      if (!result.success) {
        console.error('Erro ao atualizar template:', result.error);
        alert(`Erro ao atualizar template: ${result.error?.message || String(result.error) || 'Tente novamente.'}`);
        return;
      }
    }
    
    setEditingTemplate(null);
  };

  const handleTemplateTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!editingTemplate) return;
    const newTemplateText = e.target.value;
    
    // Update template text immediately for responsive typing
    setEditingTemplate(prev => prev ? { ...prev, template: newTemplateText } : null);
    
    // Debounce the field extraction to avoid creating partial placeholders
    if (templateTextTimerRef.current) {
      clearTimeout(templateTextTimerRef.current);
    }
    
    templateTextTimerRef.current = setTimeout(() => {
      // Extract placeholders only after user stops typing for 500ms
      const placeholders = [...new Set([...newTemplateText.matchAll(/{{(.*?)}}/g)].map(match => match[1]))];

      // Update fields: add new placeholders as fields, and remove auto-created fields
      // that no longer have a corresponding placeholder. We only remove fields that
      // were auto-created by this editor (heuristic: label === name && type === 'text')
      // to avoid deleting user-customized fields unexpectedly.
      setEditingTemplate(prev => {
        if (!prev) return null;

        const existingFieldNames = new Set(prev.fields.map(f => f.name));
        const logicPlaceholders = new Set(prev.template_logic ? Object.keys(prev.template_logic) : []);

        // New fields to add for placeholders that don't exist yet
        const fieldsToAdd: TemplateField[] = placeholders
          .filter(p => !existingFieldNames.has(p) && !logicPlaceholders.has(p))
          .map((name): TemplateField => ({ name, label: name, type: 'text' }));

        // Remove only auto-created fields (label === name && type === 'text') that
        // are no longer present as placeholders and are not logic placeholders.
        const filteredExisting = prev.fields.filter(f => {
          // Heuristic for "auto-created" fields:
          // - type === 'text' AND (label equals name OR label is empty/blank)
          // This covers cases where the user never customized the label, or cleared it.
          const labelStr = f.label == null ? '' : String(f.label);
          const isAutoCreated = f.type === 'text' && (labelStr.trim() === '' || labelStr === f.name);
          const stillReferenced = placeholders.includes(f.name) || logicPlaceholders.has(f.name);
          if (isAutoCreated && !stillReferenced) return false; // drop it
          return true;
        });

        const updatedFields = [...filteredExisting, ...fieldsToAdd];
        return { ...prev, fields: updatedFields };
      });
    }, 500);
  };

  const handleFieldChange = (index: number, fieldData: Partial<TemplateField>) => {
    if (!editingTemplate) return;

    const updatedFields = [...editingTemplate.fields];
    updatedFields[index] = { ...updatedFields[index], ...fieldData };

    // Só remove options se o tipo está sendo explicitamente mudado para algo diferente de 'select' ou 'multiselect'
    if (fieldData.type !== undefined && fieldData.type !== 'select' && fieldData.type !== 'multiselect') {
      delete updatedFields[index].options;
    }
    // Remove numberDecimals se o tipo foi mudado para algo diferente de 'number'
    if (fieldData.type !== undefined && fieldData.type !== 'number') {
      delete updatedFields[index].numberDecimals;
    }

  // debug logs removed after fix

    setEditingTemplate(prev => prev ? { ...prev, fields: updatedFields } : null);
  };

  // Remove label for a field (by name) and also remove its placeholder from the template text.
  // Uses the field name so it doesn't depend on array indices that may shift.
  const handleRemoveLabelByName = (fieldName: string) => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev));

      const name = String(fieldName);
      // Remove occurrences of the placeholder {{name}} from the template text
      const placeholderRe = new RegExp('{{\\s*' + name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\s*}}', 'g');
      copy.template = (copy.template || '').replace(placeholderRe, '');

      // Remove any field(s) with this name (user requested removing the block)
      copy.fields = copy.fields.filter((fld: any) => String(fld.name) !== name);

      return copy;
    });
  };

  const handleFieldConditionChange = (fieldIndex: number, conditionData: Partial<FieldCondition> | null) => {
      if (!editingTemplate) return;

      const updatedFields = [...editingTemplate.fields];
      const field = updatedFields[fieldIndex];

      if (conditionData === null) {
          delete field.condition;
      } else {
          field.condition = {
              ...(field.condition || { field: '', value: '' }),
              ...conditionData
          };
      }
      
      setEditingTemplate(prev => prev ? { ...prev, fields: updatedFields } : null);
  };

  // Drag & drop state and handlers for organizing fields
  const [draggedFieldName, setDraggedFieldName] = useState<string | null>(null);
  const [dragOverFieldName, setDragOverFieldName] = useState<string | null>(null);

  const handleFieldDragStart = (e: React.DragEvent, name: string) => {
    setDraggedFieldName(name);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFieldDragOver = (e: React.DragEvent, name: string) => {
    e.preventDefault();
    setDragOverFieldName(name);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFieldDragLeave = (_e: React.DragEvent) => {
    setDragOverFieldName(null);
  };

  const handleFieldDrop = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    const dragged = draggedFieldName;
    setDraggedFieldName(null);
    setDragOverFieldName(null);
    if (!dragged || dragged === targetName) return;
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev));
      const all = copy.fields || [];
      const from = all.findIndex((f: any) => f.name === dragged);
      const to = all.findIndex((f: any) => f.name === targetName);
      if (from === -1 || to === -1) return copy;
      const item = all.splice(from, 1)[0];
      const insertIndex = from < to ? to - 1 : to;
      all.splice(insertIndex, 0, item);
      copy.fields = all;
      return copy;
    });
  };

  // Move a base (non-injected) field up in the editingTemplate.fields order
  const moveFieldUp = (fieldName: string) => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev));
      // build injected names set
      const injectedNames = new Set<string>();
      if (copy.template_logic) {
        Object.values(copy.template_logic).forEach((li: any) => {
          if (Array.isArray(li.injectFields)) li.injectFields.forEach((f: any) => injectedNames.add(f.name));
        });
      }
      // find index of this field among all fields
      const all = copy.fields || [];
      const idx = all.findIndex((f: any) => f.name === fieldName);
      if (idx <= 0) return copy;
      // find previous non-injected index
      let prevIdx = idx - 1;
      while (prevIdx >= 0 && injectedNames.has(all[prevIdx].name)) prevIdx--;
      if (prevIdx < 0) return copy;
      // swap
      const tmp = all[prevIdx];
      all[prevIdx] = all[idx];
      all[idx] = tmp;
      copy.fields = all;
      return copy;
    });
  };

  // Move a base (non-injected) field down in the editingTemplate.fields order
  const moveFieldDown = (fieldName: string) => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev));
      const injectedNames = new Set<string>();
      if (copy.template_logic) {
        Object.values(copy.template_logic).forEach((li: any) => {
          if (Array.isArray(li.injectFields)) li.injectFields.forEach((f: any) => injectedNames.add(f.name));
        });
      }
      const all = copy.fields || [];
      const idx = all.findIndex((f: any) => f.name === fieldName);
      if (idx === -1 || idx >= all.length - 1) return copy;
      // find next non-injected index
      let nextIdx = idx + 1;
      while (nextIdx < all.length && injectedNames.has(all[nextIdx].name)) nextIdx++;
      if (nextIdx >= all.length) return copy;
      const tmp = all[nextIdx];
      all[nextIdx] = all[idx];
      all[idx] = tmp;
      copy.fields = all;
      return copy;
    });
  };

  const handleAddTemplateLogic = () => {
    if (!editingTemplate) return;
    const newKey = `nova_logica_${Object.keys(editingTemplate.template_logic || {}).length + 1}`;
    const newLogicItem: TemplateLogicItem = {
        condition: { field: '', value: '' },
        text: ''
    };
    setEditingTemplate(prev => {
        if (!prev) return null;
        return {
            ...prev,
            template_logic: {
                ...(prev.template_logic || {}),
                [newKey]: newLogicItem
            }
        };
    });
  };

  const handleRemoveTemplateLogic = (key: string) => {
      if (!editingTemplate) return;
      setEditingTemplate(prev => {
          if (!prev || !prev.template_logic) return prev;
          const newLogic = { ...prev.template_logic };
          delete newLogic[key];
          return { ...prev, template_logic: newLogic };
      });
  };

  const handleTemplateLogicChange = (oldKey: string, newKey: string, itemData: Partial<TemplateLogicItem> | {condition: Partial<FieldCondition>}) => {
      if (!editingTemplate) return;
      // Validate newKey if provided: it must be a non-empty string and not 'true'/'false'
      if (newKey && (newKey.trim() === '' || newKey === 'true' || newKey === 'false')) {
        alert('Chave inválida para placeholder. Escolha um nome alfanumérico válido (ex: info_credito).');
        return;
      }

      setEditingTemplate(prev => {
          if (!prev || !prev.template_logic) return prev;
      // Se o usuário tentou renomear para uma chave que já existe, bloquear para evitar sobrescrever
      if (newKey && newKey !== oldKey && prev.template_logic[newKey]) {
        alert('Já existe um bloco com esse placeholder. Escolha outro nome.');
        return prev;
      }

      const newLogic = { ...prev.template_logic };
      const item = newLogic[oldKey];
      if (!item) return prev;

      // Merge updates (support injectFields updates)
      let updatedItem: any = { ...item };
      if ('condition' in itemData && typeof itemData.condition === 'object') {
        updatedItem.condition = { ...item.condition, ...itemData.condition };
      }
      if ('text' in itemData) {
        updatedItem.text = (itemData as any).text;
      }
      if ('injectFields' in itemData) {
        updatedItem.injectFields = (itemData as any).injectFields;
      }

      if (oldKey !== newKey && newKey) {
        delete newLogic[oldKey];
      }
      newLogic[newKey || oldKey] = updatedItem as TemplateLogicItem;

      return { ...prev, template_logic: newLogic };
      });
  };

  const renderConditionUI = (
    condition: FieldCondition | undefined,
    onchange: (data: Partial<FieldCondition> | null) => void,
    fieldSource: TemplateField[],
    context: string,
    injectFields?: TemplateField[],
    onInjectFieldsChange?: (arr: TemplateField[]) => void
  ) => {
    if (!condition) {
        return <button onClick={() => onchange({field: '', value: ''})} className="text-sm text-green-600 hover:text-green-800">+ Adicionar condição de visibilidade</button>
    }
    
    const conditionSourceField = fieldSource.find(f => f.name === condition.field);

    return (
        <div className="mt-2 p-3 bg-gray-100 rounded-md border">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">Condição de Visibilidade</p>
                <button onClick={() => onchange(null)} className="text-xs text-red-500 hover:text-red-700">Remover</button>
            </div>
            <div className="flex items-center space-x-2 mt-2">
                <span className="text-sm">Exibir se</span>
                <select 
                    value={condition.field} 
                    onChange={e => onchange({ field: e.target.value })} 
                    className="block w-full px-2 py-1 text-sm border-gray-300 rounded-md"
                >
                    <option value="">Selecione o campo...</option>
                    {fieldSource.map(f => <option key={`${context}-${f.name}`} value={f.name}>{f.label || f.name}</option>)}
                </select>
                <span className="text-sm">for</span>

                {!conditionSourceField || conditionSourceField.type === 'text' || conditionSourceField.type === 'number' || conditionSourceField.type === 'date' || conditionSourceField.type === 'email' || conditionSourceField.type === 'textarea' ? (
                    <input type="text" value={condition.value} onChange={e => onchange({ value: e.target.value })} className="block w-full px-2 py-1 text-sm border-gray-300 rounded-md"/>
                ) : conditionSourceField.type === 'checkbox' ? (
                    <select value={String(condition.value)} onChange={e => onchange({ value: e.target.value === 'true' })} className="block w-full px-2 py-1 text-sm border-gray-300 rounded-md">
                        <option value="true">Marcado</option>
                        <option value="false">Desmarcado</option>
                    </select>
                ) : (conditionSourceField.type === 'select' || conditionSourceField.type === 'multiselect') ? (
                    <select value={condition.value} onChange={e => onchange({ value: e.target.value })} className="block w-full px-2 py-1 text-sm border-gray-300 rounded-md">
                        <option value="">Selecione a opção...</option>
                        {conditionSourceField.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : null}
            </div>
              {/* Injected fields editor (only shown when provided) */}
              {injectFields && onInjectFieldsChange && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Campos Injetados (exibidos quando o bloco estiver ativo)</p>
                    <button onClick={() => onInjectFieldsChange([...(injectFields || []), { name: `injetado_${Date.now()}`, label: 'Novo Campo', type: 'text' } as TemplateField])} className="text-sm text-green-600 hover:text-green-800">+ Adicionar campo</button>
                  </div>
                  {(injectFields || []).map((f: TemplateField, idx: number) => (
                    <div key={f.name || idx} className="grid grid-cols-3 gap-2 items-center mb-2">
                      <input type="text" value={f.name} onChange={e => {
                        const copy = JSON.parse(JSON.stringify(injectFields || []));
                        copy[idx].name = String(e.target.value).replace(/\s+/g, '_');
                        onInjectFieldsChange(copy);
                      }} className="px-2 py-1 border rounded font-mono" />
                      <input type="text" value={f.label} onChange={e => {
                        const copy = JSON.parse(JSON.stringify(injectFields || []));
                        copy[idx].label = e.target.value;
                        onInjectFieldsChange(copy);
                      }} className="px-2 py-1 border rounded" />
                      <div>
                        <select value={f.type} onChange={e => {
                          const copy = JSON.parse(JSON.stringify(injectFields || []));
                          const newType = e.target.value;
                          copy[idx].type = newType;
                          if (newType !== 'number') delete copy[idx].numberDecimals;
                          if (newType !== 'select' && newType !== 'multiselect') delete copy[idx].options;
                          if (newType !== 'date') delete copy[idx].dateFormat;
                          onInjectFieldsChange(copy);
                        }} className="px-2 py-1 border rounded w-full">
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="date">Data</option>
                          <option value="email">Email</option>
                          <option value="textarea">Área de Texto</option>
                          <option value="select">Seleção</option>
                          <option value="multiselect">Multiseleção</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="telefone">Telefone</option>
                          <option value="cpfcnpj">CPF/CNPJ</option>
                          <option value="endereco">Endereço</option>
                        </select>
                        {f.type === 'number' && (
                          <div className="mt-1">
                            <label className="block text-xs font-medium text-gray-600">Casas Decimais</label>
                            <select value={f.numberDecimals ?? ''} onChange={e => {
                              const copy = JSON.parse(JSON.stringify(injectFields || []));
                              copy[idx].numberDecimals = e.target.value === '' ? null : Number(e.target.value);
                              onInjectFieldsChange(copy);
                            }} className="mt-1 px-2 py-1 border rounded text-sm w-full">
                              <option value="">Sem casas decimais</option>
                              <option value="2">2 casas decimais (fixo)</option>
                            </select>
                          </div>
                        )}
                        {(f.type === 'select' || f.type === 'multiselect') && (
                          <div className="mt-1">
                            <label className="block text-xs font-medium text-gray-600">Opções (separadas por vírgula)</label>
                            <input type="text" value={Array.isArray(f.options) ? f.options.join(',') : (f.options || '')} onChange={e => {
                              const copy = JSON.parse(JSON.stringify(injectFields || []));
                              copy[idx].options = String(e.target.value).split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
                              onInjectFieldsChange(copy);
                            }} className="mt-1 block w-full px-2 py-1 text-sm rounded-md border border-gray-300" />
                          </div>
                        )}
                        {f.type === 'date' && (
                          <div className="mt-1">
                            <label className="block text-xs font-medium text-gray-600">Formato da Data</label>
                            <select value={f.dateFormat || 'dd/mm/yyyy'} onChange={e => {
                              const copy = JSON.parse(JSON.stringify(injectFields || []));
                              copy[idx].dateFormat = e.target.value;
                              onInjectFieldsChange(copy);
                            }} className="mt-1 block w-full pl-2 pr-8 py-1 text-sm border-gray-300 rounded-md">
                              <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                              <option value="mm/yyyy">mm/yyyy</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <button onClick={() => {
                          const copy = JSON.parse(JSON.stringify(injectFields || []));
                          copy.splice(idx, 1);
                          onInjectFieldsChange(copy);
                        }} className="text-red-600 text-sm">Remover</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
    )
  }

  const renderEditForm = () => {
    if (!editingTemplate) return null;

    const generateTestPreview = () => {
      if (!editingTemplate) return '';
      let output = editingTemplate.template || '';

      // Process template logic: insert block text when condition matches
      if (editingTemplate.template_logic) {
        Object.keys(editingTemplate.template_logic).forEach(logicKey => {
          const logicItem = editingTemplate.template_logic![logicKey];
          const condField = logicItem.condition?.field;
          const condVal = logicItem.condition?.value;
          const formVal = testFormData[condField];
          let active = false;
          if (editingTemplate.fields.some(f => f.name === condField && f.type === 'checkbox')) {
            // boolean-ish
            const toBool = (v: any) => {
              if (v === true || v === 'true' || v === 1 || v === '1') return true;
              if (v === false || v === 'false' || v === 0 || v === '0') return false;
              return Boolean(v);
            };
            if (condVal != null) active = toBool(formVal) === toBool(condVal);
          } else {
            const a = formVal == null ? '' : String(formVal).trim();
            const b = condVal == null ? '' : String(condVal).trim();
            active = a === b;
          }

          const insertText = active ? logicItem.text || '' : '';
          output = output.replace(new RegExp(`{{${logicKey}}}`, 'g'), insertText);
        });
      }

      // Remove placeholders for injected fields that are not active
      if (editingTemplate.template_logic) {
        const allInjected: string[] = [];
        const activeInjected = new Set<string>();
        Object.values(editingTemplate.template_logic).forEach((li: any) => {
          if (Array.isArray(li.injectFields)) li.injectFields.forEach((f: any) => allInjected.push(f.name));
          const condField = li.condition?.field;
          const condVal = li.condition?.value;
          const formVal = testFormData[condField];
          const a = formVal == null ? '' : String(formVal).trim();
          const b = condVal == null ? '' : String(condVal).trim();
          const sourceField = editingTemplate.fields.find((f:any) => f.name === condField);
          let isActive = false;
          if (sourceField && sourceField.type === 'checkbox') {
            if (condVal != null) {
              const toBool = (v: any) => (v === true || v === 'true' || v === 1 || v === '1');
              isActive = toBool(formVal) === toBool(condVal);
            }
          } else {
            isActive = a === b;
          }
          if (isActive && Array.isArray(li.injectFields)) li.injectFields.forEach((f: any) => activeInjected.add(f.name));
        });
        allInjected.forEach(name => {
          if (!activeInjected.has(name)) {
            output = output.replace(new RegExp(`{{${name}}}`, 'g'), '');
          }
        });
      }

      // Replace normal placeholders with testFormData
      Object.keys(testFormData).forEach(k => {
        const v = testFormData[k];
        const rep = v == null ? '' : String(v);
        output = output.replace(new RegExp(`{{${k}}}`, 'g'), rep);
      });

      return output;
    };

    const otherFields = editingTemplate.fields;
    const allFieldsForLogic = editingTemplate.fields;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 sticky top-0 bg-white border-b z-10">
                    <h2 className="text-2xl font-bold text-gray-800">{editingTemplate.id < 0 ? 'Criar Novo Modelo' : 'Editar Modelo'}</h2>
                </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-4 mb-4">
            <button onClick={() => setActiveTab('content')} className={`px-3 py-1 text-sm font-medium rounded ${activeTab === 'content' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Conteúdo</button>
            <button onClick={() => setActiveTab('organize')} className={`px-3 py-1 text-sm font-medium rounded ${activeTab === 'organize' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Organizar Campos</button>
            <button onClick={() => setActiveTab('notes')} className={`px-3 py-1 text-sm font-medium rounded ${activeTab === 'notes' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Anotações</button>
            <button onClick={() => setActiveTab('test')} className={`px-3 py-1 text-sm font-medium rounded ${activeTab === 'test' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Testar Modelo</button>
          </div>
      {activeTab === 'test' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">Testar Modelo</h3>
              <p className="text-sm text-gray-500 mb-4">Preencha valores de exemplo para ver como o template ficará ao gerar o texto.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {(editingTemplate.fields || []).map(f => (
                  <div key={`test-${f.name}`}>
                    <label className="block text-xs font-medium text-gray-600">{f.label || f.name}</label>
                    <input type="text" className="mt-1 block w-full px-2 py-1 border rounded" value={testFormData[f.name] || ''} onChange={e => setTestFormData(prev => ({ ...prev, [f.name]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="bg-white p-4 rounded border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Preview de Teste</h4>
                  <button onClick={() => {
                    // simple copy
                    navigator.clipboard.writeText(generateTestPreview());
                  }} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Copiar</button>
                </div>
                <textarea readOnly value={generateTestPreview()} className="w-full min-h-[10rem] p-2 border rounded font-mono text-sm" />
              </div>
            </div>
          )}

          {activeTab === 'content' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Título do Modelo</label>
                <input
                  type="text"
                  placeholder="Ex: Atendimento para 2ª via do carnê"
                  value={editingTemplate.title}
                  onChange={e => setEditingTemplate(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className={`mt-1 block w-full px-3 py-2 bg-white rounded-md shadow-sm ${validationState.fieldErrors['title'] ? 'border-red-500 border' : 'border border-gray-300'}`}
                />
                {validationState.fieldErrors['title'] && (
                  <p className="text-xs text-red-600 mt-1">{validationState.fieldErrors['title'].join('; ')}</p>
                )}
              </div>

              {/* FIX: Wrapped string with `{{...}}` in a JSX expression to prevent parsing errors. */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{'Template de Texto (use `{{placeholder}}`)'}</label>
                <textarea
                  rows={6}
                  placeholder="Ex: O SR. {{nome}} ({{vinculo}}) compareceu para... {{info_credito}}"
                  value={editingTemplate.template}
                  onChange={handleTemplateTextChange}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm font-mono"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-700 mt-6 border-b pb-2 mb-4">Configuração dos Campos do Formulário</h3>
                {editingTemplate.fields.length > 0 ? (
                  <div className="space-y-6">
                    {editingTemplate.fields.map((field, index) => (
                      <div key={field.name || index} className="p-4 border rounded-md bg-gray-50">
                        <p className="font-semibold font-mono text-green-700 mb-2">{`{{${field.name}}}`}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600">Label do Campo</label>
                            <div className="flex items-center space-x-2">
                              <input type="text" value={field.label} onChange={e => handleFieldChange(index, { label: e.target.value })} className={`mt-1 block w-full px-2 py-1 text-sm rounded-md ${validationState.fieldErrors[`field:${field.name || index}`] ? 'border-red-500 border' : 'border border-gray-300'}`}/>
                              <button type="button" onClick={() => handleRemoveLabelByName(field.name)} className="mt-1 text-xs text-red-500 hover:text-red-700">Remover</button>
                            </div>
                            {validationState.fieldErrors[`field:${field.name || index}`] && (
                              <p className="text-xs text-red-600 mt-1">{validationState.fieldErrors[`field:${field.name || index}`].join('; ')}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">Tipo de Campo</label>
                            <select value={field.type} onChange={e => handleFieldChange(index, { type: e.target.value as TemplateField['type'] })} className="mt-1 block w-full pl-2 pr-8 py-1 text-sm border-gray-300 rounded-md">
                              <option value="text">Texto</option>
                              <option value="number">Número</option>
                              <option value="date">Data</option>
                              <option value="email">Email</option>
                              <option value="textarea">Área de Texto</option>
                              <option value="select">Seleção</option>
                              <option value="multiselect">Multiseleção</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="telefone">Telefone</option>
                              <option value="cpfcnpj">CPF/CNPJ</option>
                              <option value="endereco">Endereço</option>
                            </select>
                            {field.type === 'date' && (
                              <div className="mt-2">
                                <label className="block text-xs font-medium text-gray-600">Formato da Data</label>
                                <select value={field.dateFormat || 'dd/mm/yyyy'} onChange={e => handleFieldChange(index, { dateFormat: e.target.value as any })} className="mt-1 block w-full pl-2 pr-8 py-1 text-sm border-gray-300 rounded-md">
                                  <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                                  <option value="mm/yyyy">mm/yyyy</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Escolha entre data completa (dia/mês/ano) ou apenas mês/ano.</p>
                              </div>
                            )}
                              {field.type === 'number' && (
                                <div className="mt-2">
                                  <label className="block text-xs font-medium text-gray-600">Casas Decimais</label>
                                  <select
                                    value={field.numberDecimals ?? ''}
                                    onChange={e => handleFieldChange(index, { numberDecimals: e.target.value === '' ? null : Number(e.target.value) })}
                                    className="mt-1 block w-full pl-2 pr-8 py-1 text-sm border-gray-300 rounded-md"
                                  >
                                    <option value="">Sem casas decimais</option>
                                    <option value="2">2 casas decimais (fixo)</option>
                                  </select>
                                  <p className="text-xs text-gray-500 mt-1">Escolha se este campo deve armazenar um valor com casas decimais fixas.</p>
                                </div>
                              )}
                          </div>
                          {(field.type === 'select' || field.type === 'multiselect') && (
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-600">Opções (separadas por vírgula)</label>
                              <input
                                type="text"
                                value={field.options?.join(',') || ''}
                                onChange={e => {
                                  // Split by comma and trim each option to remove leading/trailing spaces
                                  handleFieldChange(index, { options: e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0) });
                                }}
                                className={`mt-1 block w-full px-2 py-1 text-sm rounded-md ${validationState.fieldErrors[`field:${field.name || index}`] ? 'border-red-500 border' : 'border border-gray-300'}`}
                              />
                              {validationState.fieldErrors[`field:${field.name || index}`] && (
                                <p className="text-xs text-red-600 mt-1">{validationState.fieldErrors[`field:${field.name || index}`].join('; ')}</p>
                              )}
                            </div>
                          )}
                        </div>
                        {renderConditionUI(field.condition, (data) => handleFieldConditionChange(index, data), otherFields.filter(f => f.name !== field.name), `field-${index}`)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{'Nenhum campo de formulário detectado no template. Placeholders como `{{nome}}` se tornarão campos.'}</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-700 mt-6 border-b pb-2 mb-4">Blocos de Texto Condicionais</h3>
                <div className="space-y-4">
                  {editingTemplate.template_logic && Object.entries(editingTemplate.template_logic).map(([key, item]) => (
                    <div key={key} className="p-4 border rounded-md bg-blue-50">
                      <div className="flex justify-end">
                        <button onClick={() => handleRemoveTemplateLogic(key)} className="text-xs text-red-500 hover:text-red-700">Remover Bloco</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Placeholder a Substituir</label>
                          <input type="text" defaultValue={key} onBlur={e => handleTemplateLogicChange(key, e.target.value, {})} className={`mt-1 block w-full px-2 py-1 text-sm rounded-md font-mono ${validationState.fieldErrors[`logic:${key}`] ? 'border-red-500 border' : 'border border-gray-300'}`} placeholder="ex: info_credito"/>
                          {validationState.fieldErrors[`logic:${key}`] && (
                            <p className="text-xs text-red-600 mt-1">{validationState.fieldErrors[`logic:${key}`].join('; ')}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600">Texto a ser Inserido</label>
                            <textarea value={(item as TemplateLogicItem).text} onChange={e => handleTemplateLogicChange(key, key, {text: e.target.value})} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded-md font-mono" rows={3}></textarea>
                        </div>
                      </div>
                        {renderConditionUI((item as TemplateLogicItem).condition, (data) => handleTemplateLogicChange(key, key, {condition: data || {field: '', value: ''}}), allFieldsForLogic, `logic-${key}`)}
                        {/* Injected fields UI */}
                        <div className="mt-3 p-3 bg-white rounded border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-700">Campos Injetados (exibidos quando o bloco estiver ativo)</p>
                            <button onClick={() => {
                              const existing = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                              const newField = { name: `injetado_${Date.now()}`, label: 'Novo Campo', type: 'text' } as TemplateField;
                              handleTemplateLogicChange(key, key, { injectFields: [...existing, newField] } as any);
                            }} className="text-sm text-green-600 hover:text-green-800">+ Adicionar campo</button>
                          </div>
                          {((editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || []).map((f: TemplateField, idx: number) => (
                            <div key={f.name || idx} className="grid grid-cols-3 gap-2 items-center mb-2">
                              <input type="text" value={f.name} onChange={e => {
                                const arr = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                                const copy = JSON.parse(JSON.stringify(arr));
                                // sanitize name: remove spaces
                                copy[idx].name = String(e.target.value).replace(/\s+/g, '_');
                                handleTemplateLogicChange(key, key, { injectFields: copy } as any);
                              }} className="px-2 py-1 border rounded font-mono" />
                              <input type="text" value={f.label} onChange={e => {
                                const arr = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                                const copy = JSON.parse(JSON.stringify(arr));
                                copy[idx].label = e.target.value;
                                handleTemplateLogicChange(key, key, { injectFields: copy } as any);
                              }} className="px-2 py-1 border rounded" />
                              <select value={f.type} onChange={e => {
                                const arr = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                                const copy = JSON.parse(JSON.stringify(arr));
                                const newType = e.target.value;
                                copy[idx].type = newType;
                                // cleanup type-specific props
                                if (newType !== 'number') delete copy[idx].numberDecimals;
                                if (newType !== 'select') delete copy[idx].options;
                                if (newType !== 'date') delete copy[idx].dateFormat;
                                if (newType !== 'select' && newType !== 'multiselect') delete copy[idx].options;
                                handleTemplateLogicChange(key, key, { injectFields: copy } as any);
                              }} className="px-2 py-1 border rounded">
                                <option value="text">Texto</option>
                                <option value="number">Número</option>
                                <option value="date">Data</option>
                                <option value="email">Email</option>
                                <option value="textarea">Área de Texto</option>
                                <option value="select">Seleção</option>
                                <option value="multiselect">Multiseleção</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="telefone">Telefone</option>
                                <option value="cpfcnpj">CPF/CNPJ</option>
                                <option value="endereco">Endereço</option>
                              </select>
                              {f.type === 'number' && (
                                <div className="mt-1">
                                  <label className="block text-xs font-medium text-gray-600">Casas Decimais</label>
                                  <select
                                    value={f.numberDecimals ?? ''}
                                    onChange={e => {
                                      const arr = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                                      const copy = JSON.parse(JSON.stringify(arr));
                                      copy[idx].numberDecimals = e.target.value === '' ? null : Number(e.target.value);
                                      handleTemplateLogicChange(key, key, { injectFields: copy } as any);
                                    }}
                                    className="mt-1 px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="">Sem casas decimais</option>
                                    <option value="2">2 casas decimais (fixo)</option>
                                  </select>
                                </div>
                              )}
                              {(f.type === 'select' || f.type === 'multiselect') && (
                                <div className="md:col-span-3 mt-2">
                                  <label className="block text-xs font-medium text-gray-600">Opções (separadas por vírgula)</label>
                                  <input
                                    type="text"
                                    value={Array.isArray(f.options) ? f.options.join(',') : (f.options || '')}
                                    onChange={e => {
                                      const arr = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                                      const copy = JSON.parse(JSON.stringify(arr));
                                      // Split and trim each option to remove spaces
                                      copy[idx].options = String(e.target.value).split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
                                      handleTemplateLogicChange(key, key, { injectFields: copy } as any);
                                    }}
                                    className="mt-1 block w-full px-2 py-1 text-sm rounded-md border border-gray-300"
                                  />
                                </div>
                              )}
                              {f.type === 'date' && (
                                <div className="md:col-span-3 mt-2">
                                  <label className="block text-xs font-medium text-gray-600">Formato da Data</label>
                                  <select
                                    value={f.dateFormat || 'dd/mm/yyyy'}
                                    onChange={e => {
                                      const arr = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                                      const copy = JSON.parse(JSON.stringify(arr));
                                      copy[idx].dateFormat = e.target.value;
                                      handleTemplateLogicChange(key, key, { injectFields: copy } as any);
                                    }}
                                    className="mt-1 block w-full pl-2 pr-8 py-1 text-sm border-gray-300 rounded-md"
                                  >
                                    <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                                    <option value="mm/yyyy">mm/yyyy</option>
                                  </select>
                                </div>
                              )}
                              <div className="text-right">
                                <button onClick={() => {
                                  const arr = (editingTemplate?.template_logic && editingTemplate.template_logic[key] && (editingTemplate.template_logic[key] as any).injectFields) || [];
                                  const copy = JSON.parse(JSON.stringify(arr));
                                  copy.splice(idx, 1);
                                  handleTemplateLogicChange(key, key, { injectFields: copy } as any);
                                }} className="text-red-600 text-sm">Remover</button>
                              </div>
                            </div>
                          ))}
                        </div>
                    </div>
                  ))}
                  <button onClick={handleAddTemplateLogic} className="text-sm text-green-600 hover:text-green-800">+ Adicionar bloco de texto condicional</button>
                </div>
              </div>
            </>
          ) : activeTab === 'organize' ? (
            <>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">Organizar Campos</h3>
                <p className="text-sm text-gray-500 mb-4">Arraste ou use os botões para ajustar a sequência dos campos como aparecerão no formulário gerado.</p>
                <div className="space-y-2">
                  {(() => {
                    // Exclude injected fields (they are shown only when logic is active).
                    const injectedNames = new Set<string>();
                    if (editingTemplate.template_logic) {
                      Object.values(editingTemplate.template_logic).forEach((li: any) => {
                        if (Array.isArray(li.injectFields)) li.injectFields.forEach((f: any) => injectedNames.add(f.name));
                      });
                    }
                    const baseFields = (editingTemplate.fields || []).filter(f => !injectedNames.has(f.name));
                    if (baseFields.length === 0) return <p className="text-sm text-gray-500">Nenhum campo para organizar.</p>;
                    return baseFields.map((f: any, idx: number) => {
                      const isDragOver = dragOverFieldName === f.name;
                      return (
                        <div
                          key={f.name}
                          draggable
                          onDragStart={(e) => handleFieldDragStart(e, f.name)}
                          onDragOver={(e) => handleFieldDragOver(e, f.name)}
                          onDrop={(e) => handleFieldDrop(e, f.name)}
                          onDragLeave={handleFieldDragLeave}
                          className={`flex items-center justify-between p-3 border rounded ${isDragOver ? 'bg-green-50 border-t-2 border-green-300' : 'bg-gray-50'}`}
                        >
                          <div>
                            <p className="font-mono text-sm text-green-700">{`{{${f.name}}}`}</p>
                            <p className="text-sm text-gray-700">{f.label || '(sem label)'}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 italic">Arraste para reordenar</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-3">A ordem será salva quando você clicar em <strong>Salvar Modelo</strong>.</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Anotações do Modelo</label>
                <textarea
                  rows={6}
                  placeholder="Anotações internas, dicas de preenchimento..."
                  value={editingTemplate.notes || ''}
                  onChange={e => setEditingTemplate(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">FAQ / Perguntas Frequentes</label>
                <textarea
                  rows={6}
                  placeholder="Perguntas e respostas frequentes relacionadas a este modelo..."
                  value={editingTemplate.faq || ''}
                  onChange={e => setEditingTemplate(prev => prev ? { ...prev, faq: e.target.value } : null)}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
                />
              </div>
            </>
          )}
        </div>
                {/* Validation modal */}
                {validationState.open && (
                  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
                      <h3 className="text-lg font-semibold text-gray-800">Erros de Validação</h3>
                      <p className="text-sm text-gray-600 mt-2">Corrija os itens indicados antes de salvar.</p>
                      <ul className="mt-4 list-disc list-inside max-h-48 overflow-auto text-sm text-red-700">
                        {validationState.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                      <div className="mt-4 flex justify-end">
                        <button onClick={() => setValidationState({ open: false, errors: [], fieldErrors: {} })} className="px-3 py-2 bg-green-600 text-white rounded">Fechar</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="px-6 py-4 bg-gray-50 border-t sticky bottom-0 z-10">
                    <div className="flex justify-end space-x-3">
                        <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
                        <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700">Salvar Modelo</button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Gerenciador de Modelos</h1>
          <button onClick={handleCreateNew} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
            Criar Novo Modelo
          </button>
        </div>
        
        {renderEditForm()}

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Modelos de Atendimento</h3>
            <p className="text-xs text-gray-500 mt-1">Arraste e solte para reordenar os modelos</p>
          </div>
          <ul className="divide-y divide-gray-200">
            {sortedTemplates.length > 0 ? sortedTemplates.map((template, index) => (
              <li 
                key={template.id.toString()} 
                draggable
                onDragStart={(e) => handleDragStart(e, template)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-move transition-colors ${
                  dragOverIndex === index ? 'bg-green-50 border-t-2 border-green-300' : ''
                } ${draggedItem?.id === template.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-800 text-sm font-bold rounded-full">
                    {template.order || index + 1}
                  </span>
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H7zM6 6h8v2H6V6zm0 4h8v2H6v-2z"/>
                    </svg>
                    <p className="text-sm font-medium text-gray-900 truncate">{template.title}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4 space-x-2">
                  <button onClick={() => handleSelectForEdit(template)} className="text-green-600 hover:text-green-900 text-sm font-medium">Editar</button>
                  <button onClick={() => handleClone(template)} className="text-blue-600 hover:text-blue-900 text-sm font-medium">Clonar</button>
                  <button onClick={() => handleDelete(template.id)} className="text-red-600 hover:text-red-900 text-sm font-medium">Excluir</button>
                </div>
              </li>
            )) : (
              <li className="px-6 py-4 text-center text-sm text-gray-500">Nenhum modelo encontrado. Crie um novo para começar.</li>
            )}
          </ul>
        </div>
        
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          variant="danger"
        />
      </div>
    </div>
  );
};

export default Manager;