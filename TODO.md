# ExamGPT

To-dos:
1. Design a schema to handle inputs:
    - Exam
        - id int
        - name string
        - url string
        - subject string
        - questions Question[]
        - answers Answer[]

    - Question
        - id int
        - number int
        - part string?
        - text string
        - type string ("MCQ", "Open-ended")
        - image string?
        - options string[]?

    - Answer
        - id int
        - question_id
        - text string

Assumptions:
- Exam papers are parsed sequentially from top to bottom.
- There are no horizontal subsections (page is not split in the middle).
- Types of questions include: MCQ and Open-ended.
- Questions are indexed by numbers, and may include sub-parts.

2. Design a simple interface for user to upload PDF. Allow the user to either browse through PC directory, or drag file into an area. Allow multiple uploads. Limit file type to only PDF and set a size limit for 10MB. List the names of the PDF that has been selected, include the option to remove any PDFs from the list. Have an upload button and cancel button. Show progress bar of upload.

3. Create a component to display all the exam questions in sequential order. The aim of this component is to simulate a digital exam interface with multiple choice questions or open-ended questions.

4. Implement Exam PDF Parser:
- PDF Upload (uploaded by client)
- Text/Image Extraction (pdf-parse for digital; OCR for scanned)
- PDF Preprocessing (Normalization)
- LLM Processing (GPT + Claude)
- Validation
- Database Population