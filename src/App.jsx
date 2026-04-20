import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Plus, Moon, Sun, Menu, X, MessageSquare,
  Download, Sparkles
} from 'lucide-react'

const fileIconMap = {
  xlsx: { icon: '📊', color: '#1d6f42', bg: '#e8f5e9' },
  pdf:  { icon: '📄', color: '#d32f2f', bg: '#ffebee' },
  docx: { icon: '📝', color: '#1565c0', bg: '#e3f2fd' },
  pptx: { icon: '📋', color: '#e65100', bg: '#fff3e0' },
  csv:  { icon: '📈', color: '#6a1b9a', bg: '#f3e5f5' },
  html: { icon: '🌐', color: '#0277bd', bg: '#e1f5fe' },
  txt:  { icon: '🗒️', color: '#37474f', bg: '#eceff1' },
};

function getFileStyle(ext) {
  return fileIconMap[ext?.toLowerCase()] || { icon: '📁', color: '#546e7a', bg: '#eceff1' };
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function MdContent({ content }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}

function FileCard({ file }) {
  const ext = file.name?.split('.').pop();
  const style = getFileStyle(ext);
  return (
    <div className="file-card">
      <div className="file-icon" style={{ background: style.bg, color: style.color }}>{style.icon}</div>
      <div className="file-card-body">
        <div className="file-card-name">{file.name}</div>
        <div className="file-card-meta">{file.summary}</div>
        <a className="download-btn" href={file.url} download={file.name} target="_blank" rel="noreferrer">
          <Download size={14} /> Download {ext?.toUpperCase()}
        </a>
      </div>
    </div>
  );
}

function ImageCard({ url, prompt }) {
  return <div className="image-card"><img src={url} alt={prompt} /></div>;
}

function TypingIndicator({ status }) {
  return (
    <div className="message-row assistant">
      <div className="avatar ai">N</div>
      <div>
        <div className="typing-indicator">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
          {status && <span className="status-text">{status}</span>}
        </div>
      </div>
    </div>
  );
}

function MessageRow({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`message-row ${msg.role}`}>
      {!isUser && <div className="avatar ai">N</div>}
      <div>
        <div className={`bubble ${msg.role}`}>
          {isUser ? msg.content : <MdContent content={msg.content} />}
          {msg.file && <FileCard file={msg.file} />}
          {msg.image && <ImageCard url={msg.image} prompt={msg.imagePrompt} />}
        </div>
      </div>
      {isUser && <div className="avatar user">U</div>}
    </div>
  );
}

function WelcomeScreen({ onSuggestion }) {
  const caps = [
    { icon: '🧠', title: 'Deep Questions', desc: 'Ask anything — structured answers with key takeaways', prompt: 'Explain how neural networks work, with key takeaways' },
    { icon: '📊', title: 'Excel Models', desc: 'Professional financial models with formulas and charts', prompt: 'Create a 3-year financial model with income statement, balance sheet, and cash flow' },
    { icon: '🎨', title: 'Image Generation', desc: 'Generate any image from a text description', prompt: 'Generate an image of a futuristic city skyline at sunset, photorealistic' },
    { icon: '📄', title: 'Any File Type', desc: 'PDF, Word, PowerPoint, CSV — real downloadable files', prompt: 'Create a professional business proposal PDF for a SaaS startup' },
  ];
  return (
    <div className="welcome-screen">
      <div className="welcome-logo"><Sparkles size={32} color="white" /></div>
      <div>
        <div className="welcome-title">What can I help you create?</div>
        <div className="welcome-sub" style={{ marginTop: 8 }}>Ask questions, generate files, create images — your AI does it all.</div>
      </div>
      <div className="capability-grid">
        {caps.map(c => (
          <div key={c.title} className="cap-card" onClick={() => onSuggestion(c.prompt)}>
            <div className="cap-icon">{c.icon}</div>
            <div className="cap-title">{c.title}</div>
            <div className="cap-desc">{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const CORRECT_PASSWORD = 'ashish123';
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem('nexus_auth', 'true');
      onLogin();
    } else {
      setError('Incorrect password. Try again.');
      setPassword('');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ textAlign: 'center' }}>
          <div className="welcome-logo" style={{ margin: '0 auto 16px', width: 56, height: 56, borderRadius: 14 }}>
            <Sparkles size={28} color="white" />
          </div>
          <div className="login-title">Nexus AI</div>
          <div className="login-sub" style={{ marginTop: 8 }}>Enter your access password to continue</div>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <input
          type="password"
          className="text-input"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        <button className="primary-btn" onClick={handleSubmit}>Enter →</button>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('nexus_theme') || 'light');
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('nexus_auth') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexus_convs') || '[]'); } catch { return []; }
  });
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_theme', theme);
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }, [input]);

  useEffect(() => {
    localStorage.setItem('nexus_convs', JSON.stringify(conversations));
  }, [conversations]);

  const startNewConversation = () => {
    const id = genId();
    setConversations(prev => [{ id, title: 'New Conversation', messages: [], created: Date.now() }, ...prev]);
    setActiveConvId(id);
    setMessages([]);
  };

  const loadConversation = (conv) => {
    setActiveConvId(conv.id);
    setMessages(conv.messages);
    if (window.innerWidth <= 680) setSidebarOpen(false);
  };

  const updateConversation = useCallback((id, msgs) => {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, messages: msgs, title: msgs[0]?.content?.slice(0, 50) || 'Conversation' } : c
    ));
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { id: genId(), role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    let convId = activeConvId;
    if (!convId) {
      convId = genId();
      setConversations(prev => [{ id: convId, title: userMsg.content.slice(0, 50), messages: [], created: Date.now() }, ...prev]);
      setActiveConvId(convId);
    }
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setStatusText('Thinking...');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          userMessage: userMsg.content,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Server error');
      }
      const data = await res.json();
      const aiMsg = {
        id: genId(),
        role: 'assistant',
        content: data.text || '',
        file: data.file || null,
        image: data.imageUrl || null,
        imagePrompt: data.imagePrompt || null,
      };
      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      updateConversation(convId, finalMessages);
    } catch (err) {
      const errorMsg = {
        id: genId(),
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}\n\nThe UI is working great! To use AI features, deploy to Vercel with your API keys. Follow the deployment guide in the README.`,
      };
      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);
      updateConversation(convId, finalMessages);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!authed) {
    return <div data-theme={theme}><LoginScreen onLogin={() => setAuthed(true)} /></div>;
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo-mark"><Sparkles size={16} /></div>
          <span className="logo-text">Nexus AI</span>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setSidebarOpen(false)}>
            <X size={14} />
          </button>
        </div>
        <button className="new-chat-btn" onClick={startNewConversation}>
          <Plus size={15} /> New Conversation
        </button>
        <div className="sidebar-section-label">Recent</div>
        <div className="conversation-list">
          {conversations.length === 0 && (
            <div style={{ padding: '12px 10px', fontSize: 13, color: 'var(--text-muted)' }}>No conversations yet</div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conv-item ${activeConvId === conv.id ? 'active' : ''}`}
              onClick={() => loadConversation(conv)}
            >
              <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
              {conv.title}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>Powered by Gemini</span>
          <button className="icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="chat-header">
          <button className="icon-btn" onClick={() => setSidebarOpen(s => !s)}><Menu size={16} /></button>
          <span className="header-title">
            {activeConvId ? conversations.find(c => c.id === activeConvId)?.title || 'Conversation' : 'Nexus AI'}
          </span>
          <button className="icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>
        <div className="messages-container">
          <div className="messages-inner">
            {messages.length === 0 && !loading && (
              <WelcomeScreen onSuggestion={(s) => { setInput(s); textareaRef.current?.focus(); }} />
            )}
            {messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}
            {loading && <TypingIndicator status={statusText} />}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="input-area">
          <div className="input-inner">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                className="chat-input"
                placeholder="Ask anything, request any file, or describe an image..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={loading}
              />
              <button className="send-btn" onClick={sendMessage} disabled={!input.trim() || loading}>
                <Send size={16} />
              </button>
            </div>
            <div className="input-hint">Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>
    </div>
  );
}
