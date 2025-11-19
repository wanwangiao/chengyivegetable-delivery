'use client';

import { useEffect, useState } from 'react';
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
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { type CartItem } from '../hooks/useCart';
import { formatCurrency } from '../utils/currency';

type CheckoutDrawerProps = {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  items: CartItem[];
  subtotal: number | null | undefined;
  deliveryFee: number | null | undefined;
  totalAmount: number | null | undefined;
  onSubmit: (data: CheckoutFormData) => Promise<void>;
  lineUserId?: string; // ✨ Optional LINE User ID
  lineDisplayName?: string; // ✨ Optional LINE Display Name
};

export type CheckoutFormData = {
  contactName: string;
  contactPhone: string;
  address: string;
  notes?: string;
  paymentMethod: string;
};

type LegacyCustomerData = {
  name?: string;
  phone?: string;
};

const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: 'cash', label: '現場付款' },
  { value: 'transfer', label: '銀行轉帳' },
  { value: 'line_pay', label: 'LINE Pay' },
  { value: 'credit', label: '信用卡' }
];

const CUSTOMER_DATA_KEY = 'customerData';

const currency = (value: number | null | undefined, fallback = '0') =>
  formatCurrency(value, { fallback });

export function CheckoutDrawer({
  open,
  onClose,
  onBack,
  items,
  subtotal,
  deliveryFee,
  totalAmount,
  onSubmit,
  lineUserId,
  lineDisplayName
}: CheckoutDrawerProps) {
  const [formData, setFormData] = useState<CheckoutFormData>({
    contactName: '',
    contactPhone: '',
    address: '',
    notes: '',
    paymentMethod: PAYMENT_METHODS[0]?.value ?? 'cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = window.localStorage.getItem(CUSTOMER_DATA_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<CheckoutFormData & LegacyCustomerData>;

      setFormData(prev => ({
        contactName: parsed.contactName ?? parsed.name ?? prev.contactName,
        contactPhone: parsed.contactPhone ?? parsed.phone ?? prev.contactPhone,
        address: parsed.address ?? prev.address,
        notes: parsed.notes ?? prev.notes,
        paymentMethod: parsed.paymentMethod ?? prev.paymentMethod
      }));
    } catch (error) {
      console.error('Failed to restore customer data:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(CUSTOMER_DATA_KEY, JSON.stringify(formData));
    } catch (error) {
      console.error('Failed to persist customer data:', error);
    }
  }, [formData]);

  const handleChange =
    (field: keyof CheckoutFormData) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [field]: event.target.value }));
      };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotalValue = subtotal ?? 0;
  const deliveryFeeValue = deliveryFee ?? 0;
  const totalValue = totalAmount ?? subtotalValue + deliveryFeeValue;

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
            maxHeight: '80vh'
          }
        }
      }}
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
        sx: {
          display: 'flex',
          flexDirection: 'column',
          '@media (min-width: 768px)': {
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            maxHeight: '100vh',
            width: '520px',
            borderTopLeftRadius: '16px',
            borderBottomLeftRadius: '16px',
            borderTopRightRadius: 0
          }
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <IconButton onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          填寫配送資料
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* ✨ LINE Connection Status Indicator */}
        {lineUserId && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: '#f0fdf4', // Green-50
              border: '1px solid #bbf7d0', // Green-200
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <Box
              component="img"
              src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg"
              alt="LINE"
              sx={{ width: 24, height: 24 }}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#166534', fontWeight: 600 }}>
                已連結 LINE 帳號
              </Typography>
              <Typography variant="caption" sx={{ color: '#15803d' }}>
                {lineDisplayName ? `你好，${lineDisplayName}！` : '將自動綁定此手機號碼'}
              </Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            聯絡資訊
          </Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="聯絡人姓名"
              value={formData.contactName}
              onChange={handleChange('contactName')}
              required
            />
            <TextField
              label="聯絡電話"
              value={formData.contactPhone}
              onChange={handleChange('contactPhone')}
              required
              inputProps={{ pattern: '09[0-9]{8}', inputMode: 'tel', maxLength: 10 }}
              helperText="格式：09xxxxxxxx"
            />
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            送貨地址
          </Typography>
          <TextField
            label="送貨地址"
            value={formData.address}
            onChange={handleChange('address')}
            required
            multiline
            minRows={2}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            訂單備註
          </Typography>
          <TextField
            label="備註"
            value={formData.notes ?? ''}
            onChange={handleChange('notes')}
            multiline
            minRows={3}
            placeholder="例如：請 17:00 前送達，門口有狗狗請注意"
          />
        </Box>

        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">付款方式</FormLabel>
          <RadioGroup
            value={formData.paymentMethod}
            onChange={handleChange('paymentMethod')}
            row
          >
            {PAYMENT_METHODS.map(method => (
              <FormControlLabel
                key={method.value}
                value={method.value}
                control={<Radio />}
                label={method.label}
              />
            ))}
          </RadioGroup>
        </FormControl>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            訂單總覽 ({items.length} 項)
          </Typography>
          <IconButton size="small" onClick={() => setShowSummary(value => !value)}>
            {showSummary ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={showSummary}>
          <Box
            sx={{
              bgcolor: '#f8fafc',
              borderRadius: '8px',
              p: 2,
              mt: 1
            }}
          >
            {items.map(item => (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 1,
                  fontSize: '14px'
                }}
              >
                <Typography variant="body2">
                  {item.name} × {item.quantity}
                </Typography>
                <Typography variant="body2">
                  NT$ {currency(item.lineTotal, '0')}
                </Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                商品小計
              </Typography>
              <Typography variant="body2">NT$ {currency(subtotalValue, '0')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                運費
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: deliveryFeeValue === 0 ? '#10b981' : 'inherit',
                  textDecoration: deliveryFeeValue === 0 ? 'line-through' : 'none'
                }}
              >
                NT$ {currency(deliveryFeeValue, '0')}
              </Typography>
            </Box>
          </Box>
        </Collapse>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 2,
            p: 2,
            bgcolor: '#f0f9ff',
            borderRadius: '8px'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            總計
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#7cb342' }}>
            NT$ {currency(totalValue, '0')}
          </Typography>
        </Box>

        <Box
          sx={{
            bgcolor: '#fef3c7',
            color: '#92400e',
            p: 1.5,
            borderRadius: '8px',
            fontSize: '13px',
            mt: 2
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
            配送說明
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            每日 12:00 前下單，當日新鮮配送。運送過程全程冷藏保鮮。
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            訂單成立後會以 LINE 通知物流進度，請保持手機暢通。
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          borderTop: '1px solid #e2e8f0',
          p: 2,
          bgcolor: '#fff'
        }}
      >
        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={isSubmitting}
          sx={{
            bgcolor: '#7cb342',
            '&:hover': { bgcolor: '#689f38' },
            py: 1.5,
            fontWeight: 600
          }}
        >
          {isSubmitting ? '送出中…' : '確認送出訂單'}
        </Button>
      </Box>
    </Drawer>
  );
}
