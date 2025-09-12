import React, { useState, useEffect, useCallback } from 'react';
import { Template, TemplateField, TemplateLogicItem, FieldCondition } from '../types';

interface ManagerProps {
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
}

const emptyTemplate: Omit<Template, 'id'> = {
  title: '',
  template: '',
  fields: [],
  template_logic: {}
};

const Manager: React.FC<ManagerProps> = ({ templates, setTemplates }) => {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const handleCreateNew = () => {
    setEditingTemplate({ ...emptyTemplate, id: Date.now(), template_logic: {} });
  };

  const handleSelectForEdit = (template: Template) => {
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
  };
  
  const handleCancel = () => {
    setEditingTemplate(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este modelo?')) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (editingTemplate?.id === id) {
          setEditingTemplate(null);
      }
    }
  };

  const handleSave = () => {
    if (!editingTemplate || !editingTemplate.title) {
        alert("O título do modelo é obrigatório.");
        return;
    }
    setTemplates(prev => {
        const exists = prev.some(t => t.id === editingTemplate.id);
        if (exists) {
            return prev.map(t => t.id === editingTemplate.id ? editingTemplate : t);
        }
        return [...prev, editingTemplate];
    });
    setEditingTemplate(null);
  };

  const handleTemplateTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!editingTemplate) return;
    const newTemplateText = e.target.value;
    const placeholders = [...new Set([...newTemplateText.matchAll(/{{(.*?)}}/g)].map(match => match[1]))];
    
    const newFields: TemplateField[] = placeholders
      .filter(p => !(editingTemplate.template_logic && p in editingTemplate.template_logic))
      .map((name): TemplateField => {
        const existingField = editingTemplate.fields.find(f => f.name === name);
        return existingField || { name, label: name, type: 'text' };
    });

    setEditingTemplate(prev => prev ? { ...prev, template: newTemplateText, fields: newFields } : null);
  };

  const handleFieldChange = (index: number, fieldData: Partial<TemplateField>) => {
    if (!editingTemplate) return;

    const updatedFields = [...editingTemplate.fields];
    updatedFields[index] = { ...updatedFields[index], ...fieldData };

    if (fieldData.type !== 'select') {
      delete updatedFields[index].options;
    }

    setEditingTemplate(prev => prev ? { ...prev, fields: updatedFields } : null);
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
      setEditingTemplate(prev => {
          if (!prev || !prev.template_logic) return prev;
          
          const newLogic = { ...prev.template_logic };
          const item = newLogic[oldKey];
          if (!item) return prev;

          let updatedItem;
          if ('condition' in itemData && typeof itemData.condition === 'object') {
              updatedItem = { ...item, condition: { ...item.condition, ...itemData.condition }};
          } else {
              updatedItem = { ...item, ...itemData };
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
    context: string
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
                ) : conditionSourceField.type === 'select' ? (
                    <select value={condition.value} onChange={e => onchange({ value: e.target.value })} className="block w-full px-2 py-1 text-sm border-gray-300 rounded-md">
                        <option value="">Selecione a opção...</option>
                        {conditionSourceField.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : null}
            </div>
        </div>
    )
  }

  const renderEditForm = () => {
    if (!editingTemplate) return null;

    const otherFields = editingTemplate.fields;
    const allFieldsForLogic = editingTemplate.fields;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 sticky top-0 bg-white border-b z-10">
                    <h2 className="text-2xl font-bold text-gray-800">{editingTemplate.id > 10000 ? 'Criar Novo Modelo' : 'Editar Modelo'}</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Título do Modelo</label>
                        <input
                            type="text"
                            placeholder="Ex: Atendimento para 2ª via do carnê"
                            value={editingTemplate.title}
                            onChange={e => setEditingTemplate(prev => prev ? { ...prev, title: e.target.value } : null)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>
                    <div>
                        {/* FIX: Wrapped string with `{{...}}` in a JSX expression to prevent parsing errors. */}
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
                                  <div key={index} className="p-4 border rounded-md bg-gray-50">
                                      {/* FIX: Wrapped template literal in a JSX expression to prevent parsing errors. */}
                                      <p className="font-semibold font-mono text-green-700 mb-2">{`\`{{${field.name}}}\``}</p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-xs font-medium text-gray-600">Label do Campo</label>
                                              <input type="text" value={field.label} onChange={e => handleFieldChange(index, { label: e.target.value })} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded-md"/>
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
                                                  <option value="checkbox">Checkbox</option>
                                              </select>
                                          </div>
                                          {field.type === 'select' && (
                                              <div className="md:col-span-2">
                                                  <label className="block text-xs font-medium text-gray-600">Opções (separadas por vírgula)</label>
                                                  <input type="text" value={field.options?.join(',') || ''} onChange={e => handleFieldChange(index, { options: e.target.value.split(',').map(s => s.trim()) })} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded-md"/>
                                              </div>
                                          )}
                                      </div>
                                      {renderConditionUI(field.condition, (data) => handleFieldConditionChange(index, data), otherFields.filter(f => f.name !== field.name), `field-${index}`)}
                                  </div>
                              ))}
                          </div>
                      ) : (
                          // FIX: Wrapped string with `{{...}}` in a JSX expression to prevent parsing errors.
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
                                           <input type="text" value={key} onBlur={e => handleTemplateLogicChange(key, e.target.value, {})} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded-md font-mono" placeholder="ex: info_credito"/>
                                       </div>
                                       <div className="md:col-span-2">
                                           <label className="block text-xs font-medium text-gray-600">Texto a ser Inserido</label>
                                           <textarea value={item.text} onChange={e => handleTemplateLogicChange(key, key, {text: e.target.value})} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded-md font-mono" rows={3}></textarea>
                                       </div>
                                   </div>
                                   {renderConditionUI(item.condition, (data) => handleTemplateLogicChange(key, key, {condition: data || {field: '', value: ''}}), allFieldsForLogic, `logic-${key}`)}
                               </div>
                           ))}
                           <button onClick={handleAddTemplateLogic} className="text-sm text-green-600 hover:text-green-800">+ Adicionar bloco de texto condicional</button>
                        </div>
                    </div>
                </div>
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
          <ul className="divide-y divide-gray-200">
            {templates.length > 0 ? templates.map(template => (
              <li key={template.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <p className="text-sm font-medium text-gray-900 truncate">{template.title}</p>
                <div className="flex-shrink-0 ml-4 space-x-2">
                  <button onClick={() => handleSelectForEdit(template)} className="text-green-600 hover:text-green-900 text-sm font-medium">Editar</button>
                  <button onClick={() => handleDelete(template.id)} className="text-red-600 hover:text-red-900 text-sm font-medium">Excluir</button>
                </div>
              </li>
            )) : (
              <li className="px-6 py-4 text-center text-sm text-gray-500">Nenhum modelo encontrado. Crie um novo para começar.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Manager;