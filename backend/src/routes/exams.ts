import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { parseExamPDF } from '../services/examParser';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const router = Router();

// Track currently parsing exams to prevent concurrent parsing
// Key: examId, Value: EventEmitter for broadcasting progress
const currentlyParsing = new Map<number, EventEmitter>();

// Get all exams
router.get('/', async (req: Request, res: Response) => {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        questions: true,
        answers: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// Get single exam by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(Array.isArray(id) ? id[0] : id) },
      include: {
        questions: {
          include: {
            answers: true,
          },
        },
        answers: true,
      },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    res.json(exam);
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
});

// Parse exam PDF and populate questions/answers
router.post('/:id/parse', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const examId = parseInt(Array.isArray(id) ? id[0] : id);
    
    // Get exam record
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Check if already parsed
    if (exam.parsed) {
      return res.status(400).json({ 
        error: 'Exam already parsed',
        message: 'This exam has already been parsed. Use GET /:id to retrieve it.'
      });
    }

    // Read PDF file
    const uploadsDir = path.join(__dirname, '../../uploads');
    const filename = path.basename(exam.url);
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    const pdfBuffer = fs.readFileSync(filePath);
    
    // Get provider from query params
    // 'both' = use both OpenAI and Claude for maximum accuracy (default)
    const provider = (req.query.provider as 'openai' | 'anthropic' | 'both') || 'both';
    
    // Parse PDF and populate database (pass examId to update existing exam)
    console.log(`\n📄 Parsing exam ${examId}: ${exam.name} (provider: ${provider})`);
    const result = await parseExamPDF(pdfBuffer, exam.name, exam.url, provider, 3, examId);
    
    // Note: No need to update parsed flag here - populateDatabase handles it
    
    res.json({
      success: true,
      message: 'Exam parsed successfully',
      examId: result.examId,
      metadata: result.metadata,
      processingTime: result.processingTime,
    });
  } catch (error) {
    console.error('Error parsing exam:', error);
    res.status(500).json({ 
      error: 'Failed to parse exam',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Parse exam PDF with Server-Sent Events for progress updates
// Supports multiple concurrent clients watching the same parsing session
router.get('/:id/parse/stream', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const examId = parseInt(Array.isArray(id) ? id[0] : id);
    
    // Get exam record
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Check if already parsed
    if (exam.parsed) {
      return res.status(400).json({ 
        error: 'Exam already parsed',
        message: 'This exam has already been parsed. Use GET /:id to retrieve it.'
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
    
    // Check if this exam is already being parsed by another user
    let progressEmitter = currentlyParsing.get(examId);
    
    if (progressEmitter) {
      // Another user is already parsing this exam - join their session
      console.log(`👥 User joining existing parsing session for exam ${examId}`);
      
      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'start', message: 'Joining existing parsing session...' })}\n\n`);
      
      // Listen to progress events from the existing parsing session
      const onProgress = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      
      const onComplete = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end();
        cleanup();
      };
      
      const onError = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end();
        cleanup();
      };
      
      const cleanup = () => {
        progressEmitter?.removeListener('progress', onProgress);
        progressEmitter?.removeListener('complete', onComplete);
        progressEmitter?.removeListener('error', onError);
      };
      
      progressEmitter.on('progress', onProgress);
      progressEmitter.on('complete', onComplete);
      progressEmitter.on('error', onError);
      
      // Clean up when client disconnects
      req.on('close', cleanup);
      
      return; // Don't start a new parsing process
    }
    
    // No one is parsing this exam yet - start a new parsing session
    console.log(`\n📄 Starting new parsing session for exam ${examId}: ${exam.name}`);
    
    // Create EventEmitter for this parsing session
    progressEmitter = new EventEmitter();
    currentlyParsing.set(examId, progressEmitter);
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'start', message: 'Starting parse...' })}\n\n`);
    
    // Listen to progress events
    const onProgress = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    const onComplete = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      res.end();
      cleanup();
    };
    
    const onError = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      res.end();
      cleanup();
    };
    
    const cleanup = () => {
      progressEmitter?.removeListener('progress', onProgress);
      progressEmitter?.removeListener('complete', onComplete);
      progressEmitter?.removeListener('error', onError);
    };
    
    progressEmitter.on('progress', onProgress);
    progressEmitter.on('complete', onComplete);
    progressEmitter.on('error', onError);
    
    // Clean up when client disconnects
    req.on('close', cleanup);
    
    // Read PDF file
    const uploadsDir = path.join(__dirname, '../../uploads');
    const filename = path.basename(exam.url);
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      const errorData = { type: 'error', message: 'PDF file not found' };
      progressEmitter.emit('error', errorData);
      currentlyParsing.delete(examId);
      return;
    }

    const pdfBuffer = fs.readFileSync(filePath);
    
    // Get provider from query params
    const provider = (req.query.provider as 'openai' | 'anthropic' | 'both') || 'both';
    
    // Parse PDF with progress callback that broadcasts to all listeners
    console.log(`📄 Parsing exam ${examId}: ${exam.name} (provider: ${provider}) with SSE`);
    
    try {
      const result = await parseExamPDF(
        pdfBuffer, 
        exam.name, 
        exam.url, 
        provider, 
        3, 
        examId,
        (progress: number, message: string) => {
          // Broadcast progress update to all connected clients
          const progressData = { type: 'progress', progress, message };
          progressEmitter?.emit('progress', progressData);
        }
      );
      
      // Broadcast completion message to all connected clients
      const completeData = {
        type: 'complete', 
        examId: result.examId,
        metadata: result.metadata,
        processingTime: result.processingTime
      };
      progressEmitter.emit('complete', completeData);
      
      // Remove from currently parsing map
      currentlyParsing.delete(examId);
      console.log(`✅ Parsing session completed for exam ${examId}`);
      
    } catch (parseError) {
      // Broadcast error message to all connected clients
      const errorData = {
        type: 'error', 
        message: parseError instanceof Error ? parseError.message : 'Parse failed'
      };
      progressEmitter.emit('error', errorData);
      
      // Remove from currently parsing map
      currentlyParsing.delete(examId);
      console.error(`❌ Parsing session failed for exam ${examId}:`, parseError);
    }
    
  } catch (error) {
    console.error('Error in SSE parsing endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to initiate parse',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new exam
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url, name, subject } = req.body;

    if (!url || !name) {
      return res.status(400).json({ error: 'URL and name are required' });
    }

    const exam = await prisma.exam.create({
      data: { url, name, subject: subject || 'Unknown' },
    });

    res.status(201).json(exam);
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// Update exam
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { url, name, subject } = req.body;

    // Build update data object, only including fields that are provided
    const updateData: any = {};
    if (url !== undefined) updateData.url = url;
    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;

    const exam = await prisma.exam.update({
      where: { id: parseInt(Array.isArray(id) ? id[0] : id) },
      data: updateData,
    });

    res.json(exam);
  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

// Delete exam
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawId = Array.isArray(id) ? id[0] : id;
    const parsedId = parseInt(rawId, 10);

    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    try {
      await prisma.exam.delete({ where: { id: parsedId } });
      return res.json({ message: 'Exam deleted successfully' });
    } catch (err: any) {
      // Prisma throws P2025 when record not found
      if (err?.code === 'P2025') {
        return res.status(404).json({ error: 'Exam not found' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error deleting exam:', error);
    res.status(500).json({ error: 'Failed to delete exam', message: error instanceof Error ? error.message : String(error) });
  }
});

// Add question to exam
router.post('/:id/questions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { number, part, text, type, image, options } = req.body;

    if (!text || !type) {
      return res.status(400).json({ error: 'Text and type are required' });
    }

    const question = await prisma.question.create({
      data: {
        examId: parseInt(Array.isArray(id) ? id[0] : id),
        number,
        part,
        text,
        type,
        image,
        options: options || [],
      },
    });

    res.status(201).json(question);
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Add answer to exam
router.post('/:examId/questions/:questionId/answers', async (req: Request, res: Response) => {
  try {
    const { examId, questionId } = req.params;
    const { textFromPdf, textFromAi } = req.body;

    if (!textFromAi) {
      return res.status(400).json({ error: 'Answer textFromAi is required' });
    }

    const answer = await prisma.answer.create({
      data: {
        examId: parseInt(Array.isArray(examId) ? examId[0] : examId),
        questionId: parseInt(Array.isArray(questionId) ? questionId[0] : questionId),
        textFromPdf: textFromPdf || null,
        textFromAi,
      },
    });

    res.status(201).json(answer);
  } catch (error) {
    console.error('Error creating answer:', error);
    res.status(500).json({ error: 'Failed to create answer' });
  }
});

export default router;
