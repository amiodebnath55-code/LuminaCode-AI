import React, { useState, useRef, useEffect } from 'react';
import { 
  Code, Sparkles, Trash2, Copy, Check, RefreshCw, 
  Cpu, ArrowUp, Plus, Image, FileText, CheckCircle2, X, Brain,
  Pin, PanelLeft, MessageSquare, MessageSquarePlus
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
}

interface SavedChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  pinned: boolean;
  updatedAt: number;
}

const STORAGE_KEY = 'luminacode_saved_chats_v1';

export default function App() {
  const [model, setModel] = useState('gemini-4-hydrogen');
  const [thinkingMode, setThinkingMode] = useState<'fast' | 'reasonable' | 'logical' | 'high_think'>('high_think');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Saved Chats State
  const [chats, setChats] = useState<SavedChat[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage parse errors
    }
    return [];
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sorted = [...parsed].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return b.updatedAt - a.updatedAt;
          });
          return sorted[0].id;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // Plus Menu & Model/Thinking Selector State
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isThinkingSelectorOpen, setIsThinkingSelectorOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMessage, setInputMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persist chats to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      // ignore quota errors
    }
  }, [chats]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const messages = activeChat ? activeChat.messages : [];

  // Sort chats: pinned first, then most recently updated
  const sortedChats = [...chats].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeChatId]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
        setIsModelSelectorOpen(false);
        setIsThinkingSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Create a new saved chat
  const handleNewChat = () => {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newChat: SavedChat = {
      id: newId,
      title: 'New Chat',
      messages: [],
      pinned: false,
      updatedAt: Date.now(),
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newId);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Pin / Unpin any chat
  const handleTogglePin = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    const target = chats.find(c => c.id === chatId);
    if (!target) return;
    const nextPinned = !target.pinned;
    setChats(prev =>
      prev.map(c => (c.id === chatId ? { ...c, pinned: nextPinned } : c))
    );
    showToast(nextPinned ? `Pinned "${target.title}"` : `Unpinned "${target.title}"`);
  };

  // Delete any chat
  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    const target = chats.find(c => c.id === chatId);
    const remaining = chats.filter(c => c.id !== chatId);
    setChats(remaining);

    if (activeChatId === chatId) {
      if (remaining.length > 0) {
        const nextSorted = [...remaining].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        });
        setActiveChatId(nextSorted[0].id);
      } else {
        setActiveChatId(null);
      }
    }

    if (target) {
      showToast(`Deleted "${target.title}"`);
    }
  };

  // Handle Chat Send
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedPhoto) || loading) return;

    const userText = inputMessage;
    const userImage = selectedPhoto;
    const userMsg: ChatMessage = {
      role: 'user',
      text: userText,
      image: userImage || undefined,
    };

    setInputMessage('');
    setSelectedPhoto(null);

    let targetChatId = activeChatId;
    let previousMessages: ChatMessage[] = [];

    if (!targetChatId || !chats.some(c => c.id === targetChatId)) {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const titleText = userText.trim()
        ? userText.trim().slice(0, 38) + (userText.trim().length > 38 ? '...' : '')
        : 'Photo Chat';
      const createdChat: SavedChat = {
        id: newId,
        title: titleText,
        messages: [userMsg],
        pinned: false,
        updatedAt: Date.now(),
      };
      targetChatId = newId;
      previousMessages = [];
      setChats(prev => [createdChat, ...prev]);
      setActiveChatId(newId);
    } else {
      const existing = chats.find(c => c.id === targetChatId)!;
      previousMessages = existing.messages;
      const shouldUpdateTitle = existing.messages.length === 0 && existing.title === 'New Chat';
      const nextTitle = shouldUpdateTitle
        ? (userText.trim()
            ? userText.trim().slice(0, 38) + (userText.trim().length > 38 ? '...' : '')
            : 'Photo Chat')
        : existing.title;

      setChats(prev =>
        prev.map(c =>
          c.id === targetChatId
            ? {
                ...c,
                title: nextTitle,
                messages: [...c.messages, userMsg],
                updatedAt: Date.now(),
              }
            : c
        )
      );
    }

    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText + (userImage ? ' [Attached Photo]' : ''),
          model,
          thinkingLevel: getThinkingLevelValue(thinkingMode),
          history: previousMessages.map(h => ({
            role: h.role,
            text: h.text || '[Attached Photo]',
          })),
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          res.ok
            ? 'Unexpected response from server.'
            : `Backend API is unavailable (HTTP ${res.status}). Static hosting like GitHub Pages serves the UI only without the Node.js /api/chat server.`
        );
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);

      const modelMsg: ChatMessage = { role: 'model', text: data.text };
      setChats(prev =>
        prev.map(c =>
          c.id === targetChatId
            ? { ...c, messages: [...c.messages, modelMsg], updatedAt: Date.now() }
            : c
        )
      );
    } catch (err: any) {
      const errMsg: ChatMessage = {
        role: 'model',
        text: `Error: ${err.message || 'Failed to get response'}`,
      };
      setChats(prev =>
        prev.map(c =>
          c.id === targetChatId
            ? { ...c, messages: [...c.messages, errMsg], updatedAt: Date.now() }
            : c
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Copy code helper
  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePlusOption = (action: string) => {
    setIsPlusMenuOpen(false);
    setIsModelSelectorOpen(false);
    setIsThinkingSelectorOpen(false);
    
    if (action === 'model_change') {
      setIsModelSelectorOpen(true);
    } else if (action === 'thinking') {
      setIsThinkingSelectorOpen(true);
    } else if (action === 'photos') {
      fileInputRef.current?.click();
    } else if (action === 'files') {
      setInputMessage('Here is the attached file content: ');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setSelectedPhoto(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const modelsList = [
    { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', desc: 'Fast & balanced general tasks' },
    { id: 'gemini-4-argon', name: 'Gemini 4 Argon', desc: 'Complex interactive coding & reasoning' },
    { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon', desc: 'Deep reasoning & high thinking mode' },
    { id: 'gemini-3.1-flash-lite', name: 'Flash Lite', desc: 'Lightning fast low-latency tasks' },
  ];

  const thinkingOptions: Array<{
    id: 'fast' | 'logical' | 'high_think' | 'reasonable';
    name: string;
    level: string;
    desc: string;
  }> = [
    { id: 'fast', name: 'Fast', level: 'LOW', desc: 'Quick, low-latency responses' },
    { id: 'logical', name: 'Logical', level: 'HIGH', desc: 'Structured step-by-step reasoning' },
    { id: 'high_think', name: 'High Think', level: 'XHIGH', desc: 'Maximum deep reasoning depth' },
    { id: 'reasonable', name: 'Reasonable', level: 'MEDIUM', desc: 'Balanced depth and speed' },
  ];

  const getModelDisplayName = (id: string) => {
    return modelsList.find(m => m.id === id)?.name || id;
  };

  const getThinkingDisplayName = (id: string) => {
    return thinkingOptions.find(t => t.id === id)?.name || id;
  };

  const getThinkingLevelValue = (id: string) => {
    return thinkingOptions.find(t => t.id === id)?.level || 'HIGH';
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950 relative overflow-hidden">
      {/* Hidden Real Device Gallery Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-cyan-950/90 border border-cyan-500/40 text-cyan-200 px-6 py-3 rounded-2xl shadow-2xl shadow-cyan-950/80 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 flex items-center space-x-3 text-sm">
          <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sleek Minimalist Cyan Liquid Glass Navigation Bar (No Model Changer at Top) */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-cyan-500/20 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-lg shadow-cyan-950/30 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(prev => !prev)}
            title="Toggle Saved Chats"
            className="p-2 rounded-xl bg-slate-900/80 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-950/50 transition-colors"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-cyan-500/30 flex items-center justify-center">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Code className="h-4 w-4 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-200 bg-clip-text text-transparent">
              LUMINA<span className="text-white">CODE</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 font-mono">
              Active: {getModelDisplayName(model)} • {getThinkingDisplayName(thinkingMode)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleNewChat}
            title="New Chat"
            className="px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors flex items-center space-x-1.5 text-xs font-medium"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {activeChat && (
            <button 
              type="button"
              onClick={() => {
                setChats(prev =>
                  prev.map(c =>
                    c.id === activeChat.id ? { ...c, messages: [], updatedAt: Date.now() } : c
                  )
                );
                showToast(`Cleared messages in "${activeChat.title}"`);
              }}
              title="Clear Current Messages"
              className="p-2 rounded-xl bg-slate-900/80 border border-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors flex items-center space-x-1.5 text-xs"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </header>

      {/* Body: Saved Chats Sidebar + Full-Screen Chat Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 top-[65px] bg-slate-950/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}

        {/* Saved Chats Sidebar */}
        {isSidebarOpen && (
          <aside className="fixed lg:static top-[65px] bottom-0 left-0 z-30 w-72 bg-slate-900/90 lg:bg-slate-900/50 backdrop-blur-2xl border-r border-cyan-500/20 flex flex-col shrink-0">
            <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between">
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-400">
                SAVED CHATS
              </span>
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-500/20">
              {sortedChats.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 text-slate-500">
                  <MessageSquare className="h-8 w-8 text-cyan-500/30 mb-3" />
                  <p className="text-sm font-medium text-slate-400">No chat found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Start a new conversation to save it here.
                  </p>
                </div>
              ) : (
                sortedChats.map(chat => {
                  const isActive = chat.id === activeChatId;
                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        setActiveChatId(chat.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-100 shadow-md shadow-cyan-950/30'
                          : 'bg-slate-950/40 border-transparent hover:bg-slate-800/60 hover:border-cyan-500/20 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {chat.pinned ? (
                          <Pin className="h-3.5 w-3.5 text-cyan-400 shrink-0 fill-cyan-400/40" />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{chat.title}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {chat.messages.length} {chat.messages.length === 1 ? 'msg' : 'msgs'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(e, chat.id)}
                          title={chat.pinned ? 'Unpin chat' : 'Pin chat'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            chat.pinned
                              ? 'text-cyan-400 bg-cyan-500/15 hover:bg-cyan-500/25'
                              : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                          }`}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteChat(e, chat.id)}
                          title="Delete chat"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Full-Screen Immersive Chat Container */}
        <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-4 py-6 justify-between h-full overflow-hidden relative">
          {/* Message Thread or Empty State */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4 scrollbar-thin scrollbar-thumb-cyan-500/20">
            {chats.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-center mb-4 shadow-xl shadow-cyan-950/40">
                  <MessageSquare className="h-8 w-8 text-cyan-400/70" />
                </div>
                <h2 className="text-xl font-bold text-slate-200">No chat found</h2>
                <p className="text-sm text-slate-400 mt-2 max-w-md">
                  Type a message below or click New Chat to start and save a conversation on any topic.
                </p>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="mt-5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  <span>Start New Chat</span>
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="h-14 w-14 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-center mb-4 shadow-xl shadow-cyan-950/40">
                  <Sparkles className="h-7 w-7 text-cyan-400" />
                </div>
                <h2 className="text-lg font-semibold text-cyan-200">{activeChat?.title || 'New Chat'}</h2>
                <p className="text-sm text-slate-400 mt-1.5 max-w-md">
                  Ask anything below. This conversation will be automatically saved.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-3xl rounded-3xl px-6 py-4 text-sm md:text-base leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-xl shadow-cyan-950/50 rounded-br-sm'
                      : 'bg-slate-900/80 backdrop-blur-xl border border-cyan-500/20 text-slate-100 shadow-2xl rounded-bl-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-2 text-xs opacity-75 font-mono">
                      <span className="font-bold tracking-wider">{msg.role === 'user' ? 'YOU' : 'LUMINACODE AI'}</span>
                      <button 
                        onClick={() => copyToClipboard(msg.text, idx)}
                        className="hover:text-cyan-300 transition-colors flex items-center space-x-1 ml-4"
                      >
                        {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    {msg.image && (
                      <div className="mb-3 rounded-2xl overflow-hidden border border-cyan-500/30 max-h-60 max-w-xs">
                        <img src={msg.image} alt="User Attachment" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-900/80 backdrop-blur-xl border border-cyan-500/20 rounded-3xl px-6 py-4 text-sm text-cyan-400 flex items-center space-x-3 shadow-xl">
                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                  <span>Thinking in {getThinkingDisplayName(thinkingMode)} mode...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Plus Popup Menu & Model/Thinking Selector Popups */}
          <div ref={plusMenuRef} className="relative w-full shrink-0">
            {isPlusMenuOpen && (
              <div className="absolute bottom-20 left-0 w-64 bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-2 shadow-2xl shadow-cyan-950/80 z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="text-xs font-mono text-cyan-400 px-3 py-2 border-b border-cyan-500/20">
                  TOOLS & DEVICE GALLERY
                </div>
                <div className="py-1 space-y-1">
                  <button
                    onClick={() => handlePlusOption('photos')}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-cyan-950/50 hover:text-cyan-300 transition-colors text-left"
                  >
                    <Image className="h-4 w-4 text-cyan-400" />
                    <span>Photos (Device Gallery)</span>
                  </button>
                  <button
                    onClick={() => handlePlusOption('files')}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-cyan-950/50 hover:text-cyan-300 transition-colors text-left"
                  >
                    <FileText className="h-4 w-4 text-cyan-400" />
                    <span>Files & Documents</span>
                  </button>
                  <button
                    onClick={() => handlePlusOption('thinking')}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-cyan-950/50 hover:text-cyan-300 transition-colors text-left"
                  >
                    <Brain className="h-4 w-4 text-cyan-400" />
                    <span>Thinking</span>
                  </button>
                  <button
                    onClick={() => handlePlusOption('model_change')}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/80 transition-colors text-left font-semibold border border-cyan-500/20"
                  >
                    <Cpu className="h-4 w-4 text-cyan-400" />
                    <span>AI Model Change</span>
                  </button>
                </div>
              </div>
            )}

            {/* Model Selector Popup */}
            {isModelSelectorOpen && (
              <div className="absolute bottom-20 left-0 w-80 bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-3 shadow-2xl shadow-cyan-950/80 z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-cyan-500/20 px-3 py-2">
                  <span className="text-xs font-mono text-cyan-400 font-bold">SELECT AI MODEL</span>
                  <button 
                    onClick={() => setIsModelSelectorOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>
                <div className="py-2 space-y-1.5">
                  {modelsList.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        const oldName = getModelDisplayName(model);
                        setModel(m.id);
                        const newName = m.name;
                        setIsModelSelectorOpen(false);
                        showToast(`AI model changed from ${oldName} to ${newName}`);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between ${
                        model === m.id
                          ? 'bg-cyan-600/20 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950/40'
                          : 'bg-slate-950/60 border-cyan-500/10 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{m.name}</div>
                        <div className="text-xs text-slate-400">{m.desc}</div>
                      </div>
                      {model === m.id && <CheckCircle2 className="h-5 w-5 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Thinking Selector Popup */}
            {isThinkingSelectorOpen && (
              <div className="absolute bottom-20 left-0 w-80 bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-3 shadow-2xl shadow-cyan-950/80 z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-cyan-500/20 px-3 py-2">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-mono text-cyan-400 font-bold">THINKING MODE</span>
                  </div>
                  <button 
                    onClick={() => setIsThinkingSelectorOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>
                <div className="py-2 space-y-1.5">
                  {thinkingOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        const oldName = getThinkingDisplayName(thinkingMode);
                        setThinkingMode(opt.id);
                        setIsThinkingSelectorOpen(false);
                        showToast(`Thinking mode changed from ${oldName} to ${opt.name}`);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between ${
                        thinkingMode === opt.id
                          ? 'bg-cyan-600/20 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950/40'
                          : 'bg-slate-950/60 border-cyan-500/10 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{opt.name}</div>
                        <div className="text-xs text-slate-400">{opt.desc}</div>
                      </div>
                      {thinkingMode === opt.id && <CheckCircle2 className="h-5 w-5 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Photo Preview Chip (Before Sending) */}
            {selectedPhoto && (
              <div className="mb-2 flex items-center space-x-3 bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-2 w-fit">
                <div className="h-12 w-12 rounded-xl overflow-hidden border border-cyan-400/50">
                  <img src={selectedPhoto} alt="Selected preview" className="h-full w-full object-cover" />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-cyan-300 block">Gallery Photo Attached</span>
                  <span className="text-slate-400">Ready to send with message</span>
                </div>
                <button 
                  onClick={() => setSelectedPhoto(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Input Bar with Plus Icon on Left & Thin Arrow Up on Right */}
            <form onSubmit={handleSendChat} className="relative flex items-center w-full bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-2.5 shadow-2xl shadow-cyan-950/60 space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsPlusMenuOpen(!isPlusMenuOpen);
                  setIsModelSelectorOpen(false);
                  setIsThinkingSelectorOpen(false);
                }}
                className="h-10 w-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-cyan-400 flex items-center justify-center transition-all border border-cyan-500/20 shadow-inner"
                title="Add attachment or tools"
              >
                <Plus className={`h-5 w-5 transition-transform ${isPlusMenuOpen ? 'rotate-45' : ''}`} />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask LuminaCode anything or use '+' for gallery photos & models..."
                className="flex-1 bg-transparent px-2 py-3 text-sm md:text-base text-slate-100 placeholder-slate-500 outline-none"
              />

              <button
                type="submit"
                disabled={loading || (!inputMessage.trim() && !selectedPhoto)}
                className="h-10 w-10 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 flex items-center justify-center transition-all shadow-lg shadow-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send message"
              >
                <ArrowUp className="h-5 w-5 stroke-[2.5]" />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
