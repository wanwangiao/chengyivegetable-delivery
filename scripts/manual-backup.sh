#!/bin/bash

# Railway PostgreSQL 手動備份腳本
# 用法: ./scripts/manual-backup.sh [備份名稱]

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME=${1:-"manual_backup_${TIMESTAMP}"}
DATABASE_URL=${DATABASE_URL:-$(grep DATABASE_URL .env | cut -d '=' -f2)}

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ 錯誤: DATABASE_URL 未設定${NC}"
  echo "請在 .env 檔案中設定 DATABASE_URL 或匯出環境變數"
  exit 1
fi

# 建立備份目錄
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}🚀 開始資料庫備份...${NC}"
echo "備份名稱: $BACKUP_NAME"
echo "時間戳記: $TIMESTAMP"
echo ""

# 執行備份
echo -e "${YELLOW}📦 正在備份資料庫...${NC}"
pg_dump "$DATABASE_URL" > "${BACKUP_DIR}/${BACKUP_NAME}.sql"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ 備份成功!${NC}"

  # 顯示備份檔案大小
  FILESIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.sql" | cut -f1)
  echo "檔案大小: $FILESIZE"
  echo "儲存路徑: ${BACKUP_DIR}/${BACKUP_NAME}.sql"

  # 壓縮備份
  echo ""
  echo -e "${YELLOW}📦 正在壓縮備份...${NC}"
  gzip "${BACKUP_DIR}/${BACKUP_NAME}.sql"

  COMPRESSED_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.sql.gz" | cut -f1)
  echo -e "${GREEN}✅ 壓縮完成!${NC}"
  echo "壓縮後大小: $COMPRESSED_SIZE"
  echo "最終路徑: ${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"

  # 列出最近的備份
  echo ""
  echo -e "${YELLOW}📋 最近的備份:${NC}"
  ls -lh "${BACKUP_DIR}" | tail -5

  # 清理超過 30 天的備份
  echo ""
  echo -e "${YELLOW}🗑️  清理舊備份...${NC}"
  find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +30 -delete
  echo -e "${GREEN}✅ 完成!${NC}"

else
  echo -e "${RED}❌ 備份失敗!${NC}"
  exit 1
fi
