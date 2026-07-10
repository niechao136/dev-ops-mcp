import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Box, IconButton, Typography, Divider, Alert, AlertTitle, Dialog, DialogContent } from '@mui/material';
import { Terminal as TerminalIcon, Close, Maximize, Minimize } from '@mui/icons-material';
import { getToken } from '@/utils/cookie';

interface TerminalPanelProps {
  projectId: number;
  workDir: string;
  open: boolean;
  onClose: () => void;
}

export function TerminalPanel({ projectId, workDir, open, onClose }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    console.log('terminal-panel: connect called');
    console.log('terminal-panel: terminalRef.current exists:', !!terminalRef.current);
    
    if (!terminalRef.current) {
      console.log('terminal-panel: terminalRef.current is null, retrying...');
      const retryTimer = setTimeout(() => {
        if (terminalRef.current) {
          connect();
        }
      }, 100);
      return;
    }

    console.log('terminal-panel: creating terminal instance');
    terminalInstanceRef.current = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 8,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      lineHeight: 1.4,
      letterSpacing: 0,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      }
    });

    fitAddonRef.current = new FitAddon();
    terminalInstanceRef.current.loadAddon(fitAddonRef.current);
    terminalInstanceRef.current.open(terminalRef.current);

    fitAddonRef.current.fit();

    terminalInstanceRef.current.onData((data) => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(data);
      }
    });

    terminalInstanceRef.current.onResize((size) => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(`\x00resize:${size.cols}:${size.rows}`);
      }
    });

    const token = await getToken();
    console.log('terminal-panel: got token:', token ? 'token exists' : 'no token');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/projects/${projectId}/terminal?token=${token}`;
    console.log('terminal-panel: connecting to:', wsUrl);

    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      console.log('terminal-panel: WebSocket opened');
      setIsConnected(true);
      setError(null);
    };

    websocketRef.current.onmessage = (event) => {
      console.log('terminal-panel: received data:', event.data.length, 'bytes');
      terminalInstanceRef.current?.write(event.data);
    };

    websocketRef.current.onerror = (event) => {
      console.error('terminal-panel: WebSocket error:', event);
      setError('WebSocket连接错误');
      setIsConnected(false);
    };

    websocketRef.current.onclose = (event) => {
      console.log('terminal-panel: WebSocket closed, code:', event.code, 'reason:', event.reason);
      setIsConnected(false);
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.write('\r\n连接已断开\r\n');
      }
    };
  }, [projectId]);

  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.dispose();
      terminalInstanceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        connect();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [open, connect, disconnect]);

  useEffect(() => {
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };

    const resizeObserver = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMaximized}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 1,
          overflow: 'hidden',
          backgroundColor: '#1e1e1e'
        }
      }}
    >
      <DialogContent sx={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            backgroundColor: '#2d2d2d',
            borderBottom: '1px solid #3d3d3d'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TerminalIcon sx={{ color: '#0dbc79' }} />
            <Typography variant="subtitle1" sx={{ color: '#d4d4d4' }}>
              Terminal - {workDir}
            </Typography>
            {isConnected ? (
              <Typography variant="caption" sx={{ color: '#0dbc79' }}>已连接</Typography>
            ) : (
              <Typography variant="caption" sx={{ color: '#cd3131' }}>未连接</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setIsMaximized(!isMaximized)}
              sx={{ color: '#d4d4d4' }}
            >
              {isMaximized ? <Minimize /> : <Maximize />}
            </IconButton>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: '#cd3131' }}
            >
              <Close />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            <AlertTitle>连接错误</AlertTitle>
            {error}
          </Alert>
        )}

        <Box sx={{ flex: 1, position: 'relative', minHeight: 400 }}>
          <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        </Box>

        <Divider sx={{ backgroundColor: '#3d3d3d' }} />
        <Box sx={{ padding: '4px 16px', backgroundColor: '#2d2d2d' }}>
          <Typography variant="caption" sx={{ color: '#666666' }}>
            按 Ctrl+C 中断命令 | 支持自动补全 | 工作目录: {workDir}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
