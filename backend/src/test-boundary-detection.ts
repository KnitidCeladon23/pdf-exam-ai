/**
 * Test script for debugging boundary detection
 * Tests the detectQuestionBoundaries() function with a real exam PDF
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { extractPagesAsImages } from './services/examParser';

const SYSTEM_PROMPT = `You are an expert at analyzing exam paper images and identifying question boundaries.

Analyze this exam page and identify the EXACT vertical positions where each question begins and ends.

For EACH question on this page, determine:
1. The question number and part (if any)
2. The TOP position (as percentage from top of page, 0-100)
3. The BOTTOM position (as percentage from top of page, 0-100)

Look for:
- Question numbers (e.g., "1.", "Q1", "Question 1", "1a", "1A", "1i")
- Visual separators (lines, spacing)
- Start of next question or end of page

IMPORTANT:
- Analyze the ENTIRE page to find ALL questions
- Percentages must be 0-100
- Ensure boundaries don't overlap significantly
- If question has parts (A, B, C or a, b, c or i, ii, iii), include each part separately
- Sub-parts can use: uppercase letters (3A, 3B), lowercase letters (5a, 5b), or roman numerals (7i, 7ii, 7iii)
- Smartly infer which notation is used based on context
- Return ONLY valid JSON`;

async function testBoundaryDetection() {
  console.log('='.repeat(60));
  console.log('BOUNDARY DETECTION TEST');
  console.log('='.repeat(60));

  try {
    // Find test PDF
    const testPdfPath = path.join(process.cwd(), '..', 'frontend', 'public', '2024-P4-Maths-Term_1_Review-Ai_Tong.pdf');
    
    if (!fs.existsSync(testPdfPath)) {
      console.error('❌ Test PDF not found at:', testPdfPath);
      process.exit(1);
    }

    console.log('✅ Found test PDF:', testPdfPath);
    
    // Read PDF
    const buffer = fs.readFileSync(testPdfPath);
    console.log(`📄 PDF size: ${(buffer.length / 1024).toFixed(2)} KB`);

    // Extract first page as image
    console.log('\n📸 Extracting page 1 as image...');
    const pages = await extractPagesAsImages(buffer);
    console.log(`✅ Extracted ${pages.length} pages`);

    if (pages.length === 0) {
      console.error('❌ No pages extracted');
      process.exit(1);
    }

    // Test with first page
    const page1 = pages[0];
    console.log(`\n🔍 Testing boundary detection on page ${page1.pageNumber}...`);
    console.log(`   Image size: ${page1.base64.length} bytes (base64)`);

    // Get API credentials
    const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!gatewayApiKey && !openaiApiKey) {
      console.error('❌ No API key found. Set AI_GATEWAY_API_KEY or OPENAI_API_KEY');
      process.exit(1);
    }

    // Use fetch directly to test
    const apiKey = gatewayApiKey || openaiApiKey;
    const baseURL = gatewayApiKey 
      ? 'https://ai-gateway.vercel.sh/v1' 
      : 'https://api.openai.com/v1';

    console.log(`\n🔗 Using API: ${gatewayApiKey ? 'Vercel AI Gateway' : 'Direct OpenAI'}`);

    const prompt = `Analyze this exam page and identify ALL questions visible.

For EACH question, provide:
- questionNumber: the number (integer)
- questionPart: the part letter/numeral if any (string or null)
- topPercentage: where question starts (0-100)
- bottomPercentage: where question ends (0-100)

Return JSON:
{
  "boundaries": [
    {"questionNumber": 1, "questionPart": null, "topPercentage": 5, "bottomPercentage": 25},
    {"questionNumber": 2, "questionPart": "a", "topPercentage": 25, "bottomPercentage": 40}
  ]
}`;

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${page1.base64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      process.exit(1);
    }

    const result: any = await response.json();
    console.log('\n✅ API Response received');
    
    const content = result.choices[0].message.content;
    console.log('\n📝 Raw response:');
    console.log(content);

    // Try to parse JSON
    console.log('\n🔍 Parsing JSON...');
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in response');
      process.exit(1);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('\n✅ Parsed boundaries:');
    console.log(JSON.stringify(parsed, null, 2));

    if (parsed.boundaries && Array.isArray(parsed.boundaries)) {
      console.log(`\n📊 Found ${parsed.boundaries.length} question boundaries`);
      parsed.boundaries.forEach((b: any, i: number) => {
        console.log(`   ${i + 1}. Q${b.questionNumber}${b.questionPart || ''}: ${b.topPercentage}% - ${b.bottomPercentage}%`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST PASSED');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
  }
}

// Run test
testBoundaryDetection();
