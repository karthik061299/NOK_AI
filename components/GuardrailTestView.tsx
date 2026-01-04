
import React, { useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { Guardrail } from '../types';
import { geminiService } from '../services/gemini';
import { ArrowLeft, Play, Loader2, ShieldCheck, ShieldAlert, FileText, Wand2, ArrowRight } from 'lucide-react';

interface GuardrailTestViewProps {
  guardrail: Guardrail;
  onBack: () => void;
}

export const GuardrailTestView: React.FC<GuardrailTestViewProps> = ({ guardrail, onBack }) => {
  const [inputText, setInputText] = useState('');
  const [outputPrompt, setOutputPrompt] = useState('');
  const [inputResult, setInputResult] = useState<{ blocked: boolean; reason: string } | null>(null);
  const [outputResult, setOutputResult] = useState<{ blocked: boolean; reason: string } | null>(null);
  const [isTestingInput, setIsTestingInput] = useState(false);
  const [isTestingOutput, setIsTestingOutput] = useState(false);

  const handleTestInput = async () => {
    if (!inputText.trim()) return;
    setIsTestingInput(true);
    setInputResult(null);
    try {
        const result = await geminiService.testGuardrail(guardrail, inputText, 'input');
        setInputResult(result);
    } catch (e: any) {
        setInputResult({ blocked: true, reason: `An unexpected error occurred: ${e.message}` });
    } finally {
        setIsTestingInput(false);
    }
  };

  const handleTestOutput = async () => {
    if (!outputPrompt.trim()) return;
    setIsTestingOutput(true);
    setOutputResult(null);
    try {
        const result = await geminiService.testGuardrail(guardrail, outputPrompt, 'output');
        setOutputResult(result);
    } catch (e: any) {
        setOutputResult({ blocked: true, reason: `An unexpected error occurred: ${e.message}` });
    } finally {
        setIsTestingOutput(false);
    }
  };

  const ResultDisplay: React.FC<{ result: { blocked: boolean; reason: string } | null }> = ({ result }) => {
    if (!result) return null;
    return (
      <div className={`mt-4 p-4 rounded-lg border ${result.blocked ? 'bg-red-100/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/20' : 'bg-emerald-100/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/20'}`}>
        <div className={`flex items-center gap-3 font-bold text-sm ${result.blocked ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {result.blocked ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          {result.blocked ? 'BLOCKED' : 'ALLOWED'}
        </div>
        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 prose prose-sm prose-invert"><Markdown>{result.reason}</Markdown></div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><ArrowLeft className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:border-zinc-800" />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Test Guardrail: {guardrail.name}</h2>
            <p className="text-xs text-zinc-500">Validate the behavior of your safety policy in isolation.</p>
          </div>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Test Input Guardrail</h3>
            {guardrail.appliesToInput ? (
                <>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Enter text below to check if it would be blocked by this guardrail before being sent to the model.</p>
                    <textarea value={inputText} onChange={e => setInputText(e.target.value)} rows={5} placeholder="Enter text to test against the input guardrail..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm mono focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y" />
                    <button onClick={handleTestInput} disabled={isTestingInput} className="mt-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                        {isTestingInput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {isTestingInput ? 'Testing...' : 'Check Input'}
                    </button>
                    {(isTestingInput || inputResult) && <ResultDisplay result={inputResult} />}
                </>
            ) : (
                <div className="p-6 bg-zinc-100 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg text-center text-sm text-zinc-500">
                    This guardrail is not configured to apply to agent inputs.
                </div>
            )}
          </section>

          <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800" />

          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Wand2 className="w-4 h-4" /> Test Output Guardrail</h3>
            {guardrail.appliesToOutput ? (
                <>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Enter a prompt below. The system will generate a response from a base model and then check if this guardrail would block that response.</p>
                    <textarea value={outputPrompt} onChange={e => setOutputPrompt(e.target.value)} rows={5} placeholder="Enter a prompt to generate an output to test against..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y" />
                    <button onClick={handleTestOutput} disabled={isTestingOutput} className="mt-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                        {isTestingOutput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {isTestingOutput ? 'Generating & Testing...' : 'Check Output'}
                    </button>
                    {(isTestingOutput || outputResult) && <ResultDisplay result={outputResult} />}
                </>
            ) : (
                <div className="p-6 bg-zinc-100 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg text-center text-sm text-zinc-500">
                    This guardrail is not configured to apply to agent outputs.
                </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
