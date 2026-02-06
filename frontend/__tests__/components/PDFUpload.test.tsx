import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PDFUpload from '@/components/PDFUpload';

// Mock fetch
global.fetch = jest.fn();

describe('PDFUpload Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('renders the component', () => {
    render(<PDFUpload />);
    
    expect(screen.getByText('Upload PDF Files')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop PDF files here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument();
  });

  it('displays file size limit information', () => {
    render(<PDFUpload />);
    
    expect(screen.getByText(/PDF files only, max 10MB per file/i)).toBeInTheDocument();
  });

  it('shows browse button', () => {
    render(<PDFUpload />);
    
    const browseButton = screen.getByRole('button', { name: /browse files/i });
    expect(browseButton).toBeInTheDocument();
  });

  it('accepts file input', () => {
    render(<PDFUpload />);
    
    // Find the hidden file input - it's a sibling of the button's parent div
    const button = screen.getByRole('button', { name: /browse files/i });
    const fileInput = button.parentElement?.parentElement?.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', 'application/pdf');
    expect(fileInput).toHaveAttribute('multiple');
  });

  it('displays selected files', async () => {
    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    }
  });

  it('shows file count when files are selected', async () => {
    render(<PDFUpload />);
    
    const file1 = new File(['test1'], 'test1.pdf', { type: 'application/pdf' });
    const file2 = new File(['test2'], 'test2.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, [file1, file2]);
      
      await waitFor(() => {
        expect(screen.getByText(/Selected Files \(2\)/i)).toBeInTheDocument();
      });
    }
  });

  it('allows removing files', async () => {
    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /remove file/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
      });
    }
  });

  it('shows upload and cancel buttons when files are selected', async () => {
    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload 1 file/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    }
  });

  it('handles file upload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        exams: [{ id: 1, filename: 'test.pdf' }],
      }),
    });

    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      const uploadButton = await screen.findByRole('button', { name: /upload 1 file/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/upload',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    }
  });

  it('clears files on cancel', async () => {
    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
      });
    }
  });

  it('displays error when upload fails', async () => {
    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Upload failed' }),
    });

    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      const uploadButton = await screen.findByRole('button', { name: /upload 1 file/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Upload failed'));
      });
    }

    alertMock.mockRestore();
  });

  it('formats file sizes correctly', async () => {
    render(<PDFUpload />);
    
    // Create a 5MB file
    const largFile = new File(['x'.repeat(5 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, largFile);
      
      await waitFor(() => {
        expect(screen.getByText(/MB/)).toBeInTheDocument();
      });
    }
  });

  it('displays custom name input for each selected file', async () => {
    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      await waitFor(() => {
        const customNameInput = screen.getByPlaceholderText('Enter file name');
        expect(customNameInput).toBeInTheDocument();
        expect(customNameInput).toHaveValue('test.pdf');
      });
    }
  });

  it('allows updating custom file name', async () => {
    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      const customNameInput = await screen.findByPlaceholderText('Enter file name');
      await userEvent.clear(customNameInput);
      await userEvent.type(customNameInput, 'renamed-file.pdf');

      await waitFor(() => {
        expect(customNameInput).toHaveValue('renamed-file.pdf');
      });
    }
  });

  it('sends custom names with upload request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        exams: [{ id: 1, filename: 'custom-name.pdf' }],
      }),
    });

    render(<PDFUpload />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /browse files/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await userEvent.upload(fileInput, file);
      
      const customNameInput = await screen.findByPlaceholderText('Enter file name');
      await userEvent.clear(customNameInput);
      await userEvent.type(customNameInput, 'custom-name.pdf');

      const uploadButton = await screen.findByRole('button', { name: /upload 1 file/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/upload',
          expect.objectContaining({
            method: 'POST',
          })
        );
        
        const callArgs = (global.fetch as jest.Mock).mock.calls[0];
        const formData = callArgs[1].body as FormData;
        expect(formData.get('customNames')).toBe('custom-name.pdf');
      });
    }
  });
});
