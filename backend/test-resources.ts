/**
 * Resource Testing Script
 * Tests PDF parsing performance and measures resource usage
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseExamPDF } from './src/services/examParser';

// Measure system resources
function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024), // MB
    heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
    external: Math.round(used.external / 1024 / 1024), // MB
  };
}

async function testPDFParsing() {
  console.log('\n' + '='.repeat(80));
  console.log('PDF EXAM AI - RESOURCE TESTING');
  console.log('='.repeat(80) + '\n');

  // Test PDF path - adjust this to your test file
  const testPdfPath = path.join(__dirname, '../frontend/public/2024-P4-Maths-Term_1_Review-Ai_Tong.pdf');
  
  if (!fs.existsSync(testPdfPath)) {
    console.error('❌ Test PDF not found:', testPdfPath);
    console.log('\nPlease ensure you have a test PDF file available.');
    process.exit(1);
  }

  const fileStats = fs.statSync(testPdfPath);
  const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);

  console.log('📄 Test File Information:');
  console.log(`   Path: ${testPdfPath}`);
  console.log(`   Size: ${fileSizeMB} MB`);
  console.log(`   Name: ${path.basename(testPdfPath)}`);
  console.log();

  // Initial memory
  const initialMemory = getMemoryUsage();
  console.log('💾 Initial Memory Usage:');
  console.log(`   RSS: ${initialMemory.rss} MB (Resident Set Size)`);
  console.log(`   Heap Total: ${initialMemory.heapTotal} MB`);
  console.log(`   Heap Used: ${initialMemory.heapUsed} MB`);
  console.log();

  // Read PDF buffer
  const buffer = fs.readFileSync(testPdfPath);
  const filename = path.basename(testPdfPath);
  
  console.log('⏱️  Starting PDF parsing test...');
  const startTime = Date.now();
  const cpuStart = process.cpuUsage();

  try {
    // Parse the PDF using Vision API with 'openai' provider
    // Vision API provides much better accuracy than OCR-based text extraction
    const result = await parseExamPDF(
      buffer,
      filename,
      '/test-pdf',
      'openai', // Use GPT-4o Vision (recommended) or 'anthropic' for Claude Vision
      3, // maxRetries
      undefined, // no existing exam
      (progress, message) => {
        console.log(`   [${progress}%] ${message}`);
      }
    );

    const endTime = Date.now();
    const cpuEnd = process.cpuUsage(cpuStart);
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);

    // Peak memory after parsing
    const peakMemory = getMemoryUsage();

    console.log('\n' + '='.repeat(80));
    console.log('✅ PARSING COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80) + '\n');

    console.log('📊 Results:');
    console.log(`   Exam ID: ${result.examId}`);
    console.log(`   Total Questions: ${result.metadata.totalQuestions}`);
    console.log(`   MCQ: ${result.metadata.mcqCount}`);
    console.log(`   Open-ended: ${result.metadata.openEndedCount}`);
    console.log();

    console.log('⏱️  Performance:');
    console.log(`   Processing Time: ${processingTime}s`);
    console.log(`   CPU User: ${(cpuEnd.user / 1000000).toFixed(2)}s`);
    console.log(`   CPU System: ${(cpuEnd.system / 1000000).toFixed(2)}s`);
    console.log();

    console.log('💾 Peak Memory Usage:');
    console.log(`   RSS: ${peakMemory.rss} MB (Resident Set Size)`);
    console.log(`   Heap Total: ${peakMemory.heapTotal} MB`);
    console.log(`   Heap Used: ${peakMemory.heapUsed} MB`);
    console.log(`   External: ${peakMemory.external} MB`);
    console.log();

    const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
    console.log(`   Memory Increase: +${memoryIncrease} MB`);
    console.log();

    console.log('📈 Resource Recommendations (Based on Test):');
    console.log('─'.repeat(80));
    console.log('\nFor 1 concurrent user:');
    console.log(`   • Memory: ${Math.max(512, peakMemory.rss + 256)} MB (with 256MB buffer)`);
    console.log(`   • vCPU: 1 core minimum, 2 cores recommended`);
    console.log();

    console.log('For 10 concurrent users (your requirement):');
    const concurrentUsers = 10;
    const memoryPerUser = peakMemory.rss;
    const baseMemory = 512; // Base system + Node.js + PostgreSQL
    const recommendedMemory = baseMemory + (memoryPerUser * concurrentUsers * 0.7); // 70% factor for shared resources
    
    console.log(`   • Memory: ${Math.ceil(recommendedMemory / 512) * 512} MB - ${Math.ceil(recommendedMemory / 256) * 256 + 512} MB`);
    console.log(`   • vCPU: 4 cores (recommended for concurrent OCR processing)`);
    console.log(`   • Storage: 20 GB SSD minimum (10GB app + logs + uploads)`);
    console.log(`   • Bandwidth: 100 Mbps (sufficient for PDF uploads & image serving)`);
    console.log();

    console.log('🐳 Recommended Server Specs:');
    console.log('─'.repeat(80));
    console.log('   VPS/Cloud Server:');
    console.log('   • 4 vCPU cores');
    console.log('   • 8 GB RAM (comfortable for 10 concurrent users)');
    console.log('   • 40 GB SSD storage');
    console.log('   • 100 Mbps+ bandwidth');
    console.log('   • Ubuntu 22.04 LTS or similar');
    console.log();

    console.log('   Examples:');
    console.log('   • DigitalOcean: $48/month (4vCPU, 8GB RAM, 160GB SSD)');
    console.log('   • Linode: $48/month (4vCPU, 8GB RAM, 160GB SSD)');
    console.log('   • Vultr: $48/month (4vCPU, 8GB RAM, 160GB SSD)');
    console.log('   • AWS EC2: t3.large ($60-70/month with reserved)');
    console.log();

    console.log('💡 Performance Notes:');
    console.log('   • OCR is CPU-intensive (3 pages processed in parallel)');
    console.log('   • LLM calls are I/O bound (waiting for API responses)');
    console.log('   • Memory spikes during OCR, then releases');
    console.log('   • PostgreSQL adds ~256-512MB memory overhead');
    console.log('   • Consider Redis for caching if scaling beyond 20 users');
    console.log();

  } catch (error) {
    console.error('\n❌ PARSING FAILED:');
    console.error(error);
    console.error();
    
    const errorMemory = getMemoryUsage();
    console.log('💾 Memory at Error:');
    console.log(`   RSS: ${errorMemory.rss} MB`);
    console.log(`   Heap Used: ${errorMemory.heapUsed} MB`);
    
    process.exit(1);
  }

  console.log('='.repeat(80));
}

// Run the test
console.log('Starting resource testing...');
console.log('Note: Make sure DATABASE_URL and AI API keys are configured in .env');
console.log();

testPDFParsing()
  .then(() => {
    console.log('✅ Resource testing completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Resource testing failed:', error);
    process.exit(1);
  });
