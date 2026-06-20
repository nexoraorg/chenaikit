import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { UploadTask } from '../hooks/useFileUpload';
import { FilePreview } from './FilePreview';

export interface FileListProps {
  tasks: UploadTask[];
  onRemove: (id: string) => void;
  onUpload?: (id: string) => void;
  onCancel?: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/**
 * FileList component containing a group of FilePreview items with support for list reordering.
 * 
 * Time Complexity: O(M) rendering, where M is the number of files.
 * Space Complexity: O(1) extra variables.
 */
export const FileList: React.FC<FileListProps> = ({
  tasks,
  onRemove,
  onUpload,
  onCancel,
  onReorder,
}) => {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {tasks.map((task, index) => (
        <Box
          key={task.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: '100%',
          }}
        >
          {/* Reordering Controls */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <Tooltip title="Move Up">
              <span>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  onClick={() => onReorder(index, index - 1)}
                  sx={{
                    p: 0.25,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  <ArrowUpwardIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
            
            <Tooltip title="Move Down">
              <span>
                <IconButton
                  size="small"
                  disabled={index === tasks.length - 1}
                  onClick={() => onReorder(index, index + 1)}
                  sx={{
                    p: 0.25,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  <ArrowDownwardIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {/* Main File Preview card */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <FilePreview
              task={task}
              onRemove={onRemove}
              onUpload={onUpload}
              onCancel={onCancel}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};
export default FileList;
