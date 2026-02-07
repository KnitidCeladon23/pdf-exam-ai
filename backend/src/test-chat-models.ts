/**
 * Test script for chatbot model functionality
 * Tests both GPT and Claude models through the chat API
 */

import 'dotenv/config';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

// Initialize OpenAI client
function getOpenAIClient() {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
  
  if (gatewayApiKey) {
    console.log('🔗 Using Vercel AI Gateway for OpenAI');
    return createOpenAI({
      apiKey: gatewayApiKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });
  } else {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY or AI_GATEWAY_API_KEY required');
    }
    return createOpenAI({ apiKey });
  }
}

// Initialize Anthropic client
function getAnthropicClient() {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
  
  if (gatewayApiKey) {
    console.log('🔗 Using Vercel AI Gateway for Anthropic');
    return createAnthropic({
      apiKey: gatewayApiKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
    }
    return createAnthropic({ apiKey });
  }
}

async function testChatModels() {
  console.log('='.repeat(60));
  console.log('CHATBOT MODEL TEST');
  console.log('='.repeat(60));

  const testMessage = 'What is 2 + 2?';
  const systemPrompt = 'You are a helpful math tutor. Keep responses brief.';

  try {
    // Test GPT model
    console.log('\n[TEST 1/2] Testing GPT-4o Mini...');
    const openai = getOpenAIClient();
    
    const gptResult = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: testMessage,
        },
      ],
      temperature: 0.7,
      maxRetries: 2,
    });

    console.log('✅ GPT Response:', gptResult.text.substring(0, 100) + (gptResult.text.length > 100 ? '...' : ''));

  } catch (error) {
    console.error('❌ GPT Test Failed:', error instanceof Error ? error.message : error);
  }

  try {
    // Test Claude model
    console.log('\n[TEST 2/2] Testing Claude 3.5 Sonnet...');
    const anthropic = getAnthropicClient();
    
    const claudeResult = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: testMessage,
        },
      ],
      temperature: 0.7,
      maxRetries: 2,
    });

    console.log('✅ Claude Response:', claudeResult.text.substring(0, 100) + (claudeResult.text.length > 100 ? '...' : ''));

  } catch (error) {
    console.error('❌ Claude Test Failed:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message) {
      console.error('Error details:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

testChatModels().catch(console.error);
