/**
 * Test Question Segmentation
 * Tests the new createQuestionSegments() function with a real exam PDF
 */

// Load environment variables first
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';
import { parseExamPDF } from './services/examParser';

async function testSegmentation() {
  console.log('🧪 Testing Question Segmentation\n');
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
    
    // Parse with Vision API + Segmentation
    console.log('⚡ Starting Vision + Segmentation Pipeline...\n');
    
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
    
    // Check segmented images
    console.log('\n📂 Checking Segmented Images...\n');
    
    const imageDir = path.join(__dirname, '../uploads/images', `exam-${result.examId}`);
    
    if (!fs.existsSync(imageDir)) {
      console.warn('⚠️  Image directory not found:', imageDir);
      return;
    }
    
    const files = fs.readdirSync(imageDir).sort();
    
    // Count full pages vs segments
    const fullPages = files.filter(f => /^page-\d+\.png$/.test(f));
    const segments = files.filter(f => /^page-\d+-q\d+\.png$/.test(f));
    
    console.log(`   Full Page Images: ${fullPages.length}`);
    console.log(`   Question Segments: ${segments.length}`);
    console.log(`   Total Files: ${files.length}\n`);
    
    if (segments.length === 0) {
      console.error('❌ No question segments created!');
      console.log('\nFiles found:', files);
      process.exit(1);
    }
    
    console.log('✅ Segmentation Successful!\n');
    
    // Show segment distribution
    const segmentsByPage: { [key: number]: number } = {};
    segments.forEach(filename => {
      const match = filename.match(/^page-(\d+)-q\d+\.png$/);
      if (match) {
        const pageNum = parseInt(match[1]);
        segmentsByPage[pageNum] = (segmentsByPage[pageNum] || 0) + 1;
      }
    });
    
    console.log('📊 Segments per Page:');
    Object.entries(segmentsByPage)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([page, count]) => {
        console.log(`   Page ${page}: ${count} questions`);
      });
    
    // Check file sizes
    console.log('\n💾 Storage Analysis:');
    let totalFullPage = 0;
    let totalSegments = 0;
    
    fullPages.forEach(file => {
      const stat = fs.statSync(path.join(imageDir, file));
      totalFullPage += stat.size;
    });
    
    segments.forEach(file => {
      const stat = fs.statSync(path.join(imageDir, file));
      totalSegments += stat.size;
    });
    
    console.log(`   Full Pages: ${(totalFullPage / 1024).toFixed(2)} KB`);
    console.log(`   Segments: ${(totalSegments / 1024).toFixed(2)} KB`);
    console.log(`   Total: ${((totalFullPage + totalSegments) / 1024).toFixed(2)} KB`);
    console.log(`   Overhead: ${((totalSegments / totalFullPage) * 100).toFixed(1)}%`);
    
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
testSegmentation().then(() => {
  console.log('\n✅ Test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
