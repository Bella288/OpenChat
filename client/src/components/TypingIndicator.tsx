import React from 'react';
import { TypingIndicatorProps } from '@/lib/types';

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="flex items-start mb-4">
      <div className="flex-shrink-0 mr-3">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
          </svg>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex items-center p-2">
          <div className="flex space-x-1">
            <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
            <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
