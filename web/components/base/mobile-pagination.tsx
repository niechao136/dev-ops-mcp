'use client';

import { Box, MenuItem, Select, Typography } from '@mui/material';

interface MobilePaginationProps {
  total: number;
  /** 1 起始页码（与桌面自建分页一致） */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** 移动端分页条：共 X 条 + 页码输入 + 每页条数选择（规格第 7.4 节） */
export default function MobilePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: MobilePaginationProps) {
  const maxPage = Math.ceil(total / pageSize) || 1;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        共 {total} 条
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>第</Typography>
        <input
          type="number"
          min="1"
          max={maxPage}
          value={page}
          onChange={(e) => {
            const newPage = parseInt(e.target.value) || 1;
            onPageChange(Math.min(Math.max(newPage, 1), maxPage));
          }}
          style={{
            width: 60,
            padding: '4px 8px',
            border: '1px solid rgba(0,0,0,0.23)',
            borderRadius: 4,
            textAlign: 'center',
            fontSize: 16,
            backgroundColor: 'transparent',
            color: 'inherit',
          }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          页 / {maxPage} 页
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>每页</Typography>
        <Select
          size="small"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          sx={{ minWidth: 72 }}
          inputProps={{ 'aria-label': '每页条数' }}
        >
          {[10, 25, 50, 100].map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
}
