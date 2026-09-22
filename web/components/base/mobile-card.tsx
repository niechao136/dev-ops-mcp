'use client';

import { ReactNode } from 'react';
import { Box, Card, CardActions, CardContent, Typography } from '@mui/material';

interface MobileCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** 右上角区域：状态 Chip 或多选 Checkbox */
  headerRight?: ReactNode;
  /** 主体：放置 MobileField，自动 2 列网格 */
  children?: ReactNode;
  /** 底部操作区 */
  footer?: ReactNode;
}

/** 移动端卡片布局壳：头部(标题/副标题/右侧) + 2 列字段网格 + 底部操作区（规格第 7.2 节结构） */
export function MobileCard({ title, subtitle, headerRight, children, footer }: MobileCardProps) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: footer ? 1 : 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{title}</Typography>
            {subtitle != null && subtitle !== '' && (
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {headerRight}
        </Box>
        {children != null && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1.5 }}>{children}</Box>
        )}
      </CardContent>
      {footer != null && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0, px: 2, pb: 1.5 }}>{footer}</CardActions>
      )}
    </Card>
  );
}

interface MobileFieldProps {
  label: string;
  value: ReactNode;
  /** 2 = 独占整行（长内容如路径、命令），默认 1 = 半行 */
  span?: 1 | 2;
}

/** 移动端字段行：灰色小字 label + 值。放入 MobileCard 的 children 中使用。 */
export function MobileField({ label, value, span = 1 }: MobileFieldProps) {
  return (
    <Box sx={{ gridColumn: span === 2 ? '1 / -1' : 'auto', minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
        {value ?? '-'}
      </Typography>
    </Box>
  );
}
