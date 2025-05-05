import React, { useEffect, useState } from 'react';
import VideoGenerator from '../components/VideoGenerator';
import { Button } from '../components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Link } from 'wouter';

export default function VideoGenPage() {
  const { toast } = useToast();
  const [isVideoAvailable, setIsVideoAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkVideoStatus = async () => {
      try {
        const response = await fetch('/api/video-status');
        if (response.ok) {
          const { isAvailable } = await response.json();
          setIsVideoAvailable(isAvailable);
          
          if (!isAvailable) {
            toast({
              title: "Video Generation Unavailable",
              description: "The video generation service is currently unavailable. You may need to add your Replicate API token.",
              variant: "destructive",
            });
          }
        } else {
          throw new Error('Failed to check video generation status');
        }
      } catch (error) {
        console.error('Error checking video generation status:', error);
        setIsVideoAvailable(false);
        toast({
          title: "Service Error",
          description: "Failed to connect to the video generation service.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkVideoStatus();
  }, [toast]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">AI Video Generator</h1>
        <Link href="/">
          <Button variant="outline">Back to Chat</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" /> 
          <span>Checking service availability...</span>
        </div>
      ) : isVideoAvailable ? (
        <VideoGenerator />
      ) : (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-md">
          <h2 className="text-xl font-semibold text-amber-800 mb-2">Video Generation Unavailable</h2>
          <p className="mb-4">
            The video generation service is currently unavailable. This may be due to:
          </p>
          <ul className="list-disc pl-5 mb-4 space-y-1">
            <li>Missing or invalid Replicate API token</li>
            <li>Service outage or rate limiting</li>
            <li>Network connectivity issues</li>
          </ul>
          <p>
            To use this feature, you need to add a valid Replicate API token with access to the Wan-AI models.
          </p>
        </div>
      )}
    </div>
  );
}