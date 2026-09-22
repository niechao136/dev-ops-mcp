'use client';

import { Box, Button, Checkbox, Typography } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

interface MobileSelectionBarProps {
  count: number;
  checked: boolean;
  indeterminate: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  /** 已选中时的操作文案，默认"删除选中" */
  deleteLabel?: string;
}

/** 移动端多选工具条：替代桌面表头的全选 checkbox（规格第 7.4 节） */
export default function MobileSelectionBar({
  count,
  checked,
  indeterminate,
  onToggleAll,
  onDelete,
  deleteLabel = '删除选中',
}: MobileSelectionBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 1.5,
        px: 1,
        py: 0.5,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Checkbox checked={checked} indeterminate={indeterminate} onChange={onToggleAll} aria-label="全选" />
      <Typography variant="body2" sx={{ flex: 1 }}>
        已选 {count} 项
      </Typography>
      {count > 0 && (
        <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
          {deleteLabel}
        </Button>
      )}
    </Box>
  );
}
