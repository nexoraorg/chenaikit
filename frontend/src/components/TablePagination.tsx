import React from "react";
import {
  TablePagination as MuiTablePagination,
  Box,
  Typography,
} from "@mui/material";

export interface TablePaginationProps {
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  labelRowsPerPage?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const TablePagination: React.FC<TablePaginationProps> = ({
  pageIndex,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  labelRowsPerPage = "Rows per page:",
}) => {
  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ) => {
    onPageChange(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    onPageSizeChange(parseInt(event.target.value, 10));
    onPageChange(0);
  };

  const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {totalRows > 0 ? `${startRow}-${endRow} of ${totalRows}` : "0 rows"}
      </Typography>
      <MuiTablePagination
        component="div"
        count={totalRows}
        page={pageIndex}
        onPageChange={handleChangePage}
        rowsPerPage={pageSize}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={pageSizeOptions}
        labelRowsPerPage={labelRowsPerPage}
        sx={{
          ".MuiTablePagination-toolbar": { paddingLeft: 0 },
          ".MuiTablePagination-spacer": { display: "none" },
        }}
      />
    </Box>
  );
};

export default TablePagination;
