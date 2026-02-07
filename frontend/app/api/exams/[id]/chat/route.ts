import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

// Initialize OpenAI client with Vercel AI Gateway support (same as backend)
function getOpenAIClient() {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
  
  if (gatewayApiKey) {
    // Gateway mode: Route requests through Vercel AI Gateway
    console.log('🔗 Using Vercel AI Gateway for chat requests');
    return createOpenAI({
      apiKey: gatewayApiKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });
  } else {
    // Direct mode: Requires local API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY or AI_GATEWAY_API_KEY environment variable must be set');
    }
    return createOpenAI({
      apiKey,
    });
  }
}

// Initialize Anthropic client with Vercel AI Gateway support
function getAnthropicClient() {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
  
  if (gatewayApiKey) {
    console.log('🔗 Using Vercel AI Gateway for Anthropic chat requests');
    return createAnthropic({
      apiKey: gatewayApiKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY environment variable must be set');
    }
    return createAnthropic({
      apiKey,
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, examContext, conversationHistory, model = 'gpt' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build conversation history
    const messages = [];

    // Add conversation history (last 10 messages for context)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message,
    });

    const systemPrompt = `You are an AI tutoring assistant helping students understand exam content. Your role is to:

1. Answer questions about the exam topics and help clarify concepts
2. Guide students toward understanding WITHOUT giving direct answers to exam questions
3. If asked for a direct answer to an exam question, respond with hints and explanations instead
4. Be encouraging and supportive in your tone
5. Format your responses clearly with **bold** for key terms and <u>underline</u> for important points

EXAM CONTEXT:
${examContext}

Remember: Your goal is to help students learn and understand, not to give them the answers directly.`;

    // Call Vercel AI SDK with selected model
    let result;
    if (model === 'claude') {
      const anthropic = getAnthropicClient();
      result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: systemPrompt,
        messages: messages as any,
        temperature: 0.7,
        maxRetries: 2,
      });
    } else {
      const openai = getOpenAIClient();
      result = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        messages: messages as any,
        temperature: 0.7,
        maxRetries: 2,
      });
    }

    const response = result.text || 'I apologize, but I couldn\'t generate a response. Please try again.';

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
