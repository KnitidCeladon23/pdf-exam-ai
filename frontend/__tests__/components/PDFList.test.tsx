import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PDFList from '@/components/PDFList';

describe('PDFList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders list of uploaded PDFs', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', subject: 'Math', createdAt: new Date().toISOString() },
    ];

    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExams,
    });

    render(<PDFList />);

    await waitFor(() => expect(screen.getByText('test.pdf')).toBeInTheDocument());

    const openLink = screen.getByRole('link', { name: /open/i });
    expect(openLink).toHaveAttribute('href', '/api/uploads/test.pdf');
  });

  it('deletes an item when Delete is clicked', async () => {
    const mockExams = [
      { id: 1, url: '/uploads/test.pdf', subject: 'Math', createdAt: new Date().toISOString() },
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

    await waitFor(() => expect(screen.getByText('test.pdf')).toBeInTheDocument());

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    userEvent.click(deleteButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledWith('/api/exams/1', expect.objectContaining({ method: 'DELETE' }));

    // Item should be removed
    await waitFor(() => expect(screen.queryByText('test.pdf')).not.toBeInTheDocument());

    confirmSpy.mockRestore();
  });
});
