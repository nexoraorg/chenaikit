import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import { helpTopics, HelpTopic } from '../help/content';

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
  helpContext?: string;
  onStartTour?: () => void;
}

const suggestionLabels: Record<string, string> = {
  analytics: 'Analytics help',
  visualization: 'Visualizations',
  dashboard: 'Dashboard guidance',
  general: 'General help',
};

const filterTopics = (topics: HelpTopic[], query: string, context?: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  return topics.filter((topic) => {
    const contextMatch =
      !context ||
      topic.contexts.includes(context) ||
      topic.keywords.some((keyword) => keyword === context);

    if (!contextMatch) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchable = [topic.title, topic.summary, topic.section, ...topic.keywords].join(' ').toLowerCase();
    return searchable.includes(normalizedQuery);
  });
};

const HelpPanel: React.FC<HelpPanelProps> = ({ open, onClose, helpContext, onStartTour }) => {
  const [query, setQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(helpTopics[0]?.id ?? '');

  const filteredTopics = useMemo(
    () => filterTopics(helpTopics, query, helpContext ?? 'general'),
    [query, helpContext],
  );

  useEffect(() => {
    if (open) {
      setSelectedTopicId((current) => {
        const stillAvailable = filteredTopics.some((topic) => topic.id === current);
        if (stillAvailable) {
          return current;
        }
        return filteredTopics[0]?.id ?? helpTopics[0]?.id ?? '';
      });
    }
  }, [filteredTopics, open]);

  const selectedTopic =
    filteredTopics.find((topic) => topic.id === selectedTopicId) || filteredTopics[0] || helpTopics[0];

  return (
    <Drawer
      open={open}
      anchor="right"
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, height: '100%' } }}
    >
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6">Help Center</Typography>
            <Typography variant="body2" color="text.secondary">
              Search tutorials, FAQs, and guided workflows.
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close help panel">
            <CloseIcon />
          </IconButton>
        </Box>

        <TextField
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help topics..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {Object.entries(suggestionLabels).map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              size="small"
              clickable
              onClick={() => setQuery(label)}
            />
          ))}
        </Box>

        {onStartTour && (
          <Button
            onClick={onStartTour}
            startIcon={<PlayCircleFilledWhiteIcon />}
            variant="contained"
            sx={{ mb: 2, textTransform: 'none' }}
          >
            Start the product tour
          </Button>
        )}

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
          <Box sx={{ flexShrink: 0, width: 200, overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Topics</Typography>
              <Typography variant="caption" color="text.secondary">
                {filteredTopics.length}
              </Typography>
            </Box>
            <List dense sx={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
              {filteredTopics.map((topic) => (
                <ListItemButton
                  key={topic.id}
                  selected={topic.id === selectedTopic.id}
                  onClick={() => setSelectedTopicId(topic.id)}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <ListItemText
                    primary={topic.title}
                    secondary={topic.summary}
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: 12, color: 'text.secondary' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Divider orientation="vertical" flexItem />

          <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
            <Typography variant="h6" gutterBottom>
              {selectedTopic.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedTopic.summary}
            </Typography>
            <Box sx={{ mb: 3 }}>{selectedTopic.details}</Box>

            {selectedTopic.videoUrl && (
              <Box sx={{ position: 'relative', pb: '56.25%', height: 0, borderRadius: 2, overflow: 'hidden', boxShadow: 1, mb: 3 }}>
                <iframe
                  src={selectedTopic.videoUrl}
                  title="Help video tutorial"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', width: '100%', height: '100%', left: 0, top: 0 }}
                />
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selectedTopic.keywords.slice(0, 4).map((keyword) => (
                <Chip key={keyword} label={keyword} size="small" />
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default HelpPanel;
