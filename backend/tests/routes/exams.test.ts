import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    exam: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    question: {
      create: jest.fn(),
    },
    answer: {
      create: jest.fn(),
    },
  },
}));

describe('Exams Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/exams', () => {
    it('should return all exams', async () => {
      const mockExams = [
        {
          id: 1,
          url: '/uploads/test.pdf',
          subject: 'Math',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          questions: [],
          answers: [],
        },
      ];

      (prisma.exam.findMany as jest.Mock).mockResolvedValue(mockExams);

      const response = await request(app)
        .get('/api/exams')
        .expect(200);

      expect(response.body).toEqual(mockExams);
      expect(prisma.exam.findMany).toHaveBeenCalledWith({
        include: {
          questions: true,
          answers: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should handle errors', async () => {
      (prisma.exam.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/exams')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to fetch exams');
    });
  });

  describe('GET /api/exams/:id', () => {
    it('should return a single exam', async () => {
      const mockExam = {
        id: 1,
        url: '/uploads/test.pdf',
        subject: 'Math',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        questions: [],
        answers: [],
      };

      (prisma.exam.findUnique as jest.Mock).mockResolvedValue(mockExam);

      const response = await request(app)
        .get('/api/exams/1')
        .expect(200);

      expect(response.body).toEqual(mockExam);
    });

    it('should return 404 if exam not found', async () => {
      (prisma.exam.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/exams/999')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Exam not found');
    });
  });

  describe('POST /api/exams', () => {
    it('should create a new exam', async () => {
      const newExam = {
        url: '/uploads/test.pdf',
        subject: 'Science',
      };

      const mockCreatedExam = {
        id: 1,
        ...newExam,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (prisma.exam.create as jest.Mock).mockResolvedValue(mockCreatedExam);

      const response = await request(app)
        .post('/api/exams')
        .send(newExam)
        .expect(201);

      expect(response.body).toEqual(mockCreatedExam);
      expect(prisma.exam.create).toHaveBeenCalledWith({
        data: newExam,
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/exams')
        .send({ url: '/uploads/test.pdf' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/exams/:id', () => {
    it('should update an exam', async () => {
      const updateData = {
        url: '/uploads/updated.pdf',
        subject: 'Updated Subject',
      };

      const mockUpdatedExam = {
        id: 1,
        ...updateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (prisma.exam.update as jest.Mock).mockResolvedValue(mockUpdatedExam);

      const response = await request(app)
        .put('/api/exams/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(mockUpdatedExam);
    });
  });

  describe('DELETE /api/exams/:id', () => {
    it('should delete an exam', async () => {
      (prisma.exam.delete as jest.Mock).mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/exams/1')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Exam deleted successfully');
    });
  });

  describe('POST /api/exams/:id/questions', () => {
    it('should add a question to an exam', async () => {
      const questionData = {
        number: 1,
        text: 'What is 2+2?',
        type: 'MCQ',
        options: ['2', '3', '4', '5'],
      };

      const mockQuestion = {
        id: 1,
        examId: 1,
        ...questionData,
      };

      (prisma.question.create as jest.Mock).mockResolvedValue(mockQuestion);

      const response = await request(app)
        .post('/api/exams/1/questions')
        .send(questionData)
        .expect(201);

      expect(response.body).toEqual(mockQuestion);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/exams/1/questions')
        .send({ number: 1 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/exams/:examId/questions/:questionId/answers', () => {
    it('should add an answer', async () => {
      const answerData = { text: 'The answer is 4' };

      const mockAnswer = {
        id: 1,
        examId: 1,
        questionId: 1,
        ...answerData,
        createdAt: new Date().toISOString(),
      };

      (prisma.answer.create as jest.Mock).mockResolvedValue(mockAnswer);

      const response = await request(app)
        .post('/api/exams/1/questions/1/answers')
        .send(answerData)
        .expect(201);

      expect(response.body).toEqual(mockAnswer);
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/exams/1/questions/1/answers')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
