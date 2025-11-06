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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import {
  Add,
  CloudDownload,
  Close,
  Delete,
  Edit as EditIcon,
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
  groupName?: string;
  isRequired?: boolean;
  selectionType?: 'single' | 'multiple';
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

  // Full edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: '',
    unit: '',
    unitHint: '',
    price: '',
    stock: '',
    isPricedItem: false,
    weightPricePerUnit: '',
    options: [] as ProductOption[]
  });

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

  const openFullEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      category: product.category,
      unit: product.unit,
      unitHint: product.unitHint ?? '',
      price: product.isPricedItem ? '' : String(product.price ?? ''),
      stock: String(product.stock),
      isPricedItem: product.isPricedItem,
      weightPricePerUnit: product.isPricedItem ? String(product.weightPricePerUnit ?? '') : '',
      options: product.options.map(opt => ({ ...opt }))
    });
    setEditDialogOpen(true);
  };

  const closeFullEditDialog = () => {
    setEditDialogOpen(false);
    setEditingProduct(null);
  };

  const handleAddOption = () => {
    setEditForm(prev => ({
      ...prev,
      options: [...prev.options, { name: '', price: null, groupName: '', isRequired: false, selectionType: 'single' }]
    }));
  };

  const handleRemoveOption = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateOption = (index: number, field: 'name' | 'price' | 'groupName' | 'isRequired' | 'selectionType', value: string | boolean) => {
    setEditForm(prev => {
      const newOptions = [...prev.options];
      if (field === 'name') {
        newOptions[index] = { ...newOptions[index], name: value as string };
      } else if (field === 'price') {
        newOptions[index] = { ...newOptions[index], price: parseNumber(value as string) };
      } else if (field === 'groupName') {
        newOptions[index] = { ...newOptions[index], groupName: value as string };
      } else if (field === 'isRequired') {
        newOptions[index] = { ...newOptions[index], isRequired: value as boolean };
      } else if (field === 'selectionType') {
        newOptions[index] = { ...newOptions[index], selectionType: value as 'single' | 'multiple' };
      }
      return { ...prev, options: newOptions };
    });
  };

  const handleSaveFullEdit = async () => {
    if (!editingProduct || !headers) {
      setMessage('請先完成登入驗證');
      return;
    }

    const payload: any = {
      name: editForm.name,
      description: editForm.description || undefined,
      category: editForm.category,
      unit: editForm.unit,
      unitHint: editForm.unitHint || undefined,
      stock: parseNumber(editForm.stock) ?? 0,
      isPricedItem: editForm.isPricedItem,
      options: editForm.options.filter(opt => opt.name.trim() !== '')
    };

    if (editForm.isPricedItem) {
      payload.weightPricePerUnit = parseNumber(editForm.weightPricePerUnit);
      payload.nextDayWeightPricePerUnit = parseNumber(editForm.weightPricePerUnit);
      payload.price = null;
      payload.nextDayPrice = null;
    } else {
      payload.price = parseNumber(editForm.price);
      payload.nextDayPrice = parseNumber(editForm.price);
      payload.weightPricePerUnit = null;
      payload.nextDayWeightPricePerUnit = null;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/admin/products/${editingProduct.id}`, {
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
      closeFullEditDialog();
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
              {/* Line 1: Toggle + Name + Edit Buttons */}
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
                <IconButton
                  size="small"
                  onClick={() => openFullEditDialog(product)}
                  sx={{ p: 0.5 }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
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
            </Stack>
          </Box>
        )}
      </Drawer>

      {/* Full Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={closeFullEditDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">編輯商品</Typography>
            <IconButton onClick={closeFullEditDialog} size="small">
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="商品名稱"
              value={editForm.name}
              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />

            <TextField
              label="商品描述"
              value={editForm.description}
              onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              label="分類"
              value={editForm.category}
              onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
              fullWidth
              required
            />

            <Stack direction="row" spacing={1}>
              <TextField
                label="單位"
                value={editForm.unit}
                onChange={e => setEditForm(prev => ({ ...prev, unit: e.target.value }))}
                fullWidth
                required
                placeholder="例：盒、條、斤"
              />
              <TextField
                label="單位提示"
                value={editForm.unitHint}
                onChange={e => setEditForm(prev => ({ ...prev, unitHint: e.target.value }))}
                fullWidth
                placeholder="例：約600g"
              />
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={editForm.isPricedItem}
                  onChange={e => setEditForm(prev => ({ ...prev, isPricedItem: e.target.checked }))}
                />
              }
              label="秤重商品"
            />

            {editForm.isPricedItem ? (
              <TextField
                label={`價格 (每${editForm.unit || '單位'})`}
                type="number"
                value={editForm.weightPricePerUnit}
                onChange={e => setEditForm(prev => ({ ...prev, weightPricePerUnit: e.target.value }))}
                fullWidth
                required
              />
            ) : (
              <TextField
                label="售價"
                type="number"
                value={editForm.price}
                onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                fullWidth
                required
              />
            )}

            <TextField
              label="庫存"
              type="number"
              value={editForm.stock}
              onChange={e => setEditForm(prev => ({ ...prev, stock: e.target.value }))}
              fullWidth
              required
            />

            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">商品選項</Typography>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={handleAddOption}
              >
                新增選項
              </Button>
            </Stack>

            {editForm.options.map((option, index) => (
              <Card key={index} variant="outlined">
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        label="選項名稱"
                        value={option.name}
                        onChange={e => handleUpdateOption(index, 'name', e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="例：要撥、大、中"
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveOption(index)}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <TextField
                        label="分組名稱"
                        value={option.groupName || ''}
                        onChange={e => handleUpdateOption(index, 'groupName', e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="選填，例：尺寸、加工方式"
                      />
                      <TextField
                        label="加價"
                        type="number"
                        value={option.price === null ? '' : option.price}
                        onChange={e => handleUpdateOption(index, 'price', e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="選填，無加價留空"
                      />
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={option.isRequired ?? false}
                            onChange={e => handleUpdateOption(index, 'isRequired', e.target.checked)}
                            size="small"
                          />
                        }
                        label="必選"
                      />
                      <TextField
                        select
                        label="選擇方式"
                        value={option.selectionType || 'single'}
                        onChange={e => handleUpdateOption(index, 'selectionType', e.target.value)}
                        size="small"
                        sx={{ minWidth: 120 }}
                      >
                        <MenuItem value="single">單選</MenuItem>
                        <MenuItem value="multiple">多選</MenuItem>
                      </TextField>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeFullEditDialog}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSaveFullEdit}
            startIcon={<Save />}
            disabled={saving}
          >
            {saving ? '儲存中…' : '儲存'}
          </Button>
        </DialogActions>
      </Dialog>

      <input ref={fileInputRef} type="file" accept="text/csv" hidden />
    </Box>
  );
}
