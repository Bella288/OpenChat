import React, { useEffect, useState } from 'react';
import ImageGenerator from '../components/ImageGenerator';
import { Button } from '../components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Link } from 'wouter';

export default function ImageGenPage() {
  const { toast } = useToast();
  const [isFluxAvailable, setIsFluxAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFluxStatus = async () => {
      try {
        const response = await fetch('/api/flux-status');
        if (response.ok) {
          const { isAvailable } = await response.json();
          setIsFluxAvailable(isAvailable);
          
          if (!isAvailable) {
            toast({
              title: "FLUX API Unavailable",
              description: "The image generation service is currently unavailable. You may need to add your Hugging Face API token.",
              variant: "destructive",
            });
          }
        } else {
          throw new Error('Failed to check FLUX status');
        }
      } catch (error) {
        console.error('Error checking FLUX status:', error);
        setIsFluxAvailable(false);
        toast({
          title: "Service Error",
          description: "Failed to connect to the image generation service.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkFluxStatus();
  }, [toast]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">FLUX Image Generator</h1>
        <Link href="/">
          <Button variant="outline">Back to Chat</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" /> 
          <span>Checking service availability...</span>
        </div>
      ) : isFluxAvailable ? (
        <ImageGenerator />
      ) : (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-md">
          <h2 className="text-xl font-semibold text-amber-800 mb-2">Image Generation Unavailable</h2>
          <p className="mb-4">
            The FLUX image generation service is currently unavailable. This may be due to:
          </p>
          <ul className="list-disc pl-5 mb-4 space-y-1">
            <li>Missing or invalid Hugging Face API token</li>
            <li>Service outage or rate limiting</li>
            <li>Network connectivity issues</li>
          </ul>
          <p>
            To use this feature, you may need to add a valid Hugging Face API token with access to the FLUX.1-dev model.
          </p>
        </div>
      )}
    </div>
  );
}