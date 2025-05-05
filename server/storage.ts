import { 
  type Message, 
  type InsertMessage, 
  type Conversation, 
  type InsertConversation,
  type User,
  PersonalityType,
  messageRoleSchema,
  messages,
  conversations,
  users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';

export interface IStorage {
  // Message operations
  getMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessages(conversationId: string): Promise<void>;
  
  // Conversation operations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversations(): Promise<Conversation[]>;
  getUserConversations(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  deleteConversation(id: string): Promise<boolean>;
  updateConversationPersonality(id: string, personality: PersonalityType): Promise<Conversation | undefined>;
  updateConversationTitle(id: string, title: string): Promise<Conversation | undefined>;
  
  // User profile operations
  getUserProfile(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(userData: any): Promise<User>;
  updateUserProfile(id: number, profile: Partial<User>): Promise<User | undefined>;
  
  // Session operations
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Initialize PostgreSQL session store
    const PgStore = connectPgSimple(session);
    this.sessionStore = new PgStore({
      pool,
      createTableIfMissing: true,
    });

    // Initialize default conversation if it doesn't exist
    this.initializeDefaultConversation();
  }

  private async initializeDefaultConversation() {
    try {
      const defaultConversation = await this.getConversation("default");
      if (!defaultConversation) {
        await this.createConversation({
          id: "default",
          title: "New Conversation",
          personality: "general"
        });
      }
    } catch (error) {
      console.error("Error initializing default conversation:", error);
    }
  }

  // Message operations
  async getMessages(conversationId: string): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values({
        ...insertMessage,
        createdAt: new Date()
      })
      .returning();
    
    return newMessage;
  }
  
  async deleteMessages(conversationId: string): Promise<void> {
    await db
      .delete(messages)
      .where(eq(messages.conversationId, conversationId));
  }

  // Conversation operations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    
    return conversation;
  }

  async getConversations(): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    // If the conversation already exists, update it
    if (conversation.id) {
      const existingConversation = await this.getConversation(conversation.id);
      if (existingConversation) {
        const [updatedConversation] = await db
          .update(conversations)
          .set({
            title: conversation.title,
            personality: conversation.personality || "general",
            // Only update userId if provided
            ...(conversation.userId && { userId: conversation.userId })
          })
          .where(eq(conversations.id, conversation.id))
          .returning();
        
        return updatedConversation;
      }
    }
    
    // Otherwise, create a new conversation
    const [newConversation] = await db
      .insert(conversations)
      .values({
        id: conversation.id || nanoid(),
        title: conversation.title,
        personality: conversation.personality || "general",
        userId: conversation.userId, // Include the user ID (can be null for unassociated conversations)
        createdAt: new Date()
      })
      .returning();
    
    return newConversation;
  }
  
  async deleteConversation(id: string): Promise<boolean> {
    // Don't allow deleting the default conversation
    if (id === "default") {
      return false;
    }
    
    try {
      // Delete associated messages first
      await this.deleteMessages(id);
      
      // Then delete the conversation
      const [deletedConversation] = await db
        .delete(conversations)
        .where(eq(conversations.id, id))
        .returning();
      
      return !!deletedConversation;
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return false;
    }
  }
  
  async updateConversationPersonality(id: string, personality: PersonalityType): Promise<Conversation | undefined> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({ personality })
      .where(eq(conversations.id, id))
      .returning();
    
    return updatedConversation;
  }
  
  async updateConversationTitle(id: string, title: string): Promise<Conversation | undefined> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, id))
      .returning();
    
    return updatedConversation;
  }
  
  // User operations
  async getUserProfile(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    
    return user;
  }
  
  async createUser(userData: any): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    
    return user;
  }
  
  async updateUserProfile(id: number, profile: Partial<User>): Promise<User | undefined> {
    // Remove sensitive information that shouldn't be updated this way
    const { password, ...updateData } = profile;
    
    const [updatedUser] = await db
      .update(users)
      .set(updateData as any)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }
  
  // Filter conversations by user ID
  async getUserConversations(userId: number): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));
  }
}

// Use the database storage for production
export const storage = new DatabaseStorage();
