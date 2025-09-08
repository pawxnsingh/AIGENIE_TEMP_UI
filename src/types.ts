export interface Message {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
  status?: 'streaming' | 'completed' | 'error';
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

export interface StreamData {
  status: string;
  message: string;
  conversationId: string;
  messageId: string;
}

export interface ParsedContent {
  type: 'text' | 'python_artifact' | 'chart_artifact' | 'followup_question';
  content: string;
  title?: string;
  code?: string;
  chartOptions?: any;
  // New: support CDN-hosted chart HTML pages (e.g., Plotly render URLs)
  htmlCdnUrl?: string;
  // New: support direct Plotly (or other) JSON config via URL
  jsonCdnUrl?: string;
}
