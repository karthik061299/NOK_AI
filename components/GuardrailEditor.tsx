import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Guardrail, User, GuardrailMethod, SemanticCategory, SemanticCategoryList, SemanticGuardrailConfig, KeywordGuardrailConfig, GuardrailAction } from '../types';
import { Save, X, Shield, ShieldCheck, AlertCircle, Check, TestTube, Plus, Trash2, Hash, Ban } from 'lucide-react';

interface GuardrailEditorProps {
  guardrail: Guardrail;
  onSave: (guardrail: Guardrail) => void;
  onTest: (guardrail: Guardrail) => void;
  onCancel: () => void;
  currentUser: User;
  setIsDirty: (isDirty: boolean) => void;
}

const Toggle: React.FC<{ label: string, enabled: boolean, onChange: (enabled: boolean) => void }> = ({ label, enabled, onChange }) => (
  <button onClick={() => onChange(!enabled)} className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${enabled ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500' : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400'}`}>
    <span className={`font-bold text-sm ${enabled ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300'}`}>{label}</span>
    <div className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${enabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
      <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </div>
  </button>
);

const ActionToggle: React.FC<{ action: GuardrailAction, onChange: (action: GuardrailAction) => void, size?: 'sm' | 'md' }> = ({ action, onChange, size = 'md' }) => {
    const isBlock = action === 'block';
    const buttonSize = size === 'sm' ? 'px-2.5 py-1.5 text-[10px]' : 'px-4 py-2 text-xs';
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

    return (
        <div className="flex rounded-lg bg-zinc-200 dark:bg-zinc-800 p-0.5">
            <button 
                onClick={() => onChange('block')}
                className={`${buttonSize} flex items-center gap-1.5 rounded-md font-bold transition-colors ${isBlock ? 'bg-white dark:bg-zinc-700 text-red-600 dark:text-red-400 shadow' : 'text-zinc-500 hover:bg-white/50 dark:hover:bg-black/10'}`}
            >
                <Ban className={iconSize} /> Block
            </button>
            <button 
                onClick={() => onChange('hash')}
                className={`${buttonSize} flex items-center gap-1.5 rounded-md font-bold transition-colors ${!isBlock ? 'bg-white dark:bg-zinc-700 text-sky-600 dark:text-sky-400 shadow' : 'text-zinc-500 hover:bg-white/50 dark:hover:bg-black/10'}`}
            >
                <Hash className={iconSize} /> Hash
            </button>
        </div>
    );
};

export const GuardrailEditor: React.FC<GuardrailEditorProps> = ({ guardrail, onSave, onTest, onCancel, currentUser, setIsDirty }) => {
  const [formData, setFormData] = useState<Guardrail>(guardrail);
  const [newKeyword, setNewKeyword] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
    } else {
        setIsDirty(true);
    }
  }, [formData, setIsDirty]);

  const handleMethodChange = (method: GuardrailMethod) => {
    setFormData(prev => {
        const base = { ...prev, method };
        if (method === 'semantic_classifier') {
            return { ...base, config: { ...prev.config, categories: prev.config.categories || [] } };
        } else {
            return { ...base, config: { ...prev.config, keywords: prev.config.keywords || [] } };
        }
    });
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    setFormData(prev => ({ ...prev, config: { ...prev.config, keywords: [...(prev.config.keywords || []), { value: newKeyword.trim(), action: 'block' }] } }));
    setNewKeyword('');
  };
  const handleRemoveKeyword = (index: number) => setFormData(prev => ({ ...prev, config: { ...prev.config, keywords: prev.config.keywords?.filter((_, i) => i !== index) } }));
  const handleKeywordActionChange = (index: number, action: GuardrailAction) => setFormData(prev => ({ ...prev, config: { ...prev.config, keywords: prev.config.keywords?.map((kw, i) => i === index ? { ...kw, action } : kw) } }));
  
  const handleCategoryActionChange = (categoryName: string, action: GuardrailAction) => {
      setFormData(prev => {
          const categories = prev.config.categories || [];
          const newCategories = categories.map(c => c.name === categoryName ? { ...c, action } : c);
          return { ...prev, config: { ...prev.config, categories: newCategories }};
      });
  };

  const handleAddCustomTopic = () => {
    const newTopic = customTopic.trim().toUpperCase().replace(/\s+/g, '_');
    if (!newTopic) return;
    const currentCategories = formData.config.categories || [];
    if (currentCategories.some(c => c.name.toUpperCase() === newTopic)) {
        alert('This topic already exists.');
        return;
    }
    setFormData(prev => ({ ...prev, config: { ...prev.config, categories: [...(prev.config.categories || []), { name: newTopic, action: 'block' }] } }));
    setCustomTopic('');
  };
  
  const handleRemoveCustomTopic = (categoryToRemove: string) => setFormData(prev => ({ ...prev, config: { ...prev.config, categories: (prev.config.categories || []).filter(c => c.name !== categoryToRemove) } }));

  const handleAction = (action: (g: Guardrail) => void) => {
    if (!formData.name.trim() || !formData.description.trim()) {
        alert('Please fill in Name and Description.');
        return;
    }

    if (formData.method === 'keyword_filter' && (!formData.config.keywords || formData.config.keywords.length === 0)) {
        alert('Please provide at least one keyword.');
        return;
    }
    if (formData.method === 'semantic_classifier' && (!formData.config.categories || formData.config.categories.length === 0)) {
        alert('Please add at least one restricted topic.');
        return;
    }
    
    action(formData);
  };

  const canSetDefault = currentUser.role === 'Admin' || currentUser.role === 'Owner';

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"><X className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{formData.name || "New Guardrail"}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleAction(onSave)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={() => handleAction(onTest)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition-all text-xs font-bold shadow-lg shadow-indigo-600/20">
            <TestTube className="w-4 h-4" /> Save & Test
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-8 space-y-8">
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Guardrail Name</label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Description</label>
          <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Method</h3>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleMethodChange('keyword_filter')} className={`p-4 rounded-lg border-2 text-left transition-all ${formData.method === 'keyword_filter' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Keyword Filter</h4>
                    <p className="text-xs text-zinc-500 mt-1">Block or hash specific words or phrases.</p>
                </button>
                <button onClick={() => handleMethodChange('semantic_classifier')} className={`p-4 rounded-lg border-2 text-left transition-all ${formData.method === 'semantic_classifier' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Semantic Classifier</h4>
                    <p className="text-xs text-zinc-500 mt-1">Block content based on custom-defined topics.</p>
                </button>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Configuration</h3>
            {formData.method === 'keyword_filter' ? (
                <div className="p-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
                    <div className="flex gap-2">
                        <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="Enter a keyword or phrase..." className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); }}} />
                        <button onClick={handleAddKeyword} className="flex items-center gap-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700"><Plus className="w-4 h-4"/> Add Keyword</button>
                    </div>
                    <div className="space-y-2">
                        {formData.config.keywords?.map((kw, index) => (
                            <div key={index} className="flex items-center justify-between p-2 pl-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{kw.value}</span>
                                <div className="flex items-center gap-2">
                                    <ActionToggle action={kw.action} onChange={(action) => handleKeywordActionChange(index, action)} size="sm" />
                                    <button onClick={() => handleRemoveKeyword(index)} className="p-2 text-zinc-500 hover:text-red-500 dark:hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Restricted Topics</label>
                    <p className="text-xs text-zinc-500 mb-3">Define topics to block or hash. The model will use AI to classify content against these topics to enforce the guardrail.</p>
                     {(formData.config.categories || []).length > 0 && (
                        <div className="space-y-2 mb-4">
                            {formData.config.categories?.map(category => (
                                <div key={category.name} className="flex items-center justify-between p-2 pl-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{category.name.replace(/_/g, ' ')}</span>
                                    <div className="flex items-center gap-2">
                                        <ActionToggle action={category.action} onChange={(action) => handleCategoryActionChange(category.name, action)} size="sm" />
                                        <button onClick={() => handleRemoveCustomTopic(category.name)} className="p-2 text-zinc-500 hover:text-red-500 dark:hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input type="text" value={customTopic} onChange={e => setCustomTopic(e.target.value)} placeholder="e.g., Medical Advice" className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddCustomTopic(); }}} />
                        <button onClick={handleAddCustomTopic} className="flex items-center gap-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700"><Plus className="w-4 h-4"/> Add Topic</button>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
                <Toggle label="Apply to Input" enabled={formData.appliesToInput} onChange={val => setFormData(p => ({...p, appliesToInput: val}))} />
                <Toggle label="Apply to Output" enabled={formData.appliesToOutput} onChange={val => setFormData(p => ({...p, appliesToOutput: val}))} />
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Policy</h3>
            <div className={`p-4 rounded-lg border-2 transition-colors ${formData.isDefault ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500' : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className={`w-6 h-6 ${formData.isDefault ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`} />
                        <div>
                            <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Set as Default</h4>
                            <p className="text-xs text-zinc-500">Apply this guardrail automatically to all new agents.</p>
                        </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${formData.isDefault ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'} ${canSetDefault ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`} onClick={() => canSetDefault && setFormData(p => ({...p, isDefault: !p.isDefault}))}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${formData.isDefault ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </div>
                {!canSetDefault && (
                    <div className="mt-4 p-3 bg-amber-100/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/20 text-xs text-amber-700 dark:text-amber-400 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>Only Admins and Owners can manage default policies.</span>
                    </div>
                )}
            </div>
        </div>

      </main>
    </div>
  );
};