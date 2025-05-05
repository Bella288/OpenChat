import { InferenceClient } from "@huggingface/inference";
import { z } from "zod";

// Define schema for video generation request
export const videoGenerationSchema = z.object({
  prompt: z.string().min(1).max(1000),
  model: z.enum(["Wan-AI/Wan2.1-T2V-14B"]).default("Wan-AI/Wan2.1-T2V-14B"),
});

// Type for video generation parameters
export type VideoGenerationParams = z.infer<typeof videoGenerationSchema>;

/**
 * Generates a video using Replicate via HuggingFace's Inference API
 * @param params Video generation parameters
 * @returns URL of the generated video
 */
export async function generateVideo(params: VideoGenerationParams): Promise<string> {
  try {
    const replicateApiKey = process.env.REPLICATE_API_KEY;
    if (!replicateApiKey) {
      throw new Error("REPLICATE_API_KEY is not set in environment variables");
    }

    // Create inference client with Replicate API key
    const client = new InferenceClient(replicateApiKey);

    // Generate the video
    const result = await client.textToVideo({
      provider: "replicate",
      model: params.model,
      inputs: params.prompt,
    });

    if (!result) {
      throw new Error("Failed to generate video: No result returned");
    }

    // Convert blob to URL
    // In a real production environment, we would save this blob to a storage service
    // For this example, we'll create a data URL
    const videoBuffer = await result.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString('base64');
    const videoUrl = `data:video/mp4;base64,${videoBase64}`;

    return videoUrl;
  } catch (error) {
    console.error("Error generating video:", error);
    throw new Error(`Failed to generate video: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to check if video generation is available
export async function isVideoGenerationAvailable(): Promise<boolean> {
  try {
    const replicateApiKey = process.env.REPLICATE_API_KEY;
    if (!replicateApiKey) {
      return false;
    }

    // Create inference client with Replicate API key
    const client = new InferenceClient(replicateApiKey);
    
    // We'll just check if we can create the client
    return !!client;
  } catch (error) {
    console.error("Error checking video generation availability:", error);
    return false;
  }
}