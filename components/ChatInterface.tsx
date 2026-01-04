import React, { useState, useEffect, useRef, useMemo } from 'react';
import Markdown from 'markdown-to-jsx';
import { dbService } from '../services/db';
import { geminiService } from '../services/gemini';
import { ChatMessage, ChatSession, DBModel, Engine, User } from '../types';
import { Send, User as UserIcon, Cpu, Trash2, Loader2, Sparkles, Plus, Search, MessageSquare, History, Edit2, RotateCcw, AlertCircle, X, ChevronUp, ChevronDown, PanelLeftClose, PanelRight } from 'lucide-react';

interface ChatInterfaceProps {
  currentUser: User;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [engines, setEngines] = useState<Engine[]>([]);
  const [models, setModels] = useState<DBModel[]>([]);
  const [selectedEngine, setSelectedEngine] = useState('GoogleAI');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');

  const [sessionSearch, setSessionSearch] = useState('');
  const [isNewChatDraft, setIsNewChatDraft] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isHistoryPanelCollapsed, setIsHistoryPanelCollapsed] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
    const loadLookups = async () => {
      const [e, m] = await Promise.all([dbService.getEngines(), dbService.getModels()]);
      setEngines(e);
      setModels(m);
    };
    loadLookups();
  }, [currentUser]);
  
  const availableModelsForEngine = useMemo(() => {
    if (!selectedEngine) return [];
    const engine = engines.find(e => e.name === selectedEngine);
    if (!engine) return [];
    return models.filter(m => m.engine_id === engine.id && m.is_active && !m.id.includes('embedding'));
  }, [selectedEngine, engines, models]);

  const handleEngineChange = (engineName: string) => {
    const engine = engines.find(e => e.name === engineName);
    if (engine && engine.is_active) {
      setSelectedEngine(engineName);
      const firstModel = models.find(m => m.engine_id === engine.id && m.is_active && !m.id.includes('embedding'));
      setSelectedModel(firstModel ? firstModel.id : '');
    }
  };

  useEffect(() => {
    if (activeSessionId && !isNewChatDraft) {
      loadMessages(activeSessionId);
    } else if (isNewChatDraft) {
      setMessages([]);
    }
  }, [activeSessionId, isNewChatDraft]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const loadSessions = async () => {
    try {
      const data = await dbService.getChatSessions(currentUser.id);
      setSessions(data);
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
    }
  };

  const loadMessages = async (sid: string) => {
    try {
      const data = await dbService.getChatMessagesBySession(sid);
      setMessages(data);
    } catch (e) {
      console.error("Failed to load chat messages:", e);
    }
  };

  const initiateNewChat = () => {
    setActiveSessionId(null);
    setIsNewChatDraft(true);
    setMessages([]);
    setInput('');
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      await dbService.deleteChatSession(sessionToDelete);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
      if (activeSessionId === sessionToDelete) {
        setActiveSessionId(null);
        setMessages([]);
        setIsNewChatDraft(false);
      }
      setSessionToDelete(null);
    } catch (err) {
      console.error("Deletion failed:", err);
      alert("Failed to delete the chat session.");
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSessionToDelete(id);
  };

  const handleEditMessage = async (msg: ChatMessage) => {
    if (msg.role !== 'user') return;
    setInput(msg.content);
    if (activeSessionId && !isNewChatDraft) {
      try {
        await dbService.deleteMessagesAfter(activeSessionId, msg.timestamp);
        setMessages(prev => prev.filter(m => m.timestamp < msg.timestamp));
      } catch (e) {
        console.error("Failed to prune message branch:", e);
      }
    }
  };

  const generateSmartTitle = async (firstMessage: string) => {
    try {
      const response = await geminiService.chat(
        'gemini-3-flash-preview', 
        [{ id: 'temp', session_id: 'temp', role: 'user', content: `Summarize this into a short title (max 5 words): "${firstMessage}"`, timestamp: Date.now() }],
        'You are a title generator. Respond only with the title.'
      );
      return response.text?.trim() || firstMessage.slice(0, 30);
    } catch (e) {
      return firstMessage.slice(0, 30);
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => 
      s.title.toLowerCase().includes(sessionSearch.toLowerCase())
    );
  }, [sessions, sessionSearch]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageContent = input.trim();
    if (!messageContent || isTyping) return;

    let currentSessionId = activeSessionId;
    const isFirstInSession = messages.length === 0;

    if (isNewChatDraft || !currentSessionId) {
      const newSid = crypto.randomUUID();
      const newSession: ChatSession = {
        id: newSid,
        title: 'New Conversation...',
        model: selectedModel,
        timestamp: Date.now(),
        user_id: currentUser.id,
      };
      
      try {
        await dbService.saveChatSession(newSession);
        currentSessionId = newSid;
        setActiveSessionId(newSid);
        setIsNewChatDraft(false);
        setSessions(prev => [newSession, ...prev]);
      } catch (err) {
        console.error("Failed to create chat session:", err);
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: currentSessionId,
      role: 'user',
      content: messageContent,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    
    try {
      await dbService.saveChatMessage(userMsg);

      if (isFirstInSession) {
        generateSmartTitle(messageContent).then(async (smartTitle) => {
          const updatedSession: ChatSession = { id: currentSessionId!, title: smartTitle, model: selectedModel, timestamp: Date.now(), user_id: currentUser.id };
          await dbService.saveChatSession(updatedSession);
          setSessions(prev => prev.map(s => s.id === currentSessionId ? updatedSession : s));
        });
      }

      const history = [...messages, userMsg];
      const result = await geminiService.chat(selectedModel, history, "You are a helpful and intelligent assistant.");

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: currentSessionId,
        role: 'model',
        content: result.text || 'No response generated.',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
      await dbService.saveChatMessage(aiMsg);
    } catch (error: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: currentSessionId,
        role: 'model',
        content: `**System Error:** ${error.message || 'Connection lost.'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || (isNewChatDraft ? { title: 'New Draft', model: selectedModel } : null);

  return (
    <div className="h-full flex bg-zinc-50 dark:bg-[#09090b]">
      {isHistoryPanelCollapsed ? (
        <div className="w-14 border-r border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/30 flex flex-col items-center py-6">
          <button onClick={() => setIsHistoryPanelCollapsed(false)} className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-lg transition-all" title="Expand History">
            <PanelRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/30 flex flex-col relative transition-all duration-300">
          <button onClick={() => setIsHistoryPanelCollapsed(true)} className="absolute top-6 -right-[14px] z-10 p-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-full border-2 border-zinc-50 dark:border-[#09090b]" title="Collapse History">
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
            <button 
              onClick={initiateNewChat}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/10"
            >
              <Plus className="w-5 h-5" /> New Chat
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search history..." 
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            <button onClick={() => setIsHistoryCollapsed(p => !p)} className="w-full flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">
              <span className="flex items-center gap-2"><History className="w-3.5 h-3.5" /> Recent Activity</span>
              <ChevronUp className={`w-4 h-4 transition-transform ${isHistoryCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 space-y-2 ${isHistoryCollapsed ? 'max-h-0' : 'max-h-[1000px]'}`}>
              {filteredSessions.map(s => (
                <div key={s.id} className="group relative">
                  <button
                    onClick={() => {
                      setActiveSessionId(s.id);
                      setIsNewChatDraft(false);
                      const modelInfo = models.find(m => m.id === s.model);
                      if (modelInfo) {
                        const engineInfo = engines.find(e => e.id === modelInfo.engine_id);
                        if (engineInfo) {
                          setSelectedEngine(engineInfo.name);
                          setSelectedModel(s.model);
                        }
                      }
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition-all pr-12 ${
                      activeSessionId === s.id && !isNewChatDraft ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-300 dark:border-indigo-600/40' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-bold truncate text-zinc-800 dark:text-zinc-300">
                      {s.title}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-2">
                      <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                      <span className="mono uppercase">{models.find(m => m.id === s.model)?.name || 'Unknown'}</span>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => handleDeleteClick(s.id, e)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                    title="Delete Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <div className="py-20 text-center opacity-50 flex flex-col items-center text-zinc-500 dark:text-zinc-700">
                  <MessageSquare className="w-10 h-10 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">No chats found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {(activeSessionId || isNewChatDraft) ? (
          <>
            <header className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-600/20 text-indigo-500 dark:text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-600/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{activeSession?.title}</h2>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-500">{models.find(m => m.id === activeSession?.model)?.name || ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <select
                      disabled={!isNewChatDraft}
                      value={selectedEngine}
                      onChange={(e) => handleEngineChange(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-zinc-800 dark:text-zinc-300 outline-none disabled:opacity-40 appearance-none"
                    >
                      {engines.map(engine => (
                        <option key={engine.id} value={engine.name} disabled={!engine.is_active} title={!engine.is_active ? "This model is currently unavailable." : ""}>
                          {engine.name === 'GoogleAI' ? 'Google AI' : engine.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                 </div>
                 <div className="relative">
                    <select
                      disabled={!isNewChatDraft || !selectedEngine}
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-zinc-800 dark:text-zinc-300 outline-none disabled:opacity-40 appearance-none"
                    >
                      {availableModelsForEngine.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                </div>
                <button onClick={initiateNewChat} className="p-2 text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="Restart Draft">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-50 dark:opacity-30 text-center space-y-4">
                   <div className="w-20 h-20 bg-indigo-100/50 dark:bg-indigo-600/5 rounded-full flex items-center justify-center border border-indigo-200 dark:border-indigo-600/10">
                     <MessageSquare className="w-10 h-10 text-indigo-500/50" />
                   </div>
                   <div className="max-w-xs">
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mb-1">New Conversation</h3>
                    <p className="text-xs text-zinc-500">Send a message to begin. The chat title will be generated automatically based on context.</p>
                   </div>
                </div>
              )}
              
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group/msg`}>
                  <div className={`flex gap-5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-lg ${
                      msg.role === 'user' ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500' : 'bg-indigo-600 border-indigo-500 text-white'
                    }`}>
                      {msg.role === 'user' ? <UserIcon className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                    </div>
                    <div className="relative">
                      <div className={`p-5 rounded-2xl shadow-xl border ${
                        msg.role === 'user' ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tr-none' : 'bg-white dark:bg-[#0c0c0e] border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none'
                      }`}>
                        <div className="prose prose-sm prose-invert">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                        <div className="text-[9px] text-zinc-400 dark:text-zinc-600 mt-3 font-bold uppercase tracking-tighter">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {msg.role === 'user' && (
                        <button 
                          onClick={() => handleEditMessage(msg)}
                          className="absolute -left-12 top-2 p-2.5 bg-white/80 dark:bg-zinc-900/80 rounded-xl text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 opacity-0 group-hover/msg:opacity-100 transition-all border border-zinc-200 dark:border-zinc-800 shadow-xl"
                          title="Edit and Re-branch"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex gap-5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 border border-indigo-500 flex items-center justify-center text-white shadow-lg">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div className="p-5 bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-none text-zinc-500 dark:text-zinc-400 text-xs italic flex items-center gap-3">
                      <span className="flex gap-1">
                        <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce"></span>
                      </span>
                      Synthesizing intelligence...
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/50">
              <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-4">
                <input
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question or request a task..."
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl px-6 py-5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-inner"
                  autoFocus
                />
                <button
                  type="submit" 
                  disabled={!input.trim() || isTyping}
                  className={`w-16 h-16 flex items-center justify-center rounded-2xl shadow-xl transition-all ${
                    !input.trim() || isTyping 
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 shadow-indigo-600/20'
                  }`}
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-8 opacity-50 dark:opacity-40 grayscale text-center">
            <Sparkles className="w-32 h-32 text-indigo-500" />
            <div className="max-w-md">
              <h3 className="font-cinzel text-4xl font-bold text-zinc-800 dark:text-zinc-100 mb-4">NOK AI</h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-medium">
                Engage in specialized dialogues with Gemini models. Brainstorm agent configurations, debug code, or orchestrate complex multi-agent workflows through conversation.
              </p>
            </div>
            <button 
              onClick={initiateNewChat}
              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all opacity-100 grayscale-0 shadow-2xl shadow-indigo-600/20"
            >
              Start Intelligence Session
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-amber-500 mb-6">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Delete Conversation?</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
              This will permanently remove the conversation and all associated message history from the database. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setSessionToDelete(null)}
                className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteSession}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
            <button 
              onClick={() => setSessionToDelete(null)}
              className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};