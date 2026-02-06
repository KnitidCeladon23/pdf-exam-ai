# Test Fixtures

This directory contains sample PDF files for integration testing.

## Required Fixtures

To run integration tests, add these sample PDF files:

### 1. `sample-exam.pdf`
- Simple exam with 3-5 questions
- Mix of MCQ and open-ended questions
- Clear question numbering (Q1, Q2, Q3, etc.)
- Example content:
  ```
  Sample Exam - Primary 4 Mathematics
  
  Q1. What is 2 + 2?
  A) 3
  B) 4
  C) 5
  D) 6
  Answer: B
  
  Q2. Calculate 10 × 5
  Answer: 50
  ```

### 2. `mcq-exam.pdf` (Optional)
- Exam with primarily MCQ questions
- Multiple choice options (A, B, C, D)
- Clear answer indicators

### 3. `open-ended-exam.pdf` (Optional)
- Exam with open-ended questions
- Long-form answers
- Show-your-work type questions

### 4. `parts-exam.pdf` (Optional)
- Exam with questions that have parts (Q3A, Q3B, etc.)
- Example:
  ```
  Q3. Based on the passage:
  A) What is the main idea?
  B) Why did the character do X?
  ```

### 5. `malformed.pdf` (Optional)
- Corrupted or invalid PDF for error handling tests

## Creating Sample PDFs

You can create sample PDFs using:
1. Microsoft Word or Google Docs (Save as PDF)
2. Online PDF generators
3. Print to PDF from any document

## Note

Integration tests are skipped by default if fixtures are not present. Add the PDFs above to enable all integration tests.

## Running Integration Tests

```bash
# Run all tests including integration
npm test

# Run only integration tests
npm test -- tests/integration

# Run specific integration test
npm test -- tests/integration/upload.integration.test.ts
```
