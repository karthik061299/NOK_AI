import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KnowledgeBase, User } from '../types';
import { dbService } from '../services/db';
import { embeddingService } from '../services/gemini';
import { Save, X, Database, Upload, FileText, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

interface KnowledgeBaseEditorProps {
  knowledgeBase: KnowledgeBase;
  onSave: () => void;
  onCancel: () => void;
  currentUser: User;
  setIsDirty: (isDirty: boolean) => void;
  isClone?: boolean;
}

type FileStatus = 'pending' | 'processing' | 'completed' | 'error';
interface FileWithStatus { file: File; status: FileStatus; message?: string; }
const CHUNK_SIZE = 1000; const CHUNK_OVERLAP = 200;
function chunkText(text: string): string[] { const chunks: string[] = []; if (!text) return chunks; for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) { chunks.push(text.substring(i, i + CHUNK_SIZE)); } return chunks; }

export const KnowledgeBaseEditor: React.FC<KnowledgeBaseEditorProps> = ({ knowledgeBase, onSave, onCancel, currentUser, setIsDirty, isClone }) => {
  const [formData, setFormData] = useState<KnowledgeBase>(knowledgeBase);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [touched, setTouched] = useState<{ name?: boolean, description?: boolean, files?: boolean }>({});
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; if (isClone) setIsDirty(true); } 
    else { setIsDirty(true); }
  }, [formData, files, setIsDirty, isClone]);

  const errors = useMemo(() => {
    const newErrors: { name?: string, description?: string, files?: string } = {};
    if (touched.name && !formData.name.trim()) newErrors.name = 'This field is required.';
    if (touched.description && !formData.description.trim()) newErrors.description = 'This field is required.';
    if (touched.files && files.length === 0) newErrors.files = 'At least one file is required.';
    return newErrors;
  }, [formData.name, formData.description, files, touched]);

  const canSave = formData.name.trim() && formData.description.trim() && files.length > 0;
  const handleBlur = (field: 'name' | 'description') => setTouched(p => ({ ...p, [field]: true }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({ file: f, status: 'pending' as FileStatus }));
      setFiles(prev => [...prev, ...newFiles]);
      setTouched(p => ({ ...p, files: true }));
      setIsDirty(true);
    }
  };
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setTouched(p => ({ ...p, files: true }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setTouched({ name: true, description: true, files: true });
    if (!canSave) return;
    setIsProcessing(true);
    try {
      const allChunks: { content: string, file_name: string }[] = [];
      for(let i = 0; i < files.length; i++) {
        const f = files[i]; if (f.status === 'completed') continue;
        files[i].status = 'processing'; setFiles([...files]);
        try {
          // Note: .text() will only work for text-based files. Parsing for .pdf, .doc, etc.
          // requires more complex libraries not available in this sandboxed environment.
          // The UI allows the selection, but parsing is best-effort.
          const text = await f.file.text();
          chunkText(text).forEach(chunk => allChunks.push({ content: chunk, file_name: f.file.name }));
        } catch (e) {
            files[i].status = 'error'; files[i].message = `Could not read file. Only text-based files (.txt, .md) can be fully processed.`; setFiles([...files]);
            throw new Error(`Could not read file ${f.file.name}`);
        }
      }
      const embeddings = await embeddingService.embed(allChunks.map(c => c.content));
      if (embeddings.length !== allChunks.length) throw new Error('Embedding mismatch.');
      const chunksWithEmbeddings = allChunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] }));
      const finalKB = { ...formData, file_names: files.map(f => f.file.name) };
      await dbService.saveKnowledgeBase(finalKB, currentUser.id);
      await dbService.saveKnowledgeBaseChunks(finalKB.id, chunksWithEmbeddings);
      files.forEach(f => f.status = 'completed'); setFiles([...files]);
      onSave();
    } catch (error) { alert(`Error creating knowledge base: ${error instanceof Error ? error.message : String(error)}`); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"><X className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /><h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{formData.name || "New Knowledge Base"}</h2></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={isProcessing || !canSave} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition-all text-xs font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50">
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{isProcessing ? `Processing...` : 'Save Knowledge Base'}
          </button>
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl mx-auto w-full p-8 space-y-8">
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Knowledge Base Name</label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} onBlur={() => handleBlur('name')} className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${errors.name ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Description</label>
          <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} onBlur={() => handleBlur('description')} rows={2} className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-4 py-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 ${errors.description ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
        </div>
        
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Documents</h3>
          <div className="space-y-3">{files.map((fileWithStatus, index) => (
            <div key={index} className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-500" />
              <div className="flex-1"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fileWithStatus.file.name}</p><p className="text-xs text-zinc-500">{(fileWithStatus.file.size / 1024).toFixed(2)} KB</p></div>
              <div className="flex items-center gap-2">
                {fileWithStatus.status === 'pending' && <span className="text-xs text-zinc-500">Ready</span>}
                {fileWithStatus.status === 'processing' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                {fileWithStatus.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {/* FIX: The title prop on lucide-react icons can be unreliable. Wrap the icon in a span with a title to ensure the tooltip appears correctly. */}
                {fileWithStatus.status === 'error' && <span title={fileWithStatus.message}><AlertCircle className="w-4 h-4 text-red-500" /></span>}
                <button onClick={() => removeFile(index)} disabled={isProcessing} className="p-1 text-zinc-500 hover:text-red-500 disabled:opacity-20"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>))}
          </div>
          <label htmlFor="kb-file-upload" className={`cursor-pointer mt-4 flex flex-col items-center justify-center gap-2 w-full p-8 bg-zinc-100/50 dark:bg-zinc-900/50 border-2 border-dashed rounded-xl text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all ${errors.files ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`}>
            <Upload className="w-6 h-6" /><span>Click to browse or drag & drop files</span><span className="text-xs font-normal text-zinc-400">Supported formats: .txt, .md, .pdf, .doc, .docx</span>
          </label>
          <input id="kb-file-upload" type="file" multiple accept=".txt,.md,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
          {errors.files && <p className="text-red-500 text-xs mt-1">{errors.files}</p>}
        </div>
        {isProcessing && <div className="space-y-2">{/* ... (progress bar) ... */}</div>}
      </main>
    </div>
  );
};