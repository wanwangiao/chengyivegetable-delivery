'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  EventAvailable,
  EventBusy,
  Save
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';

import { API_BASE_URL as API_BASE } from '../config/api';

type DateType = 'CLOSED' | 'OPEN';

interface SpecialDate {
  id: string;
  date: string;
  type: DateType;
  reason: string | null;
}

interface BusinessHours {
  id: string;
  regularClosedDays: number[]; // [0, 1, 4] = Sunday, Monday, Thursday
  orderCutoffTime: string;
  preorderStartTime: string;
  currentOrderStartTime: string;
}

interface HolidayCalendarProps {
  token: string;
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export function HolidayCalendar({ token }: HolidayCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogType, setDialogType] = useState<DateType>('CLOSED');
  const [dialogReason, setDialogReason] = useState('');

  // Regular closed days dialog
  const [regularDaysDialogOpen, setRegularDaysDialogOpen] = useState(false);
  const [selectedRegularDays, setSelectedRegularDays] = useState<number[]>([]);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  // 載入營業時間設定
  const loadBusinessHours = async () => {
    try {
      const response = await fetch(`${API_BASE}/business-hours`);
      if (!response.ok) throw new Error('載入營業時間失敗');
      const json = await response.json();
      setBusinessHours(json.data);
      setSelectedRegularDays(json.data.regularClosedDays || []);
    } catch (error) {
      console.error('載入營業時間失敗:', error);
    }
  };

  // 載入特殊日期
  const loadSpecialDates = async (year: number, month: number) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/business-hours/special-dates?year=${year}&month=${month}`);
      if (!response.ok) throw new Error('載入特殊日期失敗');
      const json = await response.json();
      setSpecialDates(json.data);
    } catch (error) {
      console.error('載入特殊日期失敗:', error);
      setMessage({ type: 'error', text: '載入特殊日期失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinessHours();
  }, []);

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    loadSpecialDates(year, month);
  }, [currentMonth]);

  // 日曆格子資料
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // 計算第一天是星期幾，補空白
    const firstDayOfWeek = getDay(start);
    const blanks = Array(firstDayOfWeek).fill(null);

    return [...blanks, ...days];
  }, [currentMonth]);

  // 檢查日期狀態
  const getDateStatus = (date: Date | null) => {
    if (!date) return null;

    // 檢查是否為特殊日期
    const special = specialDates.find(sd => isSameDay(new Date(sd.date), date));
    if (special) return { type: special.type, reason: special.reason, id: special.id };

    // 檢查是否為固定休假日
    const dayOfWeek = getDay(date);
    if (businessHours?.regularClosedDays.includes(dayOfWeek)) {
      return { type: 'REGULAR_CLOSED', reason: '固定休假' };
    }

    return null;
  };

  // 處理日期點擊
  const handleDateClick = (date: Date) => {
    const status = getDateStatus(date);

    if (status?.id) {
      // 如果已經是特殊日期，直接刪除
      handleDeleteSpecialDate(status.id);
    } else {
      // 打開對話框新增特殊日期
      setSelectedDate(date);
      setDialogType(status?.type === 'REGULAR_CLOSED' ? 'OPEN' : 'CLOSED');
      setDialogReason('');
      setDialogOpen(true);
    }
  };

  // 新增特殊日期
  const handleAddSpecialDate = async () => {
    if (!selectedDate) return;

    try {
      const response = await fetch(`${API_BASE}/business-hours/special-dates`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          type: dialogType,
          reason: dialogReason || null
        })
      });

      if (!response.ok) throw new Error('新增失敗');

      setMessage({ type: 'success', text: '✅ 特殊日期已新增' });
      setDialogOpen(false);

      // 重新載入
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      await loadSpecialDates(year, month);
    } catch (error) {
      console.error('新增特殊日期失敗:', error);
      setMessage({ type: 'error', text: '新增特殊日期失敗' });
    }
  };

  // 刪除特殊日期
  const handleDeleteSpecialDate = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/business-hours/special-dates/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) throw new Error('刪除失敗');

      setMessage({ type: 'success', text: '✅ 特殊日期已刪除' });

      // 重新載入
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      await loadSpecialDates(year, month);
    } catch (error) {
      console.error('刪除特殊日期失敗:', error);
      setMessage({ type: 'error', text: '刪除特殊日期失敗' });
    }
  };

  // 儲存固定休假日
  const handleSaveRegularDays = async () => {
    if (!businessHours) return;

    try {
      const response = await fetch(`${API_BASE}/business-hours/${businessHours.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          regularClosedDays: selectedRegularDays
        })
      });

      if (!response.ok) throw new Error('儲存失敗');

      setMessage({ type: 'success', text: '✅ 固定休假日已更新' });
      setRegularDaysDialogOpen(false);
      await loadBusinessHours();
    } catch (error) {
      console.error('儲存固定休假日失敗:', error);
      setMessage({ type: 'error', text: '儲存固定休假日失敗' });
    }
  };

  // 月份導航
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          {/* 標題與操作 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              📅 休假日設定
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setRegularDaysDialogOpen(true)}
              size="small"
            >
              設定固定休假日
            </Button>
          </Box>

          {message && (
            <Alert severity={message.type} onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}

          {/* 圖例 */}
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<EventBusy />}
              label="固定休假"
              size="small"
              sx={{ bgcolor: '#ffebee', color: '#c62828' }}
            />
            <Chip
              icon={<EventBusy />}
              label="特殊休假"
              size="small"
              sx={{ bgcolor: '#f44336', color: 'white' }}
            />
            <Chip
              icon={<EventAvailable />}
              label="特殊營業"
              size="small"
              sx={{ bgcolor: '#4caf50', color: 'white' }}
            />
          </Stack>

          {/* 月份導航 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <IconButton onClick={goToPreviousMonth}>
              <ChevronLeft />
            </IconButton>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">
                {format(currentMonth, 'yyyy 年 M 月', { locale: zhTW })}
              </Typography>
              <Button size="small" onClick={goToCurrentMonth}>
                今天
              </Button>
            </Stack>
            <IconButton onClick={goToNextMonth}>
              <ChevronRight />
            </IconButton>
          </Box>

          {/* 日曆 */}
          <Box>
            {/* 星期標題 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
              {WEEKDAY_NAMES.map((name, i) => (
                <Box
                  key={i}
                  sx={{
                    textAlign: 'center',
                    fontWeight: 600,
                    color: i === 0 ? '#f44336' : i === 6 ? '#2196f3' : 'inherit',
                    py: 1
                  }}
                >
                  {name}
                </Box>
              ))}
            </Box>

            {/* 日期格子 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <Box key={`blank-${index}`} />;
                }

                const status = getDateStatus(date);
                const isCurrentMonth = isSameMonth(date, currentMonth);
                const isToday = isSameDay(date, new Date());

                let bgcolor = 'transparent';
                let color = 'inherit';
                let borderColor = 'transparent';

                if (!isCurrentMonth) {
                  color = '#bdbdbd';
                } else if (status?.type === 'CLOSED') {
                  bgcolor = '#f44336';
                  color = 'white';
                } else if (status?.type === 'OPEN') {
                  bgcolor = '#4caf50';
                  color = 'white';
                } else if (status?.type === 'REGULAR_CLOSED') {
                  bgcolor = '#ffebee';
                  color = '#c62828';
                }

                if (isToday) {
                  borderColor = '#2196f3';
                }

                return (
                  <Box
                    key={index}
                    onClick={() => isCurrentMonth && handleDateClick(date)}
                    sx={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor,
                      color,
                      border: `2px solid ${borderColor}`,
                      borderRadius: 1,
                      cursor: isCurrentMonth ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      '&:hover': isCurrentMonth ? {
                        transform: 'scale(1.05)',
                        boxShadow: 2
                      } : {}
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: isToday ? 700 : 400 }}>
                      {format(date, 'd')}
                    </Typography>
                    {status?.reason && (
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', mt: 0.5 }}>
                        {status.reason}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* 說明 */}
          <Typography variant="caption" color="text.secondary">
            💡 提示：點擊日期可新增或移除特殊日期。固定休假日可在上方按鈕設定。
          </Typography>
        </Stack>
      </CardContent>

      {/* 新增/編輯特殊日期對話框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {selectedDate ? format(selectedDate, 'yyyy 年 M 月 d 日') : ''} - 設定特殊日期
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl>
              <FormLabel>類型</FormLabel>
              <Stack direction="row" spacing={1}>
                <Button
                  variant={dialogType === 'CLOSED' ? 'contained' : 'outlined'}
                  color="error"
                  onClick={() => setDialogType('CLOSED')}
                  startIcon={<EventBusy />}
                >
                  休假
                </Button>
                <Button
                  variant={dialogType === 'OPEN' ? 'contained' : 'outlined'}
                  color="success"
                  onClick={() => setDialogType('OPEN')}
                  startIcon={<EventAvailable />}
                >
                  營業
                </Button>
              </Stack>
            </FormControl>

            <TextField
              fullWidth
              label="原因說明（選填）"
              value={dialogReason}
              onChange={(e) => setDialogReason(e.target.value)}
              placeholder="例如：春節休假、補班日營業"
              helperText="會顯示在日曆上"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleAddSpecialDate} variant="contained">
            確定
          </Button>
        </DialogActions>
      </Dialog>

      {/* 固定休假日設定對話框 */}
      <Dialog
        open={regularDaysDialogOpen}
        onClose={() => setRegularDaysDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>設定固定休假日</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              選擇每週固定休息的日子
            </Typography>
            <FormGroup>
              {WEEKDAY_NAMES.map((name, index) => (
                <FormControlLabel
                  key={index}
                  control={
                    <Checkbox
                      checked={selectedRegularDays.includes(index)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRegularDays([...selectedRegularDays, index]);
                        } else {
                          setSelectedRegularDays(selectedRegularDays.filter(d => d !== index));
                        }
                      }}
                    />
                  }
                  label={`星期${name}`}
                />
              ))}
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegularDaysDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleSaveRegularDays}
            variant="contained"
            startIcon={<Save />}
          >
            儲存
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
