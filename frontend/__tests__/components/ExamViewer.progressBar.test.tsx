import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExamViewer from '../../components/ExamViewer';

// Mock fetch and EventSource
global.fetch = jest.fn();

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;
  
  constructor(url: string) {
    this.url = url;
    // Simulate progress updates after a short delay
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: JSON.stringify({ type: 'start', message: 'Starting parse...' })
        }));
        
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: JSON.stringify({ type: 'progress', progress: 18, message: 'Extracting text and images from PDF...' })
            }));
          }
        }, 100);
        
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: JSON.stringify({ type: 'progress', progress: 50, message: 'Processing section 1/2...' })
            }));
          }
        }, 200);
        
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: JSON.stringify({ type: 'progress', progress: 90, message: 'Saving to database...' })
            }));
          }
        }, 300);
        
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: JSON.stringify({ 
                type: 'complete', 
                examId: 1,
                metadata: { totalQuestions: 5, mcqCount: 3, openEndedCount: 2 },
                processingTime: 1000
              })
            }));
          }
        }, 400);
      }
    }, 50);
  }
  
  close() {}
}

(global as any).EventSource = MockEventSource;

const mockUnparsedExam = {
  id: 1,
  url: '/uploads/test-exam.pdf',
  name: 'Test Exam',
  subject: 'Mathematics',
  createdAt: '2026-02-06T00:00:00.000Z',
  parsed: false,
  questions: [],
};

const mockParsedExam = {
  id: 1,
  url: '/uploads/test-exam.pdf',
  name: 'Test Exam',
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
      pageNumber: 1,
      options: ['2', '3', '4', '5'],
      answers: [{ id: 1, textFromPdf: '4', textFromAi: '4', isAiGenerated: false }],
    },
  ],
};

describe('ExamViewer - Progress Bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display progress bar during parsing', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUnparsedExam,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockParsedExam,
      });

    render(<ExamViewer examId={1} />);

    // Wait for unparsed exam to load
    await waitFor(() => {
      expect(screen.getByText('📄 Exam Not Yet Parsed')).toBeInTheDocument();
    });

    // Click parse button
    const parseButton = screen.getByRole('button', { name: /Parse Exam Now/i });
    parseButton.click();

    // Check for progress bar
    await waitFor(() => {
      expect(screen.getByText(/Starting/i)).toBeInTheDocument();
    });

    // Check for progress updates
    await waitFor(() => {
      expect(screen.getByText(/Extracting text and images/i)).toBeInTheDocument();
    }, { timeout: 200 });

    await waitFor(() => {
      expect(screen.getByText(/Processing section/i)).toBeInTheDocument();
    }, { timeout: 300 });

    await waitFor(() => {
      expect(screen.getByText(/Saving to database/i)).toBeInTheDocument();
    }, { timeout: 400 });

    // Wait for parsing to complete
    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should show percentage in progress bar', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUnparsedExam,
      });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('📄 Exam Not Yet Parsed')).toBeInTheDocument();
    });

    const parseButton = screen.getByRole('button', { name: /Parse Exam Now/i });
    parseButton.click();

    // Wait for percentage displays
    await waitFor(() => {
      expect(screen.getByText(/18%/)).toBeInTheDocument();
    }, { timeout: 200 });

    await waitFor(() => {
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    }, { timeout: 300 });

    await waitFor(() => {
      expect(screen.getByText(/90%/)).toBeInTheDocument();
    }, { timeout: 400 });
  });

  it('should update progress bar width', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUnparsedExam,
      });

    const { container } = render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('📄 Exam Not Yet Parsed')).toBeInTheDocument();
    });

    const parseButton = screen.getByRole('button', { name: /Parse Exam Now/i });
    parseButton.click();

    // Wait for progress bar to appear
    await waitFor(() => {
      const progressBars = container.querySelectorAll('.bg-blue-600');
      expect(progressBars.length).toBeGreaterThan(0);
    }, { timeout: 200 });

    // Check that progress bar width updates
    await waitFor(() => {
      const progressBar = container.querySelector('.bg-blue-600') as HTMLElement;
      expect(progressBar).toBeTruthy();
      const width = progressBar?.style.width;
      expect(width).toBeTruthy();
      // Should have some width percentage
      expect(width).toMatch(/%$/);
    }, { timeout: 300 });
  });

  it('should hide progress bar after completion', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUnparsedExam,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockParsedExam,
      });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('📄 Exam Not Yet Parsed')).toBeInTheDocument();
    });

    const parseButton = screen.getByRole('button', { name: /Parse Exam Now/i });
    parseButton.click();

    // Wait for parsing to start
    await waitFor(() => {
      expect(screen.getByText(/Starting/i)).toBeInTheDocument();
    });

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Progress bar should be gone
    expect(screen.queryByText(/Saving to database/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/90%/)).not.toBeInTheDocument();
  });

  it('should handle parsing errors gracefully', async () => {
    // Mock EventSource that triggers error
    class ErrorEventSource extends MockEventSource {
      constructor(url: string) {
        super(url);
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: JSON.stringify({ type: 'error', message: 'Failed to parse PDF' })
            }));
          }
        }, 100);
      }
    }
    
    (global as any).EventSource = ErrorEventSource;

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUnparsedExam,
      });

    render(<ExamViewer examId={1} />);

    await waitFor(() => {
      expect(screen.getByText('📄 Exam Not Yet Parsed')).toBeInTheDocument();
    });

    const parseButton = screen.getByRole('button', { name: /Parse Exam Now/i });
    parseButton.click();

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to parse PDF/i)).toBeInTheDocument();
    }, { timeout: 300 });

    // Parse button should be enabled again
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Parse Exam Now/i });
      expect(button).not.toBeDisabled();
    });
  });
});
