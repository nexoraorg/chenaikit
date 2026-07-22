import React from 'react';
import { Box, Card, Typography, IconButton, LinearProgress, Tooltip } from '@mui/material';
import {
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  FolderZip as ZipIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Code as CodeIcon,
  PlayArrow as UploadIcon,
  Cancel as CancelIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { UploadTask } from '../hooks/useFileUpload';

export interface FilePreviewProps {
  task: UploadTask;
  onRemove: (id: string) => void;
  onUpload?: (id: string) => void;
  onCancel?: (id: string) => void;
}

/**
 * Format bytes into readable string format.
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Retrieves the appropriate MUI icon based on the file MIME type or name.
 */
const getFileIcon = (type: string, name: string) => {
  const lowercaseName = name.toLowerCase();
  
  if (type.startsWith('image/')) {
    return <FileIcon color="primary" />;
  }
  if (type === 'application/pdf' || lowercaseName.endsWith('.pdf')) {
    return <PdfIcon sx={{ color: '#ef4444' }} />;
  }
  if (
    ['application/zip', 'application/x-tar', 'application/x-gzip', 'application/x-zip-compressed'].includes(type) ||
    lowercaseName.endsWith('.zip') || lowercaseName.endsWith('.tar') || lowercaseName.endsWith('.gz') || lowercaseName.endsWith('.rar')
  ) {
    return <ZipIcon sx={{ color: '#eab308' }} />;
  }
  if (type.startsWith('audio/') || lowercaseName.endsWith('.mp3') || lowercaseName.endsWith('.wav')) {
    return <AudioIcon sx={{ color: '#06b6d4' }} />;
  }
  if (type.startsWith('video/') || lowercaseName.endsWith('.mp4') || lowercaseName.endsWith('.mov') || lowercaseName.endsWith('.avi')) {
    return <VideoIcon sx={{ color: '#8b5cf6' }} />;
  }
  if (
    ['text/javascript', 'text/html', 'text/css', 'application/json'].includes(type) ||
    ['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.rs', '.py', '.sh'].some(ext => lowercaseName.endsWith(ext))
  ) {
    return <CodeIcon sx={{ color: '#ec4899' }} />;
  }
  
  return <FileIcon color="action" />;
};

/**
 * FilePreview component showing thumbnail, file metadata, progress, and error details.
 * 
 * Time Complexity: O(1) constant time rendering.
 * Space Complexity: O(1) allocations.
 */
export const FilePreview: React.FC<FilePreviewProps> = ({
  task,
  onRemove,
  onUpload,
  onCancel,
}) => {
  const { id, name, size, type, progress, status, error, previewUrl } = task;

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: status === 'failed' ? 'error.light' : 'grey.200',
        borderRadius: 2,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        position: 'relative',
        bgcolor: status === 'failed' ? 'error.light' : 'background.paper',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* File Preview Thumbnail or Icon */}
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 1,
            bgcolor: 'grey.100',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            border: '1px solid',
            borderColor: 'grey.200',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            getFileIcon(type, name)
          )}
        </Box>

        {/* Metadata & Title */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            title={name}
            sx={{ color: status === 'failed' ? 'error.dark' : 'text.primary' }}
          >
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(size)}
          </Typography>
        </Box>

        {/* Action Controls */}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {status === 'idle' && onUpload && (
            <Tooltip title="Upload file">
              <IconButton size="small" onClick={() => onUpload(id)} color="primary">
                <UploadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {status === 'uploading' && onCancel && (
            <Tooltip title="Cancel upload">
              <IconButton size="small" onClick={() => onCancel(id)} color="warning">
                <CancelIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {status === 'completed' && (
            <SuccessIcon color="success" sx={{ mx: 1 }} fontSize="small" />
          )}

          {status === 'failed' && (
            <Tooltip title={error || 'Upload failed'}>
              <ErrorIcon color="error" sx={{ mx: 1 }} fontSize="small" />
            </Tooltip>
          )}

          <Tooltip title="Remove item">
            <IconButton size="small" onClick={() => onRemove(id)} color="default">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Progress Bar & Status Text */}
      {status === 'uploading' && (
        <Box sx={{ width: '100%', mt: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="primary.main" fontWeight={500}>
              Uploading...
            </Typography>
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              {progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
            }}
          />
        </Box>
      )}

      {/* Error Message Details */}
      {status === 'failed' && error && (
        <Typography
          variant="caption"
          color="error.dark"
          sx={{
            display: 'block',
            fontWeight: 500,
            mt: 0.5,
            wordBreak: 'break-word',
          }}
        >
          {error}
        </Typography>
      )}
    </Card>
  );
};
export default FilePreview;
