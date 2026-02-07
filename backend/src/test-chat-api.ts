/**
 * Integration test for chat API endpoint
 * Tests both GPT and Claude models through the Next.js API route
 */

import 'dotenv/config';

async function testChatAPI() {
  console.log('='.repeat(60));
  console.log('CHAT API INTEGRATION TEST');
  console.log('='.repeat(60));

  const API_URL = 'http://localhost:3000/api/exams/1/chat';
  
  const testPayload = {
    message: 'What is photosynthesis?',
    examContext: 'Biology Exam - Topics: Plants, Cells, Photosynthesis',
    conversationHistory: [],
  };

  // Test GPT model
  console.log('\n[TEST 1/2] Testing GPT model via API...');
  try {
    const gptResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testPayload,
        model: 'gpt',
      }),
    });

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text();
      throw new Error(`API error (${gptResponse.status}): ${errorText}`);
    }

    const gptData: any = await gptResponse.json();
    console.log('✅ GPT Response:', gptData.response.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ GPT API Test Failed:', error instanceof Error ? error.message : error);
  }

  // Test Claude model
  console.log('\n[TEST 2/2] Testing Claude model via API...');
  try {
    const claudeResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testPayload,
        model: 'claude',
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`API error (${claudeResponse.status}): ${errorText}`);
    }

    const claudeData: any = await claudeResponse.json();
    console.log('✅ Claude Response:', claudeData.response.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Claude API Test Failed:', error instanceof Error ? error.message : error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
  console.log('\n💡 Note: Frontend server must be running on http://localhost:3000');
}

testChatAPI().catch(console.error);
