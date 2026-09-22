'use client';

import { Dialog, DialogProps } from '@mui/material';
import { useIsMobile } from '@/hooks/use-is-mobile';

/**
 * 移动端强制全屏的 Dialog（规格第 4.3 节）。
 * 用法与 Dialog 完全一致：仅把 import 从 '@mui/material' 换成本文件即可，
 * maxWidth / fullWidth 在桌面端行为不变，移动端自动 fullScreen。
 */
export default function ResponsiveDialog(props: DialogProps) {
  const isMobile = useIsMobile();
  const { fullScreen, ...rest } = props;
  return <Dialog {...rest} fullScreen={isMobile ? true : fullScreen} />;
}
