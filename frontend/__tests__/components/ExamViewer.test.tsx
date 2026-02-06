import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExamViewer from '../../components/ExamViewer';

// Mock fetch
global.fetch = jest.fn();

const mockExamData = {
  id: 1,
  url: '/uploads/sample-exam.pdf',
  name: 'Sample Math Exam',
  subject: 'Mathematics',
  createdAt: '2026-02-06T00:00:00.000Z',
  questions: [
    {
      id: 1,
      number: 1,
      part: null,
      text: 'What is 2 + 2?',
      type: 'MCQ',
      image: null,
      options: ['2', '3', '4', '5'],
      answers: [{ id: 1, text: '4' }],
    },
    {
      id: 2,
      number: 2,
      part: null,
      text: 'Explain the Pythagorean theorem.',
      type: 'Open-ended',
      image: null,
      options: [],
      answers: [{ id: 2, text: 'a² + b² = c²' }],
    },
    {
      id: 3,
      number: 3,
      part: 'A',
      text: 'Calculate the area of a circle with radius 5.',
      type: 'Open-ended',
      image: null,
      options: [],
      answers: [{ id: 3, text: 'Area = πr² = 78.5 square units' }],
    },
    {
      id: 4,
      number: 3,
      part: 'B',
      text: 'What is the circumference?',
      type: 'Open-ended',
      image: null,
      options: [],
      answers: [{ id: 4, text: 'Circumference = 2πr = 31.4 units' }],
    },
    {
      id: 5,
      number: 4,
      part: null,
      text: 'Which is a prime number?',
      type: 'MCQ',
      image: null,
      options: ['4', '6', '7', '8'],
      answers: [{ id: 5, text: '7' }],
    },
  ],
};

describe('ExamViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(() => {}) // Never resolves
    );

    render(<ExamViewer examId={1} />);
    expect(screen.getByText('Loading exam...')).toBeInTheDocument();
  });

  it('should fetch and display exam data', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    expect(screen.getByText('Subject:')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByText('5 questions')).toBeInTheDocument();
  });

  it('should display questions in correct sequential order', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    // Query for question labels specifically (the circular badges)
    const questionBadges = document.querySelectorAll('.bg-blue-100.text-blue-700.rounded-full');
    expect(questionBadges).toHaveLength(5);
    expect(questionBadges[0]).toHaveTextContent('1');
    expect(questionBadges[1]).toHaveTextContent('2');
    expect(questionBadges[2]).toHaveTextContent('3A');
    expect(questionBadges[3]).toHaveTextContent('3B');
    expect(questionBadges[4]).toHaveTextContent('4');
  });

  it('should render MCQ questions with radio buttons', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Check MCQ options are rendered
    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons.length).toBeGreaterThan(0);

    // Check that radio buttons exist for the first question
    const firstQuestionRadios = document.querySelectorAll('input[name="question-1"]');
    expect(firstQuestionRadios).toHaveLength(4);
    
    // Verify the options exist
    expect(screen.getAllByText('2', { selector: 'span' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('3', { selector: 'span' }).length).toBeGreaterThan(0);
  });

  it('should render open-ended questions with textarea', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Explain the Pythagorean theorem.')).toBeInTheDocument();
    });

    // Check textarea is rendered for open-ended questions
    const textareas = screen.getAllByPlaceholderText('Type your answer here...');
    expect(textareas.length).toBeGreaterThan(0);
  });

  it('should handle MCQ answer selection', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Select an answer
    const radioButtons = screen.getAllByRole('radio');
    const correctAnswerRadio = radioButtons.find(
      (radio) => (radio as HTMLInputElement).value === '4'
    );

    if (correctAnswerRadio) {
      fireEvent.click(correctAnswerRadio);
      expect(correctAnswerRadio).toBeChecked();
    }

    // Check answer counter updates
    await waitFor(() => {
      expect(screen.getByText('Questions answered: 1 / 5')).toBeInTheDocument();
    });
  });

  it('should handle open-ended answer input', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Explain the Pythagorean theorem.')).toBeInTheDocument();
    });

    // Find the textarea for the open-ended question (id: 2)
    const textarea = screen.getByTestId('answer-input-2');
    
    fireEvent.change(textarea, {
      target: { value: 'a² + b² = c²' },
    });

    expect(textarea).toHaveValue('a² + b² = c²');

    // Check answer counter updates
    await waitFor(() => {
      expect(screen.getByText('Questions answered: 1 / 5')).toBeInTheDocument();
    });
  });

  it('should submit exam answers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Submit Exam');
    fireEvent.click(submitButton);

    // Check submitting state
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });

    // Check success state
    await waitFor(() => {
      expect(screen.getByText('Exam Submitted Successfully!')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should display error when exam fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Exam not found' }),
    });

    render(<ExamViewer examId={999} />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Exam not found')).toBeInTheDocument();
    });
  });

  it('should display error when network request fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should display question type badges', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    const mcqBadges = screen.getAllByText('MCQ');
    const openEndedBadges = screen.getAllByText('Open-ended');

    expect(mcqBadges.length).toBe(2); // Questions 1 and 4
    expect(openEndedBadges.length).toBe(3); // Questions 2, 3A, 3B
  });

  it('should handle exam with no questions', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockExamData,
        questions: [],
      }),
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    expect(screen.getByText('0 questions')).toBeInTheDocument();
    expect(screen.getByText('Questions answered: 0 / 0')).toBeInTheDocument();
  });

  it('should sort questions correctly when received in wrong order', async () => {
    const unsortedExamData = {
      ...mockExamData,
      questions: [
        mockExamData.questions[4], // Question 4
        mockExamData.questions[0], // Question 1
        mockExamData.questions[3], // Question 3B
        mockExamData.questions[2], // Question 3A
        mockExamData.questions[1], // Question 2
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => unsortedExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    // Query for question labels specifically (the circular badges)
    const questionBadges = document.querySelectorAll('.bg-blue-100.text-blue-700.rounded-full');
    expect(questionBadges[0]).toHaveTextContent('1');
    expect(questionBadges[1]).toHaveTextContent('2');
    expect(questionBadges[2]).toHaveTextContent('3A');
    expect(questionBadges[3]).toHaveTextContent('3B');
    expect(questionBadges[4]).toHaveTextContent('4');
  });

  it('should render question image when present', async () => {
    const examWithImage = {
      ...mockExamData,
      questions: [
        {
          ...mockExamData.questions[0],
          image: '/uploads/diagram.png',
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => examWithImage,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    const image = screen.getByAltText('Question 1 diagram');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/uploads/diagram.png');
  });

  it('should show Check Answer button for each question', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Sample Math Exam')).toBeInTheDocument();
    });

    // Check that all 5 questions have Check Answer buttons
    const checkButtons = screen.getAllByText('Check Answer');
    expect(checkButtons).toHaveLength(5);
    
    // All buttons should be disabled initially (no answer selected)
    checkButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('should enable Check Answer button after selecting MCQ answer', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Select an answer
    const radioButtons = screen.getAllByRole('radio');
    const option4 = radioButtons.find((radio) => (radio as HTMLInputElement).value === '4');
    
    if (option4) {
      fireEvent.click(option4);
    }

    // Check button should now be enabled
    const checkButton = screen.getByTestId('check-answer-1');
    expect(checkButton).not.toBeDisabled();
  });

  it('should highlight correct MCQ answer in green', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Select correct answer (4)
    const radioButtons = screen.getAllByRole('radio');
    const correctAnswer = radioButtons.find((radio) => (radio as HTMLInputElement).value === '4');
    
    if (correctAnswer) {
      fireEvent.click(correctAnswer);
    }

    // Click Check Answer
    const checkButton = screen.getByTestId('check-answer-1');
    fireEvent.click(checkButton);

    await waitFor(() => {
      // Check for green highlighting and checkmark
      expect(screen.getByText('✓ Correct')).toBeInTheDocument();
      
      // Verify the correct option has green styling
      const correctLabel = correctAnswer?.closest('label');
      expect(correctLabel).toHaveClass('bg-green-100', 'border-green-500');
    });
  });

  it('should highlight wrong MCQ answer in red and correct answer in green', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Select wrong answer (3)
    const radioButtons = screen.getAllByRole('radio');
    const wrongAnswer = radioButtons.find((radio) => (radio as HTMLInputElement).value === '3');
    
    if (wrongAnswer) {
      fireEvent.click(wrongAnswer);
    }

    // Click Check Answer
    const checkButton = screen.getByTestId('check-answer-1');
    fireEvent.click(checkButton);

    await waitFor(() => {
      // Check for red highlighting on wrong answer
      expect(screen.getByText('✗ Wrong')).toBeInTheDocument();
      
      // Check for green highlighting on correct answer
      expect(screen.getByText('✓ Correct')).toBeInTheDocument();
      
      // Verify the wrong option has red styling
      const wrongLabel = wrongAnswer?.closest('label');
      expect(wrongLabel).toHaveClass('bg-red-100', 'border-red-500');
    });
  });

  it('should display correct answer for open-ended questions', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Explain the Pythagorean theorem.')).toBeInTheDocument();
    });

    // Type an answer
    const textarea = screen.getByTestId('answer-input-2');
    fireEvent.change(textarea, {
      target: { value: 'My answer about triangles' },
    });

    // Click Check Answer
    const checkButton = screen.getByTestId('check-answer-2');
    fireEvent.click(checkButton);

    await waitFor(() => {
      // Should display correct answer
      expect(screen.getByText('Correct Answer:')).toBeInTheDocument();
      expect(screen.getByText('a² + b² = c²')).toBeInTheDocument();
    });
  });

  it('should disable inputs after checking answer', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Select an answer
    const radioButtons = screen.getAllByRole('radio');
    const option4 = radioButtons.find((radio) => (radio as HTMLInputElement).value === '4' && (radio as HTMLInputElement).name === 'question-1');
    
    if (option4) {
      fireEvent.click(option4);
    }

    // Click Check Answer
    const checkButton = screen.getByTestId('check-answer-1');
    fireEvent.click(checkButton);

    await waitFor(() => {
      // Only question 1 radio buttons should be disabled
      const question1Radios = document.querySelectorAll('input[name="question-1"]');
      question1Radios.forEach(radio => {
        expect(radio).toBeDisabled();
      });
      
      // Check Answer button should disappear
      expect(screen.queryByTestId('check-answer-1')).not.toBeInTheDocument();
    });
  });

  it('should disable textarea after checking open-ended answer', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamData,
    });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Explain the Pythagorean theorem.')).toBeInTheDocument();
    });

    // Type an answer
    const textarea = screen.getByTestId('answer-input-2');
    fireEvent.change(textarea, {
      target: { value: 'My answer' },
    });

    // Click Check Answer
    const checkButton = screen.getByTestId('check-answer-2');
    fireEvent.click(checkButton);

    await waitFor(() => {
      // Textarea should be disabled
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveClass('disabled:bg-gray-50');
      
      // Check Answer button should disappear
      expect(screen.queryByTestId('check-answer-2')).not.toBeInTheDocument();
    });
  });
});

