'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { Refresh, Save } from '@mui/icons-material';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

type SystemConfig = {
  storeName: string;
  storePhone: string;
  sameDayOrderStartTime: string;
  sameDayOrderEndTime: string;
  nextDayOrderStartTime: string;
  nextDayOrderEndTime: string;
  priceChangeThreshold: number;
  priceChangeTimeoutHours: number;
  lineNotifyEnabled: boolean;
};

type ConfigFormState = {
  storeName: string;
  storePhone: string;
  sameDayOrderStartTime: string;
  sameDayOrderEndTime: string;
  nextDayOrderStartTime: string;
  nextDayOrderEndTime: string;
  priceChangeThreshold: string;
  priceChangeTimeoutHours: string;
  lineNotifyEnabled: boolean;
};

const toFormState = (config: SystemConfig): ConfigFormState => ({
  storeName: config.storeName,
  storePhone: config.storePhone,
  sameDayOrderStartTime: config.sameDayOrderStartTime,
  sameDayOrderEndTime: config.sameDayOrderEndTime,
  nextDayOrderStartTime: config.nextDayOrderStartTime,
  nextDayOrderEndTime: config.nextDayOrderEndTime,
  priceChangeThreshold: String(config.priceChangeThreshold),
  priceChangeTimeoutHours: String(config.priceChangeTimeoutHours),
  lineNotifyEnabled: config.lineNotifyEnabled
});

export default function AdminSettingsPage() {
  const [token, setToken] = useState('');
  const [config, setConfig] = useState<ConfigFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('chengyi_admin_token');
    if (savedToken) setToken(savedToken);
  }, []);

  const headers = useMemo(() => {
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` } as Record<string, string>;
  }, [token]);

  const loadConfig = useCallback(async () => {
    if (!headers) {
      setMessage('請先輸入有效的管理員 JWT Token');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/settings`, { headers });
      if (!response.ok) throw new Error('讀取系統設定失敗，請確認權限或 API 狀態');
      const json = await response.json() as { data: SystemConfig };
      setConfig(toFormState(json.data));
      setMessage(null);
    } catch (error: any) {
      setMessage(error?.message ?? '系統發生未知錯誤');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) return;
    loadConfig().catch(() => undefined);
  }, [headers, loadConfig]);

  const saveToken = () => {
    window.localStorage.setItem('chengyi_admin_token', token);
    loadConfig().catch(() => undefined);
  };

  const updateField = <K extends keyof ConfigFormState>(key: K, value: ConfigFormState[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const handleSave = async () => {
    if (!config || !headers) {
      setMessage('請先完成登入驗證');
      return;
    }

    const payload = {
      storeName: config.storeName.trim(),
      storePhone: config.storePhone.trim(),
      sameDayOrderStartTime: config.sameDayOrderStartTime,
      sameDayOrderEndTime: config.sameDayOrderEndTime,
      nextDayOrderStartTime: config.nextDayOrderStartTime,
      nextDayOrderEndTime: config.nextDayOrderEndTime,
      priceChangeThreshold: Number(config.priceChangeThreshold),
      priceChangeTimeoutHours: Number(config.priceChangeTimeoutHours),
      lineNotifyEnabled: config.lineNotifyEnabled
    };

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? '更新系統設定失敗');
      }
      const json = await response.json() as { data: SystemConfig };
      setConfig(toFormState(json.data));
      setMessage('系統設定已更新');
    } catch (error: any) {
      setMessage(error?.message ?? '儲存時發生錯誤');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box p={{ xs: 2, md: 4 }} display="flex" flexDirection="column" gap={3}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={600} gutterBottom sx={{ color: '#2C3E50' }}>
            系統設定
          </Typography>
          <Typography color="text.secondary">
            管理店家基本資訊、接單時間與通知設定
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
          <TextField
            label="管理員 JWT Token"
            value={token}
            onChange={event => setToken(event.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 320 } }}
            size="small"
          />
          <Button variant="contained" onClick={saveToken} startIcon={<Save />} sx={{ bgcolor: '#2C3E50' }}>
            儲存 Token
          </Button>
        </Stack>
      </Stack>

      {/* Status Message */}
      {message && <Alert severity="info">{message}</Alert>}

      {/* Config Form */}
      {config && (
        <Stack spacing={3}>
          {/* Basic Info */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: '#2C3E50' }}>
                基本資訊
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                設定店家名稱與聯絡電話
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="店家名稱"
                    value={config.storeName}
                    onChange={event => updateField('storeName', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="店家電話"
                    value={config.storePhone}
                    onChange={event => updateField('storePhone', event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Order Time Settings */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: '#2C3E50' }}>
                接單時間設定
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                設定當日訂單與預訂單的接單時段
              </Typography>

              <Stack spacing={3}>
                {/* Same Day Orders */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    當日訂單時段
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    顧客可下單購買當天配送的商品
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="開始時間"
                        type="time"
                        value={config.sameDayOrderStartTime}
                        onChange={event => updateField('sameDayOrderStartTime', event.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="結束時間"
                        type="time"
                        value={config.sameDayOrderEndTime}
                        onChange={event => updateField('sameDayOrderEndTime', event.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Next Day Orders */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    預訂單時段
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    顧客可預訂隔天配送的商品
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="開始時間"
                        type="time"
                        value={config.nextDayOrderStartTime}
                        onChange={event => updateField('nextDayOrderStartTime', event.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="結束時間"
                        type="time"
                        value={config.nextDayOrderEndTime}
                        onChange={event => updateField('nextDayOrderEndTime', event.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Price Change Alert Settings */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: '#2C3E50' }}>
                價格變動通知設定
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                當預訂單商品價格變動超過設定閾值時，系統將通知顧客
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="價格變動閾值 (%)"
                    type="number"
                    value={config.priceChangeThreshold}
                    onChange={event => updateField('priceChangeThreshold', event.target.value)}
                    fullWidth
                    helperText="當價格變動超過此百分比時觸發通知"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="通知超時時間 (小時)"
                    type="number"
                    value={config.priceChangeTimeoutHours}
                    onChange={event => updateField('priceChangeTimeoutHours', event.target.value)}
                    fullWidth
                    helperText="若顧客未回應，超過此時間後自動取消訂單"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: '#2C3E50' }}>
                通知設定
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                管理系統通知功能的開關
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.lineNotifyEnabled}
                    onChange={event => updateField('lineNotifyEnabled', event.target.checked)}
                  />
                }
                label="啟用 LINE 通知"
              />
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                關閉後，系統將不會發送任何 LINE 通知訊息
              </Typography>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => loadConfig()}
              disabled={loading}
            >
              重新載入
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
              sx={{ bgcolor: '#2C3E50' }}
            >
              {saving ? '儲存中...' : '儲存變更'}
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Loading State */}
      {loading && !config && (
        <Card>
          <CardContent>
            <Typography align="center" color="text.secondary">
              載入中...
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
