#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Step 1: Backend(Lambda) build
# ============================================================

echo "== Backend(Lambda) build start =="

# ===== 初期化 =====
rm -rf "backend/dist"
mkdir -p "backend/dist/app"

# ===== Lambda互換pip install =====
echo "-- installing dependencies with Lambda image --"
docker run --rm \
  --platform linux/amd64 \
  --entrypoint bash \
  -v "./backend:/app" \
  -w /app \
  public.ecr.aws/lambda/python:3.13 \
  -lc "python -m pip install -r requirements.txt -t dist --only-binary=:all:"

# ===== ソースコピー（ホスト側） =====
echo "-- copying application source --"
rsync -a \
  --exclude dist \
  "backend/app" \
  "backend/dist/"

echo "== Backend(Lambda) build complete =="

# ============================================================
# Step 2: Frontend build
# ============================================================

echo "== Frontend build start =="

docker run --rm \
    -v "./frontend:/app" \
    -w /app \
    node:24.1.0-slim \
    bash -c "npm i && npm run build"

echo "== Frontend build complete =="