import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Message } from '../types';
import { parseAIContent } from '../utils';
import PythonArtifact from './PythonArtifact';
import ChartArtifact from './ChartArtifact';
import FollowUpQuestions from './FollowUpQuestions';

interface MessageBubbleProps {
  message: Message;
  onQuestionClick?: (question: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onQuestionClick }) => {
  const isUser = message.type === 'user';
  const parsedContent = !isUser ? parseAIContent(message.content) : [];
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  // Get all status messages in order
  const getAllStatusMessages = (content: string) => {
    const allStatuses = [
      { text: 'Initializing request...', condition: 'Initializing request' },
      { text: 'Processing context and history...', condition: 'Processing context and history' },
      { text: 'Analyzing the data...', condition: 'Analyzing the data' },
      { text: 'Performing data analysis...', condition: 'Performing data analysis' },
      { text: 'Generating visualization...', condition: 'Generating visualization' },
      { text: 'Generating follow-up questions...', condition: 'Generating follow-up questions' },
      { text: 'Almost complete the request...', condition: 'Almost complete the request' }
    ];
    
    return allStatuses.filter(status => content.includes(status.condition)).map(status => status.text);
  };

  const statusMessages = !isUser ? getAllStatusMessages(message.content) : [];
  const isStreaming = message.status === 'streaming';
  
  // Check if content is only status messages (simple approach)
  const isOnlyStatusContent = (content: string) => {
    const statusKeywords = [
      'Initializing request',
      'Processing context and history',
      'Analyzing the data',
      'Performing data analysis',
      'Generating visualization',
      'Generating follow-up questions',
      'Almost complete the request',
      'step_executing'
    ];
    
    // Remove all status keywords and common symbols
    let cleanContent = content;
    statusKeywords.forEach(keyword => {
      cleanContent = cleanContent.replace(new RegExp(keyword + '[.]*', 'g'), '');
    });
    
    // Remove common symbols that come with status messages
    cleanContent = cleanContent.replace(/[.\s#]+/g, '').trim();
    
    // If nothing meaningful remains, it's status-only content
    return cleanContent === '';
  };
  
  const hasContent = parsedContent.length > 0 || (
    message.content && 
    !isOnlyStatusContent(message.content) &&
    message.content.trim() !== ''
  );

  // Cycle through status messages with artificial delay
  useEffect(() => {
    if (isStreaming && statusMessages.length > 1) {
      const interval = setInterval(() => {
        setCurrentStatusIndex(prev => (prev + 1) % statusMessages.length);
      }, 2000); // Change status every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [isStreaming, statusMessages.length]);

  // Reset status index when message changes
  useEffect(() => {
    setCurrentStatusIndex(0);
  }, [message.id]);

  const currentStatus = statusMessages[currentStatusIndex] || statusMessages[0];

  // Typing animation component
  const TypingAnimation = ({ message }: { message: string }) => (
    <AnimatePresence mode="wait">
      <motion.div
        key={message}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex items-center space-x-3 mb-4"
      >
        <div className="flex space-x-1">
          <motion.div 
            className="w-2 h-2 bg-blue-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "loop" }}
          />
          <motion.div 
            className="w-2 h-2 bg-purple-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "loop", delay: 0.1 }}
          />
          <motion.div 
            className="w-2 h-2 bg-pink-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "loop", delay: 0.2 }}
          />
        </div>
        <motion.span 
          className="text-sm text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex max-w-4xl ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg' 
            : 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg'
        }`}>
          {isUser ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
        </div>

        {/* Message Content */}
        <div className={`flex-1 ${isUser ? 'mr-3' : 'ml-3'}`}>
          {isUser ? (
            // User message
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-2xl rounded-tr-md shadow-xl border border-blue-500/30">
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{message.content}</p>
              <div className="mt-2 text-xs text-blue-100 opacity-80">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ) : (
            // AI message
            <div className="space-y-4">
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl rounded-tl-md shadow-lg border border-white/20">
                {/* Show single status message when streaming */}
                {isStreaming && currentStatus && (
                  <TypingAnimation message={currentStatus} />
                )}

                {/* General typing indicator when streaming but no specific status */}
                {isStreaming && !currentStatus && (
                  <TypingAnimation message="AI is thinking..." />
                )}

                {/* Render parsed content only if there's actual content */}
                {parsedContent.length > 0 && parsedContent.map((content, index) => (
                  <div key={index} className="mb-4 last:mb-0">
                    {content.type === 'text' && (
                      <div className="prose prose-sm max-w-none text-gray-800">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {content.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {content.type === 'python_artifact' && (
                      <PythonArtifact title={content.title || ''} code={content.code || ''} />
                    )}
                    {content.type === 'chart_artifact' && (
                      <ChartArtifact title={content.title || ''} chartOptions={content.chartOptions} htmlCdnUrl={(content as any).htmlCdnUrl} />
                    )}
                    {content.type === 'followup_question' && (
                      <FollowUpQuestions questions={content.content} onQuestionClick={onQuestionClick} />
                    )}
                  </div>
                ))}

                {/* If no parsed content but has actual content, show raw content with markdown */}
                {parsedContent.length === 0 && hasContent && (
                  <div className="prose prose-sm max-w-none text-gray-800">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({children}) => <h1 className="text-xl font-bold mb-3 text-gray-900">{children}</h1>,
                        h2: ({children}) => <h2 className="text-lg font-semibold mb-2 text-gray-900">{children}</h2>,
                        h3: ({children}) => <h3 className="text-base font-medium mb-2 text-gray-900">{children}</h3>,
                        p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                        ul: ({children}) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="leading-relaxed">{children}</li>,
                        strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        code: ({children}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                        pre: ({children}) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">{children}</pre>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Message footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Copy message"
                    >
                      <Copy size={14} className="text-gray-500" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                      <ThumbsUp size={14} className="text-gray-500" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                      <ThumbsDown size={14} className="text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
