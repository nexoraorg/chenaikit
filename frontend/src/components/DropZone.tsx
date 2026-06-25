import React, { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  maxSizeInBytes?: number;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  disabled?: boolean;
}

/**
 * Reusable Drag-and-Drop Area component built on top of react-dropzone.
 * 
 * Time Complexity: O(1) rendering, onDrop is O(N) where N is files dropped.
 * Space Complexity: O(1) state variables.
 */
export const DropZone: React.FC<DropZoneProps> = ({
  onFilesDropped,
  maxSizeInBytes,
  allowedExtensions,
  allowedMimeTypes,
  disabled = false,
}) => {
  // Convert extensions to dropzone accept format (e.g. ['.jpg', '.png'] or matching mime types)
  const acceptConfig = useMemo(() => {
    if (!allowedMimeTypes && !allowedExtensions) return undefined;
    
    const accept: { [key: string]: string[] } = {};
    
    // Map standard extensions for common mime types to ensure they work correctly in react-dropzone
    const mimeToExtMap: { [key: string]: string[] } = {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/jpg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/zip': ['.zip'],
      'text/plain': ['.txt'],
      'text/html': ['.html', '.htm'],
      'text/css': ['.css'],
      'application/json': ['.json'],
    };

    if (allowedMimeTypes) {
      allowedMimeTypes.forEach((mime) => {
        accept[mime] = mimeToExtMap[mime] || [];
      });
    }

    if (allowedExtensions) {
      allowedExtensions.forEach((ext) => {
        const dotExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
        // Determine mime
        let mime = 'application/octet-stream';
        if (['.jpg', '.jpeg'].includes(dotExt)) {
          mime = 'image/jpeg';
        } else if (dotExt === '.png') {
          mime = 'image/png';
        } else if (dotExt === '.gif') {
          mime = 'image/gif';
        } else if (dotExt === '.webp') {
          mime = 'image/webp';
        } else if (dotExt === '.svg') {
          mime = 'image/svg+xml';
        } else if (dotExt === '.pdf') {
          mime = 'application/pdf';
        } else if (dotExt === '.doc') {
          mime = 'application/msword';
        } else if (dotExt === '.docx') {
          mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (dotExt === '.xls') {
          mime = 'application/vnd.ms-excel';
        } else if (dotExt === '.xlsx') {
          mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (dotExt === '.zip') {
          mime = 'application/zip';
        } else if (dotExt === '.txt') {
          mime = 'text/plain';
        } else if (dotExt === '.html' || dotExt === '.htm') {
          mime = 'text/html';
        } else if (dotExt === '.css') {
          mime = 'text/css';
        } else if (dotExt === '.json') {
          mime = 'application/json';
        }

        if (!accept[mime]) {
          accept[mime] = [];
        }
        if (!accept[mime].includes(dotExt)) {
          accept[mime].push(dotExt);
        }
      });
    }

    return accept;
  }, [allowedMimeTypes, allowedExtensions]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: onFilesDropped,
    maxSize: maxSizeInBytes,
    accept: acceptConfig,
    disabled,
  });

  const statusMessage = isDragReject
    ? 'Unsupported file type or file is too large'
    : isDragActive
    ? 'Drop files here'
    : 'Drag and drop files here, or click to browse';

  return (
    <Box
      {...getRootProps({
        'aria-label': 'File upload drop zone',
        'aria-disabled': disabled,
        'aria-describedby': 'dropzone-instructions',
      })}
      sx={{
        border: '2px dashed',
        borderColor: isDragReject
          ? 'error.main'
          : isDragActive
          ? 'primary.main'
          : 'grey.300',
        borderRadius: 3,
        p: 4,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        bgcolor: isDragReject
          ? 'error.light'
          : isDragActive
          ? 'primary.light'
          : 'background.paper',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: disabled ? 'grey.300' : 'primary.main',
          bgcolor: disabled ? 'background.paper' : 'grey.50',
          boxShadow: disabled ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.05)',
        },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 180,
      }}
    >
      <input {...getInputProps()} aria-label="Choose files to upload" />
      <CloudUploadIcon
        aria-hidden="true"
        sx={{
          fontSize: 48,
          color: isDragReject
            ? 'error.main'
            : isDragActive
            ? 'primary.main'
            : 'text.secondary',
          mb: 2,
        }}
      />
      {isDragReject ? (
        <Typography variant="body1" color="error.main" fontWeight={600} role="alert">
          {statusMessage}
        </Typography>
      ) : isDragActive ? (
        <Typography variant="body1" color="primary.main" fontWeight={600} aria-live="polite">
          {statusMessage}
        </Typography>
      ) : (
        <>
          <Typography id="dropzone-instructions" variant="body1" color="text.primary" fontWeight={500} mb={0.5}>
            {statusMessage}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {maxSizeInBytes
              ? `Max file size: ${(maxSizeInBytes / (1024 * 1024)).toFixed(0)}MB`
              : 'Any file size is allowed'}
            {allowedExtensions && ` • Allowed: ${allowedExtensions.join(', ')}`}
          </Typography>
        </>
      )}
    </Box>
  );
};
export default DropZone;
