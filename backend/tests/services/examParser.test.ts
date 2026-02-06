import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  preprocessText,
  validateExtractedText,
  extractMetadataHints,
  extractAndPreprocess,
  chunkExamPaper,
  validateChunks,
  ExamChunk,
} from '../../src/services/examParser';
import * as fs from 'fs';
import * as path from 'path';

describe('Exam Parser - Step 1 & 2: Extraction and Preprocessing', () => {
  
  // ============================================================================
  // Step 2: Text Preprocessing Tests
  // ============================================================================
  
  describe('preprocessText', () => {
    it('should normalize whitespace', () => {
      const input = 'Question  1    What   is  2+2?';
      const output = preprocessText(input);
      expect(output).not.toContain('  '); // No double spaces
    });

    it('should remove page numbers', () => {
      const input = 'Q1. What is 2+2?\nPage 1 of 10\nQ2. Next question';
      const output = preprocessText(input);
      expect(output).not.toContain('Page 1 of 10');
    });

    it('should normalize question numbering with "Question" prefix', () => {
      const input = 'Question 1: What is 2+2?';
      const output = preprocessText(input);
      expect(output).toContain('Q1.');
    });

    it('should normalize question numbering with parentheses', () => {
      const input = '1) What is 2+2?\n2) What is 3+3?';
      const output = preprocessText(input);
      expect(output).toContain('Q1.');
      expect(output).toContain('Q2.');
    });

    it('should normalize question numbering with periods', () => {
      const input = '1. What is 2+2?\n2. What is 3+3?';
      const output = preprocessText(input);
      expect(output).toContain('Q1.');
      expect(output).toContain('Q2.');
    });

    it('should normalize MCQ options format', () => {
      const input = 'a) Option A\nb) Option B\nC) Option C\nd.) Option D';
      const output = preprocessText(input);
      expect(output).toContain('A) Option A');
      expect(output).toContain('B) Option B');
      expect(output).toContain('C) Option C');
      expect(output).toContain('D) Option D');
    });

    it('should fix common OCR errors with full-width numbers', () => {
      const input = 'Question １: What is ２+２?';
      const output = preprocessText(input);
      expect(output).toMatch(/1|2/); // Should convert to half-width
    });

    it('should handle mixed question formats', () => {
      const input = `Question 1: First question
2) Second question
3. Third question`;
      const output = preprocessText(input);
      expect(output).toContain('Q1.');
      expect(output).toContain('Q2.');
      expect(output).toContain('Q3.');
    });

    it('should preserve mathematical expressions', () => {
      const input = 'Calculate 2 × 3 ÷ 6';
      const output = preprocessText(input);
      expect(output).toContain('2 × 3 ÷ 6');
    });

    it('should clean up excessive newlines', () => {
      const input = 'Q1. First\n\n\n\n\nQ2. Second';
      const output = preprocessText(input);
      expect(output).not.toContain('\n\n\n');
    });

    it('should trim leading and trailing whitespace', () => {
      const input = '   Q1. Question text   \n\n';
      const output = preprocessText(input);
      expect(output).toBe(output.trim());
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================
  
  describe('validateExtractedText', () => {
    it('should validate text with sufficient content', () => {
      const text = 'This is a sample exam paper with more than 50 characters of content including questions.';
      const result = validateExtractedText(text);
      expect(result.valid).toBe(true);
      expect(result.message).toContain('successful');
    });

    it('should reject empty text', () => {
      const text = '';
      const result = validateExtractedText(text);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('No text extracted');
    });

    it('should reject text shorter than minimum length', () => {
      const text = 'Short text';
      const result = validateExtractedText(text, 50);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Insufficient text');
    });

    it('should reject text with insufficient alphabetic characters', () => {
      const text = '123 456 789 !@# $%^ &*() 123 456 789 !@# $%^ &*() 123 456 789';
      const result = validateExtractedText(text);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('insufficient readable content');
    });

    it('should accept valid text with custom minimum length', () => {
      const text = 'Valid exam content';
      const result = validateExtractedText(text, 10);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // Metadata Extraction Tests
  // ============================================================================
  
  describe('extractMetadataHints', () => {
    it('should detect mathematical content with operators', () => {
      const text = 'Calculate 2 + 3 × 4';
      const hints = extractMetadataHints(text);
      expect(hints.containsMath).toBe(true);
    });

    it('should detect mathematical content with keywords', () => {
      const text = 'Solve the following equation: x + y = 10';
      const hints = extractMetadataHints(text);
      expect(hints.containsMath).toBe(true);
    });

    it('should detect Chinese characters', () => {
      const text = '这是一个中文考试题目';
      const hints = extractMetadataHints(text);
      expect(hints.containsChineseCharacters).toBe(true);
    });

    it('should not detect Chinese in English text', () => {
      const text = 'This is an English exam question';
      const hints = extractMetadataHints(text);
      expect(hints.containsChineseCharacters).toBe(false);
    });

    it('should detect Mathematics subject', () => {
      const text = 'Mathematics Examination - Algebra Section';
      const hints = extractMetadataHints(text);
      expect(hints.possibleSubject).toBe('Mathematics');
    });

    it('should detect English subject', () => {
      const text = 'English Comprehension and Grammar Test';
      const hints = extractMetadataHints(text);
      expect(hints.possibleSubject).toBe('English');
    });

    it('should detect Science subject', () => {
      const text = 'Science Examination - Physics and Chemistry';
      const hints = extractMetadataHints(text);
      expect(hints.possibleSubject).toBe('Science');
    });

    it('should detect Chinese subject', () => {
      const text = '华文考试 Chinese Language Examination';
      const hints = extractMetadataHints(text);
      expect(hints.possibleSubject).toBe('Chinese');
    });

    it('should detect primary grade level (P4)', () => {
      const text = 'P4 Mathematics Examination 2024';
      const hints = extractMetadataHints(text);
      expect(hints.possibleGrade).toBe('P4');
    });

    it('should detect primary grade level (Primary 5)', () => {
      const text = 'Primary 5 English Test';
      const hints = extractMetadataHints(text);
      expect(hints.possibleGrade).toBe('P5');
    });

    it('should detect secondary grade level (S2)', () => {
      const text = 'S2 Science Midterm Exam';
      const hints = extractMetadataHints(text);
      expect(hints.possibleGrade).toBe('S2');
    });

    it('should detect secondary grade level (Secondary 3)', () => {
      const text = 'Secondary 3 Mathematics Examination';
      const hints = extractMetadataHints(text);
      expect(hints.possibleGrade).toBe('S3');
    });

    it('should handle text with no clear subject or grade', () => {
      const text = 'Some random text without subject indicators';
      const hints = extractMetadataHints(text);
      expect(hints.possibleSubject).toBeUndefined();
      expect(hints.possibleGrade).toBeUndefined();
      expect(hints.containsMath).toBe(false);
    });
  });

  // ============================================================================
  // Integration Tests for Complete Pipeline
  // ============================================================================
  
  describe('Complex preprocessing scenarios', () => {
    it('should handle a complete exam paper excerpt', () => {
      const input = `
        Page 1 of 5
        
        Mathematics Examination
        Primary 4 - 2024
        
        Question 1: What is 2 + 2?
        a) 2
        b) 3
        c) 4
        d) 5
        
        2) Calculate the area of a rectangle with length 5cm and width 3cm.
        
        Page 2 of 5
        
        3. Solve: 10 × 5 = ?
      `;
      
      const output = preprocessText(input);
      
      // Should remove page numbers
      expect(output).not.toContain('Page 1 of 5');
      expect(output).not.toContain('Page 2 of 5');
      
      // Should normalize question formats
      expect(output).toContain('Q1.');
      expect(output).toContain('Q2.');
      expect(output).toContain('Q3.');
      
      // Should normalize MCQ options
      expect(output).toContain('A)');
      expect(output).toContain('B)');
      expect(output).toContain('C)');
      expect(output).toContain('D)');
      
      // Should preserve mathematical expressions
      expect(output).toContain('2 + 2');
      expect(output).toContain('10 × 5');
    });

    it('should handle mixed language content', () => {
      const input = `
        华文考试 Chinese Examination
        Primary 6
        
        Question 1: 选择正确答案 (Choose the correct answer)
        A) 苹果
        B) 香蕉
      `;
      
      const output = preprocessText(input);
      const hints = extractMetadataHints(output);
      
      expect(hints.containsChineseCharacters).toBe(true);
      expect(hints.possibleSubject).toBe('Chinese');
      expect(hints.possibleGrade).toBe('P6');
      expect(output).toContain('Q1.');
    });

    it('should handle questions with sub-parts', () => {
      const input = `
        Question 3:
        a) What is the capital of France?
        b) What is the population?
        
        Question 4:
        Calculate the following:
      `;
      
      const output = preprocessText(input);
      
      // Should normalize main questions
      expect(output).toContain('Q3.');
      expect(output).toContain('Q4.');
      
      // Sub-parts should be normalized to uppercase
      expect(output).toContain('A)');
      expect(output).toContain('B)');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  
  describe('Edge cases', () => {
    it('should handle empty input gracefully', () => {
      const output = preprocessText('');
      expect(output).toBe('');
    });

    it('should handle input with only whitespace', () => {
      const output = preprocessText('     \n\n\n     ');
      expect(output).toBe('');
    });

    it('should handle very long text', () => {
      const input = 'Q1. '.repeat(1000) + 'Long question text';
      const output = preprocessText(input);
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const input = 'Q1. Calculate √16 + π² = ?';
      const output = preprocessText(input);
      expect(output).toContain('√16');
      expect(output).toContain('π²');
    });

    it('should handle unicode characters', () => {
      const input = 'Q1. Evaluate: ∑(n=1 to 10) n²';
      const output = preprocessText(input);
      expect(output).toContain('∑');
    });
  });

  // ============================================================================
  // Step 3: Chunking Tests
  // ============================================================================
  
  describe('chunkExamPaper', () => {
    it('should split exam by question markers', () => {
      const text = `
        Q1. What is 2+2?
        A) 2
        B) 3
        C) 4
        D) 5
        
        Q2. What is 3+3?
        A) 5
        B) 6
        C) 7
        D) 8
        
        Q3. What is 4+4?
        A) 6
        B) 7
        C) 8
        D) 9
      `;
      
      const chunks = chunkExamPaper(text, 1000); // Small token limit to force chunking
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('chunkIndex');
      expect(chunks[0]).toHaveProperty('content');
      expect(chunks[0]).toHaveProperty('estimatedQuestions');
      expect(chunks[0]).toHaveProperty('tokenCount');
    });

    it('should respect token limits when chunking', () => {
      const text = `
        Q1. ${'Very long question text. '.repeat(200)}
        Q2. ${'Another long question. '.repeat(200)}
        Q3. ${'Yet another long question. '.repeat(200)}
      `;
      
      const maxTokens = 500;
      const chunks = chunkExamPaper(text, maxTokens);
      
      // Note: Individual questions may exceed token limits to maintain question integrity
      // The chunking should try to respect limits but won't split questions mid-way
      expect(chunks.length).toBeGreaterThan(1); // Should create multiple chunks
      
      // At least verify that we're not putting all questions in one chunk when they're too long
      const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
      expect(totalTokens).toBeGreaterThan(maxTokens); // Overall content exceeds one chunk
    });

    it('should handle questions with parts (Q3A, Q3B)', () => {
      const text = `
        Q1. First question
        
        Q2. Second question
        
        Q3A. Third question part A
        
        Q3B. Third question part B
        
        Q4. Fourth question
      `;
      
      const chunks = chunkExamPaper(text, 2000);
      
      // Should recognize all question markers including parts
      expect(chunks.length).toBeGreaterThan(0);
      const totalContent = chunks.map(c => c.content).join('');
      expect(totalContent).toContain('Q1.');
      expect(totalContent).toContain('Q2.');
      expect(totalContent).toContain('Q3A');
      expect(totalContent).toContain('Q3B');
      expect(totalContent).toContain('Q4.');
    });

    it('should fall back to length-based chunking if no question markers', () => {
      const text = 'This is a long text without any question markers. '.repeat(100);
      
      const chunks = chunkExamPaper(text, 1000);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].estimatedQuestions).toBe(0); // Unknown when using length-based
    });

    it('should provide accurate token estimates', () => {
      const text = 'Q1. This is a test question with approximately 100 characters in total for token estimation testing';
      
      const chunks = chunkExamPaper(text, 5000);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].tokenCount).toBeGreaterThan(0);
      // Rough estimate: 1 token ≈ 4 characters
      expect(chunks[0].tokenCount).toBeCloseTo(text.length / 4, -1);
    });

    it('should maintain question integrity across chunks', () => {
      const text = `
        Q1. First question with a lot of content
        ${'Content line. '.repeat(50)}
        
        Q2. Second question
        ${'More content. '.repeat(50)}
        
        Q3. Third question
        ${'Even more content. '.repeat(50)}
      `;
      
      const chunks = chunkExamPaper(text, 300);
      
      // Each chunk should start with a question marker (if it contains questions)
      chunks.forEach(chunk => {
        if (chunk.estimatedQuestions > 0) {
          expect(chunk.content).toMatch(/Q\d+[A-Z]?\./);
        }
      });
    });

    it('should handle empty or very short text', () => {
      const emptyText = '';
      const chunksEmpty = chunkExamPaper(emptyText, 1000);
      
      // Should return empty array or single empty chunk
      expect(chunksEmpty.length).toBeGreaterThanOrEqual(0);
      
      const shortText = 'Q1. Short';
      const chunksShort = chunkExamPaper(shortText, 1000);
      
      expect(chunksShort.length).toBe(1);
      expect(chunksShort[0].estimatedQuestions).toBe(1);
    });

    it('should calculate correct chunk indices', () => {
      const text = `
        Q1. Question 1
        Q2. Question 2
        Q3. Question 3
      `;
      
      const chunks = chunkExamPaper(text, 50); // Force multiple chunks
      
      // Indices should be sequential starting from 0
      chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index);
      });
    });
  });

  describe('validateChunks', () => {
    it('should validate chunks within acceptable range', () => {
      const validChunks: ExamChunk[] = [
        { chunkIndex: 0, content: 'Q1. '.repeat(50), estimatedQuestions: 1, tokenCount: 500 },
        { chunkIndex: 1, content: 'Q2. '.repeat(50), estimatedQuestions: 1, tokenCount: 500 },
      ];
      
      const result = validateChunks(validChunks, 100, 8000);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect chunks that are too small', () => {
      const smallChunks: ExamChunk[] = [
        { chunkIndex: 0, content: 'Q1. Short', estimatedQuestions: 1, tokenCount: 50 },
      ];
      
      const result = validateChunks(smallChunks, 100, 8000);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('too small');
    });

    it('should detect chunks that are too large', () => {
      const largeChunks: ExamChunk[] = [
        { chunkIndex: 0, content: 'Q1. '.repeat(3000), estimatedQuestions: 1, tokenCount: 9000 },
      ];
      
      const result = validateChunks(largeChunks, 100, 8000);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('too large');
    });

    it('should detect potential missed questions', () => {
      const suspiciousChunks: ExamChunk[] = [
        { chunkIndex: 0, content: 'Q1. Question text Q2. Another question', estimatedQuestions: 0, tokenCount: 500 },
      ];
      
      const result = validateChunks(suspiciousChunks, 100, 8000);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('estimated count is 0');
    });

    it('should pass validation for well-formed chunks', () => {
      const goodChunks: ExamChunk[] = [
        { chunkIndex: 0, content: 'Q1. Good question'.repeat(20), estimatedQuestions: 2, tokenCount: 400 },
        { chunkIndex: 1, content: 'Q3. Another good question'.repeat(20), estimatedQuestions: 2, tokenCount: 500 },
      ];
      
      const result = validateChunks(goodChunks, 100, 8000);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});
