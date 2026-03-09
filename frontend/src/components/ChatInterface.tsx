import React, { useState } from 'react';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface ChatInterfaceProps {
  title?: string;
  placeholder?: string;
  onSendMessage?: (message: string) => Promise<string> | string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  title = 'Wallet Chatbot',
  placeholder = 'Ask about balance, payments, swaps, or transactions...',
  onSendMessage,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello. I can help with balance checks, payments, swaps, and transaction history.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setIsLoading(true);

    try {
      const response = onSendMessage
        ? await onSendMessage(trimmed)
        : `I received: "${trimmed}". Connect this component to your NLP integration for live responses.`;

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: `Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSend();
    }
  };

  return (
    <section
      style={{
        border: '1px solid #d1d5db',
        borderRadius: '12px',
        padding: '16px',
        maxWidth: '720px',
        margin: '0 auto',
        background: '#ffffff',
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px',
          height: '320px',
          overflowY: 'auto',
          marginBottom: '12px',
          background: '#f9fafb',
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 12px',
                borderRadius: '10px',
                background: message.role === 'user' ? '#dbeafe' : '#e5e7eb',
                color: '#111827',
                whiteSpace: 'pre-wrap',
              }}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <textarea
          rows={2}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          style={{
            flex: 1,
            resize: 'vertical',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            padding: '10px',
          }}
        />
        <button
          type='button'
          onClick={() => {
            void handleSend();
          }}
          disabled={isLoading || !draft.trim()}
          style={{
            borderRadius: '8px',
            border: '1px solid #1d4ed8',
            background: isLoading ? '#93c5fd' : '#2563eb',
            color: '#fff',
            padding: '0 14px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </section>
  );
};

export default ChatInterface;

