import { z } from "zod";

// Define schema for image generation request
export const imageGenerationSchema = z.object({
  prompt: z.string().min(1).max(1000),
  seed: z.number().optional().default(0),
  randomize_seed: z.boolean().optional().default(true),
  width: z.number().min(256).max(1024).optional().default(512),
  height: z.number().min(256).max(1024).optional().default(512),
  guidance_scale: z.number().min(0).max(20).optional().default(7.5),
  num_inference_steps: z.number().min(1).max(50).optional().default(20),
});

// Type for image generation parameters
export type ImageGenerationParams = z.infer<typeof imageGenerationSchema>;

/**
 * Generates an image using the FLUX.1-dev model via Replicate API
 * @param params Image generation parameters
 * @returns URL of the generated image
 */
export async function generateImage(params: ImageGenerationParams): Promise<string> {
  try {
    const apiKey = process.env.REPLICATE_API_KEY;
    if (!apiKey) {
      throw new Error("REPLICATE_API_KEY is not set in environment variables");
    }

    // Prepare the request data
    const inputData = {
      input: {
        prompt: params.prompt,
        width: params.width,
        height: params.height,
        seed: params.randomize_seed ? Math.floor(Math.random() * 1000000) : params.seed,
        guidance_scale: params.guidance_scale,
        num_inference_steps: params.num_inference_steps,
      },
    };

    // Make API request to create prediction
    const startResponse = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputData),
      }
    );

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      throw new Error(`Replicate API error: ${JSON.stringify(errorData)}`);
    }

    const prediction = await startResponse.json();
    const predictionId = prediction.id;

    // Poll for result
    let imageUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (!imageUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
        }
      );

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json();
        throw new Error(`Replicate API status error: ${JSON.stringify(errorData)}`);
      }

      const status = await statusResponse.json();
      
      if (status.status === "succeeded") {
        if (status.output && typeof status.output === "string") {
          imageUrl = status.output;
        } else if (Array.isArray(status.output) && status.output.length > 0) {
          imageUrl = status.output[0];
        }
      } else if (status.status === "failed") {
        throw new Error(`Image generation failed: ${status.error || "Unknown error"}`);
      }
      
      attempts++;
    }

    if (!imageUrl) {
      throw new Error("Timed out waiting for image generation");
    }

    return imageUrl;
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to check if FLUX model is available via Replicate
export async function isFluxAvailable(): Promise<boolean> {
  try {
    const apiKey = process.env.REPLICATE_API_KEY;
    if (!apiKey) {
      return false;
    }

    // Check if the Replicate API is accessible by making a basic request
    const response = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-dev",
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Error checking FLUX availability:", error);
    return false;
  }
}