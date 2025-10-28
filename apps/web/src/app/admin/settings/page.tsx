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
  Typography,
  Avatar
} from '@mui/material';
import { Refresh, Save, CloudUpload, Image as ImageIcon } from '@mui/icons-material';
import { ImageCropModal } from '../../../components/ImageCropModal';
import { HolidayCalendar } from '../../../components/HolidayCalendar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

type SystemConfig = {
  storeName: string;
  storeSlogan: string;
  storeLogo: string | null;
  storePhone: string | null;
  currentOrderStartTime: string;
  currentOrderEndTime: string;
  preOrderStartTime: string;
  preOrderEndTime: string;
  priceChangeThreshold: number;
  priceConfirmTimeout: number;
  lineNotificationEnabled: boolean;
};

type ConfigFormState = {
  storeName: string;
  storeSlogan: string;
  storeLogo: string | null;
  storePhone: string;
  currentOrderStartTime: string;
  currentOrderEndTime: string;
  preOrderStartTime: string;
  preOrderEndTime: string;
  priceChangeThreshold: string;
  priceConfirmTimeout: string;
  lineNotificationEnabled: boolean;
};

const toFormState = (config: SystemConfig): ConfigFormState => ({
  storeName: config.storeName,
  storeSlogan: config.storeSlogan,
  storeLogo: config.storeLogo,
  storePhone: config.storePhone || '',
  currentOrderStartTime: config.currentOrderStartTime,
  currentOrderEndTime: config.currentOrderEndTime,
  preOrderStartTime: config.preOrderStartTime,
  preOrderEndTime: config.preOrderEndTime,
  priceChangeThreshold: String(config.priceChangeThreshold),
  priceConfirmTimeout: String(config.priceConfirmTimeout),
  lineNotificationEnabled: config.lineNotificationEnabled
});

export default function AdminSettingsPage() {
  const [token, setToken] = useState('');
  const [config, setConfig] = useState<ConfigFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');

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
      setMessage({ type: 'error', text: '請先登入管理員帳號' });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/settings`, { headers });
      if (!response.ok) throw new Error('讀取系統設定失敗，請確認權限');
      const json = (await response.json()) as { data: SystemConfig };
      setConfig(toFormState(json.data));
      setMessage(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '系統發生未知錯誤';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) return;
    loadConfig().catch(() => undefined);
  }, [headers, loadConfig]);

  const handleSave = async () => {
    if (!config || !headers) return;

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeName: config.storeName,
          storeSlogan: config.storeSlogan,
          storePhone: config.storePhone || null,
          currentOrderStartTime: config.currentOrderStartTime,
          currentOrderEndTime: config.currentOrderEndTime,
          preOrderStartTime: config.preOrderStartTime,
          preOrderEndTime: config.preOrderEndTime,
          priceChangeThreshold: parseFloat(config.priceChangeThreshold),
          priceConfirmTimeout: parseInt(config.priceConfirmTimeout, 10),
          lineNotificationEnabled: config.lineNotificationEnabled
        })
      });

      if (!response.ok) throw new Error('儲存失敗');

      setMessage({ type: 'success', text: '✅ 設定已成功儲存' });
      await loadConfig();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '儲存時發生錯誤';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 讀取圖片為 Data URL
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);

    // 清空 input，允許重複選擇同一個檔案
    event.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!headers) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('logo', croppedBlob, 'logo.png');

      const response = await fetch(`${API_BASE}/admin/settings/upload-logo`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) throw new Error('LOGO 上傳失敗');

      setMessage({ type: 'success', text: '✅ LOGO 上傳成功' });

      // 重新載入設定
      await loadConfig();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'LOGO 上傳失敗';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setUploading(false);
    }
  };

  if (!config) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          系統設定
        </Typography>
        {loading ? (
          <Typography>載入中...</Typography>
        ) : (
          <Alert severity="info">請先登入管理員帳號</Alert>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        系統設定
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 品牌設定 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                📝 品牌設定
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="店名"
                    value={config.storeName}
                    onChange={(e) => setConfig({ ...config, storeName: e.target.value })}
                    helperText="在前台頁面顯示的店名"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="副標題"
                    value={config.storeSlogan}
                    onChange={(e) => setConfig({ ...config, storeSlogan: e.target.value })}
                    helperText="店名下方的宣傳標語"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    LOGO 圖片
                  </Typography>

                  <Stack direction="row" spacing={3} alignItems="center">
                    {config.storeLogo ? (
                      <Avatar
                        src={config.storeLogo}
                        alt="店家 LOGO"
                        sx={{ width: 100, height: 100, border: '2px solid #e0e0e0' }}
                      />
                    ) : (
                      <Avatar
                        sx={{
                          width: 100,
                          height: 100,
                          bgcolor: '#f5f5f5',
                          border: '2px dashed #ccc'
                        }}
                      >
                        <ImageIcon sx={{ fontSize: 40, color: '#999' }} />
                      </Avatar>
                    )}

                    <Stack spacing={1}>
                      <Button
                        variant="contained"
                        component="label"
                        startIcon={<CloudUpload />}
                        disabled={uploading}
                      >
                        {uploading ? '上傳中...' : '上傳 LOGO'}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={handleLogoSelect}
                        />
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        建議尺寸：400x400 像素，圓形透明背景
                      </Typography>
                    </Stack>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="客服電話"
                    value={config.storePhone}
                    onChange={(e) => setConfig({ ...config, storePhone: e.target.value })}
                    helperText="選填，顯示在前台的聯絡電話"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 營業時間設定 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                ⏰ 營業時間設定
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    當日訂單時段
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    客戶可下單當日配送的時間範圍
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <TextField
                        fullWidth
                        label="開始時間"
                        type="time"
                        value={config.currentOrderStartTime}
                        onChange={(e) =>
                          setConfig({ ...config, currentOrderStartTime: e.target.value })
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <TextField
                        fullWidth
                        label="結束時間"
                        type="time"
                        value={config.currentOrderEndTime}
                        onChange={(e) =>
                          setConfig({ ...config, currentOrderEndTime: e.target.value })
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    預訂時段
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    客戶可預訂隔天配送的時間範圍
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <TextField
                        fullWidth
                        label="開始時間"
                        type="time"
                        value={config.preOrderStartTime}
                        onChange={(e) =>
                          setConfig({ ...config, preOrderStartTime: e.target.value })
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <TextField
                        fullWidth
                        label="結束時間"
                        type="time"
                        value={config.preOrderEndTime}
                        onChange={(e) =>
                          setConfig({ ...config, preOrderEndTime: e.target.value })
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 價格與通知設定 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                💰 價格與通知設定
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="價格變動閾值（%）"
                    type="number"
                    value={config.priceChangeThreshold}
                    onChange={(e) =>
                      setConfig({ ...config, priceChangeThreshold: e.target.value })
                    }
                    helperText="超過此百分比變動時發送通知給客戶"
                    inputProps={{ min: 0, max: 100, step: 1 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="價格確認超時（分鐘）"
                    type="number"
                    value={config.priceConfirmTimeout}
                    onChange={(e) =>
                      setConfig({ ...config, priceConfirmTimeout: e.target.value })
                    }
                    helperText="客戶未回應時自動接受新價格的等待時間"
                    inputProps={{ min: 1, max: 180, step: 1 }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.lineNotificationEnabled}
                        onChange={(e) =>
                          setConfig({ ...config, lineNotificationEnabled: e.target.checked })
                        }
                      />
                    }
                    label="啟用 LINE 通知"
                  />
                  <Typography variant="caption" color="text.secondary" display="block">
                    訂單狀態變更時自動發送 LINE 訊息給客戶
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 休假日設定 */}
        <Grid item xs={12}>
          {token && <HolidayCalendar token={token} />}
        </Grid>

        {/* 操作按鈕 */}
        <Grid item xs={12}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving || loading}
              size="large"
            >
              {saving ? '儲存中...' : '儲存設定'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadConfig}
              disabled={loading}
              size="large"
            >
              重新載入
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {/* LOGO 裁切 Modal */}
      <ImageCropModal
        open={cropModalOpen}
        imageSrc={selectedImageSrc}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </Box>
  );
}
