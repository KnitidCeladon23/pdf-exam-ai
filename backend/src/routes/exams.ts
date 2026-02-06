import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

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
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Answer text is required' });
    }

    const answer = await prisma.answer.create({
      data: {
        examId: parseInt(Array.isArray(examId) ? examId[0] : examId),
        questionId: parseInt(Array.isArray(questionId) ? questionId[0] : questionId),
        text,
      },
    });

    res.status(201).json(answer);
  } catch (error) {
    console.error('Error creating answer:', error);
    res.status(500).json({ error: 'Failed to create answer' });
  }
});

export default router;
