'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  Divider,
  Stack,
  Alert,
  Box,
  Chip
} from '@mui/material';
import { Schedule, Message } from '@mui/icons-material';

import { API_BASE_URL as API_BASE } from '../config/api';

interface BusinessHours {
  id: string;
  regularClosedDays: number[];
  orderCutoffTime: string;
  preorderStartTime: string;
  currentOrderStartTime: string;
  currentDayMessage: string;
  nextDayMessage: string;
  preparationMessage: string;
  beforeOpenMessage: string;
  closedDayMessage: string;
}

interface BusinessHoursSettingsProps {
  token: string;
  onUpdate?: () => void;
}

export function BusinessHoursSettings({ token, onUpdate }: BusinessHoursSettingsProps) {
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // 載入營業時間設定
  const loadBusinessHours = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/business-hours`, { headers });
      if (!response.ok) throw new Error('載入營業時間失敗');
      const json = await response.json();
      setBusinessHours(json.data);
    } catch (error) {
      console.error('載入營業時間失敗:', error);
      setMessage({ type: 'error', text: '載入營業時間失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinessHours();
  }, []);

  // 處理欄位變更
  const handleChange = (field: keyof BusinessHours, value: string) => {
    if (!businessHours) return;
    setBusinessHours({ ...businessHours, [field]: value });
  };

  // 自動儲存（debounce）
  useEffect(() => {
    if (!businessHours) return;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/business-hours/${businessHours.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            orderCutoffTime: businessHours.orderCutoffTime,
            preorderStartTime: businessHours.preorderStartTime,
            currentOrderStartTime: businessHours.currentOrderStartTime,
            currentDayMessage: businessHours.currentDayMessage,
            nextDayMessage: businessHours.nextDayMessage,
            preparationMessage: businessHours.preparationMessage,
            beforeOpenMessage: businessHours.beforeOpenMessage,
            closedDayMessage: businessHours.closedDayMessage
          })
        });

        if (!response.ok) throw new Error('儲存失敗');

        setMessage({ type: 'success', text: '✅ 設定已自動儲存' });
        if (onUpdate) onUpdate();

        // 3 秒後清除成功訊息
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('儲存失敗:', error);
        setMessage({ type: 'error', text: '儲存失敗' });
      }
    }, 1000); // 1 秒延遲自動儲存

    return () => clearTimeout(timer);
  }, [businessHours, headers, onUpdate]);

  if (loading || !businessHours) {
    return (
      <Card>
        <CardContent>
          <Typography>載入中...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          {/* 標題 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              ⏰ 營業時段設定
            </Typography>
            <Chip
              label="自動儲存"
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>

          {message && (
            <Alert severity={message.type} onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            設定每個營業時段的時間與顯示訊息。變更會在 1 秒後自動儲存。
          </Typography>

          <Divider />

          {/* 時段 1：當日訂單 */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Schedule color="success" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                時段 1：當日訂單開放
              </Typography>
              <Chip label="可下單" size="small" color="success" />
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="開始時間"
                  type="time"
                  value={businessHours.currentOrderStartTime}
                  onChange={(e) => handleChange('currentOrderStartTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="開始接受當日訂單的時間"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="結束時間"
                  type="time"
                  value={businessHours.orderCutoffTime}
                  onChange={(e) => handleChange('orderCutoffTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="當日訂單截止時間"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="顯示訊息"
                  value={businessHours.currentDayMessage}
                  onChange={(e) => handleChange('currentDayMessage', e.target.value)}
                  placeholder="例如：當日訂單開放中，10:00 前下單今日配送"
                  helperText="前台會顯示此訊息給顧客"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* 時段 2：備貨準備 */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Schedule color="disabled" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                時段 2：備貨準備中
              </Typography>
              <Chip label="不可下單" size="small" color="default" />
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="開始時間"
                  type="time"
                  value={businessHours.orderCutoffTime}
                  disabled
                  InputLabelProps={{ shrink: true }}
                  helperText="= 當日訂單結束時間"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="結束時間"
                  type="time"
                  value={businessHours.preorderStartTime}
                  disabled
                  InputLabelProps={{ shrink: true }}
                  helperText="= 隔日預訂開始時間"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="顯示訊息"
                  value={businessHours.preparationMessage}
                  onChange={(e) => handleChange('preparationMessage', e.target.value)}
                  placeholder="例如：準備中，下午 2:00 開放明日預訂"
                  helperText="此時段不接受訂單"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* 時段 3：隔日預訂 */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Schedule color="info" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                時段 3：隔日預訂開放
              </Typography>
              <Chip label="可下單" size="small" color="info" />
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="開始時間"
                  type="time"
                  value={businessHours.preorderStartTime}
                  onChange={(e) => handleChange('preorderStartTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="開始接受隔日訂單的時間"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="結束時間"
                  type="time"
                  value="23:59"
                  disabled
                  InputLabelProps={{ shrink: true }}
                  helperText="固定到當日結束"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="顯示訊息"
                  value={businessHours.nextDayMessage}
                  onChange={(e) => handleChange('nextDayMessage', e.target.value)}
                  placeholder="例如：明日配送預訂開放中"
                  helperText="明天配送的訂單"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* 時段 4：凌晨準備 */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Schedule color="disabled" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                時段 4：凌晨準備中
              </Typography>
              <Chip label="不可下單" size="small" color="default" />
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="開始時間"
                  type="time"
                  value="00:00"
                  disabled
                  InputLabelProps={{ shrink: true }}
                  helperText="固定從午夜開始"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="結束時間"
                  type="time"
                  value={businessHours.currentOrderStartTime}
                  disabled
                  InputLabelProps={{ shrink: true }}
                  helperText="= 當日訂單開始時間"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="顯示訊息"
                  value={businessHours.beforeOpenMessage}
                  onChange={(e) => handleChange('beforeOpenMessage', e.target.value)}
                  placeholder="例如：準備中，早上 7:30 開放當日訂單"
                  helperText="尚未開始營業"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* 時段 5：休息日 */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Schedule color="error" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                時段 5：休息日
              </Typography>
              <Chip label="全天休息" size="small" color="error" />
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="顯示訊息"
                  value={businessHours.closedDayMessage}
                  onChange={(e) => handleChange('closedDayMessage', e.target.value)}
                  placeholder="例如：今日店休"
                  helperText="固定休假日或特殊休假時顯示（特殊休假可在休假日日曆設定原因）"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>

          {/* 說明 */}
          <Alert severity="info">
            💡 提示：修改後會在 1 秒後自動儲存。前台顧客會立即看到更新後的時段與訊息。
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
}
