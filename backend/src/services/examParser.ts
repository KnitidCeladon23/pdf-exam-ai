/**
 * Exam PDF Parser Service
 * 
 * This service handles the extraction and parsing of exam PDFs using LLMs.
 * It supports both digital PDFs and scanned documents (via OCR).
 */

const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; info: any; metadata: any; version: string }>;
import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Step 1: PDF Text Extraction
// ============================================================================

/**
 * Extract text from a digital PDF
 * @param buffer - PDF file buffer
 * @returns Extracted text content
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Digital PDF extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Perform OCR on a scanned PDF/image
 * @param buffer - Image/PDF file buffer
 * @returns Extracted text via OCR
 */
export async function performOCR(buffer: Buffer): Promise<string> {
  try {
    const languages = process.env.OCR_LANGUAGES || 'eng+chi_sim';
    
    const { data: { text } } = await Tesseract.recognize(
      buffer,
      languages,
      {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );
    
    return text;
  } catch (error) {
    console.error('OCR failed:', error);
    throw new Error('Failed to perform OCR on document');
  }
}

/**
 * Hybrid approach: Try digital extraction first, fall back to OCR
 * @param buffer - PDF file buffer
 * @param filename - Original filename (for logging)
 * @returns Extracted text content
 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  console.log(`Attempting digital extraction for ${filename}...`);
  
  // Try digital extraction first
  try {
    const digitalText = await extractTextFromPDF(buffer);
    
    // Check if extraction was successful (has meaningful content)
    // We check for at least 100 characters as a heuristic
    if (digitalText.trim().length > 100) {
      console.log(`✅ Digital extraction successful (${digitalText.length} chars)`);
      return digitalText;
    } else {
      console.log(`⚠️  Digital extraction produced insufficient text (${digitalText.length} chars)`);
    }
  } catch (error) {
    console.log('❌ Digital extraction failed, error:', error);
  }
  
  // Fall back to OCR for scanned documents
  console.log(`Falling back to OCR for ${filename}...`);
  const ocrText = await performOCR(buffer);
  console.log(`✅ OCR extraction successful (${ocrText.length} chars)`);
  
  return ocrText;
}

/**
 * Extract images from a PDF and save them as PNG files
 * @param buffer - PDF file buffer
 * @param examId - Exam ID for organizing images
 * @returns Array of image file paths
 */
export async function extractImagesFromPDF(
  buffer: Buffer,
  examId: number
): Promise<string[]> {
  const imagePaths: string[] = [];
  
  try {
    console.log(`📷 Attempting to extract images from PDF...`);
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'images', `exam-${examId}`);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Load PDF document using pdf-lib
    const pdfDoc = await PDFDocument.load(buffer);
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`  Processing ${pageCount} pages for images...`);
    
    // Note: pdf-lib doesn't provide direct image extraction APIs
    // This is a placeholder for future implementation using pdf2pic or pdf-to-png
    // For production, consider using:
    // 1. pdf2pic (converts pages to images, then use OCR to detect image regions)
    // 2. pdf-to-png (similar approach)
    // 3. pdfjs-dist (has better image extraction capabilities)
    
    // For now, we'll document that images should be manually associated
    // or use a more advanced library like pdfjs-dist for extraction
    
    console.log(`  ⚠️  Image extraction from PDF is planned for future implementation`);
    console.log(`  ⚠️  For now, images should be associated manually via the database`);
    
  } catch (error) {
    console.error('❌ Image extraction preparation failed:', error);
    // Don't throw - images are optional, continue with text extraction
  }
  
  return imagePaths;
}

// ============================================================================
// Step 2: Text Preprocessing & Normalization
// ============================================================================

/**
 * Preprocess and normalize extracted text
 * Cleans up OCR artifacts, normalizes formatting, and prepares text for LLM parsing
 * @param rawText - Raw extracted text
 * @returns Cleaned and normalized text
 */
export function preprocessText(rawText: string): string {
  let processed = rawText;
  
  // 1. Normalize whitespace on each line (multiple spaces/tabs to single space)
  // But preserve line breaks for regex anchors to work
  processed = processed.replace(/[ \t]+/g, ' ');
  
  // 2. Remove page numbers and headers/footers
  // Examples: "Page 1 of 10", "Page 1/10", etc.
  processed = processed.replace(/Page\s+\d+\s+(of|\/)\s+\d+/gi, '');
  
  // Remove standalone page numbers (lines with just a number)
  processed = processed.replace(/^\s*\d+\s*$/gm, '');
  
  // Remove common header/footer patterns
  processed = processed.replace(/^\s*[-–—]{3,}\s*$/gm, ''); // Horizontal lines
  
  // 3. Fix common OCR errors
  // Pipe character often misread as I or l
  processed = processed.replace(/\|(?=[a-z])/g, 'I'); // Pipe before lowercase -> I
  
  // Full-width numbers to half-width
  processed = processed.replace(/[０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
  
  // Common OCR substitutions
  processed = processed.replace(/\b0\b(?=[A-Z])/g, 'O'); // Digit 0 to letter O before caps
  processed = processed.replace(/\bl\b(?=\d)/g, '1'); // Letter l to digit 1 before numbers
  
  // 4. Normalize question numbering
  // "Question 1", "Question 1:", "Question 1." -> "Q1."
  processed = processed.replace(/Question\s+(\d+)\s*[:.]?\s*/gi, 'Q$1. ');
  
  // Standalone numbers at start of line with closing paren or period -> Q format
  // "1)" or "1." at line start -> "Q1. "
  processed = processed.replace(/^\s*(\d+)\s*[\.)]\s*/gm, 'Q$1. ');
  
  // 5. Preserve and normalize multiple choice options format
  // Match: "A)", "A.", "A )", "a)", "a.", "d.)" at start of line or after whitespace
  // Need to handle both line start and mid-line options
  processed = processed.replace(/^\s*([A-Da-d])\s*\.?\s*[)\)]\s*/gm, (match, letter) => {
    return letter.toUpperCase() + ') ';
  });
  // Also normalize lowercase options that are not at line start
  processed = processed.replace(/\b([a-d])\s*\.?\s*\)\s*/g, (match, letter) => {
    return letter.toUpperCase() + ') ';
  });
  // Handle "a." format (without closing paren)
  processed = processed.replace(/\b([A-Da-d])\s*\.\s+(?=[A-Z])/g, (match, letter) => {
    return letter.toUpperCase() + ') ';
  });
  
  // 6. Clean up extra newlines (more than 2 consecutive)
  processed = processed.replace(/\n{3,}/g, '\n\n');
  
  // 7. Fix spacing around punctuation
  processed = processed.replace(/\s+([.,;:!?])/g, '$1'); // Remove space before punctuation
  processed = processed.replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 '); // Add space after punctuation
  
  // 8. Normalize mathematical symbols
  processed = processed.replace(/×/g, '×'); // Ensure proper multiplication symbol
  processed = processed.replace(/÷/g, '÷'); // Ensure proper division symbol
  
  // 9. Fix common word OCR errors (can be expanded)
  const ocrCorrections: [RegExp, string][] = [
    [/\brnath\b/gi, 'math'],
    [/\bparagraph\b/gi, 'paragraph'],
    [/\bquestion\b/gi, 'question'],
    [/\banswer\b/gi, 'answer'],
  ];
  
  for (const [pattern, replacement] of ocrCorrections) {
    processed = processed.replace(pattern, replacement);
  }
  
  // 10. Remove excessive whitespace at start and end of each line
  processed = processed.split('\n').map(line => line.trim()).join('\n');
  
  // 11. Ensure proper line breaks after questions
  // Add newline after "Q#. " if not already present
  processed = processed.replace(/(Q\d+\.\s+[^\n]+)(?!\n)/g, '$1\n');
  
  // 12. Final cleanup - remove empty lines and trim
  processed = processed.replace(/\n\s*\n/g, '\n').trim();
  
  return processed;
}

/**
 * Validate that extracted text has sufficient content
 * @param text - Extracted text
 * @param minLength - Minimum character length
 * @returns Validation result with message
 */
export function validateExtractedText(
  text: string,
  minLength: number = 50
): { valid: boolean; message: string } {
  if (!text || text.trim().length === 0) {
    return {
      valid: false,
      message: 'No text extracted from document',
    };
  }
  
  if (text.trim().length < minLength) {
    return {
      valid: false,
      message: `Insufficient text extracted (${text.trim().length} chars, minimum ${minLength})`,
    };
  }
  
  // Check if text has at least some alphabetic characters (not just symbols)
  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 10) {
    return {
      valid: false,
      message: 'Extracted text contains insufficient readable content',
    };
  }
  
  return {
    valid: true,
    message: 'Text extraction successful',
  };
}

/**
 * Extract metadata from the text (subject, grade level hints)
 * This is a helper function for better parsing accuracy
 * @param text - Preprocessed text
 * @returns Detected metadata hints
 */
export function extractMetadataHints(text: string): {
  possibleSubject?: string;
  possibleGrade?: string;
  containsMath: boolean;
  containsChineseCharacters: boolean;
} {
  const hints: {
    possibleSubject?: string;
    possibleGrade?: string;
    containsMath: boolean;
    containsChineseCharacters: boolean;
  } = {
    containsMath: false,
    containsChineseCharacters: false,
  };
  
  // Check for Chinese characters
  hints.containsChineseCharacters = /[\u4e00-\u9fff]/.test(text);
  
  // Check for mathematical content
  const mathIndicators = [
    /\d+\s*[+\-×÷*/]\s*\d+/,
    /\b(equation|formula|calculate|solve|algebra|geometry)\b/i,
    /[²³√∑∫]/,
    /\b(sin|cos|tan|log)\b/i,
  ];
  hints.containsMath = mathIndicators.some((pattern) => pattern.test(text));
  
  // Detect subject keywords
  const subjectPatterns: [RegExp, string][] = [
    [/\b(mathematics|math|algebra|geometry|calculus)\b/i, 'Mathematics'],
    [/\b(english|comprehension|grammar|vocabulary|literature)\b/i, 'English'],
    [/\b(chinese|mandarin|华文|中文)\b/i, 'Chinese'],
    [/\b(science|physics|chemistry|biology)\b/i, 'Science'],
  ];
  
  for (const [pattern, subject] of subjectPatterns) {
    if (pattern.test(text)) {
      hints.possibleSubject = subject;
      break;
    }
  }
  
  // Detect grade level
  const gradePatterns: [RegExp, string][] = [
    [/\bP[1-6]\b/i, text.match(/\bP[1-6]\b/i)?.[0] || ''],
    [/\bPrimary\s+[1-6]\b/i, 'P' + text.match(/\bPrimary\s+([1-6])\b/i)?.[1]],
    [/\bS[1-4]\b/i, text.match(/\bS[1-4]\b/i)?.[0] || ''],
    [/\bSecondary\s+[1-4]\b/i, 'S' + text.match(/\bSecondary\s+([1-4])\b/i)?.[1]],
  ];
  
  for (const [pattern, grade] of gradePatterns) {
    if (pattern.test(text)) {
      hints.possibleGrade = grade;
      break;
    }
  }
  
  return hints;
}

// Export types for use in other modules
export interface ExtractionResult {
  text: string;
  method: 'digital' | 'ocr';
  characterCount: number;
  imagePaths: string[]; // Paths to extracted images
  metadata: {
    possibleSubject?: string;
    possibleGrade?: string;
    containsMath: boolean;
    containsChineseCharacters: boolean;
  };
}

/**
 * Complete extraction and preprocessing pipeline for Steps 1-2
 * @param buffer - PDF file buffer
 * @param filename - Original filename
 * @param examId - Exam ID for organizing extracted images
 * @returns Extraction result with preprocessed text, images, and metadata
 */
export async function extractAndPreprocess(
  buffer: Buffer,
  filename: string,
  examId: number
): Promise<ExtractionResult> {
  // Step 1: Extract text (hybrid approach)
  const rawText = await extractText(buffer, filename);
  
  // Step 1b: Extract images from PDF
  const imagePaths = await extractImagesFromPDF(buffer, examId);
  
  // Validate extraction
  const validation = validateExtractedText(rawText);
  if (!validation.valid) {
    throw new Error(`Text extraction validation failed: ${validation.message}`);
  }
  
  // Determine extraction method
  let method: 'digital' | 'ocr' = 'digital';
  try {
    const digitalText = await extractTextFromPDF(buffer);
    if (digitalText.trim().length <= 100) {
      method = 'ocr';
    }
  } catch {
    method = 'ocr';
  }
  
  // Step 2: Preprocess text
  const processedText = preprocessText(rawText);
  
  // Extract metadata hints
  const metadata = extractMetadataHints(processedText);
  
  console.log('📊 Extraction Summary:');
  console.log(`  Method: ${method.toUpperCase()}`);
  console.log(`  Characters: ${processedText.length}`);
  console.log(`  Images: ${imagePaths.length}`);
  console.log(`  Possible Subject: ${metadata.possibleSubject || 'Unknown'}`);
  console.log(`  Possible Grade: ${metadata.possibleGrade || 'Unknown'}`);
  console.log(`  Contains Math: ${metadata.containsMath ? 'Yes' : 'No'}`);
  console.log(`  Contains Chinese: ${metadata.containsChineseCharacters ? 'Yes' : 'No'}`);
  
  return {
    text: processedText,
    method,
    characterCount: processedText.length,
    imagePaths,
    metadata,
  };
}

// ============================================================================
// Step 3: Intelligent Chunking
// ============================================================================

/**
 * Interface for exam text chunks
 */
export interface ExamChunk {
  chunkIndex: number;
  content: string;
  estimatedQuestions: number;
  tokenCount: number;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 * @param text - Text to estimate
 * @returns Estimated token count
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Chunk text by length when no question markers are found
 * @param text - Text to chunk
 * @param maxTokens - Maximum tokens per chunk
 * @returns Array of chunks
 */
function chunkByLength(text: string, maxTokens: number): ExamChunk[] {
  const chunks: ExamChunk[] = [];
  const maxChars = maxTokens * 4; // Rough estimate
  
  let currentPos = 0;
  let chunkIndex = 0;
  
  while (currentPos < text.length) {
    const endPos = Math.min(currentPos + maxChars, text.length);
    const content = text.slice(currentPos, endPos);
    
    chunks.push({
      chunkIndex: chunkIndex++,
      content,
      estimatedQuestions: 0, // Unknown
      tokenCount: estimateTokens(content),
    });
    
    currentPos = endPos;
  }
  
  console.log(`📦 Created ${chunks.length} length-based chunks`);
  return chunks;
}

/**
 * Intelligently chunk exam paper by questions, respecting token limits
 * Splits by question numbers (Q1, Q2, Q3A, Q3B, etc.)
 * @param text - Preprocessed exam text
 * @param maxTokens - Maximum tokens per chunk (default: 6000 for GPT-4)
 * @returns Array of exam chunks
 */
export function chunkExamPaper(
  text: string,
  maxTokens: number = 6000
): ExamChunk[] {
  const chunks: ExamChunk[] = [];
  
  // Match question patterns: Q1. Q2. Q3A. Q3B. etc.
  // This matches the normalized format from preprocessText()
  const questionPattern = /Q(\d+)([A-Z])?\.?\s/g;
  const matches = Array.from(text.matchAll(questionPattern));
  
  console.log(`🔍 Found ${matches.length} question markers in text`);
  
  if (matches.length === 0) {
    // No clear question markers, chunk by length
    console.log('⚠️  No question markers found, using length-based chunking');
    return chunkByLength(text, maxTokens);
  }
  
  let currentChunk = '';
  let chunkIndex = 0;
  let questionCount = 0;
  let questionsInCurrentChunk: string[] = [];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startPos = match.index!;
    const endPos = i < matches.length - 1 ? matches[i + 1].index! : text.length;
    const questionText = text.slice(startPos, endPos);
    
    // Track question number for logging
    const questionNumber = match[1];
    const questionPart = match[2];
    const questionId = `Q${questionNumber}${questionPart || ''}`;
    
    // Estimate tokens for current chunk + new question
    const estimatedTokens = estimateTokens(currentChunk + questionText);
    
    if (estimatedTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk and start new one
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentChunk.trim(),
        estimatedQuestions: questionCount,
        tokenCount: estimateTokens(currentChunk),
      });
      
      console.log(`  📦 Chunk ${chunkIndex - 1}: ${questionCount} questions (${questionsInCurrentChunk.join(', ')})`);
      
      // Start new chunk with current question
      currentChunk = questionText;
      questionCount = 1;
      questionsInCurrentChunk = [questionId];
    } else {
      currentChunk += questionText;
      questionCount++;
      questionsInCurrentChunk.push(questionId);
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      chunkIndex: chunkIndex,
      content: currentChunk.trim(),
      estimatedQuestions: questionCount,
      tokenCount: estimateTokens(currentChunk),
    });
    
    console.log(`  📦 Chunk ${chunkIndex}: ${questionCount} questions (${questionsInCurrentChunk.join(', ')})`);
  }
  
  console.log(`✅ Created ${chunks.length} intelligent chunks from ${matches.length} questions`);
  console.log(`   Token distribution: ${chunks.map(c => c.tokenCount).join(', ')} tokens per chunk`);
  
  return chunks;
}

/**
 * Validate chunk quality - ensure chunks are not too small or too large
 * @param chunks - Array of chunks to validate
 * @param minTokens - Minimum tokens per chunk (default: 100)
 * @param maxTokens - Maximum tokens per chunk (default: 8000)
 * @returns Validation result
 */
export function validateChunks(
  chunks: ExamChunk[],
  minTokens: number = 100,
  maxTokens: number = 8000
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  for (const chunk of chunks) {
    if (chunk.tokenCount < minTokens) {
      issues.push(
        `Chunk ${chunk.chunkIndex} is too small (${chunk.tokenCount} tokens, minimum ${minTokens})`
      );
    }
    
    if (chunk.tokenCount > maxTokens) {
      issues.push(
        `Chunk ${chunk.chunkIndex} is too large (${chunk.tokenCount} tokens, maximum ${maxTokens})`
      );
    }
    
    if (chunk.estimatedQuestions === 0 && chunk.content.includes('Q')) {
      issues.push(
        `Chunk ${chunk.chunkIndex} may contain questions but estimated count is 0`
      );
    }
  }
  
  if (issues.length > 0) {
    console.log('⚠️  Chunk validation issues:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  } else {
    console.log('✅ All chunks passed validation');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
