/**
 * Exam PDF Parser Service
 * 
 * This service handles the extraction and parsing of exam PDFs using LLMs.
 * It supports both digital PDFs and scanned documents (via OCR).
 */

import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { pdfToPng } from 'pdf-to-png-converter';

// DISABLED: pdf-parse dynamic import (causes version conflicts with pdf-to-png-converter)
// let pdfParse: any = null;
// async function getPdfParse() {
//   if (!pdfParse) {
//     const pdfParseModule = await import('pdf-parse');
//     pdfParse = (pdfParseModule as any).PDFParse || (pdfParseModule as any).default || pdfParseModule;
//   }
//   return pdfParse;
// }

// ============================================================================
// Step 1: PDF Text Extraction
// ============================================================================

/**
 * DISABLED: Extract text from a digital PDF
 * This function is disabled due to pdfjs-dist version conflicts.
 * pdf-parse uses pdfjs-dist@5.4.296 while pdf-to-png-converter uses @5.4.624
 * Loading both causes "API version does not match Worker version" errors.
 * @param buffer - PDF file buffer  
 * @returns Extracted text content
 */
// export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
//   try {
//     const PDFParse = await getPdfParse();
//     const parser = new PDFParse({ data: buffer });
//     const result = await parser.getText();
//     return result.text;
//   } catch (error) {
//     console.error('Digital PDF extraction failed:', error);
//     throw new Error('Failed to extract text from PDF');
//   }
// }

/**
 * Perform OCR on a scanned PDF/image
 * @param buffer - Image/PDF file buffer
 * @param isPDF - Whether the buffer is a PDF (needs conversion to images)
 * @returns Extracted text via OCR
 */
export async function performOCR(buffer: Buffer, isPDF: boolean = true): Promise<string> {
  try {
    const languages = process.env.OCR_LANGUAGES || 'eng';
    let allText = '';
    
    if (isPDF) {
      // Convert PDF to PNG images using pdf-to-png-converter
      console.log('  📷 Converting PDF pages to images for OCR...');
      
      try {
        const startConversion = Date.now();
        
        // Convert PDF buffer to PNG array
        // pdf-to-png-converter accepts ArrayBuffer, so convert Buffer to ArrayBuffer
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        );
        
        const pngPages = await pdfToPng(arrayBuffer, {
          disableFontFace: false, // Render fonts properly
          useSystemFonts: false,
        });
        
        const conversionTime = ((Date.now() - startConversion) / 1000).toFixed(2);
        console.log(`  ✅ PDF converted to ${pngPages.length} images in ${conversionTime}s`);
        
        // OPTIMIZATION: Process pages in parallel batches for much faster OCR
        // Use concurrency limit to avoid overwhelming system memory
        const CONCURRENCY_LIMIT = 3; // Process 3 pages at a time
        const pageTexts: string[] = new Array(pngPages.length);
        
        console.log(`  🚀 Processing ${pngPages.length} pages with OCR (${CONCURRENCY_LIMIT} parallel)...`);
        const startOCR = Date.now();
        
        // Process in batches
        for (let batchStart = 0; batchStart < pngPages.length; batchStart += CONCURRENCY_LIMIT) {
          const batchEnd = Math.min(batchStart + CONCURRENCY_LIMIT, pngPages.length);
          const batchPromises = [];
          
          for (let i = batchStart; i < batchEnd; i++) {
            const pageNumber = i + 1;
            const imageBuffer = pngPages[i].content;
            
            // Start OCR for this page
            const ocrPromise = Tesseract.recognize(imageBuffer, languages, {
              logger: (m: any) => {
                if (m.status === 'recognizing text') {
                  const progress = Math.round(m.progress * 100);
                  if (progress % 25 === 0) { // Log every 25%
                    console.log(`    Page ${pageNumber}: ${progress}%`);
                  }
                }
              },
            }).then((result) => {
              pageTexts[i] = result.data.text;
              console.log(`  ✅ Page ${pageNumber}/${pngPages.length} complete (${result.data.text.length} chars)`);
            });
            
            batchPromises.push(ocrPromise);
          }
          
          // Wait for this batch to complete
          await Promise.all(batchPromises);
        }
        
        const ocrTime = ((Date.now() - startOCR) / 1000).toFixed(2);
        console.log(`  ✅ All OCR processing complete in ${ocrTime}s`);
        
        // Combine all page texts in order
        allText = pageTexts.join('\n\n');
        console.log(`  📊 Total extracted: ${allText.length} characters`);
        
      } catch (error) {
        console.error('Error during PDF->PNG conversion:', error);
        throw new Error(`OCR PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Direct image OCR
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
      allText = text;
    }
    
    return allText;
  } catch (error) {
    console.error('OCR failed:', error);
    throw new Error('Failed to perform OCR on document');
  }
}

/**
 * Hybrid approach: Try digital extraction first, fall back to OCR
 * Note: pdf-parse uses pdfjs-dist@5.4.296 while pdf-to-png-converter uses @5.4.624
 * Loading both causes version conflicts. For now, prioritize OCR for better accuracy.
 * @param buffer - PDF file buffer
 * @param filename - Original filename (for logging)
 * @returns Extracted text content
 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  console.log(`Starting extraction for ${filename}...`);
  
  // Use OCR-only extraction to avoid pdfjs-dist version conflicts
  // pdf-parse uses pdfjs-dist@5.4.296 vs pdf-to-png-converter uses @5.4.624
  console.log(`📷 Using OCR extraction (avoids version conflicts)...`);
  
  try {
    const ocrText = await performOCR(buffer);
    console.log(`✅ OCR extraction successful (${ocrText.length} chars)`);
    return ocrText;
  } catch (ocrError) {
    console.error('❌ OCR extraction failed:', ocrError);
    throw new Error('OCR extraction failed - digital extraction disabled to avoid version conflicts');
  }
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
    console.log(`📷 Extracting images from PDF...`);
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'images', `exam-${examId}`);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Convert Buffer to ArrayBuffer for pdf-to-png-converter
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
    
    // Convert PDF pages to PNG images
    const pngPages = await pdfToPng(arrayBuffer, {
      disableFontFace: false,
      useSystemFonts: false,
    });
    
    console.log(`  📄 Extracted ${pngPages.length} page images`);
    
    // Save each page as an image
    for (let i = 0; i < pngPages.length; i++) {
      const page = pngPages[i];
      const imageName = `page-${i + 1}.png`;
      const imagePath = path.join(uploadsDir, imageName);
      
      if (page.content) {
        fs.writeFileSync(imagePath, page.content);
        
        // Store relative path for serving via Express
        const relativeImagePath = `/uploads/images/exam-${examId}/${imageName}`;
        imagePaths.push(relativeImagePath);
      }
    }
    
    console.log(`  ✅ Saved ${imagePaths.length} page images`);
    
  } catch (error) {
    console.error('❌ Image extraction failed:', error);
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
  
  // Always use OCR method to avoid pdfjs-dist version conflicts
  const method: 'digital' | 'ocr' = 'ocr';
  
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

// ============================================================================
// Step 4: LLM Structured Output Schema
// ============================================================================

/**
 * Zod schema for parsed question validation
 */
export const QuestionSchema = z.object({
  number: z.number().int().positive(),
  part: z.string().nullable(),
  text: z.string().min(5),
  type: z.enum(['MCQ', 'Open-ended']),
  options: z.array(z.string()),
  correctAnswer: z.string().nullable().transform(val => val ?? ""),
  image: z.string().nullable(),
});

/**
 * Zod schema for parsed exam validation
 */
export const ExamSchema = z.object({
  subject: z.enum(['Mathematics', 'English', 'Chinese', 'Science', 'Unknown']),
  name: z.string().min(3),
  estimatedGrade: z.string(),
  questions: z.array(QuestionSchema).min(0),
});

/**
 * TypeScript interfaces for parsed data
 */
export interface ParsedQuestion {
  number: number;
  part: string | null;
  text: string;
  type: 'MCQ' | 'Open-ended';
  options: string[];
  correctAnswer: string;
  image: string | null;
}

export interface ParsedExam {
  subject: 'Mathematics' | 'English' | 'Chinese' | 'Science' | 'Unknown';
  name: string;
  estimatedGrade: string;
  questions: ParsedQuestion[];
}

/**
 * Metadata accumulated across chunks
 */
export interface ExamMetadata {
  totalQuestions: number;
  mcqCount: number;
  openEndedCount: number;
}

// ============================================================================
// Step 5: LLM Prompt Engineering
// ============================================================================

/**
 * System prompt for LLM exam parser
 */
export const SYSTEM_PROMPT = `You are an expert exam paper parser specializing in educational assessments from PRIMARY to HIGH SCHOOL levels.

CRITICAL RULES:
1. Extract ONLY questions that appear in the provided text - DO NOT generate, invent, or create sample questions
2. If the text contains insufficient content or no questions, return an empty questions array
3. Extract questions sequentially from top to bottom exactly as they appear
4. QUESTION NUMBERING: Generally, question numbers appear on the LEFT side of the question text (e.g., "1." or "Q1:" followed by the question). However, in some cases, the question number may be embedded WITHIN the question text itself. Adapt to the document's format and reasonably infer the question structure.
5. Preserve exact question numbering (e.g., 1, 2, 3A, 3B, 4) from the source document
6. Identify question types: "MCQ" (multiple choice) or "Open-ended"
7. For MCQ: extract ALL options (typically A, B, C, D) and the correct answer. Options may appear inline, as a numbered/lettered list, or in other formats - adapt accordingly
8. For Open-ended: extract the model answer if provided
9. Preserve formatting of mathematical expressions, formulas, and special characters
10. If a question has multiple parts (A, B, C), treat each as a separate question with the same number
11. If you see "[IMAGE]", "[DIAGRAM]", or visual elements, note it in the image field
12. Extract the EXACT text of questions and answers - do not paraphrase, summarize, or modify

GRADE LEVEL AWARENESS (Primary P1-P6, Secondary S1-S4/S5):
- Primary papers may contain simple diagrams, pictures of objects, animals, trains, everyday items
- Secondary papers may contain complex graphs, technical diagrams, scientific illustrations
- Adjust complexity expectations accordingly

SUBJECT-SPECIFIC ATTENTION:
- **Mathematics**: Pay special attention to:
  * Fractions (1/2, 3/4, etc.) and mixed numbers
  * Mathematical symbols (÷, ×, √, π, ², ³)
  * Equations and algebraic expressions
  * Geometric shapes and measurements
  * Word problems with numerical data
  
- **Chinese**: Pay special attention to:
  * Simplified Chinese characters (简体字)
  * Pinyin annotations
  * Character stroke order questions
  * Reading comprehension passages in Chinese
  * Fill-in-the-blank with Chinese characters
  
- **English**: Pay special attention to:
  * Grammar questions (tenses, prepositions, articles)
  * Vocabulary and spelling
  * Comprehension passages
  * Sentence construction
  
- **Science**: Pay special attention to:
  * Diagrams of plants, animals, human body
  * Scientific apparatus and experiments
  * Charts, tables, and data interpretation
  * Technical terminology

IMAGE/DIAGRAM RECOGNITION:
- If you see references to images, diagrams, charts, graphs, or visual elements
- If text refers to "the picture above", "the diagram below", "refer to Figure 1"
- If you see [IMAGE], [DIAGRAM], [CHART], etc.
- Note this in the image field as "[VISUAL ELEMENT PRESENT]"

SUBJECTS: Mathematics, English, Chinese (Simplified Mandarin), Science

WARNING: Never fabricate questions. If the provided text is unclear, incomplete, or contains no questions, return {"subject": "Unknown", "name": "Insufficient content", "estimatedGrade": "Unknown", "questions": []}

IMPORTANT: Return ONLY valid JSON matching the exact schema. No additional text or explanation.`;

/**
 * Create user prompt for a specific chunk
 * @param chunkContent - Preprocessed text content
 * @param chunkIndex - Current chunk number (0-based)
 * @param totalChunks - Total number of chunks
 * @returns Formatted prompt string
 */
export function createUserPrompt(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number
): string {
  return `Parse the following exam paper content (chunk ${chunkIndex + 1} of ${totalChunks}):

--- EXAM CONTENT START ---
${chunkContent}
--- EXAM CONTENT END ---

CRITICAL INSTRUCTIONS:
1. Extract ONLY the questions that actually appear in the content above
2. DO NOT generate, invent, or create sample/example questions
3. If the content has insufficient or unclear question data, return an empty questions array
4. Copy questions and answers word-for-word from the source text

Return a JSON object with this structure:
{
  "subject": "Mathematics | English | Chinese | Science",
  "name": "Descriptive exam name (e.g., '2024 P4 Mathematics Midterm')",
  "estimatedGrade": "P4 | P5 | P6 | S1 | S2 | etc.",
  "questions": [
    {
      "number": 1,
      "part": null,
      "text": "Full question text EXACTLY as it appears in the source",
      "type": "MCQ",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "Option B text",
      "image": null
    },
    {
      "number": 2,
      "part": "A",
      "text": "Question 2A text EXACTLY as it appears in the source",
      "type": "Open-ended",
      "options": [],
      "correctAnswer": "Detailed model answer EXACTLY as it appears in the source",
      "image": "[DIAGRAM PRESENT]"
    }
  ]
}

IMPORTANT:
- If this is chunk ${chunkIndex + 1} of ${totalChunks}, only extract questions visible in this chunk
- Maintain exact question numbering and parts from the source
- Extract word-for-word question text and answers - no modifications
- Set "part" to null for questions without sub-parts
- For MCQ, the correctAnswer must be the EXACT text from the options array
- If you cannot find clear questions in the text above, return {"subject": "Unknown", "name": "No questions found", "estimatedGrade": "Unknown", "questions": []}
- Return ONLY the JSON object, no additional text`;
}

// ============================================================================
// Step 6: OpenAI GPT-4 Integration
// ============================================================================

/**
 * Initialize OpenAI client (lazy initialization)
 * Supports Vercel AI Gateway for caching, rate limiting, and analytics
 */
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Check if Vercel AI Gateway is configured
    const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
    
    if (gatewayApiKey) {
      // Gateway mode: Route requests through Vercel AI Gateway
      console.log('🔗 Using Vercel AI Gateway for OpenAI requests');
      openaiClient = new OpenAI({
        apiKey: gatewayApiKey,
        baseURL: 'https://ai-gateway.vercel.sh/v1',
      });
    } else {
      // Direct mode: Requires local API key
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set (or configure AI_GATEWAY_API_KEY for Vercel AI Gateway)');
      }
      openaiClient = new OpenAI({ apiKey });
    }
  }
  return openaiClient;
}

/**
 * Parse exam chunk using OpenAI GPT-4o
 * @param chunkContent - Preprocessed text content
 * @param chunkIndex - Current chunk number (0-based)
 * @param totalChunks - Total number of chunks
 * @returns Parsed exam data
 */
export async function parseWithGPT4(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number
): Promise<ParsedExam> {
  const openai = getOpenAIClient();
  
  console.log(`🤖 Parsing chunk ${chunkIndex + 1}/${totalChunks} with GPT-4o...`);
  console.log(`📝 Chunk text preview (first 500 chars): ${chunkContent.substring(0, 500)}...`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06', // Supports structured outputs
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: createUserPrompt(chunkContent, chunkIndex, totalChunks),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'exam_parser',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subject: {
                type: 'string',
                enum: ['Mathematics', 'English', 'Chinese', 'Science', 'Unknown'],
              },
              name: { type: 'string' },
              estimatedGrade: { type: 'string' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'integer' },
                    part: { type: ['string', 'null'] },
                    text: { type: 'string' },
                    type: { type: 'string', enum: ['MCQ', 'Open-ended'] },
                    options: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    correctAnswer: { type: 'string' },
                    image: { type: ['string', 'null'] },
                  },
                  required: ['number', 'part', 'text', 'type', 'options', 'correctAnswer', 'image'],
                  additionalProperties: false,
                },
              },
            },
            required: ['subject', 'name', 'estimatedGrade', 'questions'],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.1, // Low temperature for consistency
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No response from GPT-4o');
    }

    const parsed = JSON.parse(content) as ParsedExam;
    console.log(`  ✅ Extracted ${parsed.questions.length} questions`);
    
    return parsed;
  } catch (error) {
    console.error(`❌ GPT-4o parsing failed for chunk ${chunkIndex + 1}:`, error);
    throw error;
  }
}

// ============================================================================
// Step 7: Anthropic Claude Integration
// ============================================================================

/**
 * Initialize Anthropic client (lazy initialization)
 * Supports Vercel AI Gateway for caching, rate limiting, and analytics
 */
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    // Check if Vercel AI Gateway is configured
    const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
    
    if (gatewayApiKey) {
      // Gateway mode: Route requests through Vercel AI Gateway
      console.log('🔗 Using Vercel AI Gateway for Anthropic requests');
      anthropicClient = new Anthropic({
        apiKey: gatewayApiKey,
        baseURL: 'https://ai-gateway.vercel.sh',
      });
    } else {
      // Direct mode: Requires local API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set (or configure AI_GATEWAY_API_KEY for Vercel AI Gateway)');
      }
      anthropicClient = new Anthropic({ apiKey });
    }
  }
  return anthropicClient;
}

/**
 * Parse exam chunk using Anthropic Claude
 * @param chunkContent - Preprocessed text content
 * @param chunkIndex - Current chunk number (0-based)
 * @param totalChunks - Total number of chunks
 * @returns Parsed exam data
 */
export async function parseWithClaude(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number
): Promise<ParsedExam> {
  const anthropic = getAnthropicClient();
  
  console.log(`🤖 Parsing chunk ${chunkIndex + 1}/${totalChunks} with Claude...`);
  
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: createUserPrompt(chunkContent, chunkIndex, totalChunks),
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response (Claude may add explanation text)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedExam;
    console.log(`  ✅ Extracted ${parsed.questions.length} questions`);
    
    return parsed;
  } catch (error) {
    console.error(`❌ Claude parsing failed for chunk ${chunkIndex + 1}:`, error);
    throw error;
  }
}

/**
 * Parse exam chunk using the configured LLM provider
 * @param chunkContent - Preprocessed text content
 * @param chunkIndex - Current chunk number (0-based)
 * @param totalChunks - Total number of chunks
 * @param provider - LLM provider to use ('openai' or 'anthropic')
 * @returns Parsed exam data
 */
export async function parseChunkWithLLM(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number,
  provider: 'openai' | 'anthropic' = 'openai'
): Promise<ParsedExam> {
  if (provider === 'openai') {
    return parseWithGPT4(chunkContent, chunkIndex, totalChunks);
  } else {
    return parseWithClaude(chunkContent, chunkIndex, totalChunks);
  }
}

/**
 * Generate AI answer for a question that has no answer provided
 * @param question - Question text  
 * @param questionType - Type of question (MCQ or Open-ended)
 * @param options - Array of options for MCQ questions
 * @returns Generated answer text
 */
export async function generateAIAnswer(
  question: string,
  questionType: 'MCQ' | 'Open-ended',
  options: string[] = []
): Promise<string> {
  const openai = getOpenAIClient();
  
  console.log(`🤖 Generating AI answer for question: "${question.substring(0, 50)}..."`);
  
  try {
    let prompt = '';
    
    if (questionType === 'MCQ' && options.length > 0) {
      prompt = `You are a knowledgeable tutor. Provide the correct answer to this multiple choice question.

Question: ${question}

Options:
${options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}

Respond with only the letter and text of the correct answer (e.g., "A) The correct option text"). If you're not certain, choose the most reasonable option and explain briefly why.`;
    } else {
      prompt = `You are a knowledgeable tutor. Provide a clear, accurate answer to this question.

Question: ${question}

Provide a concise but complete answer. If it's a mathematical question, show key steps. If you're not completely certain, indicate that this is your best assessment.`;
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful educational AI that provides accurate answers to exam questions. For mathematical or multi-step problems, show your work. FORMAT: Start with the direct answer in bold (use **answer**), then provide explanation. For longer answers, use **bold** for the main answer and underline key points using HTML <u>tags</u>. Always be honest about uncertainty.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3, // Lower temperature for more consistent answers
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    
    if (!answer) {
      throw new Error('No answer generated by AI');
    }
    
    console.log(`  ✅ Generated answer: "${answer.substring(0, 50)}..."`);
    return answer;
    
  } catch (error) {
    console.error('❌ Failed to generate AI answer:', error);
    throw new Error(`Failed to generate AI answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify answer accuracy by solving the question independently and comparing
 * @param question - Question text
 * @param extractedAnswer - Answer extracted from PDF to verify
 * @param questionType - Type of question (MCQ or Open-ended)
 * @param options - MCQ options if applicable
 * @param context - Additional context from OCR text
 * @param previousSubparts - Context from previous subparts (for co-related questions like 14A, 14B, 14C)
 * @returns Verification result with AI's independent answer and comparison
 */
async function verifyAnswer(
  question: string,
  extractedAnswer: string,
  questionType: string,
  options: string[] = [],
  context: string = '',
  previousSubparts: Array<{ part: string; question: string; answer: string }> = []
): Promise<{
  isAccurate: boolean;
  note: string | null;
  suggestedAnswer: string | null;
}> {
  const openai = await getOpenAIClient();
  
  try {
    let prompt = '';
    
    // Build previous subpart context if available
    let subpartContext = '';
    if (previousSubparts.length > 0) {
      subpartContext = '\n\nPREVIOUS SUBPARTS (for context - these are co-related questions):\n';
      previousSubparts.forEach(sub => {
        subpartContext += `${sub.part}: ${sub.question}\nAnswer: ${sub.answer}\n\n`;
      });
      subpartContext += 'Use the information from these previous subparts when solving the current question.\n';
    }
    
    if (questionType === 'MCQ' && options.length > 0) {
      prompt = `You are solving an exam question to verify the provided answer.${subpartContext}

Question: ${question}

Options:
${options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}

${context ? `Context from exam:\n${context.substring(0, 500)}\n\n` : ''}Task: Solve this question and provide your answer. Then compare with the answer extracted from the PDF.

Extracted PDF Answer: ${extractedAnswer}

Provide your response in JSON format:
{
  "yourAnswer": "Your selected option (A/B/C/D) with full text",
  "reasoning": "Brief explanation of why you chose this answer",
  "isAccurate": true/false (true if your answer matches extracted answer exactly, false if any difference),
  "note": "Explanation if answers don't match, or null if they match",
  "suggestedAnswer": "Your correct answer with **bold** and <u>underline</u> formatting - ALWAYS provide this even if answers match"
}`;
    } else {
      prompt = `You are solving an exam question to verify the provided answer.${subpartContext}

Question: ${question}

${context ? `Context from exam:\n${context.substring(0, 500)}\n\n` : ''}Task: Solve this question and provide your answer. Then compare with the answer extracted from the PDF.

Extracted PDF Answer: ${extractedAnswer}

Provide your response in JSON format:
{
  "yourAnswer": "Your complete answer to the question",
  "reasoning": "Brief explanation of your answer",
  "isAccurate": true/false (true if answers match in meaning/value, false if different),
  "note": "Explanation if answers differ, or null if they match",
  "suggestedAnswer": "Your correct answer with **bold** and <u>underline</u> formatting - ALWAYS provide this even if answers match"
}`;
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: 'You are an expert tutor who solves exam questions to verify answers. CRITICAL: Solve each question independently and provide your answer FIRST, before seeing the extracted answer. Then compare your answer with the extracted one. Be STRICT in comparison - for numerical/factual questions, answers must match exactly or be mathematically equivalent. For subjective questions, allow minor wording differences if meaning is same. Format ALL suggested answers (both accurate and inaccurate) with **bold** for main points and <u>underline</u> for key terms. Always respond with valid JSON: {"yourAnswer": string, "reasoning": string, "isAccurate": boolean, "note": string|null, "suggestedAnswer": string|null}. IMPORTANT: Always provide suggestedAnswer with formatting, even when isAccurate=true.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      throw new Error('No response from verification AI');
    }
    
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    
    const result = JSON.parse(jsonText);
    
    console.log(`  ${result.isAccurate ? '✅' : '⚠️'} Verification: ${result.isAccurate ? 'Accurate' : result.note || 'Questionable'}`);
    
    return {
      isAccurate: result.isAccurate || false,
      note: result.note || null,
      suggestedAnswer: result.suggestedAnswer || null,
    };
    
  } catch (error) {
    console.error('⚠️ Failed to verify answer:', error);
    // Don't throw - verification is optional, return default (assume accurate)
    return {
      isAccurate: true,
      note: null,
      suggestedAnswer: null,
    };
  }
}

/**
 * Validate parsed exam data with Zod schema and business logic
 * @param data - Parsed exam data to validate
 * @returns Validated exam data
 */
export function validateParsedExam(data: unknown): ParsedExam {
  try {
    const validated = ExamSchema.parse(data);
    
    // Additional business logic validation
    validated.questions.forEach((q, index) => {
      // MCQ must have at least 2 options
      if (q.type === 'MCQ' && q.options.length < 2) {
        throw new Error(`Question ${q.number}${q.part || ''} is MCQ but has less than 2 options`);
      }
      
      // For MCQ, correct answer should match one of the options
      if (q.type === 'MCQ' && q.options.length > 0) {
        const exactMatch = q.options.includes(q.correctAnswer);
        
        if (!exactMatch) {
          console.warn(`⚠️  Question ${q.number}${q.part || ''}: Correct answer not exactly in options. Attempting fuzzy match...`);
          
          // Attempt fuzzy matching (case-insensitive, partial match)
          const match = q.options.find(opt => {
            const optLower = opt.toLowerCase().trim();
            const ansLower = q.correctAnswer.toLowerCase().trim();
            return optLower.includes(ansLower) || ansLower.includes(optLower);
          });
          
          if (match) {
            console.warn(`  ✅ Fuzzy matched "${q.correctAnswer}" to "${match}"`);
            q.correctAnswer = match;
          } else {
            console.warn(`  ⚠️  No match found, keeping original answer: "${q.correctAnswer}"`);
          }
        }
      }
      
      // Validate question numbering
      if (q.number < 1 || q.number > 999) {
        throw new Error(`Question ${q.number}${q.part || ''} has invalid number`);
      }
      
      // Validate part format (should be single letter A-Z or null)
      if (q.part !== null && !/^[A-Z]$/.test(q.part)) {
        console.warn(`⚠️  Question ${q.number}${q.part}: Part should be single letter A-Z, got "${q.part}"`);
      }
    });
    
    return validated as ParsedExam;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError<any>;
      console.error('❌ Validation errors:', zodError.issues);
      throw new Error(`Invalid exam data: ${zodError.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

// ============================================================================
// Step 8: Dual LLM Processing with Comparison & Merging
// ============================================================================

/**
 * Parse with both OpenAI and Claude, then merge results
 * Uses both LLMs in parallel for higher accuracy and completeness
 * @param chunkContent - Preprocessed text content
 * @param chunkIndex - Current chunk number (0-based)
 * @param totalChunks - Total number of chunks
 * @returns Merged and validated exam data
 */
export async function parseWithBothProviders(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number
): Promise<ParsedExam> {
  console.log(`  🤖🤖 Parsing chunk ${chunkIndex + 1} with BOTH OpenAI GPT-4o AND Claude Sonnet...`);
  
  try {
    // Parse with both providers in parallel
    const [gptResult, claudeResult] = await Promise.allSettled([
      parseWithGPT4(chunkContent, chunkIndex, totalChunks),
      parseWithClaude(chunkContent, chunkIndex, totalChunks),
    ]);
    
    // Extract successful results
    const gptData = gptResult.status === 'fulfilled' ? gptResult.value : null;
    const claudeData = claudeResult.status === 'fulfilled' ? claudeResult.value : null;
    
    if (!gptData && !claudeData) {
      throw new Error('Both LLMs failed to parse the chunk');
    }
    
    // If only one succeeded, use that
    if (!gptData) {
      console.log(`  ⚠️  Using Claude result only (GPT-4o failed: ${gptResult.status === 'rejected' ? gptResult.reason : ''})`);
      return claudeData!;
    }
    if (!claudeData) {
      console.log(`  ⚠️  Using GPT-4o result only (Claude failed: ${claudeResult.status === 'rejected' ? claudeResult.reason : ''})`);
      return gptData;
    }
    
    // Both succeeded - merge results
    console.log(`  ✅ GPT-4o extracted ${gptData.questions.length} questions`);
    console.log(`  ✅ Claude extracted ${claudeData.questions.length} questions`);
    
    const merged = mergeExamResults(gptData, claudeData, chunkIndex);
    console.log(`  🔀 Merged result: ${merged.questions.length} questions`);
    
    return merged;
    
  } catch (error) {
    console.error(`❌ Dual LLM parsing failed for chunk ${chunkIndex + 1}:`, error);
    throw error;
  }
}

/**
 * Intelligently merge results from two LLM providers
 * Prefers completeness and uses voting/comparison for conflicts
 * @param gptResult - Result from GPT-4o
 * @param claudeResult - Result from Claude
 * @param chunkIndex - Current chunk number for logging
 * @returns Merged exam data
 */
function mergeExamResults(
  gptResult: ParsedExam,
  claudeResult: ParsedExam,
  chunkIndex: number
): ParsedExam {
  // Use the result with more questions as base (likely more complete)
  const [primary, secondary] = gptResult.questions.length >= claudeResult.questions.length
    ? [gptResult, claudeResult]
    : [claudeResult, gptResult];
  
  const providerName = primary === gptResult ? 'GPT-4o' : 'Claude';
  console.log(`  📊 Using ${providerName} as primary (${primary.questions.length} questions)`);
  
  // Merge metadata: prefer non-"Unknown" values
  const merged: ParsedExam = {
    subject: primary.subject !== 'Unknown' ? primary.subject : secondary.subject,
    name: primary.name.length > secondary.name.length ? primary.name : secondary.name,
    estimatedGrade: primary.estimatedGrade !== 'Unknown' ? primary.estimatedGrade : secondary.estimatedGrade,
    questions: [...primary.questions],
  };
  
  // Add questions from secondary that might be missing in primary
  // Match by question number and part
  for (const secQ of secondary.questions) {
    const exists = merged.questions.find(
      (q) => q.number === secQ.number && q.part === secQ.part
    );
    
    if (!exists) {
      console.log(`  ➕ Adding question ${secQ.number}${secQ.part || ''} from secondary provider`);
      merged.questions.push(secQ);
    } else {
      // Question exists in both - compare and use more complete version
      if (secQ.text && exists.text && secQ.text.length > exists.text.length) {
        console.log(`  🔄 Using longer text for Q${secQ.number}${secQ.part || ''} from secondary`);
        exists.text = secQ.text;
      }
      if (secQ.correctAnswer && exists.correctAnswer && secQ.correctAnswer.length > exists.correctAnswer.length) {
        console.log(`  🔄 Using longer answer for Q${secQ.number}${secQ.part || ''} from secondary`);
        exists.correctAnswer = secQ.correctAnswer;
      }
      if (secQ.options && exists.options && secQ.options.length > exists.options.length) {
        console.log(`  🔄 Using more options for Q${secQ.number}${secQ.part || ''} from secondary`);
        exists.options = secQ.options;
      }
    }
  }
  
  // Sort questions by number and part
  merged.questions.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    if (a.part === null && b.part === null) return 0;
    if (a.part === null) return -1;
    if (b.part === null) return 1;
    return a.part.localeCompare(b.part);
  });
  
  return merged;
}

/**
 * Parse chunk with retry logic and validation
 * @param chunkContent - Preprocessed text content
 * @param chunkIndex - Current chunk number (0-based)
 * @param totalChunks - Total number of chunks
 * @param provider - LLM provider to use ('openai', 'anthropic', or 'both')
 * @param maxRetries - Maximum number of retry attempts
 * @returns Validated parsed exam data
 */
export async function parseChunkWithRetry(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number,
  provider: 'openai' | 'anthropic' | 'both' = 'both',
  maxRetries: number = 3
): Promise<ParsedExam> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`  🔄 Retry attempt ${attempt + 1}/${maxRetries}...`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
      
      // Use dual LLM processing by default for maximum accuracy
      const parsed = provider === 'both'
        ? await parseWithBothProviders(chunkContent, chunkIndex, totalChunks)
        : await parseChunkWithLLM(chunkContent, chunkIndex, totalChunks, provider);
      
      const validated = validateParsedExam(parsed);
      
      console.log(`  ✅ Chunk ${chunkIndex + 1} validated successfully`);
      return validated;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`  ❌ Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
    }
  }
  
  throw new Error(`Failed to parse chunk ${chunkIndex + 1} after ${maxRetries} attempts: ${lastError?.message}`);
}

// ============================================================================
// Step 9: Merging Multiple Chunks
// ============================================================================

/**
 * Merge parsed exam chunks into a single complete exam
 * Handles deduplication and proper question ordering
 * @param chunks - Array of parsed exam chunks
 * @returns Merged exam with all questions
 */
export function mergeExamChunks(chunks: ParsedExam[]): ParsedExam {
  if (chunks.length === 0) {
    throw new Error('No chunks to merge');
  }
  
  if (chunks.length === 1) {
    console.log('✅ Single chunk, no merging needed');
    return chunks[0];
  }
  
  console.log(`🔀 Merging ${chunks.length} chunks...`);
  
  // Use metadata from first chunk (most likely to have exam title)
  const merged: ParsedExam = {
    subject: chunks[0].subject,
    name: chunks[0].name,
    estimatedGrade: chunks[0].estimatedGrade,
    questions: [],
  };
  
  // Merge questions from all chunks using Map for deduplication
  const questionMap = new Map<string, ParsedQuestion>();
  
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    
    for (const question of chunk.questions) {
      const key = `${question.number}-${question.part || 'null'}`;
      
      // Take the first occurrence (avoid duplicates from overlapping chunks)
      if (!questionMap.has(key)) {
        questionMap.set(key, question);
      } else {
        console.log(`  ⚠️  Skipping duplicate: Q${question.number}${question.part || ''} (from chunk ${chunkIndex + 1})`);
      }
    }
  }
  
  // Sort questions by number and part
  merged.questions = Array.from(questionMap.values()).sort((a, b) => {
    if (a.number !== b.number) {
      return a.number - b.number;
    }
    // Questions without parts come before parts
    if (a.part === null && b.part === null) return 0;
    if (a.part === null) return -1;
    if (b.part === null) return 1;
    return a.part.localeCompare(b.part);
  });
  
  console.log(`✅ Merged ${merged.questions.length} unique questions`);
  console.log(`   MCQ: ${merged.questions.filter(q => q.type === 'MCQ').length}`);
  console.log(`   Open-ended: ${merged.questions.filter(q => q.type === 'Open-ended').length}`);
  
  return merged;
}

// ============================================================================
// Step 10: Database Population
// ============================================================================

/**
 * Populate database with parsed exam data
 * Creates or updates exam, questions, and answers
 * @param parsedExam - Validated parsed exam data
 * @param examUrl - URL/path to the uploaded PDF
 * @param imagePaths - Array of extracted image paths
 * @param ocrText - Extracted OCR text for verification context
 * @param existingExamId - Optional ID of existing exam to update instead of creating new one
 * @returns Exam ID (created or updated)
 */
export async function populateDatabase(
  parsedExam: ParsedExam,
  examUrl: string,
  imagePaths: string[] = [],
  ocrText: string = '',
  existingExamId?: number
): Promise<{ examId: number; questionCount: number; answerCount: number }> {
  console.log('💾 Populating database...');
  
  // Import prisma dynamically to avoid circular dependencies
  const { prisma } = await import('../lib/prisma');
  
  try {
    let exam;
    
    if (existingExamId) {
      // Update existing exam record
      exam = await prisma.exam.update({
        where: { id: existingExamId },
        data: {
          name: parsedExam.name,
          subject: parsedExam.subject,
          parsed: true,
        },
      });
      console.log(`  ✅ Updated existing exam record: ${exam.id}`);
      
      // Delete existing questions and answers for this exam (to avoid duplicates)
      await prisma.answer.deleteMany({
        where: { examId: existingExamId },
      });
      await prisma.question.deleteMany({
        where: { examId: existingExamId },
      });
      console.log(`  ✅ Cleared existing questions and answers`);
    } else {
      // Create new exam record
      exam = await prisma.exam.create({
        data: {
          url: examUrl,
          name: parsedExam.name,
          subject: parsedExam.subject,
        },
      });
      console.log(`  ✅ Created exam record: ${exam.id}`);
    }
    
    let questionCount = 0;
    let answerCount = 0;
    
    // Track created questions with answers for subpart context
    const createdQuestions: Array<{ 
      number: number; 
      part: string | null; 
      text: string; 
      answer: string;
    }> = [];
    
    // Create questions and answers
    for (const q of parsedExam.questions) {
      // Estimate page number based on question position
      // If we have N pages and M questions, estimate which page this question is on
      const totalQuestions = parsedExam.questions.length;
      const totalPages = imagePaths.length;
      
      // Estimate page for this question (1-indexed)
      let estimatedPage = 1;
      if (totalPages > 0 && totalQuestions > 0) {
        const pageIndex = Math.floor((questionCount / totalQuestions) * totalPages);
        estimatedPage = Math.min(pageIndex + 1, totalPages);
      }
      
      // Get the image for this specific page
      const questionImages: string[] = [];
      if (imagePaths.length > 0 && estimatedPage > 0 && estimatedPage <= imagePaths.length) {
        questionImages.push(imagePaths[estimatedPage - 1]);
      }
      
      const question = await prisma.question.create({
        data: {
          examId: exam.id,
          number: q.number,
          part: q.part,
          text: q.text,
          type: q.type,
          image: questionImages,
          pageNumber: estimatedPage,
          options: q.options,
        },
      });
      
      questionCount++;
      
      // Create answer - generate AI answer if original is empty/null
      let answerText = q.correctAnswer?.trim() || '';
      let isAiGenerated = false;
      let isVerified = false;
      let verificationNote = null;
      let aiSuggestedAnswer = null;
      
      if (!answerText) {
        console.log(`  🔍 Question ${q.number}${q.part || ''} has no answer, generating AI answer...`);
        try {
          answerText = await generateAIAnswer(q.text, q.type as 'MCQ' | 'Open-ended', q.options);
          isAiGenerated = true;
          isVerified = true; // AI-generated answers are considered verified by default
        } catch (error) {
          console.warn(`    ⚠️  Failed to generate AI answer for question ${q.number}${q.part || ''}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          answerText = ''; // Keep empty if AI generation fails
          isAiGenerated = false;
        }
      } else {
        // Only verify extracted answers (not AI-generated ones)
        console.log(`  🔍 Verifying answer for question ${q.number}${q.part || ''}...`);
        try {
          // Build context from previous subparts (for co-related questions like 14A, 14B, 14C)
          const previousSubparts = [];
          if (q.part) {
            // Find all previous subparts with the same number
            const sameNumberQuestions = createdQuestions.filter(
              cq => cq.number === q.number && cq.part && cq.part < q.part!
            );
            
            for (const prev of sameNumberQuestions) {
              previousSubparts.push({
                part: `${prev.number}${prev.part}`,
                question: prev.text,
                answer: prev.answer
              });
            }
            
            if (previousSubparts.length > 0) {
              console.log(`    📎 Including context from ${previousSubparts.length} previous subpart(s)`);
            }
          }
          
          const verification = await verifyAnswer(
            q.text,
            answerText,
            q.type,
            q.options,
            ocrText.substring(0, 1000), // Provide some context
            previousSubparts
          );
          
          isVerified = verification.isAccurate;
          verificationNote = verification.note;
          aiSuggestedAnswer = verification.suggestedAnswer;
        } catch (error) {
          console.warn(`    ⚠️  Failed to verify answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Continue with unverified answer
          isVerified = false;
        }
      }
      
      await prisma.answer.create({
        data: {
          examId: exam.id,
          questionId: question.id,
          textFromPdf: isAiGenerated ? null : answerText,
          textFromAi: isAiGenerated ? answerText : (aiSuggestedAnswer || answerText),
          isAiGenerated: isAiGenerated,
          isVerified: isVerified,
          verificationNote: verificationNote,
          aiSuggestedAnswer: aiSuggestedAnswer,
        },
      });
      
      answerCount++;
      
      // Track this question and answer for subpart context
      createdQuestions.push({
        number: q.number,
        part: q.part,
        text: q.text,
        answer: answerText
      });
    }
    
    console.log(`  ✅ Created ${questionCount} questions`);
    console.log(`  ✅ Created ${answerCount} answers`);
    
    return {
      examId: exam.id,
      questionCount,
      answerCount,
    };
    
  } catch (error) {
    console.error('❌ Database population failed:', error);
    throw new Error(`Failed to populate database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Step 11: Complete Parsing Pipeline
// ============================================================================

/**
 * Complete end-to-end exam PDF parsing pipeline
 * Orchestrates all steps from extraction to database population
 * @param buffer - PDF file buffer
 * @param filename - Original filename
 * @param examUrl - URL/path where PDF is accessible
 * @param provider - LLM provider to use ('openai', 'anthropic', or 'both')
 * @param maxRetries - Maximum retry attempts per chunk
 * @param existingExamId - Optional ID of existing exam to update instead of creating new one
 * @param onProgress - Optional callback for progress updates (percentage, message)
 * @returns Exam ID and metadata
 */
export async function parseExamPDF(
  buffer: Buffer,
  filename: string,
  examUrl: string,
  provider: 'openai' | 'anthropic' | 'both' = 'both',
  maxRetries: number = 3,
  existingExamId?: number,
  onProgress?: (progress: number, message: string) => void
): Promise<{
  examId: number;
  metadata: ExamMetadata;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(60));
  console.log(`📄 Starting exam parsing pipeline: ${filename}`);
  console.log('='.repeat(60));
  
  try {
    // Step 1-2: Extract and preprocess text
    console.log('\n[Step 1-2/11] [18%] Extracting and preprocessing text...');
    onProgress?.(18, 'Extracting text and images from PDF...');
    
    // Get exam ID first by creating a placeholder or using filename hash
    const tempExamId = Date.now(); // Temporary ID for image extraction
    
    const extracted = await extractAndPreprocess(buffer, filename, tempExamId);
    
    if (!extracted.text || extracted.text.trim().length < 50) {
      throw new Error('Insufficient text extracted from PDF');
    }
    
    console.log(`✅ Extracted ${extracted.characterCount} characters`);
    console.log(`✅ Method: ${extracted.method.toUpperCase()}`);
    console.log(`✅ Images: ${extracted.imagePaths.length}`);
    
    // Step 3: Chunk exam paper
    console.log('\n[Step 3/11] [27%] Chunking exam paper...');
    onProgress?.(27, `Processing exam with ${extracted.imagePaths.length} images...`);
    const chunks = chunkExamPaper(extracted.text, 6000);
    const validation = validateChunks(chunks);
    
    if (!validation.valid) {
      console.warn('⚠️  Chunk validation warnings:', validation.issues);
    }
    
    // Step 4-7: Parse with LLM
    console.log(`\n[Step 4-7/11] [36-72%] Parsing ${chunks.length} chunk(s) with ${provider.toUpperCase()}...`);
    onProgress?.(36, `Parsing ${chunks.length} section(s) with AI...`);
    const parsedChunks: ParsedExam[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkProgress = 36 + Math.floor((36 / chunks.length) * i);
      console.log(`\n  📦 Chunk ${i + 1}/${chunks.length} [${chunkProgress}%] (${chunks[i].estimatedQuestions} questions, ${chunks[i].tokenCount} tokens)`);
      onProgress?.(chunkProgress, `Processing section ${i + 1}/${chunks.length}...`);
      
      const parsed = await parseChunkWithRetry(
        chunks[i].content,
        i,
        chunks.length,
        provider,
        maxRetries
      );
      
      parsedChunks.push(parsed);
      
      // Rate limiting: wait 1 second between chunks to avoid hitting API limits
      if (i < chunks.length - 1) {
        console.log('  ⏳ Waiting 1s before next chunk...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n✅ Successfully parsed all ${parsedChunks.length} chunks`);
    
    // Step 9: Merge chunks
    console.log('\n[Step 9/11] [81%] Merging chunks...');
    onProgress?.(81, 'Merging parsed sections...');
    const mergedExam = mergeExamChunks(parsedChunks);
    
    // Validate merged exam
    const validatedExam = validateParsedExam(mergedExam);
    
    // Calculate metadata
    const metadata: ExamMetadata = {
      totalQuestions: validatedExam.questions.length,
      mcqCount: validatedExam.questions.filter(q => q.type === 'MCQ').length,
      openEndedCount: validatedExam.questions.filter(q => q.type === 'Open-ended').length,
    };
    
    // Step 10: Populate database
    console.log('\n[Step 10/11] [90%] Populating database...');
    onProgress?.(90, 'Saving to database...');
    const dbResult = await populateDatabase(validatedExam, examUrl, extracted.imagePaths, extracted.text, existingExamId);
    
    const processingTime = Date.now() - startTime;
    
    // Final summary
    console.log('\n[Step 11/11] [100%] Complete!');
    onProgress?.(100, 'Parsing complete!');
    console.log('\n' + '='.repeat(60));
    console.log('✅ PARSING COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Exam ID: ${dbResult.examId}`);
    console.log(`📊 Subject: ${validatedExam.subject}`);
    console.log(`📊 Name: ${validatedExam.name}`);
    console.log(`📊 Grade: ${validatedExam.estimatedGrade}`);
    console.log(`📊 Questions: ${metadata.totalQuestions} (${metadata.mcqCount} MCQ, ${metadata.openEndedCount} Open-ended)`);
    console.log(`📊 Processing Time: ${(processingTime / 1000).toFixed(2)}s`);
    console.log(`📊 Method: ${extracted.method.toUpperCase()}`);
    console.log(`📊 Provider: ${provider.toUpperCase()}`);
    console.log('='.repeat(60) + '\n');
    
    return {
      examId: dbResult.examId,
      metadata,
      processingTime,
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('\n' + '='.repeat(60));
    console.error('❌ PARSING FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`Processing Time: ${(processingTime / 1000).toFixed(2)}s`);
    console.error('='.repeat(60) + '\n');
    throw error;
  }
}
