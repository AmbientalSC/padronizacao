
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Template, TemplateField, Atendimento } from '../types';
import { ClipboardIcon, CheckIcon } from './icons/ClipboardIcon';

interface GeneratorProps {
  templates: Template[];
  atendimentos: Atendimento[];
  setAtendimentos: React.Dispatch<React.SetStateAction<Atendimento[]>>;
}

const Generator: React.FC<GeneratorProps> = ({ templates, atendimentos, setAtendimentos }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [isCopied, setIsCopied] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

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
    let finalValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;
    
    // Formatação especial para campos de data - converter para DD/MM/AAAA
    if (type === 'date' && value) {
      const dateObj = new Date(value);
      if (!isNaN(dateObj.getTime())) {
        finalValue = dateObj.toLocaleDateString('pt-BR');
      }
    }
    
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

  const handleProximoAtendimento = () => {
    if (!selectedTemplate || !generatedText.trim()) {
      alert('Por favor, preencha o formulário antes de salvar o atendimento.');
      return;
    }

    const novoAtendimento: Atendimento = {
      id: Date.now(),
      templateId: selectedTemplate.id,
      templateTitle: selectedTemplate.title,
      formData: { ...formData },
      generatedText: generatedText,
      createdAt: new Date().toISOString()
    };

    setAtendimentos(prev => [...prev, novoAtendimento]);
    
    // Reset form
    setSelectedTemplateId('');
    setFormData({});
    setIsCopied(false);

    // Show toast
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
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
      {/* Toast de confirmação */}
      {showSavedToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg transform transition-all duration-300 ease-in-out">
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Atendimento salvo com sucesso!</span>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
          <div className="mb-6">
          <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-1">Selecione o Modelo de Atendimento</label>
          <div className="flex items-center space-x-2">
            <select
              id="template-select"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
            >
              <option value="">-- Escolha um modelo --</option>
              {templates.map(template => (
                <option key={template.id.toString()} value={template.id.toString()}>{template.title}</option>
              ))}
            </select>
            <button title="Ver anotações e FAQ" onClick={() => setShowNotesModal(true)} disabled={!selectedTemplate} className="mt-1 p-2 rounded-md bg-gray-100 hover:bg-gray-200">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notes modal */}
        {showNotesModal && selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Anotações / FAQ — {selectedTemplate.title}</h3>
                <button onClick={() => setShowNotesModal(false)} className="text-gray-500 hover:text-gray-700">Fechar</button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Anotações</h4>
                  <div className="mt-1 p-3 bg-gray-50 rounded border text-sm whitespace-pre-wrap">{selectedTemplate.notes || 'Sem anotações.'}</div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">FAQ</h4>
                  <div className="mt-1 p-3 bg-gray-50 rounded border text-sm whitespace-pre-wrap">{selectedTemplate.faq || 'Sem FAQ.'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTemplate && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Formulário Dinâmico</h2>
              <form>
                {selectedTemplate.fields.map(renderField)}
              </form>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Preview em Tempo Real</h2>
                <button
                  onClick={handleCopyToClipboard}
                  className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-150"
                  disabled={!generatedText}
                >
                  {isCopied ? <CheckIcon className="h-5 w-5 mr-1" /> : <ClipboardIcon className="h-5 w-5 mr-1" />}
                  {isCopied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <textarea
                readOnly
                value={generatedText}
                className="w-full h-96 p-3 bg-gray-50 border border-gray-300 rounded-md shadow-inner text-sm font-mono"
                placeholder="O texto gerado aparecerá aqui..."
              />
              {generatedText && (
                <div className="mt-4">
                  <button
                    onClick={handleProximoAtendimento}
                    className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Próximo Atendimento
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;
