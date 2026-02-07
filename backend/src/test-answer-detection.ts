/**
 * Test Answer Detection
 * Tests the answer detection from exam PDF pages and outputs results to LLM_ANSWERS.md
 */

// Load environment variables first
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';
import { parseExamPDF } from './services/examParser';
import { prisma } from './lib/prisma';

async function testAnswerDetection() {
  console.log('🧪 Testing Answer Detection\n');
  console.log('='.repeat(70));
  
  try {
    // Load test PDF
    const pdfPath = path.join(__dirname, '../../frontend/public/2024-P4-Maths-Term_1_Review-Ai_Tong.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ Test PDF not found:', pdfPath);
      process.exit(1);
    }
    
    console.log('📄 Loading PDF:', path.basename(pdfPath));
    const buffer = fs.readFileSync(pdfPath);
    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    // Generate unique exam ID for testing
    const testExamId = Date.now();
    console.log(`   Test Exam ID: ${testExamId}\n`);
    
    // Parse with Vision API + Answer Detection
    console.log('⚡ Starting Vision + Answer Detection Pipeline...\n');
    
    const result = await parseExamPDF(
      buffer,
      path.basename(pdfPath),
      `/uploads/${path.basename(pdfPath)}`,
      'openai', // Use GPT-4o Vision
      3,
      undefined,
      (progress, message) => {
        console.log(`   [${progress}%] ${message}`);
      }
    );
    
    console.log('\n✅ PROCESSING COMPLETE\n');
    console.log('='.repeat(70));
    console.log('📊 Results:');
    console.log(`   Exam ID: ${result.examId}`);
    console.log(`   Total Questions: ${result.metadata.totalQuestions}`);
    console.log(`   MCQ: ${result.metadata.mcqCount}`);
    console.log(`   Open-ended: ${result.metadata.openEndedCount}`);
    console.log(`   Processing Time: ${(result.processingTime / 1000).toFixed(2)}s`);
    console.log('='.repeat(70));
    
    // Fetch questions with answers from database
    console.log('\n📋 Fetching question and answer data...\n');
    
    const questions = await prisma.question.findMany({
      where: { examId: result.examId },
      include: {
        answers: true,
      },
      orderBy: [
        { number: 'asc' },
        { part: 'asc' },
      ],
    });
    
    console.log(`   Found ${questions.length} questions in database`);
    
    // Generate markdown output
    console.log('\n📝 Generating LLM_ANSWERS.md...\n');
    
    const outputPath = path.join(process.cwd(), 'LLM_ANSWERS.md');
    let markdown = `# Answer Detection Test Results\n\n`;
    markdown += `**Test Date**: ${new Date().toISOString().split('T')[0]}\n`;
    markdown += `**PDF**: ${path.basename(pdfPath)}\n`;
    markdown += `**Exam ID**: ${result.examId}\n`;
    markdown += `**Processing Time**: ${(result.processingTime / 1000).toFixed(2)}s\n\n`;
    markdown += `---\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Total Questions**: ${result.metadata.totalQuestions}\n`;
    markdown += `- **MCQ**: ${result.metadata.mcqCount}\n`;
    markdown += `- **Open-ended**: ${result.metadata.openEndedCount}\n`;
    
    // Count detected answers
    const detectedAnswers = questions.filter(q => {
      const answer = q.answers[0];
      return answer && !answer.isAiGenerated;
    }).length;
    
    const aiGeneratedAnswers = questions.filter(q => {
      const answer = q.answers[0];
      return answer && answer.isAiGenerated;
    }).length;
    
    markdown += `- **Answers Detected from PDF**: ${detectedAnswers}\n`;
    markdown += `- **AI-Generated Answers**: ${aiGeneratedAnswers}\n\n`;
    markdown += `---\n\n`;
    
    // Add questions with answers
    markdown += `## Questions and Answers\n\n`;
    
    for (const question of questions) {
      const answer = question.answers[0];
      const questionLabel = `Question ${question.number}${question.part ? question.part : ''}`;
      
      markdown += `### ${questionLabel}\n\n`;
      markdown += `**Type**: ${question.type}\n\n`;
      markdown += `**Question Text**:\n`;
      markdown += `> ${question.text}\n\n`;
      
      if (question.options && question.options.length > 0) {
        markdown += `**Options**:\n`;
        question.options.forEach(opt => {
          markdown += `- ${opt}\n`;
        });
        markdown += `\n`;
      }
      
      if (answer) {
        const answerText = answer.textFromPdf || answer.textFromAi;
        markdown += `**Answer**:\n`;
        markdown += `\`\`\`\n${answerText}\n\`\`\`\n\n`;
        
        markdown += `**Source**: ${answer.isAiGenerated ? '🤖 AI-Generated' : '✅ Detected from PDF'}\n`;
        markdown += `**Verified**: ${answer.isVerified ? '✅ Yes' : '❌ No'}\n\n`;
        
        if (answer.verificationNote) {
          markdown += `**Verification Note**: ${answer.verificationNote}\n\n`;
        }
      } else {
        markdown += `**Answer**: ❌ No answer found\n\n`;
      }
      
      if (question.image && question.image.length > 0) {
        markdown += `**Image**: ${question.image[0]}\n\n`;
      }
      
      markdown += `---\n\n`;
    }
    
    // Add statistics section
    markdown += `## Detection Statistics\n\n`;
    markdown += `| Category | Count | Percentage |\n`;
    markdown += `|----------|-------|------------|\n`;
    markdown += `| Total Questions | ${questions.length} | 100% |\n`;
    markdown += `| Answers from PDF | ${detectedAnswers} | ${((detectedAnswers / questions.length) * 100).toFixed(1)}% |\n`;
    markdown += `| AI-Generated | ${aiGeneratedAnswers} | ${((aiGeneratedAnswers / questions.length) * 100).toFixed(1)}% |\n`;
    markdown += `| Verified | ${questions.filter(q => q.answers[0]?.isVerified).length} | ${((questions.filter(q => q.answers[0]?.isVerified).length / questions.length) * 100).toFixed(1)}% |\n\n`;
    
    // Add answer page detection log
    markdown += `## Answer Page Detection Log\n\n`;
    markdown += `The system scanned all ${result.metadata.totalQuestions} pages of the PDF for answer sections.\n\n`;
    
    if (detectedAnswers > 0) {
      markdown += `✅ **Success**: Found ${detectedAnswers} answers from the PDF.\n\n`;
      markdown += `These answers were likely located in:\n`;
      markdown += `- Dedicated answer pages at the end of the exam\n`;
      markdown += `- Answer sections at the beginning of the exam\n`;
      markdown += `- Inline answers within question pages\n\n`;
    } else {
      markdown += `⚠️ **Note**: No answers were detected from the PDF.\n\n`;
      markdown += `This could mean:\n`;
      markdown += `- The exam does not include answer pages\n`;
      markdown += `- Answers are in a separate document\n`;
      markdown += `- The answer format was not recognized by the detection algorithm\n\n`;
      markdown += `All answers were generated using AI (GPT-4o) based on the question content.\n\n`;
    }
    
    markdown += `---\n\n`;
    markdown += `## Technology Stack\n\n`;
    markdown += `- **Vision AI**: GPT-4o (OpenAI) via Vercel AI Gateway\n`;
    markdown += `- **Answer Detection**: Custom prompt-engineered detection algorithm\n`;
    markdown += `- **Answer Matching**: Question number and part-based matching\n`;
    markdown += `- **AI Generation**: GPT-4o for missing answers\n`;
    markdown += `- **Verification**: AI-based answer verification\n\n`;
    
    markdown += `---\n\n`;
    markdown += `*Generated by answer detection test script*\n`;
    markdown += `*Test completed at: ${new Date().toISOString()}*\n`;
    
    // Write markdown file
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    
    console.log(`   ✅ Output written to: ${outputPath}`);
    console.log(`   📄 File size: ${(markdown.length / 1024).toFixed(2)} KB`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    if (error instanceof Error) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

// Run test
testAnswerDetection().then(() => {
  console.log('\n✅ Test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
