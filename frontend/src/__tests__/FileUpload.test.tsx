import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { validateFile } from '../utils/fileValidation';
import { useFileUpload } from '../hooks/useFileUpload';
import { DropZone } from '../components/DropZone';
import { FilePreview } from '../components/FilePreview';
import { FileList } from '../components/FileList';
import { FileUpload } from '../components/FileUpload';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('File Upload Feature Suite', () => {
  // Mock window URL helpers to prevent JSDOM errors
  beforeAll(() => {
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-image-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('File Validation Utility', () => {
    it('passes when file is within limit', () => {
      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const error = validateFile(file, { maxSizeInBytes: 1024 });
      expect(error).toBeNull();
    });

    it('rejects when file exceeds size limit', () => {
      const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
      const error = validateFile(file, { maxSizeInBytes: 5 });
      expect(error).toContain('exceeds the maximum limit');
    });

    it('validates allowed extensions correctly', () => {
      const file = new File(['data'], 'photo.png', { type: 'image/png' });
      const error = validateFile(file, { allowedExtensions: ['.jpg', '.jpeg'] });
      expect(error).toContain('Unsupported extension');
    });

    it('validates allowed mime types correctly', () => {
      const file = new File(['data'], 'document.pdf', { type: 'application/pdf' });
      const error = validateFile(file, { allowedMimeTypes: ['image/png'] });
      expect(error).toContain('Unsupported file type');
    });
  });

  describe('useFileUpload Hook', () => {
    it('adds files and generates blob previews for images', () => {
      const { result } = renderHook(() => useFileUpload());
      const imageFile = new File(['image'], 'test.png', { type: 'image/png' });

      act(() => {
        result.current.addFiles([imageFile]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].name).toBe('test.png');
      expect(result.current.files[0].previewUrl).toBe('blob:mock-image-url');
    });

    it('removes files and revokes preview URLs', () => {
      const { result } = renderHook(() => useFileUpload());
      const file = new File(['data'], 'test.png', { type: 'image/png' });

      act(() => {
        result.current.addFiles([file]);
      });

      const fileId = result.current.files[0].id;
      expect(result.current.files).toHaveLength(1);

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(result.current.files).toHaveLength(0);
      expect(window.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('reorders files correctly', () => {
      const { result } = renderHook(() => useFileUpload());
      const file1 = new File(['1'], 'first.txt', { type: 'text/plain' });
      const file2 = new File(['2'], 'second.txt', { type: 'text/plain' });

      act(() => {
        result.current.addFiles([file1, file2]);
      });

      expect(result.current.files[0].name).toBe('first.txt');
      expect(result.current.files[1].name).toBe('second.txt');

      act(() => {
        result.current.reorderFiles(0, 1);
      });

      expect(result.current.files[0].name).toBe('second.txt');
      expect(result.current.files[1].name).toBe('first.txt');
    });

    it('simulates chunked uploads correctly', async () => {
      jest.useFakeTimers();
      const { result } = renderHook(() =>
        useFileUpload({
          chunkSizeInBytes: 1, // small chunks so file is uploaded in multiple parts
          simulateNetworkLatency: true,
        })
      );
      const file = new File(['abc'], 'test.txt', { type: 'text/plain' }); // 3 bytes -> 3 chunks

      act(() => {
        result.current.addFiles([file]);
      });

      const taskId = result.current.files[0].id;

      // Start upload
      let uploadPromise: Promise<void>;
      act(() => {
        uploadPromise = result.current.uploadFile(taskId);
      });

      // Assert status changed to uploading
      expect(result.current.files[0].status).toBe('uploading');

      // Resolve chunks sequentially using Jest fake timers
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(result.current.files[0].progress).toBeGreaterThan(0);

      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      await act(async () => {
        await uploadPromise;
      });

      expect(result.current.files[0].status).toBe('completed');
      expect(result.current.files[0].progress).toBe(100);
      
      jest.useRealTimers();
    });
  });

  describe('UI Components rendering', () => {
    it('renders DropZone details', () => {
      renderWithTheme(<DropZone onFilesDropped={() => {}} maxSizeInBytes={1024 * 1024} />);
      expect(screen.getByText(/Drag & drop files here/i)).toBeInTheDocument();
      expect(screen.getByText(/Max file size: 1MB/i)).toBeInTheDocument();
    });

    it('renders FilePreview info and handle removals', () => {
      const mockRemove = jest.fn();
      const task = {
        id: '1',
        file: new File(['data'], 'test.txt', { type: 'text/plain' }),
        name: 'test.txt',
        size: 2048,
        type: 'text/plain',
        progress: 50,
        status: 'uploading' as const,
      };

      renderWithTheme(<FilePreview task={task} onRemove={mockRemove} />);
      expect(screen.getByText('test.txt')).toBeInTheDocument();
      expect(screen.getByText('2 KB')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();

      const removeBtn = screen.getByRole('button', { name: /remove item/i });
      fireEvent.click(removeBtn);
      expect(mockRemove).toHaveBeenCalledWith('1');
    });

    it('renders FileList reordering controls', () => {
      const mockReorder = jest.fn();
      const tasks = [
        {
          id: '1',
          file: new File(['data1'], 'test1.txt', { type: 'text/plain' }),
          name: 'test1.txt',
          size: 100,
          type: 'text/plain',
          progress: 0,
          status: 'idle' as const,
        },
        {
          id: '2',
          file: new File(['data2'], 'test2.txt', { type: 'text/plain' }),
          name: 'test2.txt',
          size: 100,
          type: 'text/plain',
          progress: 0,
          status: 'idle' as const,
        },
      ];

      renderWithTheme(
        <FileList
          tasks={tasks}
          onRemove={() => {}}
          onReorder={mockReorder}
        />
      );

      expect(screen.getByText('test1.txt')).toBeInTheDocument();
      expect(screen.getByText('test2.txt')).toBeInTheDocument();

      // Trigger move down on first item
      const moveDownButtons = screen.getAllByRole('button', { name: /move down/i });
      fireEvent.click(moveDownButtons[0]);
      expect(mockReorder).toHaveBeenCalledWith(0, 1);
    });

    it('integrates successfully in FileUpload component', () => {
      renderWithTheme(<FileUpload title="Project Document Upload" />);
      expect(screen.getByText('Project Document Upload')).toBeInTheDocument();
      expect(screen.getByText(/Drag & drop files here/i)).toBeInTheDocument();
    });
  });
});

