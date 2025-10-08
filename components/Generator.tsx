
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Template, TemplateField, Atendimento } from '../types';
import { ClipboardIcon, CheckIcon } from './icons/ClipboardIcon';

interface GeneratorProps {
  templates: Template[];
  atendimentos: Atendimento[];
  setAtendimentos: React.Dispatch<React.SetStateAction<Atendimento[]>>;
  showFAQModal?: boolean;
  setShowFAQModal?: (val: boolean) => void;
}

const Generator: React.FC<GeneratorProps> = ({ templates, atendimentos, setAtendimentos, showFAQModal, setShowFAQModal }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [isCopied, setIsCopied] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [cpfCnpjMode, setCpfCnpjMode] = useState<Record<string, 'cpf' | 'cnpj'>>({});
    // Se o pai fornecer controle do FAQ, usa-o; caso contrário usa estado local
    const [localFAQOpen, setLocalFAQOpen] = useState(false);
    const faqOpen = typeof showFAQModal === 'boolean' ? showFAQModal : localFAQOpen;
    const setFAQOpen = (val: boolean) => {
      if (typeof setShowFAQModal === 'function') setShowFAQModal(val);
      else setLocalFAQOpen(val);
    };
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // Address autocomplete suggestions per field name
  const [addressSuggestions, setAddressSuggestions] = useState<Record<string, Array<{display_name: string, lat: string, lon: string}>>>({});
  const [addressQueryTimers, setAddressQueryTimers] = useState<Record<string, any>>({});
  // Leaflet / map modal state
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapModal, setMapModal] = useState<{ open: boolean; field?: string; lat?: number; lon?: number }>(() => ({ open: false }));
  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find(t => t.id.toString() === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  // Templates filtrados e ordenados
  const filteredAndSortedTemplates = useMemo(() => {
    return templates
      .map((template, index) => ({
        ...template,
        order: template.order ?? index + 1
      }))
      .filter(template => 
        template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.order.toString().includes(searchTerm)
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [templates, searchTerm]);

  useEffect(() => {
    const defaultFormData: { [key: string]: any } = {};
    const initialModes: Record<string, 'cpf' | 'cnpj'> = {};
    if (selectedTemplate) {
      selectedTemplate.fields.forEach(field => {
        if (field.type === 'checkbox') {
          defaultFormData[field.name] = false;
        } else if (field.type === 'multiselect') {
          defaultFormData[field.name] = [];
        } else {
          defaultFormData[field.name] = '';
        }
        if (field.type === 'cpfcnpj') {
          // default mode is cpf
          initialModes[field.name] = 'cpf';
        }
      });
    }
    setFormData(defaultFormData);
    if (Object.keys(initialModes).length > 0) {
      setCpfCnpjMode(prev => ({ ...initialModes, ...prev }));
    }
  }, [selectedTemplate]);

  // helpers for cpf/cnpj formatting
  const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
  const formatCPF = (digits: string) => {
    const d = digits.slice(0,11);
    if (!d) return '';
    const p1 = d.slice(0,3);
    const p2 = d.slice(3,6);
    const p3 = d.slice(6,9);
    const p4 = d.slice(9,11);
    let out = p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '-' + p4;
    return out;
  };
  const formatCNPJ = (digits: string) => {
    const d = digits.slice(0,14);
    if (!d) return '';
    const p1 = d.slice(0,2);
    const p2 = d.slice(2,5);
    const p3 = d.slice(5,8);
    const p4 = d.slice(8,12);
    const p5 = d.slice(12,14);
    let out = p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '/' + p4;
    if (p5) out += '-' + p5;
    return out;
  };

  // Compute active fields preserving original base order and inserting active injectFields
  // immediately after the field that controls the condition.
  const activeFields = useMemo(() => {
    if (!selectedTemplate) return [] as TemplateField[];
    const allFields = selectedTemplate.fields || [];

    // Collect names of all possible injected fields declared in template_logic so we can
    // exclude them from the base fields list (they should only appear when injected)
    const allInjectedNames = new Set<string>();
    const logicItems = selectedTemplate.template_logic ? Object.values(selectedTemplate.template_logic) as any[] : [];
    logicItems.forEach(li => {
      if (Array.isArray(li.injectFields)) li.injectFields.forEach((f: TemplateField) => allInjectedNames.add(f.name));
    });

    // Base fields in original order, excluding any names that are declared as injected
    const base = allFields.filter(f => !allInjectedNames.has(f.name));

    const result: TemplateField[] = [];
    const pushedInjected = new Set<string>();

    // helper to normalize boolean-like values used in conditions
    const toBool = (v: any) => {
      if (v === true || v === 1 || v === '1') return true;
      if (v === false || v === 0 || v === '0') return false;
      if (typeof v === 'string') {
        const lower = v.toLowerCase();
        if (lower === 'true' || lower === 'marcado' || lower === 'sim' || lower === 'yes') return true;
        if (lower === 'false' || lower === 'desmarcado' || lower === 'nao' || lower === 'não' || lower === 'no') return false;
      }
      return Boolean(v);
    };

    // For each base field, push it and then any injectFields from logic items whose condition
    // references this base field and is currently active. This preserves visual proximity.
    base.forEach(field => {
      result.push(field);

      logicItems.forEach((logicItem: any) => {
        const conditionField = logicItem.condition?.field;
        const conditionValue = logicItem.condition?.value;
        if (conditionField !== field.name) return;

        const formValue = formData[conditionField];
        const sourceField = selectedTemplate.fields.find((f: TemplateField) => f.name === conditionField);
        let active = false;
        if (sourceField && sourceField.type === 'checkbox') {
          if (conditionValue == null) active = false;
          else active = toBool(formValue) === toBool(conditionValue);
        } else {
          const a = formValue == null ? '' : String(formValue).trim();
          const b = conditionValue == null ? '' : String(conditionValue).trim();
          active = a === b;
        }

        if (active && Array.isArray(logicItem.injectFields)) {
          logicItem.injectFields.forEach((f: TemplateField) => {
            if (!pushedInjected.has(f.name)) {
              result.push(f);
              pushedInjected.add(f.name);
            }
          });
        }
      });
    });

    return result;
  }, [selectedTemplate, formData]);

  // Ensure formData contains keys for active injected fields
  useEffect(() => {
    if (!selectedTemplate) return;
    const additions: { [k: string]: any } = {};
    activeFields.forEach(f => {
      if (!(f.name in formData)) {
        additions[f.name] = f.type === 'checkbox' ? false : '';
      }
    });
    if (Object.keys(additions).length > 0) {
      setFormData(prev => ({ ...prev, ...additions }));
    }
  }, [activeFields, selectedTemplate]);

  // Clean up injected fields values when their logic blocks become inactive
  useEffect(() => {
    if (!selectedTemplate || !selectedTemplate.template_logic) return;

    // helper to normalize boolean-like values (same logic used above)
    const toBool = (v: any) => {
      if (v === true || v === 1 || v === '1') return true;
      if (v === false || v === 0 || v === '0') return false;
      if (typeof v === 'string') {
        const lower = v.toLowerCase();
        if (lower === 'true' || lower === 'marcado' || lower === 'sim' || lower === 'yes') return true;
        if (lower === 'false' || lower === 'desmarcado' || lower === 'nao' || lower === 'não' || lower === 'no') return false;
      }
      return Boolean(v);
    };

    const allInjectedNames = new Set<string>();
    const activeInjectedNames = new Set<string>();

    Object.values(selectedTemplate.template_logic).forEach((li: any) => {
      if (Array.isArray(li.injectFields)) {
        li.injectFields.forEach((f: TemplateField) => allInjectedNames.add(f.name));
      }
      // determine if this logic is active
      const condField = li.condition?.field;
      const condVal = li.condition?.value;
      const formVal = formData[condField];
      // if condition references a checkbox field, use toBool, but only if condVal is defined
      const sourceField = selectedTemplate.fields.find((f: TemplateField) => f.name === condField);
      let isActive = false;
      if (sourceField && sourceField.type === 'checkbox') {
        if (condVal != null) {
          isActive = toBool(formVal) === toBool(condVal);
        }
      } else {
        const a = formVal == null ? '' : String(formVal).trim();
        const b = condVal == null ? '' : String(condVal).trim();
        isActive = a === b;
      }
      if (isActive && Array.isArray(li.injectFields)) {
        li.injectFields.forEach((f: TemplateField) => activeInjectedNames.add(f.name));
      }
    });

    // Fields to remove: injected names that are not active
    const toRemove: string[] = [];
    allInjectedNames.forEach(name => {
      if (!activeInjectedNames.has(name) && (name in formData)) {
        toRemove.push(name);
      }
    });

    if (toRemove.length > 0) {
      setFormData(prev => {
        const copy = { ...prev };
        toRemove.forEach(k => delete copy[k]);
        return copy;
      });
    }
  }, [formData, selectedTemplate]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const dropdown = target.closest('.template-select-container');
      if (!dropdown) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Close address suggestions when clicking outside
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (!t.closest('.address-suggestion') && !t.closest('input')) {
        setAddressSuggestions({});
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Lazy-load Leaflet when modal opens and initialize map
  useEffect(() => {
    if (!mapModal.open) return;

    const loadLeaflet = async () => {
      if (!(window as any).L) {
        // inject CSS
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
        // inject script
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.body.appendChild(s);
        });
      }
      setLeafletLoaded(true);
    };

    loadLeaflet().then(() => {
      try {
        const L = (window as any).L;
        // init map
        if (mapContainerRef.current) {
          // clear any previous map
          if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            markerRef.current = null;
          }
          mapRef.current = L.map(mapContainerRef.current).setView([mapModal.lat || -26.3, mapModal.lon || -48.8], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(mapRef.current);
          markerRef.current = L.marker([mapModal.lat || -26.3, mapModal.lon || -48.8], { draggable: true }).addTo(mapRef.current);
          markerRef.current.on('dragend', async () => {
            const pos = markerRef.current.getLatLng();
            const lat = pos.lat;
            const lon = pos.lng;
            // reverse geocode
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`;
            try {
              const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
              const data = await res.json();
              const addr = data.address || {};
              const road = addr.road || addr.pedestrian || addr.residential || addr.street || '';
              const house = addr.house_number || addr.housenumber || '';
              const neighbourhood = addr.neighbourhood || addr.suburb || addr.city_district || addr.village || '';
              const parts: string[] = [];
              if (road) {
                if (house) parts.push(`${road}, N° ${house}`);
                else parts.push(road);
              } else if (house) parts.push(`N° ${house}`);
              if (neighbourhood) parts.push(neighbourhood);
              const short = parts.join(', ').toUpperCase();
              // update formData for the field
              if (mapModal.field) {
                setFormData(prev => ({ ...prev, [mapModal.field!]: short, [`${mapModal.field!}__lat`]: lat, [`${mapModal.field!}__lon`]: lon }));
              }
            } catch (e) {
              // ignore
            }
          });
        }
      } catch (e) {
        console.error('Erro inicializando Leaflet', e);
      }
    }).catch(err => console.error('Erro carregando Leaflet', err));

    return () => {
      // cleanup map when modal closes
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [mapModal.open]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    let finalValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;
    
    // Formatação especial para campos de data - converter para DD/MM/AAAA
    if ((type === 'date' || type === 'month') && value) {
      if (type === 'date') {
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
          finalValue = dateObj.toLocaleDateString('pt-BR');
        }
      } else if (type === 'month') {
        // value is YYYY-MM, convert to MM/YYYY
        const parts = value.split('-');
        if (parts.length === 2) {
          finalValue = `${parts[1]}/${parts[0]}`;
        }
      }
    }
    
    // convert strings to uppercase for consistent preview
    // EXCEPT for select fields - preserve original case from options
    if (typeof finalValue === 'string' && type !== 'select' && type !== 'select-one') {
      finalValue = finalValue.toUpperCase();
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  // Handler for multiselect fields (checkboxes with multiple options)
  const handleMultiSelectChange = (fieldName: string, option: string, checked: boolean) => {
    setFormData(prev => {
      const currentValues = Array.isArray(prev[fieldName]) ? prev[fieldName] : [];
      let newValues: string[];
      
      if (checked) {
        // Add option if not already present
        newValues = currentValues.includes(option) ? currentValues : [...currentValues, option];
      } else {
        // Remove option
        newValues = currentValues.filter((v: string) => v !== option);
      }
      
      return { ...prev, [fieldName]: newValues };
    });
  };

  // Address autocomplete: debounce and fetch suggestions from Nominatim
  const fetchAddressSuggestions = (fieldName: string, query: string) => {
    if (!query || query.trim().length < 3) {
      setAddressSuggestions(prev => ({ ...prev, [fieldName]: [] }));
      return;
    }
    // use Nominatim public API for geocoding/autocomplete
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=6&countrycodes=br`;
    fetch(url, { headers: { 'Accept-Language': 'pt-BR' }})
      .then(res => res.json())
      .then((data: any[]) => {
        const items = (data || []).map(d => {
          const addr = d.address || {};
          // build a short, human-friendly address: Road, N° house_number, bairro - city
          const road = addr.road || addr.pedestrian || addr.cycleway || addr.footway || addr.residential || addr.street || '';
          const house = addr.house_number || addr.housenumber || '';
          const neighbourhood = addr.neighbourhood || addr.suburb || addr.hamlet || addr.village || addr.city_district || '';
          // NOTE: we intentionally omit the city from the short_name per request
          const parts: string[] = [];
          if (road) {
            if (house) parts.push(`${road}, N° ${house}`);
            else parts.push(road);
          } else if (house) {
            parts.push(`N° ${house}`);
          }
          if (neighbourhood) parts.push(neighbourhood);
          const shortRaw = parts.join(', ');
          const short = shortRaw ? shortRaw.toUpperCase() : (d.display_name || '').toUpperCase();
          return { display_name: d.display_name, lat: d.lat, lon: d.lon, short_name: short, address: addr };
        });
        setAddressSuggestions(prev => ({ ...prev, [fieldName]: items }));
      })
      .catch(() => setAddressSuggestions(prev => ({ ...prev, [fieldName]: [] })));
  };

  const scheduleAddressQuery = (fieldName: string, query: string) => {
    // clear existing timer
    if (addressQueryTimers[fieldName]) {
      clearTimeout(addressQueryTimers[fieldName]);
    }
    const timer = setTimeout(() => fetchAddressSuggestions(fieldName, query), 300);
    setAddressQueryTimers(prev => ({ ...prev, [fieldName]: timer }));
  };

  // Helper: formata telefone para (DD) 9XXXX-XXXX
  const formatPhone = (raw: string) => {
    if (!raw) return '';
    // remove tudo que não é número
    const digits = raw.replace(/\D/g, '');
    // aplicar formato brasileiro comum: (AA) 9XXXX-XXXX ou (AA) XXXX-XXXX
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    // se tiver 11 ou mais dígitos, considera DDD + 9 + resto
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7,11)}`;
  };

  const generatedText = useMemo(() => {
    if (!selectedTemplate) return '';

    let output = selectedTemplate.template;

    // Track which logic blocks are active (to suppress normal field values)
    const activeLogicBlocks = new Set<string>();
    // Track condition fields that triggered active logic (to suppress them too)
    const activeConditionFields = new Set<string>();
    
    // Process template logic first
    if (selectedTemplate.template_logic) {
      // Get all normal field names to check for conflicts
      const normalFieldNames = selectedTemplate.fields.map((f: TemplateField) => f.name);
      
      Object.keys(selectedTemplate.template_logic).forEach(logicKey => {
        const logicItem = selectedTemplate.template_logic![logicKey];
        const conditionField = logicItem.condition.field;
        const conditionValue = logicItem.condition.value;
        const formValue = formData[conditionField];

        let textToInsert = '';
        const isActive = (typeof formValue === 'boolean' && formValue === conditionValue) || (formValue == conditionValue);
        if (isActive) {
            textToInsert = logicItem.text;
            activeLogicBlocks.add(logicKey); // Track active logic blocks
            activeConditionFields.add(conditionField); // Track the field that triggered this logic
        }
        
        // If this logic key is also a normal field name and condition is NOT active,
        // skip the replacement to let the normal field value be used instead
        const isAlsoNormalField = normalFieldNames.includes(logicKey);
        if (isAlsoNormalField && !isActive) {
          return; // Skip this replacement
        }
        
        output = output.replace(new RegExp(`{{${logicKey}}}`, 'g'), textToInsert);
      });
    }
    
    // Remove placeholders for injected fields that are NOT active (so they don't show as {{injetado_xxx}})
    if (selectedTemplate.template_logic) {
      // helper to normalize boolean-like values
      const toBool = (v: any) => {
        if (v === true || v === 1 || v === '1') return true;
        if (v === false || v === 0 || v === '0') return false;
        if (typeof v === 'string') {
          const lower = v.toLowerCase();
          if (lower === 'true' || lower === 'marcado' || lower === 'sim' || lower === 'yes') return true;
          if (lower === 'false' || lower === 'desmarcado' || lower === 'nao' || lower === 'não' || lower === 'no') return false;
        }
        return Boolean(v);
      };

      const allInjected: string[] = [];
      const activeInjected = new Set<string>();

      Object.values(selectedTemplate.template_logic).forEach((li: any) => {
        if (Array.isArray(li.injectFields)) {
          li.injectFields.forEach((f: TemplateField) => allInjected.push(f.name));
        }
        const condField = li.condition?.field;
        const condVal = li.condition?.value;
        const formVal = formData[condField];
        const sourceField = selectedTemplate.fields.find((f: TemplateField) => f.name === condField);
        let isActive = false;
        if (sourceField && sourceField.type === 'checkbox') {
          if (condVal != null) {
            isActive = toBool(formVal) === toBool(condVal);
          }
        } else {
          const a = formVal == null ? '' : String(formVal).trim();
          const b = condVal == null ? '' : String(condVal).trim();
          isActive = a === b;
        }
        if (isActive && Array.isArray(li.injectFields)) {
          li.injectFields.forEach((f: TemplateField) => activeInjected.add(f.name));
        }
      });

      // Get all normal field names to avoid removing placeholders that are also normal fields
      const normalFieldNames = selectedTemplate.fields.map((f: TemplateField) => f.name);
      
      allInjected.forEach(name => {
        if (!activeInjected.has(name)) {
          // Only remove if this is NOT also a normal field name
          if (!normalFieldNames.includes(name)) {
            output = output.replace(new RegExp(`{{${name}}}`, 'g'), '');
          }
        }
      });
    }
    
    // Process regular field placeholders
    Object.keys(formData).forEach(key => {
      const val = formData[key];
      
      // If there's an active logic block with the same name as this field,
      // OR if this field triggered an active logic block,
      // suppress the field value (use empty string instead)
      if (activeLogicBlocks.has(key) || activeConditionFields.has(key)) {
        output = output.replace(new RegExp(`{{${key}}}`, 'g'), '');
        return;
      }
      
      // Do not insert literal 'true' or 'false' for checkbox fields — use empty string instead.
      let replacement = '';
      if (typeof val === 'boolean') {
        replacement = '';
      } else if (val === null || val === undefined) {
        replacement = '';
      } else if (Array.isArray(val)) {
        // For multiselect fields, join selected values with comma and space
        replacement = val.length > 0 ? val.join(', ') : '';
      } else {
        replacement = String(val);
      }
      console.log(`🔄 Substituindo "{{${key}}}" por "${replacement}"`); // DEBUG
      const before = output;
      output = output.replace(new RegExp(`{{${key}}}`, 'g'), replacement);
      if (before === output && replacement) {
        console.warn(`⚠️ Placeholder {{${key}}} NÃO foi encontrado no template!`); // DEBUG
      }
    });
    
    console.log('✨ Output final:', output); // DEBUG
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

    // clone and format numeric fields according to field.numberDecimals
    const formattedFormData: { [k: string]: any } = { ...formData };
    selectedTemplate.fields.forEach((f: TemplateField) => {
      if (f.type === 'number') {
        const val = formattedFormData[f.name];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const parsed = parseFloat(String(val).replace(',', '.'));
          if (!isNaN(parsed)) {
            let out = '';
            if (f.numberDecimals != null && Number.isFinite(Number(f.numberDecimals))) {
              out = parsed.toFixed(Number(f.numberDecimals));
            } else {
              out = String(parsed);
            }
            formattedFormData[f.name] = out.replace('.', ',');
          }
        }
      }
    });

    const novoAtendimento: Atendimento = {
      id: Date.now(),
      templateId: selectedTemplate.id,
      templateTitle: selectedTemplate.title,
      formData: formattedFormData,
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
    // try to find the source field to decide how to compare
    const sourceField = selectedTemplate?.fields.find(f => f.name === conditionField);
    if (sourceField && sourceField.type === 'checkbox') {
      // If condition has no explicit value, don't show the field
      if (conditionValue == null) return null;
      // normalize boolean-like values (accept boolean true/false or strings 'true'/'false' or localized labels)
      const toBool = (v: any) => {
        if (v === true || v === 1 || v === '1') return true;
        if (v === false || v === 0 || v === '0') return false;
        if (typeof v === 'string') {
          const lower = v.toLowerCase();
          if (lower === 'true' || lower === 'marcado' || lower === 'sim' || lower === 'yes') return true;
          if (lower === 'false' || lower === 'desmarcado' || lower === 'nao' || lower === 'não' || lower === 'no') return false;
        }
        return Boolean(v);
      };
      if (toBool(formValue) !== toBool(conditionValue)) return null;
    } else {
      // string compare (tolerant): treat undefined/null as empty string
      const a = formValue == null ? '' : String(formValue).trim();
      const b = conditionValue == null ? '' : String(conditionValue).trim();
      if (a !== b) return null;
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
        {field.type === 'multiselect' && (
          <div className="mt-2 space-y-2">
            {field.options?.map((option) => {
              const isChecked = Array.isArray(formData[field.name]) && formData[field.name].includes(option);
              return (
                <div key={option} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`${field.name}-${option}`}
                    checked={isChecked}
                    onChange={(e) => handleMultiSelectChange(field.name, option, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor={`${field.name}-${option}`} className="ml-2 text-sm text-gray-700 cursor-pointer">
                    {option}
                  </label>
                </div>
              );
            })}
          </div>
        )}
        {field.type === 'number' && (
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9.,]*"
            name={field.name}
            id={field.name}
            className={commonProps.className}
            value={formData[field.name] || ''}
            placeholder={field.numberDecimals ? `0,${'0'.repeat(Number(field.numberDecimals))}` : '0'}
            onChange={(e) => {
              // allow digits, dot or comma and basic editing
              const raw = e.target.value;
              // keep as typed so user sees comma while editing
              setFormData(prev => ({ ...prev, [field.name]: raw }));
            }}
            onBlur={(e) => {
              const v = e.target.value;
              if (v === '' || v == null) return;
              const parsed = parseFloat(String(v).replace(',', '.'));
              if (isNaN(parsed)) {
                // keep raw input if cannot parse
                return;
              }
              // Format using comma as decimal separator
              let outVal: string;
              if (field.numberDecimals != null && Number.isFinite(Number(field.numberDecimals))) {
                outVal = parsed.toFixed(Number(field.numberDecimals));
              } else {
                outVal = String(parsed);
              }
              outVal = outVal.replace('.', ',');
              setFormData(prev => ({ ...prev, [field.name]: outVal }));
            }}
          />
        )}
        {['text', 'email'].includes(field.type) && <input type={field.type} {...commonProps} value={formData[field.name] || ''} />}
        {field.type === 'date' && (() => {
          // helpers to convert stored formatted value to ISO for native inputs
          const formattedToISODate = (v: string) => {
            if (!v) return '';
            // expect dd/mm/yyyy
            const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!m) return '';
            const day = m[1]; const month = m[2]; const year = m[3];
            return `${year}-${month}-${day}`;
          };
          const formattedToISOMonth = (v: string) => {
            if (!v) return '';
            // expect mm/yyyy
            const m = v.match(/^(\d{2})\/(\d{4})$/);
            if (!m) return '';
            const month = m[1]; const year = m[2];
            return `${year}-${month}`;
          };

          if (field.dateFormat === 'mm/yyyy') {
            return (
              <input
                type="month"
                {...commonProps}
                value={formattedToISOMonth(formData[field.name] || '')}
                onChange={handleInputChange}
              />
            );
          }

          // default: full date with native calendar
          return (
            <input
              type="date"
              {...commonProps}
              value={formattedToISODate(formData[field.name] || '')}
              onChange={handleInputChange}
            />
          );
        })()}
        {field.type === 'telefone' && (
          <input
            type="text"
            {...commonProps}
            value={formData[field.name] || ''}
            onChange={(e) => {
              // preserve digits and format for display
              const raw = e.target.value;
              const formatted = formatPhone(raw);
              // store formatted string so previews and saves show masked value (uppercase)
              setFormData(prev => ({ ...prev, [field.name]: formatted.toUpperCase() }));
            }}
            onPaste={(e) => {
              const paste = (e as React.ClipboardEvent<HTMLInputElement>).clipboardData.getData('Text') || '';
              const formatted = formatPhone(paste);
              e.preventDefault();
              setFormData(prev => ({ ...prev, [field.name]: formatted.toUpperCase() }));
            }}
            placeholder="(47) 99999-9999"
          />
        )}
        {field.type === 'endereco' && (
          <div className="relative flex items-center">
            <input
              type="text"
              {...commonProps}
              value={formData[field.name] || ''}
              placeholder="Digite o endereço..."
              onChange={(e) => {
                const v = e.target.value;
                setFormData(prev => ({ ...prev, [field.name]: v }));
                scheduleAddressQuery(field.name, v);
              }}
              autoComplete="off"
            />
            <button
              type="button"
              title="Abrir mapa"
              className="ml-2 p-2 text-gray-500 hover:text-gray-700"
              onClick={() => {
                // Prefer coordinates already stored in formData, else use first suggestion, else fallback
                const latKey = `${field.name}__lat`;
                const lonKey = `${field.name}__lon`;
                let lat = formData[latKey] ? parseFloat(String(formData[latKey])) : undefined;
                let lon = formData[lonKey] ? parseFloat(String(formData[lonKey])) : undefined;
                const sugg = (addressSuggestions[field.name] && addressSuggestions[field.name][0]) || null;
                if ((!lat || !lon) && sugg) {
                  lat = parseFloat(sugg.lat);
                  lon = parseFloat(sugg.lon);
                }
                setMapModal({ open: true, field: field.name, lat: lat, lon: lon });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9l-4.95 4.95a1 1 0 01-1.414 0L3.636 13.95a7 7 0 011.414-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </button>
            {addressSuggestions[field.name] && addressSuggestions[field.name].length > 0 && (
              <ul className="address-suggestion absolute z-20 left-0 right-0 bg-white border mt-1 rounded max-h-48 overflow-auto text-sm">
                {addressSuggestions[field.name].map((s: any, i) => (
                  <li key={i} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                    // set selected address (short) and clear suggestions; also store lat/lon under fieldname__lat/long
                    const short = (s.short_name || s.display_name || '').toUpperCase();
                    setFormData(prev => ({ ...prev, [field.name]: short, [`${field.name}__lat`]: s.lat, [`${field.name}__lon`]: s.lon }));
                    setAddressSuggestions(prev => ({ ...prev, [field.name]: [] }));
                  }}>{s.short_name || s.display_name}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {field.type === 'cpfcnpj' && (
          <div className="flex items-center space-x-2">
            <select
              value={cpfCnpjMode[field.name] || 'cpf'}
              onChange={(e) => setCpfCnpjMode(prev => ({ ...prev, [field.name]: e.target.value as any }))}
              className="px-2 py-1 border rounded"
            >
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
            </select>
            <input
              type="text"
              {...commonProps}
              value={formData[field.name] || ''}
              inputMode="numeric"
              placeholder={cpfCnpjMode[field.name] === 'cnpj' ? '99.999.999/9999-99' : '999.999.999-99'}
              onChange={(e) => {
                const digits = onlyDigits(e.target.value);
                const mode = cpfCnpjMode[field.name] || 'cpf';
                const formatted = mode === 'cnpj' ? formatCNPJ(digits) : formatCPF(digits);
                setFormData(prev => ({ ...prev, [field.name]: formatted.toUpperCase() }));
              }}
              onPaste={(e) => {
                const paste = (e as React.ClipboardEvent<HTMLInputElement>).clipboardData.getData('Text') || '';
                const digits = onlyDigits(paste);
                const mode = cpfCnpjMode[field.name] || 'cpf';
                const formatted = mode === 'cnpj' ? formatCNPJ(digits) : formatCPF(digits);
                e.preventDefault();
                setFormData(prev => ({ ...prev, [field.name]: formatted.toUpperCase() }));
              }}
            />
          </div>
  )}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="relative template-select-container w-full">
              <input
                type="text"
                placeholder={selectedTemplate ? `${selectedTemplate.order || 1} - ${selectedTemplate.title}` : "Digite o número ou nome do modelo..."}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
              />
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 mt-1"
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {isDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                  {filteredAndSortedTemplates.length > 0 ? (
                    filteredAndSortedTemplates.map(template => (
                      <div
                        key={template.id.toString()}
                        className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-green-50 ${
                          selectedTemplateId === template.id.toString() ? 'bg-green-100 text-green-900' : 'text-gray-900'
                        }`}
                        onClick={() => {
                          setSelectedTemplateId(template.id.toString());
                          setSearchTerm('');
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                            {template.order || 1}
                          </span>
                          <span className="block truncate">{template.title}</span>
                        </div>
                        {selectedTemplateId === template.id.toString() && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-green-600">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-2 pl-3 pr-9 text-gray-500">Nenhum modelo encontrado</div>
                  )}
                </div>
              )}
            </div>

            {/* Coluna das anotações (50%) */}
            <div className="w-full">
              <div className="mt-1 p-3 bg-white rounded border text-sm text-gray-700 whitespace-pre-wrap h-[104px] overflow-auto">
                <strong className="block text-xs text-gray-500 mb-1">Anotações</strong>
                {selectedTemplate ? (
                  selectedTemplate.notes ? (
                    <div className="text-sm text-gray-700">{selectedTemplate.notes}</div>
                  ) : (
                    <div className="text-sm text-gray-500">Sem anotações.</div>
                  )
                ) : (
                  <div className="text-sm text-gray-500">Selecione um modelo para ver as anotações.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes modal (apenas FAQ agora) */}
        {faqOpen && selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">FAQ — {selectedTemplate.title}</h3>
                <button onClick={() => setFAQOpen(false)} className="text-gray-500 hover:text-gray-700">Fechar</button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">FAQ</h4>
                  <div className="mt-1 p-3 bg-gray-50 rounded border text-sm whitespace-pre-wrap">{selectedTemplate.faq || 'Sem FAQ.'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTemplate && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-md self-start">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Formulário Dinâmico</h2>
                <form>{activeFields.map(renderField)}</form>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md self-start lg:sticky lg:top-20">
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
                  className="w-full min-h-[18rem] p-3 bg-gray-50 border border-gray-300 rounded-md shadow-inner text-sm font-mono"
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

            {/* Map modal for address precision (Leaflet) */}
            {mapModal.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[70vh] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between p-3 border-b">
                    <h3 className="text-lg font-semibold">Ajustar Localização</h3>
                    <div className="space-x-2">
                      <button onClick={() => setMapModal({ open: false })} className="px-3 py-1 text-sm bg-gray-100 rounded">Fechar</button>
                    </div>
                  </div>
                  <div ref={mapContainerRef} id="map-container" className="flex-1" style={{ minHeight: '300px' }} />
                  <div className="p-3 border-t text-sm text-gray-600">Arraste o marcador para ajustar a posição. Ao soltar, o endereço será atualizado.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;
