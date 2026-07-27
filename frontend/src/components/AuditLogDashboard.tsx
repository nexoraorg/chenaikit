import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  FileDownload as FileDownloadIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import axios from "axios";
import useToast from "../hooks/useToast";

interface AuditLog {
  id: string;
  createdAt: string;
  userId?: string;
  action: string;
  resource?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  ipAddress?: string;
  duration?: number;
  errorMessage?: string;
  piiRedacted: boolean;
  user?: { id: string; email: string };
}

interface AuditStatistics {
  totalEvents: number;
  uniqueUsers: number;
  failureRate: number;
  topUsers: Array<{ userId: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  topIPs: Array<{ ipAddress: string; count: number }>;
  failedActionsCount: number;
}

const getStatusColor = (code?: number) => {
  if (!code) return "default";
  if (code < 400) return "success";
  if (code < 500) return "warning";
  return "error";
};

export const AuditLogDashboard: React.FC = () => {
  const { showToast } = useToast();

  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    action: "",
    ipAddress: "",
    statusCode: "",
    searchQuery: "",
  });

  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false,
  });

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        ...(filters.action && { action: filters.action }),
        ...(filters.ipAddress && { ipAddress: filters.ipAddress }),
        ...(filters.statusCode && { statusCode: parseInt(filters.statusCode) }),
        ...(filters.searchQuery && { searchQuery: filters.searchQuery }),
        limit: pagination.limit,
        offset: pagination.offset,
      };

      const response = await axios.get("/api/v2/audit/logs", { params });
      setLogs(response.data.data.logs);
      setPagination({
        limit: response.data.data.pagination.limit,
        offset: response.data.data.pagination.offset,
        total: response.data.data.pagination.total,
        hasMore: response.data.data.pagination.hasMore,
      });
    } catch (error) {
      showToast("Failed to fetch audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, pagination.offset, showToast]);

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      const params = {
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
      };

      const response = await axios.get("/api/v2/audit/statistics", { params });
      setStats(response.data.data);
    } catch (error) {
      // Silently fail - may not have permission
    }
  }, [filters.startDate, filters.endDate]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, [fetchLogs, fetchStatistics]);

  // Export logs
  const handleExport = async (format: "csv" | "json") => {
    try {
      const params = {
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        format,
        ...(filters.action && { action: filters.action }),
      };

      const response = await axios.get("/api/v2/audit/export", { params });

      const blob = new Blob(
        [
          format === "csv"
            ? response.data
            : JSON.stringify(response.data, null, 2),
        ],
        {
          type: format === "csv" ? "text/csv" : "application/json",
        },
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);

      showToast(`Exported ${format.toUpperCase()} successfully`, "success");
    } catch (error) {
      showToast("Failed to export logs", "error");
    }
  };

  // Handle filter changes
  const handleFilterChange = (field: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
    fetchLogs();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
        Audit Logs
      </Typography>

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Events
                </Typography>
                <Typography variant="h5">
                  {stats.totalEvents.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unique Users
                </Typography>
                <Typography variant="h5">{stats.uniqueUsers}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Failure Rate
                </Typography>
                <Typography variant="h5">
                  {stats.failureRate.toFixed(2)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Failed Actions
                </Typography>
                <Typography variant="h5">{stats.failedActionsCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(date) => handleFilterChange("startDate", date)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="End Date"
                    value={filters.endDate}
                    onChange={(date) => handleFilterChange("endDate", date)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Action"
                  value={filters.action}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                  placeholder="e.g. LOGIN, USER_CREATE"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="IP Address"
                  value={filters.ipAddress}
                  onChange={(e) =>
                    handleFilterChange("ipAddress", e.target.value)
                  }
                  placeholder="Filter by IP"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Status Code</InputLabel>
                  <Select
                    label="Status Code"
                    value={filters.statusCode}
                    onChange={(e) =>
                      handleFilterChange("statusCode", e.target.value)
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="200">200 OK</MenuItem>
                    <MenuItem value="201">201 Created</MenuItem>
                    <MenuItem value="400">400 Bad Request</MenuItem>
                    <MenuItem value="401">401 Unauthorized</MenuItem>
                    <MenuItem value="403">403 Forbidden</MenuItem>
                    <MenuItem value="500">500 Server Error</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Search"
                  value={filters.searchQuery}
                  onChange={(e) =>
                    handleFilterChange("searchQuery", e.target.value)
                  }
                  placeholder="Search request/response data"
                />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                startIcon={<RefreshIcon />}
                variant="outlined"
                onClick={handleApplyFilters}
                disabled={loading}
              >
                Apply Filters
              </Button>
              <Button
                startIcon={<FileDownloadIcon />}
                variant="outlined"
                onClick={() => handleExport("csv")}
                disabled={loading}
              >
                Export CSV
              </Button>
              <Button
                startIcon={<DownloadIcon />}
                variant="outlined"
                onClick={() => handleExport("json")}
                disabled={loading}
              >
                Export JSON
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>PII Redacted</TableCell>
                  <TableCell align="center">Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow hover>
                      <TableCell>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {log.user?.email || log.userId || "-"}
                      </TableCell>
                      <TableCell>{log.resource || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.statusCode || "N/A"}
                          color={getStatusColor(log.statusCode) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{log.ipAddress || "-"}</TableCell>
                      <TableCell>
                        {log.duration ? `${log.duration}ms` : "-"}
                      </TableCell>
                      <TableCell>
                        {log.piiRedacted ? (
                          <Chip label="Yes" size="small" color="warning" />
                        ) : (
                          <Chip label="No" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() =>
                              setExpandedDetailId(
                                expandedDetailId === log.id ? null : log.id,
                              )
                            }
                          >
                            <ExpandMoreIcon
                              sx={{
                                transform:
                                  expandedDetailId === log.id
                                    ? "rotate(180deg)"
                                    : "rotate(0deg)",
                                transition: "transform 0.3s",
                              }}
                            />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {expandedDetailId === log.id && (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <Box
                            sx={{
                              p: 2,
                              backgroundColor: "#f9f9f9",
                              borderRadius: 1,
                            }}
                          >
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 1 }}
                            >
                              Request Details
                            </Typography>
                            <pre style={{ fontSize: "12px", overflow: "auto" }}>
                              {log.errorMessage || "No error"}
                            </pre>
                            {log.endpoint && (
                              <>
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600, mb: 1, mt: 2 }}
                                >
                                  Endpoint
                                </Typography>
                                <Typography variant="body2">
                                  {log.method} {log.endpoint}
                                </Typography>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {logs.length === 0 && (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography color="textSecondary">No audit logs found</Typography>
            </Box>
          )}

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 2, justifyContent: "flex-end" }}
            >
              <Button
                disabled={pagination.offset === 0}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: Math.max(0, prev.offset - prev.limit),
                  }))
                }
              >
                Previous
              </Button>
              <Typography sx={{ alignSelf: "center" }}>
                Page {Math.floor(pagination.offset / pagination.limit) + 1} of{" "}
                {Math.ceil(pagination.total / pagination.limit)}
              </Typography>
              <Button
                disabled={!pagination.hasMore}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }))
                }
              >
                Next
              </Button>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
};

export default AuditLogDashboard;
