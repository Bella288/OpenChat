import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { generateChatResponse } from "./openai";
import { canUseOpenAI, canUseQwen } from "./fallbackChat";
import { getPersonalityConfig } from "./personalities";
import { generateImage, imageGenerationSchema, isFluxAvailable } from "./flux";
import { generateVideo, videoGenerationSchema, isVideoGenerationAvailable } from "./video";
import OpenAI from "openai";
import { nanoid } from "nanoid";
import { 
  messageSchema, 
  conversationSchema, 
  insertMessageSchema, 
  insertConversationSchema,
  messageRoleSchema,
  personalityTypeSchema
} from "@shared/schema";
import { z } from "zod";

// Track the current model in use
let currentModelStatus = {
  model: 'openai',
  isOpenAIAvailable: true,
  isQwenAvailable: true,
  lastChecked: new Date()
};

// Function to check and update model availability status
async function updateModelStatus() {
  try {
    const isOpenAIAvailable = await canUseOpenAI();
    const isQwenAvailable = await canUseQwen();
    
    // Determine current model based on availability
    let model = 'unavailable';
    if (isOpenAIAvailable) {
      model = 'openai';
    } else if (isQwenAvailable) {
      model = 'qwen';
    }
    
    currentModelStatus = {
      model,
      isOpenAIAvailable,
      isQwenAvailable,
      lastChecked: new Date()
    };
    
    console.log(`Updated model status: ${model} (OpenAI: ${isOpenAIAvailable}, Qwen: ${isQwenAvailable})`);
    return currentModelStatus;
  } catch (error) {
    console.error("Error updating model status:", error);
    return currentModelStatus;
  }
}

// Initialize model status
updateModelStatus();

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  // Get all conversations (filtered by user if authenticated)
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      let conversations;
      
      // If user is authenticated, only get their conversations
      if (req.isAuthenticated() && req.user) {
        const userId = req.user.id;
        conversations = await storage.getUserConversations(userId);
      } else {
        // For unauthenticated users, get only conversations without a userId
        conversations = await storage.getConversations();
        // Filter out conversations that belong to users
        conversations = conversations.filter(conv => !conv.userId);
      }
      
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations." });
    }
  });

  // Create a new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversationId = nanoid();
      
      // Generate title based on user's message
      let title = req.body.title;
      if (!title || title === "New Conversation") {
        try {
          const openaiClient = new OpenAI();
          const response = await openaiClient.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "You are a title generator. Create a concise, descriptive title (2-4 words) that summarizes the following message. Respond with just the title."
              },
              {
                role: "user", 
                content: req.body.firstMessage || "New chat conversation"
              }
            ],
            max_tokens: 15,
            temperature: 0.6
          });
          
          title = response.choices[0].message.content?.trim() || "New Conversation";
        } catch (err) {
          console.error("Error generating AI title:", err);
          title = "New Conversation";
        }
      }
      
      // Include user ID if authenticated
      const conversationData: any = {
        id: conversationId,
        title: title,
        personality: req.body.personality || "general"
      };
      
      // Associate conversation with user if authenticated
      if (req.isAuthenticated() && req.user) {
        conversationData.userId = req.user.id;
      }
      
      const result = insertConversationSchema.safeParse(conversationData);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid conversation data." });
      }

      const conversation = await storage.createConversation(result.data);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation." });
    }
  });
  
  // Generate AI title for conversation
  app.post("/api/conversations/:id/generate-title", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the conversation messages
      const messages = await storage.getMessages(id);
      
      if (messages.length < 2) {
        return res.status(400).json({ message: "Need at least one exchange to generate a title" });
      }
      
      // Extract the first few messages (user and assistant) to use as context
      const contextMessages = messages.slice(0, Math.min(4, messages.length))
        .map(msg => `${msg.role}: ${msg.content}`).join("\n");
      
      // Generate the title using AI
      let title;
      try {
        // First try using OpenAI
        const openaiClient = new OpenAI();
        const response = await openaiClient.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates short, descriptive titles (max 6 words) for conversations based on their content. Respond with just the title."
            },
            {
              role: "user",
              content: `Generate a short, descriptive title (maximum 6 words) for this conversation:\n${contextMessages}`
            }
          ],
          max_tokens: 20,
          temperature: 0.7
        });
        
        title = response.choices[0].message.content?.trim();
        
        // Use fallback if title is undefined or empty
        if (!title) {
          title = `Chat ${new Date().toLocaleDateString()}`;
        }
      } catch (err) {
        // Fallback to a generic title
        console.error("Error generating AI title:", err);
        title = `Chat ${new Date().toLocaleDateString()}`;
      }
      
      // Update the conversation with the new title
      const updatedConversation = await storage.updateConversationTitle(id, title as string);
      
      if (!updatedConversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      res.json(updatedConversation);
    } catch (error) {
      console.error("Error generating title:", error);
      res.status(500).json({ message: "Failed to generate title." });
    }
  });

  // Get messages for a conversation
  app.get("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found." });
      }
      
      // Check ownership if the conversation belongs to a user
      if (conversation.userId && req.isAuthenticated() && req.user) {
        // User must be the owner of the conversation
        if (conversation.userId !== req.user.id) {
          return res.status(403).json({ message: "You don't have permission to access this conversation." });
        }
      }
      
      const messages = await storage.getMessages(id);
      
      // If user is authenticated, include their system context
      if (req.isAuthenticated() && req.user) {
        const userContext = {
          role: "system",
          content: req.user.systemContext || `Chat with ${req.user.username}`,
          conversationId: id,
          createdAt: new Date()
        };
        messages.unshift(userContext);
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages." });
    }
  });

  // Send a message and get AI response
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      // Update model status before processing
      await updateModelStatus();
      
      // Check if any AI model is available
      if (currentModelStatus.model === 'unavailable') {
        return res.status(503).json({ 
          message: "All AI models are currently unavailable. Please check your API keys." 
        });
      }
      
      // Validate incoming data
      const result = conversationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid chat data format." });
      }

      const { messages } = result.data;
      const conversationId = req.body.conversationId || "default";
      
      // Ensure the conversation exists
      const conversation = await storage.getConversation(conversationId);
      if (!conversation && conversationId !== "default") {
        return res.status(404).json({ message: "Conversation not found." });
      }

      // If conversation belongs to a user, check permissions
      if (conversation && conversation.userId) {
        // If user is not authenticated or not the owner
        if (!req.isAuthenticated() || !req.user || conversation.userId !== req.user.id) {
          return res.status(403).json({ message: "You don't have permission to access this conversation." });
        }
      }

      // Store user message
      const userMessage = messages[messages.length - 1];
      if (userMessage.role !== "user") {
        return res.status(400).json({ message: "Last message must be from the user." });
      }

      await storage.createMessage({
        content: userMessage.content,
        role: userMessage.role,
        conversationId
      });

      // Get user system context if available
      let userSystemContext: string | undefined = undefined;
      if (req.isAuthenticated() && req.user && req.user.systemContext) {
        // If we have a logged-in user, include their system context
        userSystemContext = req.user.systemContext;
        console.log("Including user system context in conversation:", 
                    userSystemContext ? "Yes" : "None available");
      }

      // Generate AI response with user's system context if available
      const aiResponse = await generateChatResponse(messages, userSystemContext);

      // Store AI response
      const savedMessage = await storage.createMessage({
        content: aiResponse,
        role: "assistant",
        conversationId
      });

      // Return the AI response with model info
      res.json({ 
        message: savedMessage,
        conversationId,
        modelInfo: {
          model: currentModelStatus.model,
          isFallback: currentModelStatus.model !== 'openai'
        }
      });
    } catch (error: any) {
      console.error("Chat API error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to process chat message." 
      });
    }
  });
  
  // Get current model status
  app.get("/api/model-status", async (_req: Request, res: Response) => {
    try {
      // If it's been more than 5 minutes since last check, update status
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (currentModelStatus.lastChecked < fiveMinutesAgo) {
        await updateModelStatus();
      }
      
      return res.json(currentModelStatus);
    } catch (error) {
      console.error("Error getting model status:", error);
      return res.status(500).json({ message: "Failed to get model status" });
    }
  });

  // Delete a conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Don't allow deleting the default conversation
      if (id === "default") {
        return res.status(400).json({ message: "Cannot delete the default conversation" });
      }
      
      // Check if conversation exists
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check ownership if the conversation belongs to a user
      if (conversation.userId && req.isAuthenticated() && req.user) {
        // User must be the owner of the conversation
        if (conversation.userId !== req.user.id) {
          return res.status(403).json({ message: "You don't have permission to delete this conversation." });
        }
      }
      
      // Delete the conversation
      const success = await storage.deleteConversation(id);
      
      if (success) {
        res.status(200).json({ message: "Conversation deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete conversation" });
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Server error deleting conversation" });
    }
  });
  
  // Update conversation title
  app.patch("/api/conversations/:id/title", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title } = req.body;
      
      // Validate title
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ message: "Valid title is required" });
      }
      
      // Get the conversation
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check ownership if the conversation belongs to a user
      if (conversation.userId && req.isAuthenticated() && req.user) {
        // User must be the owner of the conversation
        if (conversation.userId !== req.user.id) {
          return res.status(403).json({ message: "You don't have permission to update this conversation." });
        }
      }
      
      // Update the conversation
      const updatedConversation = await storage.createConversation({
        ...conversation,
        title: title.trim()
      });
      
      res.json(updatedConversation);
    } catch (error) {
      console.error("Error updating conversation title:", error);
      res.status(500).json({ message: "Failed to update conversation title" });
    }
  });
  
  // Update conversation personality
  app.patch("/api/conversations/:id/personality", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { personality } = req.body;
      
      // Validate personality
      const result = personalityTypeSchema.safeParse(personality);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid personality type",
          validOptions: personalityTypeSchema.options
        });
      }
      
      // Get the conversation
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check ownership if the conversation belongs to a user
      if (conversation.userId && req.isAuthenticated() && req.user) {
        // User must be the owner of the conversation
        if (conversation.userId !== req.user.id) {
          return res.status(403).json({ message: "You don't have permission to update this conversation." });
        }
      }
      
      // Update the conversation personality
      const updatedConversation = await storage.updateConversationPersonality(id, result.data);
      
      // Return the updated conversation with personality details
      const personalityConfig = getPersonalityConfig(result.data);
      
      res.json({
        ...updatedConversation,
        personalityConfig: {
          name: personalityConfig.name,
          description: personalityConfig.description,
          emoji: personalityConfig.emoji
        }
      });
    } catch (error) {
      console.error("Error updating conversation personality:", error);
      res.status(500).json({ message: "Failed to update conversation personality" });
    }
  });
  
  // Get available personalities
  app.get("/api/personalities", async (_req: Request, res: Response) => {
    try {
      // Get all personality types from the schema
      const personalityTypes = personalityTypeSchema.options;
      
      // Map to include details for each personality
      const personalities = personalityTypes.map(type => {
        const config = getPersonalityConfig(type);
        return {
          id: type,
          name: config.name,
          description: config.description,
          emoji: config.emoji
        };
      });
      
      res.json(personalities);
    } catch (error) {
      console.error("Error fetching personalities:", error);
      res.status(500).json({ message: "Failed to fetch personalities" });
    }
  });

  // Generate image with FLUX.1-dev
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      // Validate the request body using the schema
      const result = imageGenerationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid image generation parameters",
          errors: result.error.format() 
        });
      }

      // Generate the image
      const imageUrl = await generateImage(result.data);
      
      // Return the image URL
      return res.json({ 
        success: true, 
        imageUrl,
        params: result.data
      });
    } catch (error: any) {
      console.error("Error generating image:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to generate image" 
      });
    }
  });

  // Check FLUX availability
  app.get("/api/flux-status", async (_req: Request, res: Response) => {
    try {
      const isAvailable = await isFluxAvailable();
      return res.json({ 
        isAvailable,
        model: "FLUX.1-dev"
      });
    } catch (error) {
      console.error("Error checking FLUX availability:", error);
      return res.status(500).json({ 
        isAvailable: false, 
        message: "Error checking FLUX availability" 
      });
    }
  });

  // Generate video using Replicate
  app.post("/api/generate-video", async (req: Request, res: Response) => {
    try {
      // Validate the request body using the schema
      const result = videoGenerationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid video generation parameters",
          errors: result.error.format() 
        });
      }

      // Generate the video
      const videoUrl = await generateVideo(result.data);
      
      // Return the video URL
      return res.json({ 
        success: true, 
        videoUrl,
        params: result.data
      });
    } catch (error: any) {
      console.error("Error generating video:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to generate video" 
      });
    }
  });

  // Check video generation availability
  app.get("/api/video-status", async (_req: Request, res: Response) => {
    try {
      const isAvailable = await isVideoGenerationAvailable();
      return res.json({ 
        isAvailable,
        model: "Wan-AI/Wan2.1-T2V-14B"
      });
    } catch (error) {
      console.error("Error checking video generation availability:", error);
      return res.status(500).json({ 
        isAvailable: false, 
        message: "Error checking video generation availability" 
      });
    }
  });

  // Health check endpoint
  // Profile image upload endpoint
  app.post("/api/user/profile-image", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      if (!req.files || !('image' in req.files)) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const file = req.files.image;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: "Invalid file type. Only JPG, PNG and GIF allowed." });
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
      }

      // Generate safe filename
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `profile-${req.user.id}-${Date.now()}.${ext}`;
      
      // Save file and get URL (implement this in storage.ts)
      const imageUrl = await req.app.locals.storage.saveProfileImage(fileName, file);
      
      // Update user profile
      await req.app.locals.storage.updateUserProfile(req.user.id, {
        profileImage: imageUrl
      });

      res.json({ imageUrl });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    return res.json({ status: "ok" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
