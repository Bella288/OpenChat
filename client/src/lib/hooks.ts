import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from './queryClient';
import { Message, ChatResponse, ModelInfo } from './types';

// Hook for managing chat state
export function useChat(initialConversationId = "default") {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you today?"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [currentModel, setCurrentModel] = useState<'openai' | 'qwen' | 'unavailable'>('openai');
  const [isConnected, setIsConnected] = useState(true);

  // Load message history for a conversation
  const loadMessages = useCallback(async (convId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/conversations/${convId}/messages`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // If conversation not found, reset to welcome message
          setMessages([
            {
              role: "assistant",
              content: "Hello! I'm your AI assistant. How can I help you today?"
            }
          ]);
          return;
        }
        throw new Error('Failed to load message history');
      }
      
      const data = await response.json() as Message[];
      if (data.length > 0) {
        setMessages(data);
      } else {
        // Reset to welcome message if no messages
        setMessages([
          {
            role: "assistant",
            content: "Hello! I'm your AI assistant. How can I help you today?"
          }
        ]);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load messages when conversation ID changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (conversationId) {
        try {
          await loadMessages(conversationId);
        } catch (error) {
          console.error("Failed to load messages:", error);
        }
      }
    };
    
    fetchMessages();
  }, [conversationId]);

  // Send a message to the API
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Add user message to state immediately for UI
      const userMessage: Message = {
        role: "user",
        content
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Prepare message history for API
      // Filter out any messages without content or role
      const messageHistory = messages
        .filter(msg => msg.content && msg.role) 
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // Add the new user message
      messageHistory.push({
        role: userMessage.role,
        content: userMessage.content
      });
      
      // Make API request
      const response = await apiRequest('POST', '/api/chat', {
        messages: messageHistory,
        conversationId
      });
      
      const data = await response.json() as ChatResponse;
      
      // Add the assistant's response to state
      setMessages(prev => [...prev, data.message]);
      
      // Update current model if provided
      if (data.modelInfo) {
        setCurrentModel(data.modelInfo.model);
      }
      
      // Auto-refresh message history to sync with server
      setTimeout(() => {
        loadMessages(conversationId);
      }, 1000);
      
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to send message';
      
      // Check if it's a quota exceeded error and provide a more friendly message
      if (errorMessage.includes('quota exceeded') || errorMessage.includes('insufficient_quota')) {
        errorMessage = "The OpenAI API quota has been exceeded. This often happens with free accounts. The system will attempt to use the Qwen fallback model.";
      }
      
      setError(errorMessage);
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  }, [messages, conversationId, loadMessages]);

  // Clear the current conversation
  const clearConversation = useCallback(() => {
    setMessages([
      {
        role: "assistant",
        content: "Hello! I'm your AI assistant. How can I help you today?"
      }
    ]);
  }, []);

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health');
        setIsConnected(response.ok);
      } catch (err) {
        setIsConnected(false);
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Also check model status periodically
  useEffect(() => {
    const checkModelStatus = async () => {
      try {
        const response = await fetch('/api/model-status');
        if (response.ok) {
          const data = await response.json();
          setCurrentModel(data.model);
        }
      } catch (err) {
        console.error('Error checking model status:', err);
      }
    };
    
    checkModelStatus();
    const interval = setInterval(checkModelStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    isConnected,
    currentModel,
    sendMessage,
    clearConversation,
    loadMessages,
    setConversationId
  };
}

// Hook to scroll to bottom of chat
export function useScrollToBottom(dependency: any) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dependency]);
  
  return ref;
}