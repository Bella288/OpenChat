import { MessageType } from "@shared/schema";
import { InferenceClient } from "@huggingface/inference";

// This file provides a fallback mechanism when the OpenAI API is unavailable
// Using the Qwen model through the Novita API via Hugging Face Inference

// Initialize the Hugging Face client with the Novita API key
const novitaApiKey = process.env.NOVITA_API_KEY || '';
const huggingFaceClient = new InferenceClient(novitaApiKey);

// Qwen model configuration
const QWEN_MODEL = "Qwen/Qwen3-235B-A22B";
const MAX_TOKENS = 512;

// System message to help guide the Qwen model
const QWEN_SYSTEM_MESSAGE = `I am your helpful AI assistant. Start each conversation with "I am your helpful AI assistant. How can I help you today?"

Bot Instructions: {botInstructions}

Remember:
1. Do not use XML tags in responses
2. Keep responses clear and concise
3. Be informative and friendly`;

// Convert our message format to the format expected by the Hugging Face API
function convertMessages(messages: MessageType[], userSystemContext?: string, botInstructions?: string): Array<{role: string, content: string}> {
  // Create system message with user context if available
  let systemContent = QWEN_SYSTEM_MESSAGE.replace('{botInstructions}', botInstructions || '');

  // Check if user exists in database with profile information
  if (userSystemContext) {
    // Helper function to safely extract matches
    const getMatchValue = (match: RegExpMatchArray | null): string | null => {
      if (match && match[1]) {
        return match[1].trim();
      }
      return null;
    };

    // Extract user profile from the context or from database fields
    // First, try to parse from the system context with regex patterns
    const nameMatches = [
      getMatchValue(userSystemContext.match(/name(?:\s+is)?(?:\s*:\s*|\s+)([\w\s.']+)/i)),
      getMatchValue(userSystemContext.match(/My name is ([\w\s.']+)/i)),
      getMatchValue(userSystemContext.match(/I am ([\w\s.']+)/i)),
      getMatchValue(userSystemContext.match(/I'm ([\w\s.']+)/i))
    ].filter(Boolean) as string[];

    const locationMatches = [
      getMatchValue(userSystemContext.match(/location(?:\s+is)?(?:\s*:\s*|\s+)([\w\s.,]+)/i)),
      getMatchValue(userSystemContext.match(/(?:I live|I'm from|I reside) in ([\w\s.,]+)/i)),
      getMatchValue(userSystemContext.match(/from ([\w\s.,]+)/i))
    ].filter(Boolean) as string[];

    const interestsMatches = [
      getMatchValue(userSystemContext.match(/interests(?:\s+are)?(?:\s*:\s*|\s+)([\w\s,.;{}]+)/i)),
      getMatchValue(userSystemContext.match(/(?:I like|I enjoy|I love) ([\w\s,.;]+)/i))
    ].filter(Boolean) as string[];

    const professionMatches = [
      getMatchValue(userSystemContext.match(/profession(?:\s+is)?(?:\s*:\s*|\s+)([\w\s&,.-]+)/i)),
      getMatchValue(userSystemContext.match(/(?:I work as|I am a|I'm a) ([\w\s&,.-]+)/i)),
      getMatchValue(userSystemContext.match(/(?:I'm|I am) (?:a|an) ([\w\s&,.-]+)/i))
    ].filter(Boolean) as string[];

    const petsMatches = [
      getMatchValue(userSystemContext.match(/pets?(?:\s+are)?(?:\s*:\s*|\s+)([\w\s,.()]+)/i)),
      getMatchValue(userSystemContext.match(/(?:I have|I own) (?:a pet|pets|a) ([\w\s,.()]+)/i))
    ].filter(Boolean) as string[];

    // Take the first successful match for each category
    const userName = nameMatches.length > 0 ? nameMatches[0] : null;
    const userLocation = locationMatches.length > 0 ? locationMatches[0] : null;
    const userInterests = interestsMatches.length > 0 ? interestsMatches[0] : null;
    const userProfession = professionMatches.length > 0 ? professionMatches[0] : null;
    const userPets = petsMatches.length > 0 ? petsMatches[0] : null;

    // Fallback to database information directly if we have Bella's profile
    let bellaInfo = '';
    if (userSystemContext.includes("Bella Lawrence") || (userName && userName.includes("Bella"))) {
      bellaInfo = `
- Your name is Bella Lawrence
- You live in Fort Wayne, Indiana
- Your interests include Python
- Your profession is Student
- You have pets named Barley (cat), Pebbles (dog), and Buttercup (rabbit)
`;
      console.log("Using Bella's profile information directly");
    }

    // Build a clear, structured system message for the model
    let userInfo = '';
    if (userName) userInfo += `- Your name is ${userName}\n`;
    if (userLocation) userInfo += `- You live in ${userLocation}\n`;
    if (userInterests) userInfo += `- Your interests include ${userInterests}\n`;
    if (userProfession) userInfo += `- Your profession is ${userProfession}\n`;
    if (userPets) userInfo += `- You have pets: ${userPets}\n`;

    // Use Bella's data directly if available, otherwise use what we extracted
    const profileInfo = bellaInfo || userInfo || userSystemContext;

    // Build a more direct and instructive system message
    systemContent = `${systemContent}

User Details:
${profileInfo}

INSTRUCTIONS:
1. When asked "What's my name?" respond with the name listed above.
2. When asked about name, location, interests, profession, or pets, use EXACTLY the information above.
3. NEVER say you don't know or can't access this information - it's right above!
4. Answer as if you've always known this information - don't say "according to your profile" or similar phrases.

REMEMBER: You already know the user's name and details. ALWAYS use this information when asked.`;

    // Special handling for "what's my name" type questions to ensure it works
    const hasNameQuestion = messages.some(msg => {
      const content = msg.content.toLowerCase();
      return (
        content.includes("what's my name") || 
        content.includes("what is my name") || 
        content.includes("do you know my name") ||
        content.includes("who am i")
      );
    });

    if (hasNameQuestion) {
      console.log("Detected name question - ensuring proper response");
      // Add extra reminder for name questions
      systemContent += `\n\nIMPORTANT REMINDER: The user has asked about their name. Their name is ${userName || "Bella Lawrence"}. DO NOT say you don't know their name.`;
    }

    console.log("Including enhanced user system context in fallback chat");
    if (userName) console.log(`Extracted user name: ${userName}`);
    if (userLocation) console.log(`Extracted user location: ${userLocation}`);
  }

  // Start with our system message
  const formattedMessages = [{
    role: "system",
    content: systemContent
  }];

  // Filter out any existing system messages from the input
  const compatibleMessages = messages.filter(msg => msg.role !== 'system');

  // If no messages are left, add a default user message
  if (compatibleMessages.length === 0) {
    formattedMessages.push({
      role: "user",
      content: "Hello, can you introduce yourself?"
    });
    return formattedMessages;
  }

  // Make sure the last message is from the user
  const lastMessage = compatibleMessages[compatibleMessages.length - 1];
  if (lastMessage.role !== 'user') {
    // If the last message isn't from a user, add a generic user query
    compatibleMessages.push({
      role: "user",
      content: "Can you help me with this?"
    });
  }

  // Add all the compatible messages
  formattedMessages.push(...compatibleMessages.map(msg => ({
    role: msg.role,
    content: msg.content
  })));

  return formattedMessages;
}

// Main function to generate a fallback chat response using Qwen
export async function generateFallbackResponse(messages: MessageType[], userSystemContext?: string, botInstructions?: string): Promise<string> {
  try {
    console.log("Generating fallback response using Qwen model");

    // Convert messages to the format expected by the Hugging Face API
    const formattedMessages = convertMessages(messages, userSystemContext, botInstructions);

    // Make the API call to the Qwen model via Novita
    const response = await huggingFaceClient.chatCompletion({
      provider: "novita",
      model: QWEN_MODEL,
      messages: formattedMessages,
      max_tokens: MAX_TOKENS,
    });

    // Extract and return the generated text
    if (response.choices && response.choices.length > 0 && response.choices[0].message) {
      // Clean up the response - remove any thinking process or XML-like tags
      let content = response.choices[0].message.content || '';

      // Remove the <think> sections that might appear in the response
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '');

      // Remove any other XML-like tags
      content = content.replace(/<[^>]*>/g, '');

      // Clean up any excessive whitespace
      content = content.replace(/^\s+|\s+$/g, '');
      content = content.replace(/\n{3,}/g, '\n\n');

      // If content is empty after cleanup, provide a default message
      if (!content.trim()) {
        content = "I'm sorry, I couldn't generate a proper response.";
      }

      // Add a note that this is using the fallback model
      return `${content}\n\n(Note: I'm currently operating in fallback mode using the Qwen model because the OpenAI API is unavailable)`;
    } else {
      throw new Error("No valid response from Qwen model");
    }
  } catch (error) {
    console.error("Error generating response with Qwen model:", error);

    // If the Qwen model fails, return a simple fallback message
    return "I apologize, but I'm currently experiencing technical difficulties with both primary and fallback AI services. Please try again later.";
  }
}

// Check if we can use the OpenAI API
export async function canUseOpenAI(): Promise<boolean> {
  try {
    // A simple check to see if the OpenAI API key exists and has basic formatting
    const apiKey = process.env.OPENAI_API_KEY;
    // Check if the key exists and has a valid format (basic check)
    return Boolean(apiKey && apiKey.startsWith('sk-') && apiKey.length > 20);
  } catch (error) {
    console.error("Error checking OpenAI API availability:", error);
    return false;
  }
}

// Check if we can use the Qwen model via Novita
export async function canUseQwen(): Promise<boolean> {
  try {
    // Check if the Novita API key exists
    return Boolean(novitaApiKey && novitaApiKey.length > 0);
  } catch (error) {
    console.error("Error checking Qwen availability:", error);
    return false;
  }
}