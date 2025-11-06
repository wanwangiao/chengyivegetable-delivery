'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Drawer,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import {
  CloudDownload,
  Close,
  ExpandLess,
  ExpandMore,
  Refresh,
  Save,
  Search,
  Upload
} from '@mui/icons-material';

import { API_BASE_URL as API_BASE } from '../../../config/api';

type ProductOption = {
  id?: string;
  name: string;
  price: number | null;
  isActive?: boolean;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  unitHint?: string;
  price: number | null;
  nextDayPrice: number | null;
  stock: number;
  isAvailable: boolean;
  isPricedItem: boolean;
  weightPricePerUnit?: number | null;
  nextDayWeightPricePerUnit?: number | null;
  sortOrder: number;
  imageUrl?: string;
  options: ProductOption[];
};

type ProductStats = {
  total: number;
  available: number;
  unavailable: number;
  lowStock: number;
  fixedPrice: number;
  variablePrice: number;
  categories: Record<string, number>;
};

const currencyFormatter = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 2
});

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : currencyFormatter.format(value);

const parseNumber = (value: string) => {
  if (value.trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const filterProducts = (products: Product[], keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  return products.filter(product =>
    normalizedKeyword.length === 0 ||
    product.name.toLowerCase().includes(normalizedKeyword) ||
    (product.description ?? '').toLowerCase().includes(normalizedKeyword) ||
    product.options?.some(option => option.name.toLowerCase().includes(normalizedKeyword))
  );
};

export default function AdminProductsPage() {
  const [token, setToken] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Quick price edit drawer
  const [priceEditProduct, setPriceEditProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('chengyi_admin_token');
    if (savedToken) setToken(savedToken);
  }, []);

  const headers = useMemo(() => {
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` } as Record<string, string>;
  }, [token]);

  const loadProducts = useCallback(async () => {
    if (!headers) {
      setMessage('請先輸入有效的管理員 JWT Token');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/products`, { headers });
      if (!response.ok) throw new Error('讀取商品資料失敗，請確認權限或 API 狀態');
      const json = await response.json() as { data: { products: Product[]; stats: ProductStats } };
      setProducts(json.data.products ?? []);
      setStats(json.data.stats ?? null);
      setMessage(null);
    } catch (error: any) {
      setMessage(error?.message ?? '系統發生未知錯誤');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) return;
    loadProducts().catch(() => undefined);
  }, [headers, loadProducts]);

  const filteredProducts = useMemo(
    () => filterProducts(products, search),
    [products, search]
  );

  const saveToken = () => {
    window.localStorage.setItem('chengyi_admin_token', token);
    loadProducts().catch(() => undefined);
  };

  const toggleExpanded = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const openPriceEditor = (product: Product) => {
    setPriceEditProduct(product);
    setEditPrice(
      product.isPricedItem
        ? String(product.weightPricePerUnit ?? '')
        : String(product.price ?? '')
    );
    setEditStock(String(product.stock ?? 0));
    setMessage(null);
  };

  const closePriceEditor = () => {
    setPriceEditProduct(null);
    setSaving(false);
  };

  const handleToggleAvailability = async (product: Product) => {
    if (!headers) {
      setMessage('請先輸入有效的管理員 JWT Token');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/products/${product.id}/toggle`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !product.isAvailable })
      });
      if (!response.ok) throw new Error('切換上架狀態失敗');
      const json = await response.json() as { data: Product };

      setProducts(prev => prev.map(p => (p.id === json.data.id ? json.data : p)));
      setMessage(json.data.isAvailable ? '商品已上架' : '商品已下架');
    } catch (error: any) {
      setMessage(error?.message ?? '切換商品狀態時發生錯誤');
    }
  };

  const handleToggleOption = async (productId: string, optionId: string, currentActive: boolean) => {
    if (!headers) {
      setMessage('請先輸入有效的管理員 JWT Token');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/products/${productId}/options/${optionId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive })
      });
      if (!response.ok) throw new Error('切換選項狀態失敗');
      const json = await response.json() as { data: Product };

      setProducts(prev => prev.map(p => (p.id === json.data.id ? json.data : p)));
      setMessage(`選項已${!currentActive ? '啟用' : '停用'}`);
    } catch (error: any) {
      setMessage(error?.message ?? '切換選項狀態時發生錯誤');
    }
  };

  const handleSaveQuickEdit = async () => {
    if (!priceEditProduct || !headers) {
      setMessage('請先完成登入驗證');
      return;
    }

    const payload: any = {
      stock: parseNumber(editStock) ?? 0
    };

    if (priceEditProduct.isPricedItem) {
      payload.weightPricePerUnit = parseNumber(editPrice);
      payload.nextDayWeightPricePerUnit = parseNumber(editPrice);
    } else {
      payload.price = parseNumber(editPrice);
      payload.nextDayPrice = parseNumber(editPrice);
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/admin/products/${priceEditProduct.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? '更新商品資料失敗');
      }
      const json = await response.json() as { data: Product };

      setProducts(prev => prev.map(p => (p.id === json.data.id ? json.data : p)));
      setMessage('商品資料已更新');
      closePriceEditor();
      await loadProducts();
    } catch (error: any) {
      setMessage(error?.message ?? '儲存時發生錯誤');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!headers) {
      setMessage('請先輸入有效的管理員 JWT Token');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/products/export`, { headers });
      if (!response.ok) throw new Error('匯出 CSV 失敗');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('已匯出商品清單');
    } catch (error: any) {
      setMessage(error?.message ?? '匯出商品時發生錯誤');
    }
  };

  return (
    <Box p={2} display="flex" flexDirection="column" gap={2}>
      {/* Header */}
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={600}>
          商品管理
        </Typography>

        {/* Token Input */}
        <Stack direction="row" spacing={1}>
          <TextField
            label="管理員 Token"
            value={token}
            onChange={event => setToken(event.target.value)}
            size="small"
            fullWidth
          />
          <Button variant="contained" onClick={saveToken} sx={{ minWidth: 80 }}>
            儲存
          </Button>
        </Stack>

        {/* Stats */}
        {stats && (
          <Grid container spacing={1}>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">全部</Typography>
                  <Typography variant="h6">{stats.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">上架</Typography>
                  <Typography variant="h6" color="success.main">{stats.available}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">低庫存</Typography>
                  <Typography variant="h6" color="warning.main">{stats.lowStock}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Search */}
        <TextField
          placeholder="搜尋商品名稱或選項"
          value={search}
          onChange={event => setSearch(event.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )
          }}
          fullWidth
        />

        {/* Actions */}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            onClick={() => loadProducts()}
            startIcon={<Refresh />}
            disabled={loading}
          >
            重新整理
          </Button>
          <Button size="small" onClick={handleExport} startIcon={<CloudDownload />}>
            匯出
          </Button>
        </Stack>
      </Stack>

      {message && <Alert severity="info">{message}</Alert>}

      {/* Product List */}
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          共 {filteredProducts.length} 項商品
        </Typography>

        {filteredProducts.map(product => (
          <Card key={product.id} variant="outlined">
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              {/* Line 1: Toggle + Name + Price Edit Button */}
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Switch
                  checked={product.isAvailable}
                  onChange={() => handleToggleAvailability(product)}
                  size="small"
                  color="success"
                />
                <Typography
                  variant="body1"
                  fontWeight={600}
                  sx={{ flex: 1, minWidth: 0 }}
                  noWrap
                >
                  {product.name}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => openPriceEditor(product)}
                  sx={{ minWidth: 60 }}
                >
                  改價
                </Button>
              </Stack>

              {/* Line 2: Price + Unit + Stock */}
              <Stack direction="row" spacing={2} alignItems="center" ml={5}>
                <Typography variant="body2" color="text.secondary">
                  {product.isPricedItem
                    ? `${formatCurrency(product.weightPricePerUnit ?? null)} / ${product.unit}`
                    : `${formatCurrency(product.price)} / ${product.unit}`}
                </Typography>
                <Chip
                  label={`庫存 ${product.stock}`}
                  size="small"
                  color={product.stock <= 5 ? 'warning' : 'default'}
                  sx={{ height: 20 }}
                />
              </Stack>

              {/* Options Section */}
              {product.options && product.options.length > 0 && (
                <>
                  <Box mt={1} ml={5}>
                    <Button
                      size="small"
                      onClick={() => toggleExpanded(product.id)}
                      endIcon={expandedProducts.has(product.id) ? <ExpandLess /> : <ExpandMore />}
                      sx={{ minWidth: 0, p: 0, textTransform: 'none' }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        選項 ({product.options.length})
                      </Typography>
                    </Button>
                  </Box>

                  <Collapse in={expandedProducts.has(product.id)}>
                    <Stack spacing={0.5} mt={1} ml={5}>
                      {product.options.map(option => (
                        <Stack
                          key={option.id}
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Switch
                            checked={option.isActive ?? true}
                            onChange={() => handleToggleOption(product.id, option.id!, option.isActive ?? true)}
                            size="small"
                          />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {option.name}
                          </Typography>
                          {option.price !== null && option.price !== undefined && (
                            <Typography variant="caption" color="text.secondary">
                              +{formatCurrency(option.price)}
                            </Typography>
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  </Collapse>
                </>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredProducts.length === 0 && (
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                {loading ? '載入中…' : '沒有符合條件的商品'}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* Quick Price Edit Drawer */}
      <Drawer
        anchor="bottom"
        open={Boolean(priceEditProduct)}
        onClose={closePriceEditor}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80vh'
          }
        }}
      >
        {priceEditProduct && (
          <Box p={3}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">快速改價</Typography>
                <IconButton onClick={closePriceEditor} size="small">
                  <Close />
                </IconButton>
              </Stack>

              <Typography variant="body1" fontWeight={600}>
                {priceEditProduct.name}
              </Typography>

              <TextField
                label={priceEditProduct.isPricedItem ? `價格 (每${priceEditProduct.unit})` : '單價'}
                type="number"
                value={editPrice}
                onChange={event => setEditPrice(event.target.value)}
                fullWidth
                autoFocus
              />

              <TextField
                label="庫存"
                type="number"
                value={editStock}
                onChange={event => setEditStock(event.target.value)}
                fullWidth
              />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button onClick={closePriceEditor}>取消</Button>
                <Button
                  variant="contained"
                  onClick={handleSaveQuickEdit}
                  startIcon={<Save />}
                  disabled={saving}
                >
                  {saving ? '儲存中…' : '儲存'}
                </Button>
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>

      <input ref={fileInputRef} type="file" accept="text/csv" hidden />
    </Box>
  );
}
