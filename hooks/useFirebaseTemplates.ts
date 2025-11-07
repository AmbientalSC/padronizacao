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
    // Always attempt to subscribe to Firestore templates. If that fails (permission/network),
    // fallback to localStorage or initialTemplates so unauthenticated users still see something.
    setLoading(true);
    const templatesRef = collection(db, 'templates');

    const unsubscribe = onSnapshot(
      templatesRef,
      (snapshot) => {
        const firebaseTemplates: Template[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          firebaseTemplates.push({
            ...data,
            id: doc.id as unknown as any
          } as any);
        });

        if (firebaseTemplates.length === 0) {
          // Only attempt to create initial templates in Firestore when authenticated
          if (isAuthenticated) {
            createInitialTemplates();
          } else {
            // if not authenticated and Firestore returned no templates, use local fallback
            const localTemplates = localStorage.getItem('atendimento-templates');
            if (localTemplates) {
              setTemplates(JSON.parse(localTemplates));
            } else {
              setTemplates(initialTemplates);
            }
          }
        } else {
          setTemplates(firebaseTemplates);
        }

        setLoading(false);
      },
      (error) => {
        // Firestore subscription failed (likely permission denied for unauthenticated users).
        // Fallback to localStorage / initialTemplates so unauthenticated users still have templates.
        if (process.env.NODE_ENV === 'development') {
          console.warn('useFirebaseTemplates: Firestore indisponível, usando fallback local', error.code || error.message);
        }
        const localTemplates = localStorage.getItem('atendimento-templates');
        if (localTemplates) {
          try {
            setTemplates(JSON.parse(localTemplates));
          } catch (parseError) {
            console.error('Erro ao recuperar templates do localStorage:', parseError);
            setTemplates(initialTemplates);
          }
        } else {
          setTemplates(initialTemplates);
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [isAuthenticated]);

  const createInitialTemplates = async () => {
    try {
      const templatesRef = collection(db, 'templates');
      // deep clean helper to remove undefined and id fields
      const deepCleanLocal = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(v => deepCleanLocal(v));
        const res: any = {};
        Object.entries(obj).forEach(([k, v]) => {
          if (v === undefined) return;
          if (k === 'id') return;
          res[k] = deepCleanLocal(v);
        });
        return res;
      };

      for (const template of initialTemplates) {
        const cleaned = deepCleanLocal(template);
        await addDoc(templatesRef, cleaned);
      }
    } catch (error: any) {
      console.error('Erro ao criar templates iniciais:', error?.message || error);
    }
  };

  const addTemplate = async (template: Omit<Template, 'id'>) => {
    try {
      if (isAuthenticated) {
        const templatesRef = collection(db, 'templates');
        // clean payload before sending to Firestore
        const deepCleanLocal = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map(v => deepCleanLocal(v));
          const res: any = {};
          Object.entries(obj).forEach(([k, v]) => {
            if (v === undefined) return;
            if (k === 'id') return;
            res[k] = deepCleanLocal(v);
          });
          return res;
        };
        const cleaned = deepCleanLocal(template);
        await addDoc(templatesRef, cleaned);
      } else {
        // Fallback para localStorage se não estiver autenticado
        const newTemplate = { ...template, id: Date.now() };
        const updatedTemplates = [...templates, newTemplate];
        setTemplates(updatedTemplates);
        localStorage.setItem('atendimento-templates', JSON.stringify(updatedTemplates));
      }
      return { success: true };
    } catch (error: any) {
      console.error('Erro ao adicionar template:', error?.message || error);
      return { success: false, error: error?.message || 'Erro desconhecido' };
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

        // If the update contains full objects like 'fields', 'template' or 'template_logic',
        // we should NOT use merge, so that deletions (e.g. removed placeholders) are persisted.
        const shouldOverwrite = cleaned && (cleaned.fields !== undefined || cleaned.template !== undefined || cleaned.template_logic !== undefined);
        if (shouldOverwrite) {
          // overwrite the document with the cleaned payload
          await setDoc(templateRef, cleaned || {});
        } else {
          // Use setDoc with merge to update partial props safely
          await setDoc(templateRef, cleaned || {}, { merge: true });
        }
      } else {
        // Fallback para localStorage
        const updatedTemplates = templates.map(t =>
          t.id.toString() === templateId.toString() ? { ...t, ...updatedData } : t
        );
        setTemplates(updatedTemplates);
        localStorage.setItem('atendimento-templates', JSON.stringify(updatedTemplates));
      }
      return { success: true };
    } catch (error: any) {
      console.error('Erro ao atualizar template:', error?.message || error, { templateId, updatedData: Object.keys(updatedData) });
      return { success: false, error: error?.message || 'Erro desconhecido' };
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
    } catch (error: any) {
      console.error('Erro ao excluir template:', error?.message || error);
      return { success: false, error: error?.message || 'Erro desconhecido' };
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
