'use client';

import { Drawer, IconButton, Button, Box, Typography, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { type CartItem } from '../hooks/useCart';

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  isFreeShipping: boolean;
  amountToFreeShipping: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
};

export function CartDrawer({
  open,
  onClose,
  items,
  subtotal,
  deliveryFee,
  totalAmount,
  isFreeShipping,
  amountToFreeShipping,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: CartDrawerProps) {
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
            // 桌面端改為右側
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
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          🛒 購物車 ({items.length})
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 免運提示 */}
      {!isFreeShipping && amountToFreeShipping > 0 && (
        <Box
          sx={{
            bgcolor: '#fef3c7',
            color: '#92400e',
            px: 2,
            py: 1.5,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <span>💡</span>
          <span>
            再買 <strong>NT${amountToFreeShipping}</strong> 即可免運費
          </span>
        </Box>
      )}

      {isFreeShipping && (
        <Box
          sx={{
            bgcolor: '#d1fae5',
            color: '#065f46',
            px: 2,
            py: 1.5,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <span>✅</span>
          <span>已達免運門檻</span>
        </Box>
      )}

      {/* 商品列表 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
            <Typography variant="h6" gutterBottom>
              購物車是空的
            </Typography>
            <Typography variant="body2">快去選購喜歡的商品吧！</Typography>
          </Box>
        ) : (
          items.map(item => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                gap: 2,
                mb: 2,
                pb: 2,
                borderBottom: '1px solid #f1f5f9',
                '&:last-child': {
                  borderBottom: 'none',
                },
              }}
            >
              {/* 商品圖示 */}
              <Box
                sx={{
                  width: '64px',
                  height: '64px',
                  bgcolor: '#f8fafc',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  flexShrink: 0,
                }}
              >
                🥬
              </Box>

              {/* 商品資訊 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 500, mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {item.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  NT${item.unitPrice} / {item.unit}
                </Typography>

                {/* 數量控制 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    sx={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      width: '32px',
                      height: '32px',
                    }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>

                  <Typography
                    sx={{
                      minWidth: '40px',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '16px',
                    }}
                  >
                    {item.quantity}
                  </Typography>

                  <IconButton
                    size="small"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    sx={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      width: '32px',
                      height: '32px',
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>

                  <IconButton
                    size="small"
                    onClick={() => onRemoveItem(item.id)}
                    sx={{ ml: 'auto', color: '#ef4444' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              {/* 小計 */}
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#7cb342' }}>
                  NT${item.lineTotal}
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* 底部結帳區 */}
      {items.length > 0 && (
        <Box
          sx={{
            borderTop: '1px solid #e2e8f0',
            p: 2,
            bgcolor: '#f8fafc',
          }}
        >
          {/* 金額明細 */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                商品小計
              </Typography>
              <Typography variant="body2">NT${subtotal.toLocaleString()}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                運費
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: deliveryFee === 0 ? '#10b981' : 'text.primary',
                  textDecoration: deliveryFee === 0 ? 'line-through' : 'none',
                }}
              >
                NT${deliveryFee}
                {deliveryFee === 0 && ' (免運)'}
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                總計
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#7cb342' }}>
                NT${totalAmount.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          {/* 按鈕群 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={onClose} sx={{ flex: 1 }}>
              繼續購物
            </Button>
            <Button
              variant="contained"
              onClick={onCheckout}
              sx={{
                flex: 1,
                bgcolor: '#7cb342',
                '&:hover': {
                  bgcolor: '#689f38',
                },
              }}
            >
              前往結帳
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
