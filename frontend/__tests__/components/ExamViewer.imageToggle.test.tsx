import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExamViewer from '../../components/ExamViewer';

// Mock fetch
global.fetch = jest.fn();

const mockExamWithImages = {
  id: 1,
  url: '/uploads/test-exam.pdf',
  name: 'Test Exam with Diagrams',
  subject: 'Physics',
  createdAt: '2026-02-06T00:00:00.000Z',
  parsed: true,
  questions: [
    {
      id: 1,
      number: 1,
      part: null,
      text: 'What is shown in the diagram?',
      type: 'MCQ',
      image: ['/uploads/images/exam-1/page-1.png', '/uploads/images/exam-1/page-2.png'],
      options: ['Circuit', 'Graph', 'Force Diagram', 'None'],
      answers: [{ id: 1, textFromPdf: 'Force Diagram', textFromAi: 'Force Diagram', isAiGenerated: false }],
    },
    {
      id: 2,
      number: 2,
      part: null,
      text: 'Analyze the graph shown.',
      type: 'Open-ended',
      image: ['/uploads/images/exam-1/page-3.png'],
      options: [],
      answers: [{ id: 2, textFromPdf: 'The graph shows linear relationship.', textFromAi: 'The graph shows linear relationship.', isAiGenerated: false }],
    },
  ],
};

describe('ExamViewer - Image Toggle Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockExamWithImages,
    });
  });

  it('should show toggle button when question has images', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is shown in the diagram?')).toBeInTheDocument();
    });

    // Should have toggle buttons for both questions with images
    const toggleButtons = screen.getAllByRole('button', { name: /Show Image/i });
    expect(toggleButtons).toHaveLength(2);
  });

  it('should toggle image visibility when button is clicked', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is shown in the diagram?')).toBeInTheDocument();
    });

    const toggleButton = screen.getAllByRole('button', { name: /Show Images \(2\)/i })[0];
    
    // Images should be hidden initially
    expect(screen.queryByAltText(/Question 1 diagram 1/i)).not.toBeInTheDocument();
    
    // Click to show images
    fireEvent.click(toggleButton);
    
    // Images should now be visible
    await waitFor(() => {
      expect(screen.getByAltText(/Question 1 diagram 1/i)).toBeInTheDocument();
      expect(screen.getByAltText(/Question 1 diagram 2/i)).toBeInTheDocument();
    });
    
    // Button text should change to "Hide"
    expect(screen.getByRole('button', { name: /Hide Images \(2\)/i })).toBeInTheDocument();
  });

  it('should show correct count for multiple images', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is shown in the diagram?')).toBeInTheDocument();
    });

    // First question has 2 images
    expect(screen.getByRole('button', { name: /Show Images \(2\)/i })).toBeInTheDocument();
    
    // Second question has 1 image
    expect(screen.getByRole('button', { name: /Show Image$/i })).toBeInTheDocument();
  });

  it('should independently toggle images for different questions', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is shown in the diagram?')).toBeInTheDocument();
    });

    const toggleButtons = screen.getAllByRole('button', { name: /Show/i });
    const firstQuestionToggle = toggleButtons[0];
    const secondQuestionToggle = toggleButtons[1];
    
    // Show images for first question
    fireEvent.click(firstQuestionToggle);
    
    await waitFor(() => {
      expect(screen.getByAltText(/Question 1 diagram 1/i)).toBeInTheDocument();
    });
    
    // Second question images should still be hidden
    expect(screen.queryByAltText(/Question 2 diagram/i)).not.toBeInTheDocument();
    
    // Show images for second question
    fireEvent.click(secondQuestionToggle);
    
    await waitFor(() => {
      expect(screen.getByAltText(/Question 2 diagram/i)).toBeInTheDocument();
    });
    
    // Both should be visible now
    expect(screen.getByAltText(/Question 1 diagram 1/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Question 2 diagram/i)).toBeInTheDocument();
  });

  it('should hide images when toggle button is clicked again', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is shown in the diagram?')).toBeInTheDocument();
    });

    const toggleButton = screen.getAllByRole('button', { name: /Show/i })[0];
    
    // Show images
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByAltText(/Question 1 diagram 1/i)).toBeInTheDocument();
    });
    
    // Hide images
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.queryByAltText(/Question 1 diagram 1/i)).not.toBeInTheDocument();
    });
  });

  it('should render all image paths correctly', async () => {
    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('What is shown in the diagram?')).toBeInTheDocument();
    });

    const toggleButton = screen.getAllByRole('button', { name: /Show Images \(2\)/i })[0];
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      const images = screen.getAllByAltText(/Question 1 diagram/i);
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute('src', '/uploads/images/exam-1/page-1.png');
      expect(images[1]).toHaveAttribute('src', '/uploads/images/exam-1/page-2.png');
    });
  });
});
