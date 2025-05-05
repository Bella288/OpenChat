import React, { useState, useEffect } from 'react';
import { PlusCircle, MessageSquare, Trash2, Edit2, Save, X, User, LogOut } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { Conversation } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedConversationId: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onClose,
  selectedConversationId,
  onSelectConversation,
  onNewConversation
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  
  const isSignedIn = !!user;
  
  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
          const data = await response.json();
          setConversations(data);
        } else {
          console.error('Failed to fetch conversations');
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchConversations();
    
    // Set up interval to refresh conversations (every 30 seconds)
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [isSignedIn]);
  
  // Navigate to auth page
  const handleSignIn = () => {
    setLocation('/auth');
  };
  
  // Sign out
  const handleSignOut = () => {
    setLocation('/logout');
  };
  
  // Start editing a conversation title
  const handleEditStart = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  };
  
  // Cancel editing
  const handleEditCancel = () => {
    setEditingId(null);
    setEditingTitle('');
  };
  
  // Save edited title
  const handleEditSave = async (conversationId: string) => {
    try {
      const response = await apiRequest('PATCH', `/api/conversations/${conversationId}/title`, {
        title: editingTitle
      });
      
      if (response.ok) {
        const updatedConversation = await response.json();
        setConversations(conversations.map(conv => 
          conv.id === conversationId ? updatedConversation : conv
        ));
        setEditingId(null);
      } else {
        console.error('Failed to update conversation title');
      }
    } catch (error) {
      console.error('Error updating conversation title:', error);
    }
  };
  
  // Delete a conversation
  const handleDelete = async (conversationId: string) => {
    // Confirm delete
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    try {
      const response = await apiRequest('DELETE', `/api/conversations/${conversationId}`);
      
      if (response.ok) {
        setConversations(conversations.filter(conv => conv.id !== conversationId));
        
        // If we deleted the selected conversation, switch to a new one
        if (conversationId === selectedConversationId) {
          const nextConv = conversations.find(conv => conv.id !== conversationId);
          if (nextConv) {
            onSelectConversation(nextConv.id);
          } else {
            onNewConversation();
          }
        }
      } else {
        console.error('Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };
  
  return (
    <aside 
      className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 shadow-md transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out z-10 flex flex-col`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>
      
      <div className="p-4 border-b border-gray-200">
        <Button 
          onClick={onNewConversation}
          className="w-full flex items-center justify-center"
          variant="outline"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Sign in/out section */}
      <div className="p-4 border-b border-gray-200">
        {isSignedIn ? (
          <Button 
            onClick={handleSignOut} 
            variant="ghost" 
            className="w-full flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        ) : (
          <Button 
            onClick={handleSignIn} 
            variant="default" 
            className="w-full flex items-center justify-center"
          >
            <User className="mr-2 h-4 w-4" />
            Sign In to Save Chats
          </Button>
        )}
        {!isSignedIn && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Create an account to save your conversations
          </p>
        )}
      </div>
      
      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        ) : (
          conversations.length === 0 ? (
            isSignedIn ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                <p>No conversations yet</p>
                <p className="text-sm">Start a new chat to get started</p>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Sign in to view your saved conversations</p>
              </div>
            )
          ) : (
            <ul className="space-y-1">
              {conversations.map(conversation => (
                <li key={conversation.id} className="relative">
                  {editingId === conversation.id ? (
                    <div className="flex items-center p-2 rounded-md bg-gray-100">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 mr-1"
                        autoFocus
                      />
                      <div className="flex">
                        <Button 
                          onClick={() => handleEditSave(conversation.id)}
                          size="sm" 
                          variant="ghost" 
                          className="p-1 h-8 w-8"
                        >
                          <Save className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button 
                          onClick={handleEditCancel}
                          size="sm" 
                          variant="ghost" 
                          className="p-1 h-8 w-8"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className={`flex items-center p-2 rounded-md cursor-pointer group ${
                        conversation.id === selectedConversationId 
                          ? 'bg-primary text-white' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => onSelectConversation(conversation.id)}
                    >
                      <MessageSquare className={`h-4 w-4 mr-2 ${
                        conversation.id === selectedConversationId ? 'text-white' : 'text-gray-500'
                      }`} />
                      <span className="flex-1 truncate">{conversation.title}</span>
                      
                      <div className={`flex space-x-1 ${
                        conversation.id === selectedConversationId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      } transition-opacity`}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditStart(conversation);
                                }}
                                size="sm" 
                                variant="ghost" 
                                className={`p-1 h-6 w-6 ${
                                  conversation.id === selectedConversationId ? 'text-white hover:bg-primary-dark' : ''
                                }`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit title</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(conversation.id);
                                }}
                                size="sm" 
                                variant="ghost" 
                                className={`p-1 h-6 w-6 ${
                                  conversation.id === selectedConversationId ? 'text-white hover:bg-primary-dark' : ''
                                }`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete conversation</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </aside>
  );
};

export default ConversationSidebar;