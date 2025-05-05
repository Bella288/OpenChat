import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';

// Define form schema
const formSchema = z.object({
  prompt: z.string().min(1, {
    message: 'Prompt is required',
  }).max(1000, {
    message: 'Prompt must be less than 1000 characters',
  }),
  model: z.enum(["Wan-AI/Wan2.1-T2V-14B"]).default("Wan-AI/Wan2.1-T2V-14B"),
});

type FormValues = z.infer<typeof formSchema>;

export default function VideoGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Default form values
  const defaultValues: FormValues = {
    prompt: '',
    model: "Wan-AI/Wan2.1-T2V-14B",
  };

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate video');
      }

      const result = await response.json();
      setVideoUrl(result.videoUrl);
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the video');
      console.error('Error generating video:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="A young man walking on the street"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the video you want to generate.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating video...
                </>
              ) : 'Generate Video'}
            </Button>
          </form>
        </Form>
      </Card>

      {error && (
        <div className="p-4 text-sm border border-red-200 bg-red-50 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      <div className={cn("flex flex-col items-center justify-center", 
        videoUrl ? "bg-gray-50 dark:bg-gray-900" : "bg-gray-100 dark:bg-gray-800")}>
        {videoUrl ? (
          <div className="relative w-full">
            <video 
              src={videoUrl} 
              controls
              className="rounded-md object-contain max-h-[600px] mx-auto"
            />
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => window.open(videoUrl, '_blank')}
                className="mr-2"
              >
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = videoUrl;
                  a.download = 'generated-video.mp4';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                Download
              </Button>
            </div>
          </div>
        ) : (
          <Card className="w-full h-full flex items-center justify-center p-8 border-dashed">
            <div className="text-center">
              <p className="text-muted-foreground">
                Your generated video will appear here
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}