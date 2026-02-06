import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExamViewer from '../../components/ExamViewer';

// Mock fetch
global.fetch = jest.fn();

const mockExamWithVerification = {
  id: 1,
  url: '/uploads/test-exam.pdf',
  name: 'Test Exam with Verification',
  subject: 'Mathematics',
  createdAt: '2026-02-06T00:00:00.000Z',
  parsed: true,
  questions: [
    {
      id: 1,
      number: 1,
      part: null,
      text: 'What is 2 + 2?',
      type: 'MCQ',
      image: [],
      options: ['2', '3', '4', '5'],
      answers: [{
        id: 1,
        textFromPdf: '4',
        textFromAi: '4',
        isAiGenerated: false,
        isVerified: true,
        verificationNote: null,
        aiSuggestedAnswer: null,
      }],
    },
    {
      id: 2,
      number: 2,
      part: null,
      text: 'What is the square root of 16?',
      type: 'MCQ',
      image: [],
      options: ['2', '3', '4', '8'],
      answers: [{
        id: 2,
        textFromPdf: '3',
        textFromAi: '4',
        isAiGenerated: false,
        isVerified: false,
        verificationNote: 'Answer may be incorrect due to low quality scan',
        aiSuggestedAnswer: '**4** is the correct answer. √16 = 4 because 4 × 4 = 16.',
      }],
    },
    {
      id: 3,
      number: 3,
      part: null,
      text: 'Explain calculus.',
      type: 'Open-ended',
      image: [],
      options: [],
      answers: [{
        id: 3,
        textFromPdf: 'Calculus is about integration.',
        textFromAi: 'Calculus is a branch of mathematics that studies continuous change.',
        isAiGenerated: false,
        isVerified: false,
        verificationNote: 'Answer is incomplete',
        aiSuggestedAnswer: '**Calculus** is a branch of mathematics that studies <u>continuous change</u>. It has two main branches: <u>differential calculus</u> (rates of change and slopes) and <u>integral calculus</u> (accumulation of quantities and areas under curves).',
      }],
    },
    {
      id: 4,
      number: 4,
      part: null,
      text: 'What is 5 × 6?',
      type: 'Open-ended',
      image: [],
      options: [],
      answers: [{
        id: 4,
        textFromPdf: null,
        textFromAi: '30',
        isAiGenerated: true,
        isVerified: true,
        verificationNote: null,
        aiSuggestedAnswer: null,
      }],
    },
  ],
};

describe('ExamViewer - Answer Verification Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamWithVerification,
    });
  });

  it('should show verified answer without warning', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Answer question
    const option = screen.getByLabelText('4');
    fireEvent.click(option);

    // Check answer
    const checkButton = screen.getAllByRole('button', { name: /Check Answer/i })[0];
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText(/✓ Correct/i)).toBeInTheDocument();
    });

    // Should not show warning badge for verified answer
    const correctAnswer = screen.getByText(/✓ Correct/i).closest('div');
    expect(correctAnswer).not.toHaveTextContent('⚠️ Uncertain');
  });

  it('should show warning badge for unverified MCQ answer', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is the square root of 16?')).toBeInTheDocument();
    });

    // Answer question
    const option = screen.getByLabelText('3');
    fireEvent.click(option);

    // Check answer
    const checkButtons = screen.getAllByRole('button', { name: /Check Answer/i });
    fireEvent.click(checkButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/✓ Correct/i)).toBeInTheDocument();
    });

    // Should show warning badge
    expect(screen.getByText('⚠️ Uncertain')).toBeInTheDocument();
  });

  it('should show verification note and AI-suggested answer for open-ended questions', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Explain calculus.')).toBeInTheDocument();
    });

    // Type answer
    const textarea = screen.getAllByPlaceholderText(/Type your answer here/i)[0];
    fireEvent.change(textarea, { target: { value: 'My answer' } });

    // Check answer
    const checkButtons = screen.getAllByRole('button', { name: /Check Answer/i });
    fireEvent.click(checkButtons[2]);

    await waitFor(() => {
      // Should show verification warning
      expect(screen.getByText(/⚠️ Warning: Answer is incomplete/i)).toBeInTheDocument();
    });

    // Should show AI-suggested alternative answer
    expect(screen.getByText('AI-Suggested Alternative:')).toBeInTheDocument();
    expect(screen.getByText('🤖 AI Verified')).toBeInTheDocument();

    // Should show the formatted AI answer (check for bold/underline)
    const aiAnswerSection = screen.getByText('AI-Suggested Alternative:').closest('div');
    expect(aiAnswerSection).toBeInTheDocument();
  });

  it('should format AI-suggested answers with bold and underline', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Explain calculus.')).toBeInTheDocument();
    });

    // Type answer
    const textarea = screen.getAllByPlaceholderText(/Type your answer here/i)[0];
    fireEvent.change(textarea, { target: { value: 'My answer' } });

    // Check answer
    const checkButtons = screen.getAllByRole('button', { name: /Check Answer/i });
    fireEvent.click(checkButtons[2]);

    await waitFor(() => {
      expect(screen.getByText('AI-Suggested Alternative:')).toBeInTheDocument();
    });

    // The answer should be rendered with HTML formatting
    const aiAnswer = screen.getByText('AI-Suggested Alternative:').closest('div')?.querySelector('.text-purple-800');
    expect(aiAnswer).toBeInTheDocument();
    expect(aiAnswer?.innerHTML).toContain('<strong>');
    expect(aiAnswer?.innerHTML).toContain('<u>');
  });

  it('should not show AI-suggested answer if answer is verified', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Answer question
    const option = screen.getByLabelText('4');
    fireEvent.click(option);

    // Check answer
    const checkButton = screen.getAllByRole('button', { name: /Check Answer/i })[0];
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText(/✓ Correct/i)).toBeInTheDocument();
    });

    // Should not show AI-suggested alternative
    expect(screen.queryByText('AI-Suggested Alternative:')).not.toBeInTheDocument();
  });

  it('should show AI badge for AI-generated answers', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 5 × 6?')).toBeInTheDocument();
    });

    // Type answer
    const textareas = screen.getAllByPlaceholderText(/Type your answer here/i);
    const lastTextarea = textareas[textareas.length - 1];
    fireEvent.change(lastTextarea, { target: { value: 'My answer' } });

    // Check answer
    const checkButtons = screen.getAllByRole('button', { name: /Check Answer/i });
    const lastCheckButton = checkButtons[checkButtons.length - 1];
    fireEvent.click(lastCheckButton);

    await waitFor(() => {
      expect(screen.getByText('🤖 AI Suggested')).toBeInTheDocument();
    });

    // Should show AI generation note
    expect(screen.getByText(/This answer was generated by AI/i)).toBeInTheDocument();
  });
});
