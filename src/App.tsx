import { useState, useEffect } from 'react';
import type { Conversation, Message } from './types';
import { parseStreamData } from './utils';
import { ApiService } from './services/api';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [convPage, setConvPage] = useState(1);
  const [convHasNext, setConvHasNext] = useState(true);
  const [convLoading, setConvLoading] = useState(false);

  // Function to get conversation ID from URL
  const getConversationIdFromUrl = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('conversation_id');
  };

  // Function to update URL with conversation ID
  const updateUrlWithConversationId = (conversationId: string | null) => {
    const url = new URL(window.location.href);
    if (conversationId) {
      url.searchParams.set('conversation_id', conversationId);
    } else {
      url.searchParams.delete('conversation_id');
    }
    window.history.pushState({}, '', url.toString());
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const conversationIdFromUrl = getConversationIdFromUrl();
      if (conversationIdFromUrl && conversations.some(c => c.id === conversationIdFromUrl)) {
        setActiveConversationId(conversationIdFromUrl);
      } else if (conversations.length > 0) {
        setActiveConversationId(conversations[0].id);
        updateUrlWithConversationId(conversations[0].id);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [conversations]);

  // Fetch conversations from backend (first page)
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setConvLoading(true);
        const { conversations: firstPageConvs, page, hasNext } = await ApiService.fetchConversationsPage(1, 20);
        setConversations(firstPageConvs);
        setConvPage(page);
        setConvHasNext(hasNext);
        
        // Check if there's a conversation ID in the URL
        const conversationIdFromUrl = getConversationIdFromUrl();
        if (conversationIdFromUrl && firstPageConvs.some(c => c.id === conversationIdFromUrl)) {
          setActiveConversationId(conversationIdFromUrl);
        } else if (firstPageConvs.length > 0) {
          // Set the first conversation as active if no valid URL conversation ID
          setActiveConversationId(firstPageConvs[0].id);
          updateUrlWithConversationId(firstPageConvs[0].id);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
        // Optionally show an error message to the user
      } finally {
        setConvLoading(false);
      }
    };

    loadConversations();
  }, []);

  const loadMoreConversations = async () => {
    if (convLoading || !convHasNext) return;
    try {
      setConvLoading(true);
      const nextPage = convPage + 1;
      const { conversations: nextConvs, page, hasNext } = await ApiService.fetchConversationsPage(nextPage, 20);
      setConversations(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const filtered = nextConvs.filter(c => !existingIds.has(c.id));
        return [...prev, ...filtered];
      });
      setConvPage(page);
      setConvHasNext(hasNext);
    } catch (e) {
      console.error('Failed to load more conversations:', e);
    } finally {
      setConvLoading(false);
    }
  };

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      const conversation = conversations.find(c => c.id === activeConversationId);
      if (conversation && conversation.messages.length === 0) {
        loadConversationMessages(activeConversationId);
      }
    }
  }, [activeConversationId, conversations]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Generalized function to process and display content
  const processAndDisplayContent = (content: string, messageId: string, isCompleted: boolean = false) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: conv.messages.map(msg => 
                msg.id === messageId
                  ? { 
                      ...msg, 
                      content,
                      status: isCompleted ? 'completed' : 'streaming'
                    }
                  : msg
              ),
              lastMessage: isCompleted ? content.substring(0, 100) + '...' : conv.lastMessage
            }
          : conv
      )
    );
  };

  const handleNewConversation = async () => {
    try {
      const newConversation = await ApiService.createConversation('New Chat');
      if (newConversation) {
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
        updateUrlWithConversationId(newConversation.id);
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      // Fallback: create conversation locally
      const localConversation: Conversation = {
        id: `conv-${Date.now()}`,
        title: 'New Chat',
        lastMessage: '',
        timestamp: new Date(),
        messages: [],
      };
      setConversations(prev => [localConversation, ...prev]);
      setActiveConversationId(localConversation.id);
      updateUrlWithConversationId(localConversation.id);
    }
  };

  const handleConversationSelect = (id: string) => {
    setActiveConversationId(id);
    updateUrlWithConversationId(id);
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const messages = await ApiService.fetchConversationMessages(conversationId);
      
      // Update the conversation with loaded messages
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId
            ? {
                ...conv,
                messages,
                lastMessage: messages.length > 0 
                  ? messages[messages.length - 1].content.substring(0, 100) + '...'
                  : 'No messages yet'
              }
            : conv
        )
      );
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId) return;

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content,
      type: 'user',
      timestamp: new Date(),
    };

    setConversations(prev => 
      prev.map(conv => 
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              lastMessage: content,
              timestamp: new Date(),
            }
          : conv
      )
    );

    // Start streaming AI response
    setIsStreaming(true);
    await streamResponseFromAPI(content);
  };

  const streamResponseFromAPI = async (userMessage: string) => {
    // Create AI message
    const aiMessage: Message = {
      id: `msg-${Date.now()}-ai`,
      content: '',
      type: 'ai',
      timestamp: new Date(),
      status: 'streaming',
    };

    // Add streaming message
    setConversations(prev => 
      prev.map(conv => 
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, aiMessage],
            }
          : conv
      )
    );

    try {
      // Call the real API
      const response = await ApiService.sendMessage(activeConversationId!, userMessage);
      
      if (!response || !response.body) {
        throw new Error('No response from API');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));
        
        for (const line of lines) {
          const parsedData = parseStreamData(line);
          if (parsedData && parsedData.message) {
            // Generalized approach: accumulate any message content regardless of status
            accumulatedContent += parsedData.message;
            
            // Update message content in real-time
            processAndDisplayContent(accumulatedContent, aiMessage.id);
          }
        }
      }

      // Mark as completed
      processAndDisplayContent(accumulatedContent, aiMessage.id, true);

    } catch (error) {
      console.error('Error streaming from API:', error);
      
      // Fallback to local simulation for development
      await simulateStreamingResponse(userMessage, aiMessage);
    }

    setIsStreaming(false);
  };

  const simulateStreamingResponse = async (_userMessage: string, aiMessage: Message) => {
    // Simulate reading from streamed_result.txt as fallback
    try {
      const response = await fetch('/streamed_result.txt');
      const streamData = await response.text();
      const lines = streamData.split('\n').filter(line => line.trim().startsWith('data:'));
      
      let accumulatedContent = '';
      
      for (let i = 0; i < lines.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate streaming delay
        
        const parsedData = parseStreamData(lines[i]);
        if (parsedData && parsedData.message) {
          // Generalized approach: accumulate any message content regardless of status
          accumulatedContent += parsedData.message;
        }
        
        // Update message content
        processAndDisplayContent(accumulatedContent, aiMessage.id);
      }

      // Mark as completed
      processAndDisplayContent(accumulatedContent, aiMessage.id, true);
    } catch (error) {
      console.error('Error simulating stream:', error);
      
      // Fallback to combined_result.txt
      try {
        const response = await fetch('/combined_result.txt');
        const combinedData = await response.text();
        
        processAndDisplayContent(combinedData, aiMessage.id, true);
      } catch (fallbackError) {
        console.error('Error loading combined result:', fallbackError);
        
        // Default response
        processAndDisplayContent('Sorry, I encountered an error while processing your request.', aiMessage.id, true);
      }
    }
  };

  const handleStopStream = () => {
    setIsStreaming(false);
    // Mark current streaming message as completed
    setConversations(prev => 
      prev.map(conv => 
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: conv.messages.map(msg => 
                msg.status === 'streaming'
                  ? { ...msg, status: 'completed' }
                  : msg
              ),
            }
          : conv
      )
    );
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onConversationSelect={handleConversationSelect}
  onNewConversation={handleNewConversation}
  onLoadMoreConversations={loadMoreConversations}
  hasNextConversations={convHasNext}
  isLoadingConversations={convLoading}
      />
      <ChatInterface
        conversation={activeConversation || null}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        onStopStream={handleStopStream}
      />
    </div>
  );
}

export default App;
