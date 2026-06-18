import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  CameraAlt as CameraAltIcon,
  Person as PersonIcon
} from '@mui/icons-material';

interface ProfileHeaderProps {
  user: {
    id: number;
    email: string;
    name?: string;
    avatar?: string;
    role?: string;
    createdAt?: string;
  };
  stats?: {
    transactions?: number;
    score?: number;
    activeDays?: number;
  };
  onUpdateProfile: (data: { name?: string; avatar?: string }) => Promise<void>;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  stats = {},
  onUpdateProfile
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await onUpdateProfile({ avatar: base64 });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await onUpdateProfile({ name: editName });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = user.name || user.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
        borderRadius: 3,
        p: 4,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar
            src={user.avatar}
            sx={{
              width: 120,
              height: 120,
              fontSize: '2.5rem',
              fontWeight: 700,
              background: user.avatar ? 'transparent' : 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)'
            }}
          >
            {user.avatar ? null : initials}
          </Avatar>

          <IconButton
            component="label"
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              width: 36,
              height: 36,
              '&:hover': {
                backgroundColor: '#7dd3fc'
              }
            }}
          >
            {isUploading ? <CircularProgress size={16} color="inherit" /> : <CameraAltIcon sx={{ fontSize: 18 }} />}
            <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {displayName}
            </Typography>
            <IconButton
              onClick={() => {
                setEditName(displayName);
                setIsEditing(true);
              }}
              sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonIcon sx={{ fontSize: 16, opacity: 0.7 }} />
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              {user.email}
            </Typography>
            {user.role && (
              <>
                <Box sx={{ mx: 1, opacity: 0.5 }}>•</Box>
                <Typography variant="body2" sx={{ opacity: 0.7, textTransform: 'capitalize' }}>
                  {user.role}
                </Typography>
              </>
            )}
          </Box>

          {user.createdAt && (
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      </Box>

      {stats && (stats.transactions !== undefined || stats.score !== undefined || stats.activeDays !== undefined) && (
        <Box
          sx={{
            display: 'flex',
            gap: 4,
            mt: 4,
            pt: 3,
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {stats.transactions !== undefined && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {stats.transactions.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Transactions
              </Typography>
            </Box>
          )}
          {stats.score !== undefined && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {stats.score}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Credit Score
              </Typography>
            </Box>
          )}
          {stats.activeDays !== undefined && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {stats.activeDays}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Active Days
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Dialog open={isEditing} onClose={() => setIsEditing(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Display Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfileHeader;
