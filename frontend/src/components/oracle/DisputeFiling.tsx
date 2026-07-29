import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, TextField, Paper, Typography, Alert, CircularProgress } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';

interface DisputeFilingProps {
  requestId?: string;
}

const DisputeFiling: React.FC<DisputeFilingProps> = ({ requestId: propRequestId }) => {
  const { t } = useTranslation();
  const [requestId, setRequestId] = useState(propRequestId || '');
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const disputeMutation = useMutation({
    mutationFn: async (data: { requestId: string; disputerAddress: string; evidence: any }) => {
      const response = await fetch('/api/v2/oracle/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to file dispute');
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      setRequestId('');
      setEvidence('');
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!requestId || !evidence) {
      setError(t('oracleNetwork.disputes.requiredFields'));
      return;
    }

    // In a real app, you'd get the disputer address from auth context
    const disputerAddress = 'GABC...'; // Placeholder

    try {
      const evidenceData = JSON.parse(evidence);
      disputeMutation.mutate({
        requestId,
        disputerAddress,
        evidence: evidenceData,
      });
    } catch (parseError) {
      setError(t('oracleNetwork.disputes.invalidEvidence'));
    }
  };

  return (
    <Box role="region" aria-label={t('oracleNetwork.disputes.title')}>
      <Typography variant="h6" gutterBottom id="dispute-filing-title">
        {t('oracleNetwork.disputes.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('oracleNetwork.disputes.description')}
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)} role="alert" aria-live="polite">
          {t('oracleNetwork.disputes.success')}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} role="alert" aria-live="assertive">
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }} component="section" aria-labelledby="dispute-filing-title">
        <form onSubmit={handleSubmit} aria-label={t('oracleNetwork.disputes.formLabel')}>
          <TextField
            fullWidth
            label={t('oracleNetwork.disputes.requestId')}
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            margin="normal"
            required
            disabled={!!propRequestId}
            aria-required="true"
          />
          <TextField
            fullWidth
            label={t('oracleNetwork.disputes.evidence')}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            margin="normal"
            multiline
            rows={4}
            required
            placeholder={t('oracleNetwork.disputes.evidencePlaceholder')}
            helperText={t('oracleNetwork.disputes.evidenceHelper')}
            aria-required="true"
            aria-describedby="evidence-helper"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            disabled={disputeMutation.isPending}
            aria-busy={disputeMutation.isPending}
          >
            {disputeMutation.isPending ? (
              <CircularProgress size={24} aria-label={t('oracleNetwork.disputes.submitting')} />
            ) : (
              t('oracleNetwork.disputes.submit')
            )}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default DisputeFiling;
