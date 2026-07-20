import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Button,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Experiment,
  ExperimentResults,
  listExperiments,
  getExperimentResults,
  rollbackModel,
  startExperiment,
  pauseExperiment,
} from '../utils/mlModelsApi';
import { SkeletonCard } from './SkeletonCard';

const STATUS_COLORS: Record<Experiment['status'], 'default' | 'success' | 'warning' | 'info' | 'error'> = {
  draft: 'default',
  running: 'success',
  paused: 'warning',
  completed: 'info',
  rolled_back: 'error',
};

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

interface RollbackDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (targetVersionId: string, actor: string) => Promise<void>;
  modelId: string | null;
}

const RollbackDialog: React.FC<RollbackDialogProps> = ({ open, onClose, onConfirm }) => {
  const [targetVersionId, setTargetVersionId] = useState('');
  const [actor, setActor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(targetVersionId, actor);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Roll back model</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Target version ID"
            value={targetVersionId}
            onChange={(e) => setTargetVersionId(e.target.value)}
            helperText="The model version to restore to production"
            fullWidth
          />
          <TextField
            label="Your name / actor id"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={submitting || !targetVersionId || !actor}
        >
          {submitting ? 'Rolling back…' : 'Confirm rollback'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ExperimentDashboard: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listExperiments();
      setExperiments(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadResults = useCallback(async (experimentId: string) => {
    setResultsLoading(true);
    try {
      const data = await getExperimentResults(experimentId);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiment results');
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  useEffect(() => {
    if (selectedId) {
      loadResults(selectedId);
    }
  }, [selectedId, loadResults]);

  const handleToggleStatus = async (experiment: Experiment) => {
    try {
      if (experiment.status === 'running') {
        await pauseExperiment(experiment.id);
      } else {
        await startExperiment(experiment.id);
      }
      await loadExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update experiment status');
    }
  };

  const handleRollback = async (targetVersionId: string, actor: string) => {
    if (!results) return;
    await rollbackModel(results.experiment.modelId, targetVersionId, actor);
    await loadResults(results.experiment.id);
  };

  const chartData = results
    ? [
        {
          name: results.control.variant.name,
          conversionRate: results.control.conversionRate * 100,
          exposures: results.control.exposures,
          isControl: true,
        },
        ...results.treatments.map((t) => ({
          name: t.variant.name,
          conversionRate: t.conversionRate * 100,
          exposures: t.exposures,
          isControl: false,
        })),
      ]
    : [];

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
      {error && (
        <Alert severity="error" sx={{ width: '100%' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Experiments
          </Typography>
          <List disablePadding>
            {experiments.map((experiment) => (
              <ListItemButton
                key={experiment.id}
                selected={experiment.id === selectedId}
                onClick={() => setSelectedId(experiment.id)}
              >
                <ListItemText
                  primary={experiment.name}
                  secondary={
                    <Chip
                      size="small"
                      label={experiment.status}
                      color={STATUS_COLORS[experiment.status]}
                      sx={{ mt: 0.5 }}
                    />
                  }
                />
              </ListItemButton>
            ))}
            {experiments.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No experiments yet.
              </Typography>
            )}
          </List>
        </CardContent>
      </Card>

      <Box sx={{ flex: 1 }}>
        {resultsLoading && <SkeletonCard />}

        {!resultsLoading && results && (
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h5">{results.experiment.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {results.experiment.description || 'No description'}
                    </Typography>
                    <Chip
                      size="small"
                      sx={{ mt: 1 }}
                      label={results.experiment.status}
                      color={STATUS_COLORS[results.experiment.status]}
                    />
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      onClick={() => handleToggleStatus(results.experiment)}
                    >
                      {results.experiment.status === 'running' ? 'Pause' : 'Start'}
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => setRollbackOpen(true)}
                    >
                      Rollback model
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Variant comparison — conversion rate on &ldquo;{results.experiment.metric}&rdquo;
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis unit="%" />
                    <RechartsTooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                    <Legend />
                    <ReferenceLine
                      y={results.control.conversionRate * 100}
                      stroke="#888"
                      strokeDasharray="4 4"
                      label="control"
                    />
                    <Bar dataKey="conversionRate" name="Conversion rate" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Control — {results.control.variant.name}
                    </Typography>
                    <Typography variant="h4">{formatPct(results.control.conversionRate)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {results.control.conversions} / {results.control.exposures} exposures
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {results.treatments.map((treatment) => (
                <Grid item xs={12} md={6} key={treatment.variant.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {treatment.variant.name}
                      </Typography>
                      <Typography variant="h4">{formatPct(treatment.conversionRate)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {treatment.conversions} / {treatment.exposures} exposures
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      {treatment.significance ? (
                        <>
                          <Chip
                            size="small"
                            label={
                              treatment.significance.significant
                                ? 'Statistically significant'
                                : 'Not significant'
                            }
                            color={treatment.significance.significant ? 'success' : 'default'}
                            sx={{ mb: 1 }}
                          />
                          <Typography variant="body2">
                            p-value: {treatment.significance.pValue.toFixed(4)} (α ={' '}
                            {treatment.significance.alpha.toFixed(4)})
                          </Typography>
                          <Typography variant="body2">
                            Relative uplift: {formatPct(treatment.significance.relativeUplift)}
                          </Typography>
                          <Typography variant="body2">
                            95% CI on diff: [{formatPct(treatment.significance.confidenceInterval.lower)},{' '}
                            {formatPct(treatment.significance.confidenceInterval.upper)}]
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not enough data yet for significance testing.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {results.powerAnalysis && (
              <Alert severity={results.readyForDecision ? 'success' : 'info'}>
                {results.readyForDecision
                  ? `Minimum sample size (${results.powerAnalysis.requiredSampleSizePerVariant} per variant) reached — safe to make a decision.`
                  : `Still collecting data: need ${results.powerAnalysis.requiredSampleSizePerVariant} exposures per variant before checking significance (peek prevention).`}
              </Alert>
            )}
          </Stack>
        )}

        {!resultsLoading && !results && experiments.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Select an experiment to view results.
          </Typography>
        )}
      </Box>

      <RollbackDialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        onConfirm={handleRollback}
        modelId={results?.experiment.modelId ?? null}
      />
    </Box>
  );
};

export default ExperimentDashboard;
