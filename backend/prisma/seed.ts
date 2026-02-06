import dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  // Create or get a sample exam
  let exam = await prisma.exam.findFirst({
    where: { name: 'Sample Math Exam' },
  });

  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        url: '/uploads/sample-math-exam.pdf',
        name: 'Sample Math Exam',
        subject: 'Mathematics',
      },
    });
    console.log('✅ Created sample exam:', exam.id);
  } else {
    console.log('📝 Using existing exam:', exam.id);
  }

  // Create 5 sample questions with answers
  const questionsData = [
    {
      number: 1,
      part: 'A',
      text: 'What is the derivative of f(x) = x² + 3x + 2?',
      type: 'MCQ',
      options: ['2x + 3', 'x + 3', '2x + 2', 'x² + 3'],
      answer: '2x + 3',
    },
    {
      number: 2,
      part: 'A',
      text: 'Solve for x: 2x + 5 = 15',
      type: 'Open-ended',
      options: [],
      answer: 'x = 5',
    },
    {
      number: 3,
      part: 'B',
      text: 'Calculate the area of a circle with radius 7 cm. (Use π ≈ 3.14)',
      type: 'Open-ended',
      options: [],
      answer: 'Area = πr² = 3.14 × 7² = 3.14 × 49 = 153.86 cm²',
    },
    {
      number: 4,
      part: 'B',
      text: 'Which of the following is a prime number?',
      type: 'MCQ',
      options: ['15', '21', '29', '35'],
      answer: '29',
    },
    {
      number: 5,
      part: 'C',
      text: 'If f(x) = 2x + 3 and g(x) = x², what is (f ∘ g)(2)?',
      type: 'MCQ',
      options: ['11', '14', '19', '7'],
      answer: '11 (because g(2) = 4, then f(4) = 2(4) + 3 = 11)',
    },
  ];

  for (const qData of questionsData) {
    // Check if question already exists
    const existingQuestion = await prisma.question.findFirst({
      where: {
        examId: exam.id,
        number: qData.number,
        part: qData.part,
      },
    });

    if (existingQuestion) {
      console.log(`⏭️  Question ${qData.number}${qData.part} already exists, skipping...`);
      continue;
    }

    // Create question
    const question = await prisma.question.create({
      data: {
        examId: exam.id,
        number: qData.number,
        part: qData.part,
        text: qData.text,
        type: qData.type,
        options: qData.options,
      },
    });

    // Create answer
    await prisma.answer.create({
      data: {
        examId: exam.id,
        questionId: question.id,
        text: qData.answer,
      },
    });

    console.log(`✅ Created question ${qData.number}${qData.part} with answer`);
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
