'use client';

import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { useTheme } from '@mui/material/styles';

import { useColorMode } from '@/providers/root-provider';

export default function ToggleThemeButton({ sx }: { sx?: any }) {
  const theme = useTheme();
  const colorMode = useColorMode();

  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Tooltip title={isDarkMode ? '切换到明亮模式' : '切换到暗黑模式'} arrow>
      <IconButton
        onClick={colorMode.toggleColorMode}
        color="inherit"
        sx={{
          width: 40,
          height: 40,
          // 增加一个微小的渐变过渡动画，让图标切换时更丝滑
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          },
          ...sx,
        }}
        aria-label="切换主题模式"
      >
        {isDarkMode ? (
          <Brightness7Icon sx={{ color: '#ffb74d' }} /> // 暗黑模式下显示金黄色的太阳，提示可以切到亮色
        ) : (
          <Brightness4Icon sx={{ color: '#5c6bc0' }} /> // 明亮模式下显示深邃的月亮，提示可以切到暗色
        )}
      </IconButton>
    </Tooltip>
  );
}
