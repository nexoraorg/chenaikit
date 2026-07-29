import React, { useMemo } from 'react';
import { Box, Button, Typography, Paper, Divider } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { useFileUpload, UseFileUploadOptions } from '../hooks/useFileUpload';
import { DropZone } from './DropZone';
import { FileList } from './FileList';
import { formatFileSize } from './FilePreview';

export interface FileUploadProps extends UseFileUploadOptions {
  title?: string;
  onUploadSuccess?: (completedFiles: Array<{ name: string; size: number }>) => void;
}

/**
 * Orchestrating FileUpload Component.
 * Ties DropZone, FileList, and hook state together with unified controls.
 * 
 * Time Complexity: O(M) where M is the number of files.
 * Space Complexity: O(M) state and callback memory.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  title = 'Upload Files',
  maxSizeInBytes,
  allowedExtensions,
  allowedMimeTypes,
  uploadUrl,
  chunkSizeInBytes,
  simulateNetworkLatency,
  onUploadSuccess,
}) => {
  const {
    files,
    addFiles,
    removeFile,
    reorderFiles,
    uploadFile,
    uploadAll,
    cancelUpload,
    clearFiles,
  } = useFileUpload({
    maxSizeInBytes,
    allowedExtensions,
    allowedMimeTypes,
    uploadUrl,
    chunkSizeInBytes,
    simulateNetworkLatency,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCount = files.length;
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    const uploadingCount = files.filter((f) => f.status === 'uploading').length;
    const completedCount = files.filter((f) => f.status === 'completed').length;
    const hasIdleOrFailed = files.some((f) => f.status === 'idle' || f.status === 'failed');

    return {
      totalCount,
      totalSize,
      uploadingCount,
      completedCount,
      hasIdleOrFailed,
    };
  }, [files]);

  // Hook success callback if all uploads finished
  React.useEffect(() => {
    if (onUploadSuccess && stats.totalCount > 0 && stats.completedCount === stats.totalCount && stats.uploadingCount === 0) {
      const completedList = files.map((f) => ({ name: f.name, size: f.size }));
      onUploadSuccess(completedList);
    }
  }, [stats.completedCount, stats.totalCount, stats.uploadingCount, files, onUploadSuccess]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'background.paper',
        borderColor: 'grey.200',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        maxWidth: 600,
        width: '100%',
        mx: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={700} color="text.primary">
          {title}
        </Typography>
        {stats.totalCount > 0 && (
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            {stats.totalCount} {stats.totalCount === 1 ? 'file' : 'files'} ({formatFileSize(stats.totalSize)})
          </Typography>
        )}
      </Box>

      <DropZone
        onFilesDropped={addFiles}
        maxSizeInBytes={maxSizeInBytes}
        allowedExtensions={allowedExtensions}
        allowedMimeTypes={allowedMimeTypes}
        disabled={stats.uploadingCount > 0}
      />

      {stats.totalCount > 0 && (
        <>
          <Divider />
          <FileList
            tasks={files}
            onRemove={removeFile}
            onUpload={uploadFile}
            onCancel={cancelUpload}
            onReorder={reorderFiles}
          />
          <Divider />

          {/* Bulk Action Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 0.5 }}>
            <Button
              variant="outlined"
              color="error"
              size="medium"
              startIcon={<DeleteIcon />}
              onClick={clearFiles}
              disabled={stats.totalCount === 0}
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                px: 2,
              }}
            >
              Clear All
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="medium"
              startIcon={<CloudUploadIcon />}
              onClick={uploadAll}
              disabled={!stats.hasIdleOrFailed || stats.uploadingCount > 0}
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                px: 3.5,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              }}
            >
              {stats.uploadingCount > 0 ? 'Uploading...' : 'Upload All'}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
};
export default FileUpload;
