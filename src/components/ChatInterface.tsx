import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square } from 'lucide-react';
import type { Conversation } from '../types';
import MessageBubble from './MessageBubble';

interface ChatInterfaceProps {
  conversation: Conversation | null;
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
  onStopStream?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversation,
  onSendMessage,
  isStreaming,
  onStopStream
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isStreaming) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  };

  const handleQuestionClick = (question: string) => {
    if (!isStreaming) {
      onSendMessage(question);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Implement voice recording logic here
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <span className="text-3xl text-white">✨</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to AI Chat</h2>
          <p className="text-gray-600 mb-6">Start a new conversation to begin chatting with AI</p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>💡 Ask questions about data analysis</p>
            <p>📊 Request charts and visualizations</p>
            <p>🔍 Get insights and recommendations</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Chat Header */}
      <div className="px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{conversation.title}</h2>
            <p className="text-sm text-gray-500">
              {conversation.messages.length} message{conversation.messages.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isStreaming && (
            <button
              onClick={onStopStream}
              className="flex items-center space-x-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Square size={14} />
              <span className="text-sm">Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {conversation.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onQuestionClick={handleQuestionClick}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 bg-white/90 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={isStreaming ? "AI is responding..." : "Type your message..."}
                  disabled={isStreaming}
                  className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm disabled:bg-gray-50 disabled:text-gray-500"
                  rows={1}
                  style={{ minHeight: '48px' }}
                />
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                    isRecording 
                      ? 'bg-red-500 text-white' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Mic size={16} />
                </button>
              </div>
              
              <button
                type="button"
                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Paperclip size={20} />
              </button>
              
              <button
                type="submit"
                disabled={!inputValue.trim() || isStreaming}
                className={`p-3 rounded-xl transition-all duration-200 ${
                  inputValue.trim() && !isStreaming
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
          </form>
          
          <div className="mt-2 text-xs text-gray-500 text-center">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
