import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { Template } from '../types';
import { initialTemplates } from '../data/initialData';

export const useFirebaseTemplates = (isAuthenticated: boolean) => {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Se não estiver autenticado, usar templates locais
      const localTemplates = localStorage.getItem('atendimento-templates');
      if (localTemplates) {
        setTemplates(JSON.parse(localTemplates));
      } else {
        setTemplates(initialTemplates);
      }
      return;
    }

    // Se estiver autenticado, buscar templates do Firebase
    setLoading(true);
    const templatesRef = collection(db, 'templates');
    
    const unsubscribe = onSnapshot(templatesRef, (snapshot) => {
      const firebaseTemplates: Template[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        firebaseTemplates.push({ 
          ...data,
          id: data.id || doc.id 
        } as Template);
      });
      
      // Se não houver templates no Firebase, criar os iniciais
      if (firebaseTemplates.length === 0) {
        createInitialTemplates();
      } else {
        setTemplates(firebaseTemplates);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [isAuthenticated]);

  const createInitialTemplates = async () => {
    try {
      const templatesRef = collection(db, 'templates');
      for (const template of initialTemplates) {
        await addDoc(templatesRef, template);
      }
    } catch (error) {
      console.error('Erro ao criar templates iniciais:', error);
    }
  };

  const addTemplate = async (template: Omit<Template, 'id'>) => {
    try {
      if (isAuthenticated) {
        const templatesRef = collection(db, 'templates');
        await addDoc(templatesRef, template);
      } else {
        // Fallback para localStorage se não estiver autenticado
        const newTemplate = { ...template, id: Date.now() };
        const updatedTemplates = [...templates, newTemplate];
        setTemplates(updatedTemplates);
        localStorage.setItem('atendimento-templates', JSON.stringify(updatedTemplates));
      }
      return { success: true };
    } catch (error) {
      console.error('Erro ao adicionar template:', error);
      return { success: false, error };
    }
  };

  const updateTemplate = async (templateId: string | number, updatedData: Partial<Template>) => {
    try {
      if (isAuthenticated) {
        const templateRef = doc(db, 'templates', templateId.toString());
        await updateDoc(templateRef, updatedData);
      } else {
        // Fallback para localStorage
        const updatedTemplates = templates.map(t => 
          t.id.toString() === templateId.toString() ? { ...t, ...updatedData } : t
        );
        setTemplates(updatedTemplates);
        localStorage.setItem('atendimento-templates', JSON.stringify(updatedTemplates));
      }
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      return { success: false, error };
    }
  };

  const deleteTemplate = async (templateId: string | number) => {
    try {
      if (isAuthenticated) {
        const templateRef = doc(db, 'templates', templateId.toString());
        await deleteDoc(templateRef);
      } else {
        // Fallback para localStorage
        const updatedTemplates = templates.filter(t => t.id.toString() !== templateId.toString());
        setTemplates(updatedTemplates);
        localStorage.setItem('atendimento-templates', JSON.stringify(updatedTemplates));
      }
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      return { success: false, error };
    }
  };

  return {
    templates,
    loading,
    addTemplate,
    updateTemplate,
    deleteTemplate
  };
};
