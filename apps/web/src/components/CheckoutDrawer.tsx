'use client';

import { useState } from 'react';
import {
  Drawer,
  IconButton,
  Button,
  Box,
  Typography,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Collapse,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { type CartItem } from '../hooks/useCart';

type CheckoutDrawerProps = {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  onSubmit: (data: CheckoutFormData) => Promise<void>;
};

export type CheckoutFormData = {
  contactName: string;
  contactPhone: string;
  address: string;
  notes?: string;
  paymentMethod: string;
};

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 現金付款' },
  { value: 'transfer', label: '🏦 銀行轉帳' },
  { value: 'line_pay', label: '💳 LINE Pay' },
  { value: 'credit', label: '💳 信用卡' },
];

export function CheckoutDrawer({
  open,
  onClose,
  onBack,
  items,
  subtotal,
  deliveryFee,
  totalAmount,
  onSubmit,
}: CheckoutDrawerProps) {
  const [formData, setFormData] = useState<CheckoutFormData>({
    contactName: '',
    contactPhone: '',
    address: '',
    notes: '',
    paymentMethod: 'cash',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // 載入已儲存的客戶資料
  useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('customerData');
        if (saved) {
          const parsed = JSON.parse(saved);
          setFormData(prev => ({
            ...prev,
            contactName: parsed.name || prev.contactName,
            contactPhone: parsed.phone || prev.contactPhone,
            address: parsed.address || prev.address,
            paymentMethod: parsed.paymentMethod || prev.paymentMethod,
          }));
        }
      } catch (error) {
        console.error('Failed to load saved customer data:', error);
      }
    }
  });

  const handleChange = (field: keyof CheckoutFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          maxHeight: '70vh',
          '@media (min-width: 768px)': {
            maxHeight: '80vh',
          },
        },
      }}
      PaperProps={{
        sx: {
          '@media (min-width: 768px)': {
            // 桌面端右側 - 與購物車相同
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            maxHeight: '100vh',
            width: '450px',
            borderTopLeftRadius: '16px',
            borderBottomLeftRadius: '16px',
            borderTopRightRadius: 0,
          },
        },
      }}
    >
      {/* 標題列 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={onBack} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            結帳
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 表單內容 - 可滾動 */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* 配送資訊 */}
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            📋 配送資訊
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="收件人姓名"
              required
              value={formData.contactName}
              onChange={handleChange('contactName')}
              fullWidth
              size="small"
            />
            <TextField
              label="聯絡電話"
              required
              type="tel"
              value={formData.contactPhone}
              onChange={handleChange('contactPhone')}
              placeholder="09xxxxxxxx"
              fullWidth
              size="small"
            />
            <TextField
              label="配送地址"
              required
              value={formData.address}
              onChange={handleChange('address')}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
            <TextField
              label="訂單備註"
              value={formData.notes}
              onChange={handleChange('notes')}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="例如：請放管理室、不需要塑膠袋等"
            />
          </Box>
        </Box>

        {/* 付款方式 */}
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            💳 付款方式
          </Typography>
          <RadioGroup value={formData.paymentMethod} onChange={handleChange('paymentMethod')}>
            {PAYMENT_METHODS.map(method => (
              <FormControlLabel
                key={method.value}
                value={method.value}
                control={<Radio />}
                label={method.label}
                sx={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  mb: 1,
                  mx: 0,
                  px: 1.5,
                  py: 0.5,
                }}
              />
            ))}
          </RadioGroup>
        </Box>

        {/* 訂單摘要 - 可折疊 */}
        <Box>
          <Box
            onClick={() => setShowSummary(!showSummary)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              py: 1,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              📦 訂單摘要 ({items.length} 件)
            </Typography>
            <IconButton size="small">
              {showSummary ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={showSummary}>
            <Box sx={{ bgcolor: '#f8fafc', borderRadius: '8px', p: 2, mt: 1 }}>
              {items.map(item => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 1,
                    fontSize: '14px',
                  }}
                >
                  <Typography variant="body2">
                    {item.name} × {item.quantity}
                  </Typography>
                  <Typography variant="body2">NT${item.lineTotal}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  商品小計
                </Typography>
                <Typography variant="body2">NT${subtotal}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  運費
                </Typography>
                <Typography variant="body2">
                  NT${deliveryFee}
                  {deliveryFee === 0 && ' (免運)'}
                </Typography>
              </Box>
            </Box>
          </Collapse>

          {/* 總計 - 始終顯示 */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mt: 2,
              p: 2,
              bgcolor: '#f0f9ff',
              borderRadius: '8px',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              總計
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#7cb342' }}>
              NT${totalAmount.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* 配送提醒 */}
        <Box
          sx={{
            bgcolor: '#fef3c7',
            color: '#92400e',
            p: 1.5,
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
            ⏰ 配送提醒
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            • 每日 12:00 前下單，當日新鮮出貨
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            • 訂單確認後將透過 LINE 通知配送進度
          </Typography>
        </Box>
      </Box>

      {/* 底部送出按鈕 */}
      <Box
        sx={{
          borderTop: '1px solid #e2e8f0',
          p: 2,
          bgcolor: '#fff',
        }}
      >
        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={isSubmitting}
          onClick={handleSubmit}
          sx={{
            bgcolor: '#7cb342',
            '&:hover': {
              bgcolor: '#689f38',
            },
            py: 1.5,
            fontWeight: 600,
          }}
        >
          {isSubmitting ? '送出中...' : '確認送出訂單'}
        </Button>
      </Box>
    </Drawer>
  );
}
