'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Box, Card, CardContent, Typography, Chip, Button, CircularProgress } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

// 動態載入地圖組件（避免 SSR 問題）
const DeliveryMap = dynamic(() => import('./DeliveryMap'), {
  ssr: false,
  loading: () => (
    <Box display="flex" justifyContent="center" alignItems="center" height="600px">
      <CircularProgress />
    </Box>
  )
});

interface MapDriver {
  id: string;
  name: string;
  status: string;
  currentLat: number;
  currentLng: number;
  lastLocationUpdate: string;
}

interface MapOrder {
  id: string;
  contactName: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  driverId?: string;
}

interface MapSnapshot {
  generatedAt: string;
  recommendedPollingIntervalSeconds: number;
  drivers: MapDriver[];
  orders: {
    ready: MapOrder[];
    delivering: MapOrder[];
  };
  counts: {
    drivers: number;
    readyOrders: number;
    deliveringOrders: number;
  };
}

export default function DeliveryMonitoringPage() {
  const [snapshot, setSnapshot] = useState<MapSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchSnapshot = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const url = force
        ? '/api/v1/admin/delivery/map-snapshot?force=true'
        : '/api/v1/admin/delivery/map-snapshot';

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
        }
      });

      if (!response.ok) {
        throw new Error('取得地圖資料失敗');
      }

      const data = await response.json();
      setSnapshot(data.data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? '取得地圖資料失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();

    const interval = setInterval(() => {
      fetchSnapshot();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  const handleRefresh = useCallback(() => {
    fetchSnapshot(true);
  }, [fetchSnapshot]);

  return (
    <div className="admin-delivery">
      <header className="mb-4">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <div>
            <h1 className="h3 mb-2">配送監控</h1>
            <p className="text-muted mb-0">即時掌握配送設定與外送員定位狀態。</p>
          </div>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            sx={{ color: '#2C3E50', borderColor: '#2C3E50' }}
          >
            重新整理
          </Button>
        </Box>
      </header>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      <Box display="flex" gap={2} mb={3}>
        <Card sx={{ flex: 1, bgcolor: '#ECEFF1' }}>
          <CardContent>
            <Typography variant="body2" color="#546E7A" gutterBottom>
              線上外送員
            </Typography>
            <Typography variant="h4" color="#2C3E50" fontWeight={600}>
              {snapshot?.counts.drivers ?? 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, bgcolor: '#FFA726' + '20' }}>
          <CardContent>
            <Typography variant="body2" color="#546E7A" gutterBottom>
              待配送訂單
            </Typography>
            <Typography variant="h4" color="#FFA726" fontWeight={600}>
              {snapshot?.counts.readyOrders ?? 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, bgcolor: '#42A5F5' + '20' }}>
          <CardContent>
            <Typography variant="body2" color="#546E7A" gutterBottom>
              配送中訂單
            </Typography>
            <Typography variant="h4" color="#42A5F5" fontWeight={600}>
              {snapshot?.counts.deliveringOrders ?? 0}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {lastUpdate && (
        <Typography variant="caption" color="#546E7A" display="block" mb={2}>
          最後更新：{lastUpdate.toLocaleString('zh-TW')}
        </Typography>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && !snapshot ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="600px">
              <CircularProgress />
            </Box>
          ) : snapshot ? (
            <DeliveryMap
              drivers={snapshot.drivers}
              readyOrders={snapshot.orders.ready}
              deliveringOrders={snapshot.orders.delivering}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
