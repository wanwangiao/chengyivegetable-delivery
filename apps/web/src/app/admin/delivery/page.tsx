export default function DeliveryMonitoringPage() {
  return (
    <div className="admin-delivery">
      <header className="mb-4">
        <h1 className="h3 mb-2">配送監控</h1>
        <p className="text-muted mb-0">即時掌握配送設定與司機定位狀態。</p>
      </header>
      <div className="alert alert-info" role="alert">
        配送監控儀表尚在建置中，請先透過後台 API 或即時系統確認配送狀態。
      </div>
    </div>
  );
}
