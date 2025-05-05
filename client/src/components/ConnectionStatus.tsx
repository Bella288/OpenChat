import React from 'react';
import { ConnectionStatusProps } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected, currentModel = 'openai' }) => {
  // Get model status details
  const getModelBadge = () => {
    switch (currentModel) {
      case 'openai':
        return (
          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-800 border-blue-300">
            OpenAI
          </Badge>
        );
      case 'qwen':
        return (
          <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-800 border-amber-300">
            Qwen (Fallback)
          </Badge>
        );
      case 'unavailable':
        return (
          <Badge variant="outline" className="ml-2 bg-red-50 text-red-800 border-red-300">
            No AI Available
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center">
      <span 
        className={`inline-block h-2 w-2 rounded-full mr-2 ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}
      ></span>
      <span className="text-sm text-gray-600 mr-2">
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {getModelBadge()}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {currentModel === 'openai' 
                ? 'Using OpenAI GPT-4o model' 
                : currentModel === 'qwen' 
                  ? 'Using Qwen fallback model due to OpenAI unavailability' 
                  : 'All AI models are currently unavailable'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default ConnectionStatus;
