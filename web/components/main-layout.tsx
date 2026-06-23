'use client';

import { ReactNode, useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Logout,
  AccountCircle,
  Storage,
  Security,
  People,
  History,
  Lock,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/auth-query';
import { useRouter } from 'next/navigation';
import { useColorMode } from '@/providers/root-provider';
import ToggleThemeButton from './base/toggle-theme';
import { apiService } from '@/services/api';


const drawerWidth = 240;


const menuItems = [
  { text: '仪表板', icon: <Dashboard />, path: '/' },
  { text: '用户管理', icon: <People />, path: '/users' },
  { text: '项目管理', icon: <Storage />, path: '/projects' },
  { text: 'API Key 管理', icon: <Security />, path: '/api-keys' },
  { text: '操作日志', icon: <History />, path: '/audit-logs' },
];


interface MainLayoutProps {
  children: ReactNode;
}


export default function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { user, logout } = useAuth();
  const router = useRouter();


  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };


  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };


  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };


  const handleLogout = () => {
    logout();
    handleCloseUserMenu();
    router.push('/login');
  };


  const handleChangePassword = () => {
    handleCloseUserMenu();
    setPasswordDialogOpen(true);
  };


  const handleSubmitPassword = async () => {
    if (!oldPassword || !newPassword) {
      return;
    }
    
    try {
      const result = await apiService.changeMyPassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      
      if (result.status === 1) {
        setPasswordDialogOpen(false);
        setOldPassword('');
        setNewPassword('');
        logout();
        router.push('/login');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
    }
  };


  const handleNavigate = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };


  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          DevOps MCP
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton onClick={() => handleNavigate(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );


  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            运维管理平台
          </Typography>

          <ToggleThemeButton sx={{ mr: 2 }} />

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="用户设置">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  {user?.username?.charAt(0).toUpperCase() || <AccountCircle />}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              <MenuItem disabled>
                <ListItemIcon>
                  <AccountCircle fontSize="small" />
                </ListItemIcon>
                <ListItemText>{user?.username}</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleChangePassword}>
                <ListItemIcon>
                  <Lock fontSize="small" />
                </ListItemIcon>
                <ListItemText>修改密码</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText>退出登录</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
      >
        <Toolbar />
        {children}
      </Box>

      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>修改密码</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="旧密码"
              fullWidth
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入当前密码"
            />
            <TextField
              label="新密码"
              fullWidth
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>取消</Button>
          <Button onClick={handleSubmitPassword} variant="contained">
            修改
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
