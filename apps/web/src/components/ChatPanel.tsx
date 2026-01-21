import { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import './ChatPanel.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  onClose: () => void;
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading) {
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message to UI immediately
    const newUserMessage: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const response = await api.post('/chat', {
        message: userMessage,
        threadId: threadId || undefined,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Store thread ID for subsequent messages
      if (response.data.threadId && !threadId) {
        setThreadId(response.data.threadId);
      }
    } catch (err: any) {
      console.error('Chat API error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to get response from AI assistant. Please try again.';
      setError(errorMessage);
      
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-panel-overlay" onClick={onClose}>
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chat-panel-header">
          <div className="chat-panel-header-content">
            <img src="/ai-icon.png" alt="AI" className="chat-panel-icon" />
            <h3>AI Beekeeping Assistant</h3>
          </div>
          <button className="chat-panel-close" onClick={onClose} aria-label="Close chat">
            ×
          </button>
        </div>

        <div className="chat-panel-messages">
          {messages.length === 0 && (
            <div className="chat-panel-welcome">
              <p>Hello! I'm your AI beekeeping assistant. How can I help you today?</p>
              <p className="chat-panel-hint">Ask me anything about beekeeping, hive management, or bee health.</p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`chat-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="chat-message-content">
                {message.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-message assistant-message">
              <div className="chat-message-content">
                <div className="chat-loading">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="chat-error">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="chat-panel-input-form" onSubmit={handleSend}>
          <input
            type="text"
            className="chat-panel-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about beekeeping..."
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className="chat-panel-send"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
