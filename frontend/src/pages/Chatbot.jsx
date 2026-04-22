import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from 'lucide-react';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const logApi = axios.create({ baseURL: API_CONFIG.LOG_BASE_URL });
logApi.interceptors.request.use((config) => {
  const t = localStorage.getItem('accessToken');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

function Markdown({ text }) {
  // Simple markdown: bold, code blocks, inline code, bullet points
  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-black/30 rounded-lg p-3 my-2 overflow-x-auto text-xs text-slate-300 font-mono">
            {codeLines.join('\n')}
          </pre>
        );
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    let processed = line
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs text-blue-300 font-mono">$1</code>');

    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm text-slate-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />
      );
    } else if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-semibold text-white mt-3 mb-1">{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-semibold text-white mt-3 mb-1">{line.slice(3)}</h3>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-slate-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processed }} />
      );
    }
  });

  return <div className="space-y-0.5">{elements}</div>;
}

export default function Chatbot() {
  const { user } = useAuth();
  const tier = (user?.tier || 'FREE').toUpperCase();
  const isFree = tier === 'FREE';

  const storageKey = `durianbot_history_${user?.id || 'anon'}`;
  const greeting = {
    role: 'assistant',
    content: `Hi${user?.first_name ? ` ${user.first_name}` : ''}! I'm **DurianBot**, your security analyst assistant.\n\nI can help you with:\n- Viewing alerts, stats, and threat trends\n- Checking your blacklist and whitelist\n- **Flagging or trusting IPs** (I'll ask you to confirm first)\n- **Creating incidents** from suspicious activity\n- Explaining threats and recommending actions\n\nWhat would you like to do?`,
  };
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [greeting];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch {}
  }, [messages]);

  const clearHistory = () => {
    setMessages([greeting]);
    localStorage.removeItem(storageKey);
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setError('');
    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Send history (skip the initial greeting)
      const history = newMessages.slice(1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await logApi.post('/api/chat', {
        message: msg,
        history: history.slice(0, -1), // Don't include the current message in history
      });

      const actionLabel = res.data.action_taken
        ? { block_ip: 'Flagged IP', trust_ip: 'Trusted IP', create_incident: 'Created Incident', block_all_quarantined: 'Mass Flagged Quarantined', get_stats: null, get_alerts: null, get_blacklist: null, get_whitelist: null }[res.data.action_taken]
        : null;
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply, action: actionLabel }]);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to get a response. Please try again.';
      setError(detail);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${detail}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'How many critical alerts do I have?',
    'What are the top attack sources?',
    'Show me my blacklist',
    'Summarize my threat landscape',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            DurianBot
            {isFree ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/20">Read-only</span>
            ) : (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-3 h-3 inline mr-0.5" />Pro
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500">AI-powered security assistant</p>
        </div>
        {messages.length > 1 && (
          <button onClick={clearHistory} className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/[0.05]">
            <Trash2 className="w-3 h-3" /> Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              msg.role === 'user'
                ? 'bg-blue-600/20 border border-blue-500/20'
                : 'bg-white/[0.06] border border-white/[0.08]'
            }`}>
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-blue-400" />
                : <Bot className="w-4 h-4 text-slate-400" />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-600/15 border border-blue-500/20'
                : 'bg-white/[0.03] border border-white/[0.06]'
            }`}>
              {msg.action && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Action: {msg.action}
                  </span>
                </div>
              )}
              <Markdown text={msg.content} />
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-slate-400" />
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Suggestions (only show if no user messages yet) */}
        {messages.filter((m) => m.role === 'user').length === 0 && !loading && (
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                className="text-xs text-slate-400 border border-white/[0.06] rounded-lg px-3 py-2 hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/5 transition-all cursor-pointer">
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 pt-2 border-t border-white/[0.06]">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask DurianBot about your security data..."
          disabled={loading}
          rows={1}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none disabled:opacity-50"
          style={{ minHeight: '44px', maxHeight: '120px' }}
          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 cursor-pointer shrink-0"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
