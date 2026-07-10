import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormLabel,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Grid,
  Switch,
  FormGroup,
  FormControlLabel,
  SelectChangeEvent,
  Divider
} from '@mui/material';
import type { AutomationInfo, AutomationAdd, AutomationUpdate, CommandInfo } from '@/types/api';

interface AutomationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: AutomationAdd | AutomationUpdate) => void;
  projectId: number;
  commands: CommandInfo[];
  automation?: AutomationInfo | null;
}

const CRON_PRESETS = [
  { label: '每小时', cron: '0 * * * *', description: '每小时整点执行' },
  { label: '每天 02:00', cron: '0 2 * * *', description: '每天凌晨 2:00 执行' },
  { label: '每天 08:00', cron: '0 8 * * *', description: '每天早上 8:00 执行' },
  { label: '每天 12:00', cron: '0 12 * * *', description: '每天中午 12:00 执行' },
  { label: '每天 18:00', cron: '0 18 * * *', description: '每天下午 18:00 执行' },
  { label: '每天 22:00', cron: '0 22 * * *', description: '每天晚上 22:00 执行' },
  { label: '每周一 02:00', cron: '0 2 * * 1', description: '每周一凌晨 2:00 执行' },
  { label: '每周五 18:00', cron: '0 18 * * 5', description: '每周五下午 18:00 执行' },
  { label: '每月1日 02:00', cron: '0 2 1 * *', description: '每月1日凌晨 2:00 执行' },
  { label: '自定义', cron: '', description: '手动输入 cron 表达式' }
];

const INTERVAL_PRESETS = [
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '10分钟', value: 600 },
  { label: '15分钟', value: 900 },
  { label: '30分钟', value: 1800 },
  { label: '1小时', value: 3600 },
  { label: '2小时', value: 7200 },
  { label: '自定义', value: -1 }
];

export function AutomationDialog({
  open,
  onClose,
  onSave,
  projectId,
  commands,
  automation
}: AutomationDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    trigger_type: 'cron' as 'cron' | 'condition',
    cron_expression: '',
    cron_preset: '',
    condition_script: '',
    condition_interval: 60,
    condition_interval_preset: '',
    command_id: 0,
    is_enabled: true
  });

  useEffect(() => {
    if (automation) {
      const preset = CRON_PRESETS.find(p => p.cron === automation.cron_expression);
      const intervalValue = automation.condition_interval ?? 60;
      const intervalPreset = INTERVAL_PRESETS.find(p => p.value === intervalValue);
      setFormData({
        name: automation.name,
        trigger_type: automation.trigger_type,
        cron_expression: automation.cron_expression || '',
        cron_preset: preset?.label || '自定义',
        condition_script: automation.condition_script || '',
        condition_interval: intervalValue,
        condition_interval_preset: intervalPreset?.label || '自定义',
        command_id: automation.command_id,
        is_enabled: automation.is_enabled
      });
    } else {
      setFormData({
        name: '',
        trigger_type: 'cron',
        cron_expression: '',
        cron_preset: '',
        condition_script: '',
        condition_interval: 60,
        condition_interval_preset: '',
        command_id: 0,
        is_enabled: true
      });
    }
  }, [open, automation]);

  const handleCronPresetChange = (event: SelectChangeEvent) => {
    const preset = CRON_PRESETS.find(p => p.label === event.target.value);
    setFormData(prev => ({
      ...prev,
      cron_preset: event.target.value,
      cron_expression: preset?.cron || ''
    }));
  };

  const handleIntervalPresetChange = (event: SelectChangeEvent) => {
    const preset = INTERVAL_PRESETS.find(p => p.label === event.target.value);
    setFormData(prev => ({
      ...prev,
      condition_interval_preset: event.target.value,
      condition_interval: preset?.value === -1 ? prev.condition_interval : (preset?.value || 60)
    }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }
    if (!formData.command_id) {
      return;
    }
    if (formData.trigger_type === 'cron' && !formData.cron_expression.trim()) {
      return;
    }
    if (formData.trigger_type === 'condition' && !formData.condition_script.trim()) {
      return;
    }

    const data = automation
      ? ({
        name: formData.name.trim(),
        trigger_type: formData.trigger_type,
        cron_expression: formData.trigger_type === 'cron' ? formData.cron_expression.trim() : undefined,
        condition_script: formData.trigger_type === 'condition' ? formData.condition_script.trim() : undefined,
        condition_interval: formData.trigger_type === 'condition' ? formData.condition_interval : undefined,
        command_id: formData.command_id,
        is_enabled: formData.is_enabled
      } as AutomationUpdate)
      : ({
        project_id: projectId,
        name: formData.name.trim(),
        trigger_type: formData.trigger_type,
        cron_expression: formData.trigger_type === 'cron' ? formData.cron_expression.trim() : undefined,
        condition_script: formData.trigger_type === 'condition' ? formData.condition_script.trim() : undefined,
        condition_interval: formData.trigger_type === 'condition' ? formData.condition_interval : undefined,
        command_id: formData.command_id,
        is_enabled: formData.is_enabled
      } as AutomationAdd);

    onSave(data);
    onClose();
  };

  const getCronDescription = (cronExpr: string) => {
    const preset = CRON_PRESETS.find(p => p.cron === cronExpr);
    if (preset) return preset.description;

    const parts = cronExpr.trim().split(' ');
    if (parts.length !== 5) return '无效的 cron 表达式';

    const [minute, hour, day, month, dow] = parts;
    let description = '定时执行: ';

    if (minute === '0') {
      description += `${hour === '*' ? '每小时' : `每天 ${hour.padStart(2, '0')}:00`}`;
    } else if (minute !== '*') {
      description += `${hour === '*' ? '每小时' : `每天 ${hour.padStart(2, '0')}`}:${minute.padStart(2, '0')}`;
    }

    if (day !== '*') {
      description += `，每月${day}日`;
    }

    if (dow !== '*') {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      if (dow.match(/^\d$/)) {
        description += `，每周${days[parseInt(dow)]}`;
      } else {
        description += `，每周${dow}`;
      }
    }

    return description;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {automation ? '编辑自动化规则' : '新建自动化规则'}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <TextField
              fullWidth
              label="规则名称"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="输入规则名称"
            />
          </Grid>

          <Grid size={12}>
            <FormControl fullWidth>
              <InputLabel>触发类型</InputLabel>
              <Select
                label="触发类型"
                value={formData.trigger_type}
                onChange={(e) => setFormData(prev => ({ ...prev, trigger_type: e.target.value as 'cron' | 'condition' }))}
              >
                <MenuItem value="cron">定时触发</MenuItem>
                <MenuItem value="condition">条件触发</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {formData.trigger_type === 'cron' && (
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>执行频率</InputLabel>
                <Select
                  label="执行频率"
                  value={formData.cron_preset}
                  onChange={handleCronPresetChange}
                >
                  {CRON_PRESETS.map(preset => (
                    <MenuItem key={preset.label} value={preset.label}>
                      {preset.label}
                      {preset.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                          {preset.description}
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Cron 表达式"
                value={formData.cron_expression}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    cron_expression: e.target.value,
                    cron_preset: '自定义'
                  }));
                }}
                placeholder="例如: 0 2 * * *"
                sx={{ mt: 2 }}
              />
              {formData.cron_expression && (
                <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                  {getCronDescription(formData.cron_expression)}
                </Typography>
              )}
            </Grid>
          )}

          {formData.trigger_type === 'condition' && (
            <Grid size={12}>
              <TextField
                fullWidth
                label="检查脚本"
                value={formData.condition_script}
                onChange={(e) => setFormData(prev => ({ ...prev, condition_script: e.target.value }))}
                multiline
                rows={4}
                placeholder="输入检查脚本，exit code 为 0 时触发执行命令\n\n例如:\ncurl -f http://localhost:8080/health"
                required
              />
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>检查间隔</InputLabel>
                <Select
                  label="检查间隔"
                  value={formData.condition_interval_preset}
                  onChange={handleIntervalPresetChange}
                >
                  {INTERVAL_PRESETS.map(preset => (
                    <MenuItem key={preset.label} value={preset.label}>
                      {preset.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {formData.condition_interval_preset === '自定义' && (
                <TextField
                  fullWidth
                  label="自定义间隔（秒）"
                  type="number"
                  value={formData.condition_interval}
                  onChange={(e) => setFormData(prev => ({ ...prev, condition_interval: parseInt(e.target.value) || 60 }))}
                  sx={{ mt: 2 }}
                />
              )}
            </Grid>
          )}

          <Grid size={12}>
            <FormControl fullWidth>
              <InputLabel>执行命令</InputLabel>
              <Select
                label="执行命令"
                value={formData.command_id}
                onChange={(e) => setFormData(prev => ({ ...prev, command_id: e.target.value as number }))}
                required
              >
                {commands.map(cmd => (
                  <MenuItem key={cmd.id} value={cmd.id}>
                    {cmd.action_type}
                    {cmd.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                        {cmd.description}
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={12}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
                  />
                }
                label="启用规则"
              />
            </FormGroup>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained">
          {automation ? '保存' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
