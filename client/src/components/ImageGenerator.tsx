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
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
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
  width: z.number().min(256).max(1024).default(512),
  height: z.number().min(256).max(1024).default(512),
  seed: z.number().default(0),
  randomize_seed: z.boolean().default(true),
  guidance_scale: z.number().min(0).max(20).default(7.5),
  num_inference_steps: z.number().min(1).max(50).default(20),
});

type FormValues = z.infer<typeof formSchema>;

export default function ImageGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Default form values
  const defaultValues: FormValues = {
    prompt: '',
    width: 512,
    height: 512,
    seed: 0,
    randomize_seed: true,
    guidance_scale: 7.5,
    num_inference_steps: 20,
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
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate image');
      }

      const result = await response.json();
      setImageUrl(result.imageUrl);
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the image');
      console.error('Error generating image:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Image Generator</h2>
        {isLoading && <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your prompt..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Describe the image you want to generate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="width"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Width: {field.value}px</FormLabel>
                      <FormControl>
                        <Slider
                          min={256}
                          max={1024}
                          step={64}
                          defaultValue={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height: {field.value}px</FormLabel>
                      <FormControl>
                        <Slider
                          min={256}
                          max={1024}
                          step={64}
                          defaultValue={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="randomize_seed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Randomize Seed</FormLabel>
                      <FormDescription>
                        Use a random seed for each generation
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!form.watch("randomize_seed") && (
                <FormField
                  control={form.control}
                  name="seed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seed: {field.value}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Specific seed for reproducible results
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="guidance_scale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guidance Scale: {field.value}</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={20}
                        step={0.1}
                        defaultValue={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      How closely to follow the prompt (higher = more faithful)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="num_inference_steps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inference Steps: {field.value}</FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={50}
                        step={1}
                        defaultValue={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of denoising steps (higher = better quality but slower)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Image'
                )}
              </Button>
            </form>
          </Form>
        </div>

        <div className={cn("flex flex-col items-center justify-center", 
          imageUrl ? "bg-gray-50 dark:bg-gray-900" : "bg-gray-100 dark:bg-gray-800")}>
          {imageUrl ? (
            <div className="relative w-full">
              <img 
                src={imageUrl} 
                alt="Generated" 
                className="rounded-md object-contain max-h-[600px] mx-auto"
              />
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => window.open(imageUrl, '_blank')}
                  className="mr-2"
                >
                  Open in New Tab
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = imageUrl;
                    a.download = 'generated-image.png';
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
                  Your generated image will appear here
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}