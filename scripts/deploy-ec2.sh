#!/usr/bin/env bash
# CredAxis — one-command EC2 deploy
# Pulls backend + website + admin + games-webview, builds frontends,
# copies admin under /admin/, symlinks games for Express /games/,
# restarts API + reloads nginx.
#
# On EC2 (after backend git pull):
#   bash ~/credaxis-backend/scripts/deploy-ec2.sh
# Or install once:
#   cp ~/credaxis-backend/scripts/deploy-ec2.sh ~/deploy-credaxis.sh
#   chmod +x ~/deploy-credaxis.sh
#   ~/deploy-credaxis.sh
#
set -euo pipefail

HOME_DIR="${HOME:-/home/ec2-user}"
BACKEND_DIR="${BACKEND_DIR:-$HOME_DIR/credaxis-backend}"
WEBSITE_DIR="${WEBSITE_DIR:-$HOME_DIR/credaxis-website}"
ADMIN_DIR="${ADMIN_DIR:-$HOME_DIR/credaxis-admin_pannel}"
GAMES_DIR="${GAMES_DIR:-$HOME_DIR/credaxis-games-webview}"
# Express looks for ../../games-webview/dist from backend/src → ~/games-webview
GAMES_LINK="${GAMES_LINK:-$HOME_DIR/games-webview}"
PM2_APP="${PM2_APP:-credaxis-api}"
BRANCH="${BRANCH:-main}"

# EC2 is deploy-only: discard local tracked edits on frontends so pull never aborts.
# Backend keeps .env; only tracked code is soft-pulled (stash first).
HARD_RESET_FRONTENDS="${HARD_RESET_FRONTENDS:-1}"

log() { echo ""; echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

need_dir() {
  [[ -d "$1" ]] || die "Folder not found: $1"
}

git_pull_hard() {
  local dir="$1"
  need_dir "$dir"
  cd "$dir"
  log "Git pull (hard): $dir @ $BRANCH"
  git fetch origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  git clean -fd -e .env -e .env.local -e .env.*.local -e node_modules -e dist -e public/uploads
}

git_pull_soft() {
  local dir="$1"
  need_dir "$dir"
  cd "$dir"
  log "Git pull (keep .env): $dir @ $BRANCH"
  git stash push -m "deploy-credaxis-$(date +%Y%m%d%H%M%S)" -- || true
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH" || git pull origin "$BRANCH"
}

write_admin_env() {
  cat > "$ADMIN_DIR/.env.production" << 'EOF'
VITE_BASE_PATH=/admin/
VITE_API_BASE_URL=/api
EOF
}

write_website_env() {
  cat > "$WEBSITE_DIR/.env.production" << 'EOF'
VITE_BASE_PATH=/
VITE_ADMIN_PATH=/admin
EOF
}

write_games_env() {
  cat > "$GAMES_DIR/.env.production" << 'EOF'
VITE_BASE_PATH=/games/
EOF
}

restart_pm2() {
  log "PM2 restart: $PM2_APP"
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
      pm2 restart "$PM2_APP"
    else
      cd "$BACKEND_DIR"
      pm2 start src/server.js --name "$PM2_APP"
      pm2 save || true
    fi
    pm2 status "$PM2_APP" || true
  else
    echo "WARN: pm2 not found — start API manually"
  fi
}

log "CredAxis deploy starting"
echo "  backend : $BACKEND_DIR"
echo "  website : $WEBSITE_DIR"
echo "  admin   : $ADMIN_DIR"
echo "  games   : $GAMES_DIR → $GAMES_LINK"

need_dir "$BACKEND_DIR"
need_dir "$WEBSITE_DIR"
need_dir "$ADMIN_DIR"
need_dir "$GAMES_DIR"

# ---------- PULL ----------
if [[ "$HARD_RESET_FRONTENDS" == "1" ]]; then
  git_pull_hard "$WEBSITE_DIR"
  git_pull_hard "$ADMIN_DIR"
  git_pull_hard "$GAMES_DIR"
else
  git_pull_soft "$WEBSITE_DIR"
  git_pull_soft "$ADMIN_DIR"
  git_pull_soft "$GAMES_DIR"
fi
git_pull_soft "$BACKEND_DIR"

# ---------- ENV (frontends) ----------
log "Writing production env files"
write_website_env
write_admin_env
write_games_env

# ---------- BACKEND deps ----------
log "Backend: npm install"
cd "$BACKEND_DIR"
npm install --omit=dev

# ---------- WEBSITE BUILD ----------
log "Website: npm install + build (base /)"
cd "$WEBSITE_DIR"
npm install
npm run build
[[ -f dist/index.html ]] || die "Website build failed — dist/index.html missing"

# ---------- ADMIN BUILD ----------
log "Admin: npm install + build (base /admin/)"
cd "$ADMIN_DIR"
npm install
npm run build
[[ -f dist/index.html ]] || die "Admin build failed — dist/index.html missing"

if ! grep -q '/admin/' dist/index.html; then
  echo "Admin index.html asset paths:"
  grep -E 'src=|href=' dist/index.html || true
  die "Admin build missing /admin/ prefix — check vite.config.js + .env.production"
fi

# ---------- COPY ADMIN INTO WEBSITE ----------
log "Copy admin → website/dist/admin/"
rm -rf "$WEBSITE_DIR/dist/admin"
mkdir -p "$WEBSITE_DIR/dist/admin"
cp -r "$ADMIN_DIR/dist/"* "$WEBSITE_DIR/dist/admin/"
[[ -f "$WEBSITE_DIR/dist/admin/index.html" ]] || die "Admin copy failed"
[[ -d "$WEBSITE_DIR/dist/admin/assets" ]] || die "Admin assets folder missing after copy"

# ---------- GAMES BUILD ----------
log "Games: npm install + build (base /games/)"
cd "$GAMES_DIR"
npm install
npm run build
[[ -f dist/index.html ]] || die "Games build failed — dist/index.html missing"

if ! grep -q '/games/' dist/index.html; then
  echo "Games index.html asset paths:"
  grep -E 'src=|href=' dist/index.html || true
  die "Games build missing /games/ prefix — check vite.config.js + .env.production"
fi

log "Symlink games for Express: $GAMES_LINK → $GAMES_DIR"
ln -sfn "$GAMES_DIR" "$GAMES_LINK"
[[ -f "$GAMES_LINK/dist/index.html" ]] || die "Games symlink broken — $GAMES_LINK/dist/index.html missing"

# ---------- PM2 (after games dist exists so Express hasGames=true) ----------
restart_pm2

# ---------- NGINX ----------
log "Nginx reload"
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
else
  echo "WARN: nginx not found — skip reload"
fi

# ---------- VERIFY ----------
log "Verify"
echo "Website:"
ls -la "$WEBSITE_DIR/dist/index.html"
grep -o '<title>[^<]*</title>' "$WEBSITE_DIR/dist/index.html" || true
echo "Admin:"
ls -la "$WEBSITE_DIR/dist/admin/index.html"
ls -la "$WEBSITE_DIR/dist/admin/assets/" | head -6
echo "Admin asset sample:"
grep -oE 'src="[^"]+"' "$WEBSITE_DIR/dist/admin/index.html" | head -3
echo "Games:"
ls -la "$GAMES_LINK/dist/index.html"
grep -o '<title>[^<]*</title>' "$GAMES_LINK/dist/index.html" || true
grep -oE 'src="[^"]+"' "$GAMES_LINK/dist/index.html" | head -3

JS_FILE="$(ls "$WEBSITE_DIR/dist/admin/assets/"*.js 2>/dev/null | head -1 || true)"
if [[ -n "$JS_FILE" ]]; then
  JS_NAME="$(basename "$JS_FILE")"
  echo ""
  echo "Local nginx check (optional):"
  curl -sI "http://127.0.0.1/admin/assets/${JS_NAME}" | head -5 || true
  echo "Expect Content-Type: application/javascript (NOT text/html)"
fi

echo ""
echo "Local games check (Express):"
curl -sI "http://127.0.0.1:5000/games/" | head -5 || true
curl -s "http://127.0.0.1:5000/games/" | grep -o '<title>[^<]*</title>' || true

echo ""
log "DONE"
echo "  https://www.mycredaxis.com/        → website"
echo "  https://www.mycredaxis.com/admin/  → admin"
echo "  https://www.mycredaxis.com/games/  → games (nginx → Express)"
echo "  https://www.mycredaxis.com/api/    → API (via nginx)"
echo ""
echo "If admin is white screen: nginx must use:"
echo "  location ^~ /admin/ { try_files \$uri \$uri/ /admin/index.html; }"
echo "  (no alias)  root = $WEBSITE_DIR/dist"
echo ""
echo "If games shows website HTML: nginx needs:"
echo "  location ^~ /games/ { proxy_pass http://127.0.0.1:5000/games/; ... }"
