import React, { useState } from 'react';
import { Atendimento, Template } from '../types';
import { ClipboardIcon, CheckIcon } from './icons/ClipboardIcon';

interface AtendimentosProps {
  atendimentos: Atendimento[];
  setAtendimentos: React.Dispatch<React.SetStateAction<Atendimento[]>>;
  templates: Template[];
}

const Atendimentos: React.FC<AtendimentosProps> = ({ atendimentos, setAtendimentos, templates }) => {
  const [editingAtendimento, setEditingAtendimento] = useState<Atendimento | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleEdit = (atendimento: Atendimento) => {
    setEditingAtendimento({ ...atendimento });
  };

  const handleSave = () => {
    if (!editingAtendimento) return;
    
    setAtendimentos(prev => 
      prev.map(a => a.id === editingAtendimento.id ? editingAtendimento : a)
    );
    setEditingAtendimento(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este atendimento?')) {
      setAtendimentos(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleCancel = () => {
    setEditingAtendimento(null);
    setIsCopied(false);
  };

  const handleCopyToClipboard = () => {
    if (!editingAtendimento) return;
    navigator.clipboard.writeText(editingAtendimento.generatedText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const filteredAtendimentos = atendimentos.filter(atendimento => 
    atendimento.templateTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    atendimento.generatedText.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const renderEditModal = () => {
    if (!editingAtendimento) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 sticky top-0 bg-white border-b z-10">
            <h2 className="text-2xl font-bold text-gray-800">Editar Atendimento</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo de Atendimento</label>
              <p className="mt-1 text-sm text-gray-600">{editingAtendimento.templateTitle}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Data/Hora</label>
              <p className="mt-1 text-sm text-gray-600">{formatDate(editingAtendimento.createdAt)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Texto Gerado</label>
                <button
                  onClick={handleCopyToClipboard}
                  className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-150"
                  disabled={!editingAtendimento.generatedText}
                >
                  {isCopied ? <CheckIcon className="h-4 w-4 mr-1" /> : <ClipboardIcon className="h-4 w-4 mr-1" />}
                  {isCopied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <textarea
                value={editingAtendimento.generatedText}
                onChange={(e) => setEditingAtendimento(prev => prev ? { ...prev, generatedText: e.target.value } : null)}
                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                rows={8}
              />
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t sticky bottom-0 z-10">
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Histórico de Atendimentos</h1>
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Buscar atendimentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-4 text-sm text-gray-600">
              {filteredAtendimentos.length} de {atendimentos.length} atendimentos
            </div>
          </div>
        </div>

        {renderEditModal()}

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {filteredAtendimentos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo de Atendimento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAtendimentos
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((atendimento) => (
                    <tr key={atendimento.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(atendimento.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {atendimento.templateTitle}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">
                          {atendimento.generatedText}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(atendimento)}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(atendimento.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum atendimento encontrado</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Nenhum atendimento corresponde aos critérios de busca.' : 'Comece realizando um atendimento na aba Gerador.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Atendimentos;
