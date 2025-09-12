
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Template, TemplateField } from '../types';
import { ClipboardIcon, CheckIcon } from './icons/ClipboardIcon';

interface GeneratorProps {
  templates: Template[];
}

const Generator: React.FC<GeneratorProps> = ({ templates }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [isCopied, setIsCopied] = useState(false);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find(t => t.id.toString() === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    const defaultFormData: { [key: string]: any } = {};
    if (selectedTemplate) {
      selectedTemplate.fields.forEach(field => {
        defaultFormData[field.name] = field.type === 'checkbox' ? false : '';
      });
    }
    setFormData(defaultFormData);
  }, [selectedTemplate]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const finalValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const generatedText = useMemo(() => {
    if (!selectedTemplate) return '';

    let output = selectedTemplate.template;

    // Process template logic first
    if (selectedTemplate.template_logic) {
      Object.keys(selectedTemplate.template_logic).forEach(logicKey => {
        const logicItem = selectedTemplate.template_logic![logicKey];
        const conditionField = logicItem.condition.field;
        const conditionValue = logicItem.condition.value;
        const formValue = formData[conditionField];

        let textToInsert = '';
        if ((typeof formValue === 'boolean' && formValue === conditionValue) || (formValue == conditionValue)) {
            textToInsert = logicItem.text;
        }
        output = output.replace(new RegExp(`{{${logicKey}}}`, 'g'), textToInsert);
      });
    }
    
    // Process regular field placeholders
    Object.keys(formData).forEach(key => {
      output = output.replace(new RegExp(`{{${key}}}`, 'g'), formData[key] || '');
    });

    return output;
  }, [formData, selectedTemplate]);
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const renderField = useCallback((field: TemplateField) => {
    if (field.condition) {
        const conditionField = field.condition.field;
        const conditionValue = field.condition.value;
        const formValue = formData[conditionField];
        if (typeof formValue === 'boolean' && formValue !== conditionValue) {
            return null;
        }
        if (typeof formValue !== 'boolean' && formValue != conditionValue) {
            return null;
        }
    }

    const commonProps = {
      name: field.name,
      id: field.name,
      onChange: handleInputChange,
      className: "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm",
    };

    return (
      <div key={field.name} className="mb-4">
        <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">{field.label}</label>
        {field.type === 'textarea' && <textarea {...commonProps} value={formData[field.name] || ''} rows={3}></textarea>}
        {field.type === 'select' && (
          <select {...commonProps} value={formData[field.name] || ''}>
            <option value="">Selecione...</option>
            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        )}
        {field.type === 'checkbox' && (
          <div className="mt-2">
            <input type="checkbox" {...commonProps} checked={!!formData[field.name]} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
          </div>
        )}
        {['text', 'number', 'date', 'email'].includes(field.type) && <input type={field.type} {...commonProps} value={formData[field.name] || ''} />}
      </div>
    );
  }, [formData, handleInputChange]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-1">Selecione o Modelo de Atendimento</label>
          <select
            id="template-select"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value="">-- Escolha um modelo --</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>{template.title}</option>
            ))}
          </select>
        </div>

        {selectedTemplate && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Formulário Dinâmico</h2>
              <form>
                {selectedTemplate.fields.map(renderField)}
              </form>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Preview em Tempo Real</h2>
              <div className="relative">
                <textarea
                  readOnly
                  value={generatedText}
                  className="w-full h-96 p-3 bg-gray-50 border border-gray-300 rounded-md shadow-inner text-sm font-mono"
                  placeholder="O texto gerado aparecerá aqui..."
                />
                <button
                  onClick={handleCopyToClipboard}
                  className="absolute top-2 right-2 flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-150"
                  disabled={!generatedText}
                >
                  {isCopied ? <CheckIcon className="h-5 w-5 mr-1" /> : <ClipboardIcon className="h-5 w-5 mr-1" />}
                  {isCopied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;
