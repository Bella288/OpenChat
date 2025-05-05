export interface Message {
  id?: number;
  content: string;
  role: "user" | "assistant" | "system";
  conversationId?: string;
  createdAt?: Date;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  conversationId: string;
}

export interface ChatInputFormProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export interface ChatHistoryProps {
  messages: Message[];
  isLoading: boolean;
  currentModel?: 'openai' | 'qwen' | 'unavailable';
}

export interface ConnectionStatusProps {
  isConnected: boolean;
  currentModel?: 'openai' | 'qwen' | 'unavailable';
}

export interface TypingIndicatorProps {
  isVisible: boolean;
}

export interface ModelStatus {
  model: 'openai' | 'qwen' | 'unavailable';
  isOpenAIAvailable: boolean;
  isQwenAvailable: boolean;
  lastChecked: Date;
}

export interface ModelInfo {
  model: 'openai' | 'qwen' | 'unavailable';
  isFallback: boolean;
}

export interface ChatResponse {
  message: Message;
  conversationId: string;
  modelInfo?: ModelInfo;
}
