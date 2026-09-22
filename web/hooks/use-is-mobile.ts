'use client';

import { useMediaQuery } from '@mui/material';

/**
 * 全项目唯一的移动端判定来源。
 * 断点约定：< 900px 为移动模式（见 docs/superpowers/specs/2026-09-22-web-mobile-adaptation-design.md 第 3 节）。
 * noSsr: 客户端首帧即用真实匹配结果，代价是手机首帧可能短暂闪现桌面布局（已接受的 trade-off）。
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width:899.95px)', { noSsr: true });
}
