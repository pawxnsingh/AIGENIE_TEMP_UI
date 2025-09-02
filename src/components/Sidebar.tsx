import React from 'react';
import { MessageSquare, Plus, Settings, User, Search, MoreVertical } from 'lucide-react';
import type { Conversation } from '../types';
import { formatTimestamp } from '../utils';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onConversationSelect,
  onNewConversation
}) => {
  return (
    <div className="w-80 h-full bg-black/30 backdrop-blur-xl border-r border-white/30 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">AI Chat</h1>
          <button
            onClick={onNewConversation}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 text-white shadow-lg"
          >
            <Plus size={20} />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70" size={16} />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent shadow-inner"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-2">
          {conversations.length === 0 ? (
            // Loading state
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-white/70 text-sm">Loading conversations...</p>
              </div>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onConversationSelect(conversation.id)}
                className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                  activeConversationId === conversation.id
                    ? 'bg-white/25 border border-white/40 shadow-lg'
                    : 'bg-black/20 hover:bg-white/15 border border-white/20 hover:border-white/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <MessageSquare size={16} className="text-white/90 flex-shrink-0" />
                      <h3 className="text-white font-semibold text-sm truncate drop-shadow-sm">
                        {conversation.title}
                      </h3>
                    </div>
                    <p className="text-white/80 text-xs truncate mb-2 drop-shadow-sm">
                      {conversation.lastMessage}
                    </p>
                    <span className="text-white/60 text-xs drop-shadow-sm">
                      {formatTimestamp(conversation.timestamp)}
                    </span>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/20 transition-all duration-200">
                    <MoreVertical size={14} className="text-white/80" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center shadow-lg">
              <User size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold drop-shadow-sm">User</p>
              <p className="text-white/70 text-xs drop-shadow-sm">Premium Plan</p>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/20 transition-colors">
            <Settings size={16} className="text-white/90" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
