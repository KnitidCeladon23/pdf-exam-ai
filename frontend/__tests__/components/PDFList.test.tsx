import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PDFList from '@/components/PDFList';

describe('PDFList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders list of uploaded PDFs', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', name: 'Math Exam', subject: 'Math', createdAt: new Date().toISOString() },
    ];

    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExams,
    });

    render(<PDFList />);

    await waitFor(() => expect(screen.getByText(/Math Exam/i)).toBeInTheDocument());

    const openLink = screen.getByRole('link', { name: /open/i });
    expect(openLink).toHaveAttribute('href', '/api/uploads/test.pdf');
  });

  it('deletes an item when Delete is clicked', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', name: 'Math Exam', subject: 'Math', createdAt: new Date().toISOString() },
    ];

    // First fetch: list
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockExams })
      // Second fetch: delete
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Exam deleted successfully' }) });

    (global.fetch as unknown as jest.Mock) = fetchMock;

    // Mock confirm dialog to auto-accept
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<PDFList />);

    await waitFor(() => expect(screen.getByText(/Math Exam/i)).toBeInTheDocument());

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    userEvent.click(deleteButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledWith('/api/exams/1', expect.objectContaining({ method: 'DELETE' }));

    // Item should be removed
    await waitFor(() => expect(screen.queryByText(/Math Exam/i)).not.toBeInTheDocument());

    confirmSpy.mockRestore();
  });

  it('displays Edit button for each PDF', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', name: 'Math Exam', subject: 'Math', createdAt: new Date().toISOString() },
    ];

    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExams,
    });

    render(<PDFList />);

    await waitFor(() => expect(screen.getByText('Math Exam')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('shows edit input when Edit button is clicked', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', name: 'Math Exam', subject: 'Math', createdAt: new Date().toISOString() },
    ];

    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExams,
    });

    render(<PDFList />);

    await waitFor(() => expect(screen.getByText('Math Exam')).toBeInTheDocument());

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit filename:')).toBeInTheDocument();
      const input = screen.getByDisplayValue('Math Exam');
      expect(input).toBeInTheDocument();
    });
  });

  it('allows updating filename and saves changes', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', name: 'Math Exam', subject: 'Math', createdAt: new Date().toISOString() },
    ];

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockExams })
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ id: 1, url: '/uploads/test.pdf', name: 'Physics Exam', subject: 'Physics' }) 
      });

    (global.fetch as unknown as jest.Mock) = fetchMock;

    render(<PDFList />);

    await waitFor(() => expect(screen.getByText('Math Exam')).toBeInTheDocument());

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    const input = await screen.findByDisplayValue('Math Exam');
    await userEvent.clear(input);
    await userEvent.type(input, 'Physics Exam');

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/exams/1',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Physics Exam' }),
        })
      );
    });

    await waitFor(() => expect(screen.getByText('Physics Exam')).toBeInTheDocument());
  });

  it('cancels edit when Cancel button is clicked', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', name: 'Math Exam', subject: 'Math', createdAt: new Date().toISOString() },
    ];

    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExams,
    });

    render(<PDFList />);

    await waitFor(() => expect(screen.getByText('Math Exam')).toBeInTheDocument());

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => expect(screen.getByText('Edit filename:')).toBeInTheDocument());

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Edit filename:')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });
});
