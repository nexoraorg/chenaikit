import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  InputAdornment
} from '@mui/material';
import {
  VpnKey as VpnKeyIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Visibility,
  VisibilityOff,
  Add as AddIcon
} from '@mui/icons-material';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  permissions: string[];
}

interface ApiKeysSettingsProps {
  apiKeys: ApiKey[];
  onCreateApiKey: (name: string, permissions: string[]) => Promise<{ key: string }>;
  onDeleteApiKey: (id: string) => Promise<void>;
  onRegenerateApiKey: (id: string) => Promise<{ key: string }>;
}

const AVAILABLE_PERMISSIONS = [
  'read:transactions',
  'write:transactions',
  'read:scores',
  'write:scores',
  'read:analytics',
  'admin'
];

export const ApiKeysSettings: React.FC<ApiKeysSettingsProps> = ({
  apiKeys = [],
  onCreateApiKey,
  onDeleteApiKey,
  onRegenerateApiKey
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read:transactions']);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateKey = async () => {
    setIsLoading(true);
    try {
      const result = await onCreateApiKey(newKeyName, newKeyPermissions);
      setCreatedKey(result.key);
      setNewKeyName('');
      setNewKeyPermissions(['read:transactions']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!selectedKeyId) return;
    setIsLoading(true);
    try {
      await onDeleteApiKey(selectedKeyId);
      setDeleteDialogOpen(false);
      setSelectedKeyId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!selectedKeyId) return;
    setIsLoading(true);
    try {
      const result = await onRegenerateApiKey(selectedKeyId);
      setCreatedKey(result.key);
      setRegenerateDialogOpen(false);
      setSelectedKeyId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = (permission: string) => {
    setNewKeyPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '•'.repeat(key.length);
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <VpnKeyIcon color="primary" />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  API Keys
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Manage your API keys for external access
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setCreatedKey(null);
                setCreateDialogOpen(true);
              }}
            >
              Create New Key
            </Button>
          </Box>

          {apiKeys.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <VpnKeyIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
              <Typography variant="body1" sx={{ color: '#64748b', mb: 2 }}>
                No API keys yet
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Create your first API key to start integrating with external services
              </Typography>
            </Box>
          ) : (
            <List>
              {apiKeys.map((apiKey) => (
                <ListItem
                  key={apiKey.id}
                  sx={{
                    borderBottom: '1px solid #f1f5f9',
                    py: 2,
                    '&:last-child': { borderBottom: 'none' },
                    flexDirection: 'column',
                    alignItems: 'flex-start'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                    <ListItemText
                      primary={apiKey.name}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                          </Typography>
                          {apiKey.lastUsed && (
                            <>
                              <Box component="span" sx={{ color: '#cbd5e1' }}>•</Box>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                Last used: {new Date(apiKey.lastUsed).toLocaleDateString()}
                              </Typography>
                            </>
                          )}
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => setShowKey(showKey === apiKey.id ? null : apiKey.id)}
                      >
                        {showKey === apiKey.id ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedKeyId(apiKey.id);
                          setRegenerateDialogOpen(true);
                        }}
                        title="Regenerate key"
                      >
                        <VpnKeyIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedKeyId(apiKey.id);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete key"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {apiKey.permissions.map((perm) => (
                      <Chip
                        key={perm}
                        label={perm}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    ))}
                  </Box>

                  <Box
                    sx={{
                      mt: 1,
                      px: 2,
                      py: 1,
                      backgroundColor: '#f8fafc',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      color: '#475569',
                      width: '100%'
                    }}
                  >
                    {showKey === apiKey.id ? apiKey.key : maskKey(apiKey.key)}
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2, backgroundColor: '#fffbeb' }}>
        <CardContent>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#92400e', mb: 1 }}>
            Security Notice
          </Typography>
          <Typography variant="body2" sx={{ color: '#a16207' }}>
            Your API keys carry significant privileges. Keep them secure and never share them in public repositories or client-side code.
          </Typography>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New API Key</DialogTitle>
        <DialogContent>
          {createdKey ? (
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                API key created successfully! Copy it now - you won't be able to see it again.
              </Alert>
              <TextField
                fullWidth
                label="Your API Key"
                value={createdKey}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => navigator.clipboard.writeText(createdKey)}
                        edge="end"
                      >
                        <CopyIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          ) : (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Key Name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production Server"
                sx={{ mb: 3 }}
              />

              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                Permissions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <Box
                    key={perm}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer'
                    }}
                    onClick={() => togglePermission(perm)}
                  >
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: 1,
                        border: '2px solid',
                        borderColor: newKeyPermissions.includes(perm) ? 'primary.main' : '#cbd5e1',
                        backgroundColor: newKeyPermissions.includes(perm) ? 'primary.main' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      {newKeyPermissions.includes(perm) && (
                        <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: 'white' }} />
                      )}
                    </Box>
                    <Typography variant="body2">{perm}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            {createdKey ? 'Close' : 'Cancel'}
          </Button>
          {!createdKey && (
            <Button
              variant="contained"
              onClick={handleCreateKey}
              disabled={!newKeyName || newKeyPermissions.length === 0 || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Key'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete API Key</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete this API key? Any applications using this key will lose access immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteKey} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={regenerateDialogOpen} onClose={() => setRegenerateDialogOpen(false)}>
        <DialogTitle>Regenerate API Key</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will invalidate the current key immediately. Make sure to update any applications using this key.
          </Alert>
          <Typography variant="body2">
            A new key will be generated and displayed once you confirm.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenerateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleRegenerateKey} disabled={isLoading}>
            {isLoading ? 'Regenerating...' : 'Regenerate Key'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApiKeysSettings;
