import type { Conversation, Message } from '../types';

// const API_BASE_URL = 'https://backend.microgcc.in/api';
const API_BASE_URL = 'https://backend-test.microgcc.in/api'; // For local development
const AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJfY21iOHhocmo3MDAwMGRjaTViZjZsbWI0NCIsImVtYWlsIjoidGVzdGFkbWluMUB0ZXN0LmNvbSIsInJvbGUiOiJvcmdfYWRtaW4iLCJleHAiOjE3NzQ3MDczMTd9.bxUMUvIlPzWF5EMP0oKvCoNXRMyxeMv9Rjd94Ow8w6w'

interface BackendConversation {
  id: string;
  title: string;
  userId: string;
  updatedAt: string;
  selectedAssets: string[];
  selectedDataSources: string[];
  createdAt: string;
}

interface BackendMessage {
  id: string;
  conversationId: string;
  userId: string;
  query: string;
  content: string;
  feedbackType: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsResponse {
  status: string;
  data: {
    conversations: BackendConversation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
      has_next: boolean;
    };
  };
  message: string;
}

interface MessagesResponse {
  status: string;
  data: {
    messages: BackendMessage[];
  };
  message: string;
}

export class ApiService {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_TOKEN,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  static async fetchConversations(): Promise<Conversation[]> {
    try {
      const response = await this.request<ConversationsResponse>('/conversation');
      
      // Transform API response to match our Conversation interface
      return response.data.conversations.map((backendConv: BackendConversation) => ({
        id: backendConv.id,
        title: backendConv.title || 'New Chat',
        lastMessage: 'Click to view conversation', // We'll update this when we fetch messages
        timestamp: new Date(backendConv.updatedAt),
        messages: [], // Will be populated when conversation is selected
      }));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      // Return empty array on error
      return [];
    }
  }

  static async fetchConversationMessages(conversationId: string): Promise<Message[]> {
    try {
      const response = await this.request<MessagesResponse>(`/conversation?conversation_id=${conversationId}`);
      
      // Transform backend messages to frontend Message format
      const messages: Message[] = [];
      
      response.data.messages.forEach((backendMsg: BackendMessage) => {
        // Add user message (query)
        if (backendMsg.query) {
          messages.push({
            id: `${backendMsg.id}_user`,
            content: backendMsg.query,
            type: 'user',
            timestamp: new Date(backendMsg.createdAt),
            status: 'completed',
          });
        }
        
        // Add AI message (content)
        if (backendMsg.content) {
          messages.push({
            id: backendMsg.id,
            content: backendMsg.content,
            type: 'ai',
            timestamp: new Date(backendMsg.updatedAt),
            status: 'completed',
          });
        }
      });
      
      // Sort messages by timestamp
      return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error('Failed to fetch conversation messages:', error);
      return [];
    }
  }

  static async createConversation(title?: string): Promise<Conversation | null> {
    try {
      const data = await this.request<BackendConversation>('/conversation', {
        method: 'POST',
        body: JSON.stringify({
          title: title || 'New Chat',
          selectedAssets: [],
          selectedDataSources: [],
        }),
      });

      return {
        id: data.id,
        title: data.title || 'New Chat',
        lastMessage: 'No messages yet',
        timestamp: new Date(data.createdAt),
        messages: [],
      };
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }

  static async sendMessage(conversationId: string, message: string): Promise<Response | null> {
    try {
      return await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
        body: JSON.stringify({
          query: message,
          conversationId: conversationId,
        }),
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  }
}
