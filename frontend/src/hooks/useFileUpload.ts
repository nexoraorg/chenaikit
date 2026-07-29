import { useState, useCallback, useRef } from 'react';
import { validateFile, FileValidationConfig } from '../utils/fileValidation';

export interface UploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'idle' | 'validating' | 'uploading' | 'completed' | 'failed';
  error?: string;
  previewUrl?: string;
  abortController?: AbortController;
}

export interface UseFileUploadOptions extends FileValidationConfig {
  uploadUrl?: string;
  chunkSizeInBytes?: number; // e.g., 1MB = 1024 * 1024
  simulateNetworkLatency?: boolean;
}

/**
 * Custom hook to manage the state and actions of a file upload component.
 * 
 * Time Complexities:
 * - Adding files: O(N) where N is the number of files dropped.
 * - Reordering: O(M) where M is the number of items in the list.
 * - Removing: O(1) direct lookup and deletion.
 * - Chunking: O(C) where C is the number of chunks (C = Size / ChunkSize).
 * 
 * Space Complexities:
 * - State storage: O(M) where M is the current number of files.
 * - Previews: O(P) memory allocated for browser blob URLs (carefully cleaned up on removal).
 */
export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const {
    maxSizeInBytes = 50 * 1024 * 1024, // Default 50MB
    allowedMimeTypes,
    allowedExtensions,
    uploadUrl,
    chunkSizeInBytes = 1024 * 1024, // Default 1MB chunks
    simulateNetworkLatency = true,
  } = options;

  const [files, setFiles] = useState<UploadTask[]>([]);
  const uploadPromisesRef = useRef<{ [key: string]: boolean }>({});

  // Cleanup helper to revoke object URLs and avoid memory leaks
  const revokeFilePreview = (file: UploadTask) => {
    if (file.previewUrl && file.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(file.previewUrl);
    }
  };

  // Add files to the state
  const addFiles = useCallback((newFiles: File[]) => {
    const newTasks: UploadTask[] = newFiles.map((file) => {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Perform validation
      const errorMsg = validateFile(file, {
        maxSizeInBytes,
        allowedMimeTypes,
        allowedExtensions,
      });

      // Generate preview for images
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: errorMsg ? 'failed' : 'idle',
        error: errorMsg || undefined,
        previewUrl,
      };
    });

    setFiles((prev) => [...prev, ...newTasks]);
  }, [maxSizeInBytes, allowedMimeTypes, allowedExtensions]);

  // Remove file from the list (and abort upload if in progress)
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        if (fileToRemove.abortController) {
          fileToRemove.abortController.abort();
        }
        revokeFilePreview(fileToRemove);
        delete uploadPromisesRef.current[id];
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  // Reorder files in the list
  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  }, []);

  // Simulates chunked upload progress
  const uploadChunkSimulated = async (
    taskId: string,
    file: File,
    chunkIndex: number,
    totalChunks: number,
    signal: AbortSignal
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        return reject(new Error('Upload aborted'));
      }

      const timeout = setTimeout(() => {
        if (signal.aborted) {
          return reject(new Error('Upload aborted'));
        }
        resolve();
      }, simulateNetworkLatency ? 200 + Math.random() * 200 : 10);

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Upload aborted'));
      });
    });
  };

  // Perform upload of a single file (supporting chunking)
  const uploadFile = useCallback(async (id: string) => {
    const task = files.find((f) => f.id === id);
    if (!task || task.status === 'failed' || task.status === 'completed') {
      return;
    }

    // Set state to uploading
    const abortController = new AbortController();
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: 'uploading', progress: 0, abortController }
          : f
      )
    );

    const file = task.file;
    const totalSize = file.size;
    
    // Chunking parameters
    const sizeOfChunk = chunkSizeInBytes;
    const totalChunks = Math.ceil(totalSize / sizeOfChunk);

    try {
      uploadPromisesRef.current[id] = true;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload aborted');
        }

        const start = chunkIndex * sizeOfChunk;
        const end = Math.min(start + sizeOfChunk, totalSize);
        const chunk = file.slice(start, end);

        if (uploadUrl) {
          // Actual Network Chunk Upload Implementation
          const formData = new FormData();
          formData.append('fileId', id);
          formData.append('filename', file.name);
          formData.append('chunkIndex', chunkIndex.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('chunk', chunk);

          const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error(`Upload failed with status code ${response.status}`);
          }
        } else {
          // Simulated Network Chunk Upload
          await uploadChunkSimulated(id, file, chunkIndex, totalChunks, abortController.signal);
        }

        // Calculate progress percentage
        const progressPercentage = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, progress: progressPercentage } : f
          )
        );
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: 'completed', progress: 100, abortController: undefined }
            : f
        )
      );
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Upload aborted') {
        // Do not update status to failed if user explicitly aborted it
        return;
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: 'failed', error: err.message || 'Upload failed', abortController: undefined }
            : f
        )
      );
    } finally {
      delete uploadPromisesRef.current[id];
    }
  }, [files, uploadUrl, chunkSizeInBytes, simulateNetworkLatency]);

  // Upload all idle/failed files
  const uploadAll = useCallback(() => {
    files.forEach((file) => {
      if (file.status === 'idle' || file.status === 'failed') {
        uploadFile(file.id);
      }
    });
  }, [files, uploadFile]);

  // Cancel in-progress upload
  const cancelUpload = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToCancel = prev.find((f) => f.id === id);
      if (fileToCancel && fileToCancel.abortController) {
        fileToCancel.abortController.abort();
      }
      return prev.map((f) =>
        f.id === id
          ? { ...f, status: 'idle', progress: 0, abortController: undefined }
          : f
      );
    });
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    files.forEach((f) => {
      if (f.abortController) {
        f.abortController.abort();
      }
      revokeFilePreview(f);
    });
    setFiles([]);
    uploadPromisesRef.current = {};
  }, [files]);

  return {
    files,
    addFiles,
    removeFile,
    reorderFiles,
    uploadFile,
    uploadAll,
    cancelUpload,
    clearFiles,
  };
};
