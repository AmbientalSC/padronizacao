import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  setDoc,
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
        // Use sempre o id do documento (doc.id) como identificador para evitar conflitos
        // com um campo `id` armazenado dentro do documento.
        // casting to any because Firestore doc.id is string while our Template.id is number in types.
        // We purposely keep id as the document id string to guarantee uniqueness; comparisons in
        // the app use toString(), so this is safe at runtime.
        firebaseTemplates.push({ 
          ...data,
          id: doc.id as unknown as any
        } as any);
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

        // Remove propriedades undefined e a propriedade `id` antes de enviar ao Firestore
        const deepClean = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map(v => deepClean(v));
          const res: any = {};
          Object.entries(obj).forEach(([k, v]) => {
            if (v === undefined) return;
            res[k] = deepClean(v);
          });
          return res;
        };

        const cleaned = deepClean(updatedData as any);
        if (cleaned && typeof cleaned === 'object' && 'id' in cleaned) {
          delete cleaned.id;
        }

        // Use setDoc with merge para criar/atualizar com mais segurança
        await setDoc(templateRef, cleaned || {}, { merge: true });
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
  console.error('Erro ao atualizar template:', error, { templateId, updatedData });
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
