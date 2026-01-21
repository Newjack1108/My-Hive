import { useState } from 'react';
import ChatPanel from './ChatPanel';
import './ChatButton.css';

export default function ChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        className={`chat-button ${isOpen ? 'active' : ''}`}
        onClick={handleClick}
        aria-label="Open AI chat assistant"
        title="AI Beekeeping Assistant"
      >
        <img src="/ai-icon.png" alt="AI" className="chat-button-icon" />
      </button>
      {isOpen && <ChatPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
