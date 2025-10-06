'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { CloudDownload, Close, Refresh, Save, Search, Upload } from '@mui/icons-material';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

type ProductOption = {
  id?: string;
  name: string;
  price: number | null;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  unitHint?: string;
  price: number | null;
  stock: number;
  isAvailable: boolean;
  isPricedItem: boolean;
  weightPricePerUnit?: number | null;
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

type ProductOptionFormState = {
  id?: string;
  name: string;
  price: string;
};

type ProductFormState = {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  unitHint: string;
  price: string;
  stock: string;
  isAvailable: boolean;
  isPricedItem: boolean;
  weightPricePerUnit: string;
  sortOrder: string;
  options: ProductOptionFormState[];
  imageUrl?: string;
};

const currencyFormatter = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 2
});

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : currencyFormatter.format(value);

const toFormState = (product: Product): ProductFormState => ({
  id: product.id,
  name: product.name,
  description: product.description ?? '',
  category: product.category,
  unit: product.unit,
  unitHint: product.unitHint ?? '',
  price: product.price === null || product.price === undefined ? '' : String(product.price),
  stock: String(product.stock ?? 0),
  isAvailable: product.isAvailable,
  isPricedItem: product.isPricedItem,
  weightPricePerUnit:
    product.weightPricePerUnit === null || product.weightPricePerUnit === undefined
      ? ''
      : String(product.weightPricePerUnit),
  sortOrder: String(product.sortOrder ?? 0),
  options: product.options?.map(option => ({
    id: option.id,
    name: option.name,
    price: option.price === null || option.price === undefined ? '' : String(option.price)
  })) ?? [],
  imageUrl: product.imageUrl
});

const parseNumber = (value: string) => {
  if (value.trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseRequiredNumber = (value: string, fallback = 0) => {
  if (value.trim() === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const filterProducts = (products: Product[], keyword: string, category: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const normalizedCategory = category === '全部分類' ? '' : category;

  return products.filter(product => {
    const matchKeyword =
      normalizedKeyword.length === 0 ||
      product.name.toLowerCase().includes(normalizedKeyword) ||
      (product.description ?? '').toLowerCase().includes(normalizedKeyword) ||
      product.options?.some(option => option.name.toLowerCase().includes(normalizedKeyword));

    const matchCategory = normalizedCategory === '' || product.category === normalizedCategory;

    return matchKeyword && matchCategory;
  });
};

export default function AdminProductsPage() {
  const [token, setToken] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('全部分類');
  const [editorState, setEditorState] = useState<ProductFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

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
      const json = await response.json() as { data: Product[]; stats: ProductStats };
      setProducts(json.data ?? []);
      setStats(json.stats ?? null);
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
    () => filterProducts(products, search, categoryFilter),
    [products, search, categoryFilter]
  );

  const categories = useMemo(() => {
    const base = ['全部分類'];
    if (stats) base.push(...Object.keys(stats.categories).sort());
    return base;
  }, [stats]);

  const saveToken = () => {
    window.localStorage.setItem('chengyi_admin_token', token);
    loadProducts().catch(() => undefined);
  };

  const openEditor = (product: Product) => {
    setEditorState(toFormState(product));
    setMessage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const closeEditor = () => {
    setEditorState(null);
    setSaving(false);
  };

  const updateEditorField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    if (!editorState) return;
    setEditorState({ ...editorState, [key]: value });
  };

  const updateOption = (index: number, field: keyof ProductOptionFormState, value: string) => {
    if (!editorState) return;
    const nextOptions = editorState.options.map((option, optionIndex) =>
      optionIndex === index ? { ...option, [field]: value } : option
    );
    setEditorState({ ...editorState, options: nextOptions });
  };

  const addOption = () => {
    if (!editorState) return;
    setEditorState({
      ...editorState,
      options: [...editorState.options, { name: '', price: '' }]
    });
  };

  const removeOption = (index: number) => {
    if (!editorState) return;
    setEditorState({
      ...editorState,
      options: editorState.options.filter((_, i) => i !== index)
    });
  };

  const refreshProduct = (updated: Product) => {
    setProducts(prev => prev.map(product => (product.id === updated.id ? updated : product)));
    setEditorState(prev => (prev && prev.id === updated.id ? toFormState(updated) : prev));
  };

  const handleSave = async () => {
    if (!editorState || !headers) {
      setMessage('請先完成登入驗證');
      return;
    }

    const payload = {
      name: editorState.name.trim(),
      description: editorState.description.trim() || undefined,
      category: editorState.category.trim(),
      unit: editorState.unit.trim(),
      unitHint: editorState.unitHint.trim() || undefined,
      isAvailable: editorState.isAvailable,
      isPricedItem: editorState.isPricedItem,
      price: editorState.isPricedItem ? null : parseNumber(editorState.price),
      weightPricePerUnit: editorState.isPricedItem ? parseNumber(editorState.weightPricePerUnit) : null,
      stock: parseRequiredNumber(editorState.stock, 0),
      sortOrder: parseRequiredNumber(editorState.sortOrder, 0),
      options: editorState.options
        .filter(option => option.name.trim().length > 0)
        .map(option => ({
          id: option.id,
          name: option.name.trim(),
          price: option.price.trim() === '' ? null : Number(option.price)
        }))
    };

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/admin/products/${editorState.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? '更新商品資料失敗');
      }
      const json = await response.json() as { data: Product };
      refreshProduct(json.data);
      setMessage('商品資料已更新');
      await loadProducts();
    } catch (error: any) {
      setMessage(error?.message ?? '儲存時發生錯誤');
    } finally {
      setSaving(false);
    }
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
      refreshProduct(json.data);
      setMessage(json.data.isAvailable ? '商品已上架' : '商品已下架');
    } catch (error: any) {
      setMessage(error?.message ?? '切換商品狀態時發生錯誤');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editorState || !headers) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`${API_BASE}/admin/products/${editorState.id}/image`, {
        method: 'POST',
        headers,
        body: formData
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? '圖片上傳失敗');
      }
      const json = await response.json() as { data: Product };
      refreshProduct(json.data);
      setMessage('商品圖片已更新');
    } catch (error: any) {
      setMessage(error?.message ?? '上傳圖片時發生錯誤');
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

  const handleImportClick = () => {
    if (!headers) {
      setMessage('請先輸入有效的管理員 JWT Token');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!headers) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE}/admin/products/import`, {
        method: 'POST',
        headers,
        body: formData
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? '匯入商品失敗');
      }
      const json = await response.json() as { data: Product[]; imported: number };
      setMessage(`已成功匯入 ${json.imported} 項商品`);
      await loadProducts();
    } catch (error: any) {
      setMessage(error?.message ?? '匯入商品時發生錯誤');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setImporting(false);
    }
  };

  return (
    <Box p={{ xs: 2, md: 4 }} display="flex" flexDirection="column" gap={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            商品管理中心
          </Typography>
          <Typography color="text.secondary">
            維護商品資訊、上架狀態與批次匯入匯出
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
          <Button variant="contained" onClick={saveToken} startIcon={<Save />}>儲存 Token</Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
        <TextField
          placeholder="搜尋商品名稱、描述或選項"
          value={search}
          onChange={event => setSearch(event.target.value)}
          InputProps={{ startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ) }}
          fullWidth
        />
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>分類</InputLabel>
          <Select
            label="分類"
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
          >
            {categories.map(category => (
              <MenuItem key={category} value={category}>{category}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => loadProducts()} startIcon={<Refresh />} disabled={loading}>
            重新整理
          </Button>
          <Button onClick={handleExport} startIcon={<CloudDownload />}>匯出 CSV</Button>
          <Button onClick={handleImportClick} startIcon={<Upload />} disabled={importing}>
            {importing ? '匯入中…' : '匯入 CSV'}
          </Button>
        </Stack>
      </Stack>

      {stats && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <Card><CardContent><Typography color="text.secondary">全部商品</Typography><Typography variant="h5">{stats.total}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <Card><CardContent><Typography color="text.secondary">上架中</Typography><Typography variant="h5" color="success.main">{stats.available}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <Card><CardContent><Typography color="text.secondary">已下架</Typography><Typography variant="h5" color="error.main">{stats.unavailable}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <Card><CardContent><Typography color="text.secondary">低庫存 (&lt;=5)</Typography><Typography variant="h5" color="warning.main">{stats.lowStock}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <Card><CardContent><Typography color="text.secondary">固定價格</Typography><Typography variant="h5">{stats.fixedPrice}</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <Card><CardContent><Typography color="text.secondary">秤重計價</Typography><Typography variant="h5">{stats.variablePrice}</Typography></CardContent></Card>
          </Grid>
        </Grid>
      )}

      {message && <Alert severity="info">{message}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            共 {filteredProducts.length} 項商品
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>名稱</TableCell>
                <TableCell>分類</TableCell>
                <TableCell>單位</TableCell>
                <TableCell>價格</TableCell>
                <TableCell>庫存</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProducts.map(product => (
                <TableRow key={product.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>{product.name}</Typography>
                      {product.options?.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {product.options.map(option => option.name).join('、')}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography>{product.unit}</Typography>
                      {product.unitHint && <Typography variant="caption" color="text.secondary">{product.unitHint}</Typography>}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {product.isPricedItem ? (
                      <Stack spacing={0.5}>
                        <Typography>{formatCurrency(product.weightPricePerUnit ?? null)} / {product.unit}</Typography>
                        <Chip label="秤重" size="small" color="warning" />
                      </Stack>
                    ) : (
                      formatCurrency(product.price)
                    )}
                  </TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>
                    <Chip
                      label={product.isAvailable ? '上架中' : '已下架'}
                      color={product.isAvailable ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => openEditor(product)}>
                        編輯
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color={product.isAvailable ? 'error' : 'success'}
                        onClick={() => handleToggleAvailability(product)}
                      >
                        {product.isAvailable ? '下架' : '上架'}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    {loading ? '載入中…' : '目前沒有符合條件的商品'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editorState)} onClose={closeEditor} fullWidth maxWidth="md">
        {editorState && (
          <>
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">編輯商品</Typography>
                <IconButton onClick={closeEditor}><Close /></IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="商品名稱"
                    value={editorState.name}
                    onChange={event => updateEditorField('name', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="分類"
                    value={editorState.category}
                    onChange={event => updateEditorField('category', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="單位"
                    value={editorState.unit}
                    onChange={event => updateEditorField('unit', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="單位提示"
                    value={editorState.unitHint}
                    onChange={event => updateEditorField('unitHint', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="排序"
                    type="number"
                    value={editorState.sortOrder}
                    onChange={event => updateEditorField('sortOrder', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="商品描述"
                    value={editorState.description}
                    onChange={event => updateEditorField('description', event.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="庫存"
                    type="number"
                    value={editorState.stock}
                    onChange={event => updateEditorField('stock', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  {!editorState.isPricedItem ? (
                    <TextField
                      label="固定單價"
                      type="number"
                      value={editorState.price}
                      onChange={event => updateEditorField('price', event.target.value)}
                      fullWidth
                    />
                  ) : (
                    <TextField
                      label={`每${editorState.unit || '單位'}價格`}
                      type="number"
                      value={editorState.weightPricePerUnit}
                      onChange={event => updateEditorField('weightPricePerUnit', event.target.value)}
                      fullWidth
                    />
                  )}
                </Grid>
                <Grid item xs={12} sm={4} display="flex" flexDirection="column" justifyContent="center">
                  <Stack direction="row" spacing={2}>
                    <FormControlLabel
                      control={<Switch checked={editorState.isPricedItem} onChange={event => updateEditorField('isPricedItem', event.target.checked)} />}
                      label="秤重計價"
                    />
                    <FormControlLabel
                      control={<Switch checked={editorState.isAvailable} onChange={event => updateEditorField('isAvailable', event.target.checked)} />}
                      label="上架中"
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2">商品圖片</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" onClick={() => imageInputRef.current?.click()} startIcon={<Upload />}>
                        上傳新圖片
                      </Button>
                      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      支援 JPG / PNG / WEBP，檔案大小需小於 5 MB
                    </Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      height: 180,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {editorState.imageUrl ? (
                      <Box component="img" src={editorState.imageUrl} alt={editorState.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Typography color="text.secondary">尚未設定圖片</Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2">商品選項</Typography>
                      <Button size="small" variant="outlined" onClick={addOption}>新增選項</Button>
                    </Stack>
                    {editorState.options.length === 0 && (
                      <Typography variant="caption" color="text.secondary">目前沒有額外選項</Typography>
                    )}
                    {editorState.options.map((option, index) => (
                      <Stack key={option.id ?? index} direction={{ xs: 'column', sm: 'row' }} spacing={1}
                        alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <TextField
                          label="選項名稱"
                          value={option.name}
                          onChange={event => updateOption(index, 'name', event.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="加價 (可留空)"
                          type="number"
                          value={option.price}
                          onChange={event => updateOption(index, 'price', event.target.value)}
                          fullWidth
                        />
                        <Button color="inherit" onClick={() => removeOption(index)}>移除</Button>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeEditor}>取消</Button>
              <Button variant="contained" onClick={handleSave} startIcon={<Save />} disabled={saving}>
                {saving ? '儲存中…' : '儲存變更'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <input ref={fileInputRef} type="file" accept="text/csv" hidden onChange={handleImportChange} />
    </Box>
  );
}
