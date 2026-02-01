#!/bin/bash

# ============================================
# EcommerceERP - Deploy Script per Hetzner VPS
# ============================================
# Script per deploy iniziale e aggiornamenti
#
# Prerequisiti:
# - Ubuntu 22.04 LTS
# - Docker installato
# - Git installato
# - File .env configurato
#
# Utilizzo:
#   ./deploy.sh setup     # Setup iniziale server
#   ./deploy.sh deploy    # Deploy applicazione
#   ./deploy.sh update    # Aggiorna applicazione
#   ./deploy.sh rollback  # Rollback ultimo deploy
#   ./deploy.sh status    # Stato servizi
#   ./deploy.sh logs      # Mostra logs
# ============================================

set -e

# Configurazione
APP_DIR="${APP_DIR:-/opt/ecommerceerp}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
GIT_BRANCH="${GIT_BRANCH:-main}"

# Colori output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_step() {
    echo -e "\n${BLUE}==>${NC} $1\n"
}

# Verifica prerequisiti
check_prerequisites() {
    log_step "Verifica prerequisiti..."

    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker non installato. Esegui: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi

    # Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose v2 non installato"
        exit 1
    fi

    # Git
    if ! command -v git &> /dev/null; then
        log_error "Git non installato. Esegui: apt install git"
        exit 1
    fi

    log_info "Prerequisiti OK"
}

# Setup iniziale server (da eseguire una volta)
setup_server() {
    log_step "Setup iniziale server Hetzner..."

    # Aggiornamenti sistema
    log_info "Aggiornamento sistema..."
    apt update && apt upgrade -y

    # Installa dipendenze
    log_info "Installazione dipendenze..."
    apt install -y curl git htop unzip

    # Docker (se non installato)
    if ! command -v docker &> /dev/null; then
        log_info "Installazione Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
    fi

    # Utente deploy (opzionale)
    if ! id "deploy" &>/dev/null; then
        log_info "Creazione utente deploy..."
        useradd -m -s /bin/bash deploy
        usermod -aG docker deploy
    fi

    # Firewall
    log_info "Configurazione firewall..."
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable

    # Directory applicazione
    mkdir -p "$APP_DIR"
    mkdir -p "$BACKUP_DIR"

    # Cron per backup
    log_info "Configurazione backup automatico..."
    (crontab -l 2>/dev/null; echo "0 3 * * * $APP_DIR/scripts/backup.sh daily >> /var/log/backup.log 2>&1") | sort -u | crontab -
    (crontab -l 2>/dev/null; echo "0 4 * * 0 $APP_DIR/scripts/backup.sh weekly >> /var/log/backup.log 2>&1") | sort -u | crontab -
    (crontab -l 2>/dev/null; echo "0 5 1 * * $APP_DIR/scripts/backup.sh monthly >> /var/log/backup.log 2>&1") | sort -u | crontab -

    log_info "Setup completato!"
    log_info "Prossimi passi:"
    log_info "  1. Clona il repository in $APP_DIR"
    log_info "  2. Copia .env.production.example in .env e configura"
    log_info "  3. Esegui: ./scripts/deploy.sh deploy"
}

# Deploy applicazione
deploy() {
    log_step "Deploy EcommerceERP..."

    cd "$APP_DIR"

    # Verifica .env
    if [ ! -f ".env" ]; then
        log_error "File .env non trovato!"
        log_info "Copia .env.production.example in .env e configura"
        exit 1
    fi

    # Backup pre-deploy (se esistono container)
    if docker ps -q -f name=ecommerceerp-postgres &> /dev/null; then
        log_info "Esecuzione backup pre-deploy..."
        ./scripts/backup.sh daily || true
    fi

    # Salva commit corrente per rollback
    CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")
    echo "$CURRENT_COMMIT" > .last-deploy-commit

    # Pull ultime modifiche
    log_info "Pull modifiche da Git..."
    git fetch origin
    git checkout "$GIT_BRANCH"
    git pull origin "$GIT_BRANCH"

    # Build e deploy
    log_info "Build immagini Docker..."
    docker compose -f "$COMPOSE_FILE" build --pull

    log_info "Avvio servizi..."
    docker compose -f "$COMPOSE_FILE" up -d

    # Attendi che i servizi siano healthy
    log_info "Attesa avvio servizi..."
    sleep 10

    # Migrazioni database
    log_info "Esecuzione migrazioni database..."
    docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy || {
        log_error "Errore migrazioni! Rollback consigliato."
        exit 1
    }

    # Verifica health
    verify_health

    log_info "Deploy completato con successo!"
    show_status
}

# Aggiorna applicazione (senza rebuild completo)
update() {
    log_step "Aggiornamento EcommerceERP..."

    cd "$APP_DIR"

    # Backup pre-update
    log_info "Esecuzione backup pre-update..."
    ./scripts/backup.sh daily || true

    # Salva commit corrente
    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "$CURRENT_COMMIT" > .last-deploy-commit

    # Pull modifiche
    log_info "Pull modifiche da Git..."
    git fetch origin
    git pull origin "$GIT_BRANCH"

    # Rebuild solo se necessario
    log_info "Ricostruzione immagini..."
    docker compose -f "$COMPOSE_FILE" build

    # Restart servizi con zero-downtime
    log_info "Riavvio servizi..."
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate

    # Migrazioni
    log_info "Verifica migrazioni..."
    docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

    verify_health

    log_info "Aggiornamento completato!"
}

# Rollback all'ultimo deploy
rollback() {
    log_step "Rollback EcommerceERP..."

    cd "$APP_DIR"

    if [ ! -f ".last-deploy-commit" ]; then
        log_error "Nessun commit precedente trovato per rollback"
        exit 1
    fi

    PREVIOUS_COMMIT=$(cat .last-deploy-commit)
    log_info "Rollback al commit: $PREVIOUS_COMMIT"

    git checkout "$PREVIOUS_COMMIT"

    docker compose -f "$COMPOSE_FILE" build
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate

    verify_health

    log_info "Rollback completato!"
}

# Verifica health dei servizi
verify_health() {
    log_info "Verifica health servizi..."

    # Attendi che i container siano up
    sleep 5

    # Check backend
    BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' ecommerceerp-backend 2>/dev/null || echo "unknown")
    if [ "$BACKEND_HEALTH" != "healthy" ]; then
        log_warn "Backend non healthy: $BACKEND_HEALTH"
        # Attendi ancora
        sleep 10
        BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' ecommerceerp-backend 2>/dev/null || echo "unknown")
    fi

    # Check API endpoint
    API_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health 2>/dev/null || echo "000")
    if [ "$API_CHECK" == "200" ]; then
        log_info "API health check: OK"
    else
        log_warn "API health check: $API_CHECK"
    fi

    # Check database
    DB_CHECK=$(docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres 2>/dev/null && echo "OK" || echo "FAIL")
    log_info "Database check: $DB_CHECK"

    # Check Redis
    REDIS_CHECK=$(docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null || echo "FAIL")
    log_info "Redis check: $REDIS_CHECK"
}

# Mostra stato servizi
show_status() {
    log_step "Stato servizi EcommerceERP"

    cd "$APP_DIR" 2>/dev/null || cd /opt/ecommerceerp

    echo ""
    docker compose -f "$COMPOSE_FILE" ps
    echo ""

    # Uso risorse
    log_info "Utilizzo risorse:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep ecommerceerp || true

    # Spazio disco
    echo ""
    log_info "Spazio disco:"
    df -h / | tail -1

    # Spazio Docker
    echo ""
    log_info "Spazio Docker:"
    docker system df
}

# Mostra logs
show_logs() {
    SERVICE="${2:-}"

    cd "$APP_DIR" 2>/dev/null || cd /opt/ecommerceerp

    if [ -n "$SERVICE" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
    else
        docker compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Restart servizio specifico
restart_service() {
    SERVICE="${2:-}"

    cd "$APP_DIR" 2>/dev/null || cd /opt/ecommerceerp

    if [ -n "$SERVICE" ]; then
        log_info "Riavvio $SERVICE..."
        docker compose -f "$COMPOSE_FILE" restart "$SERVICE"
    else
        log_info "Riavvio tutti i servizi..."
        docker compose -f "$COMPOSE_FILE" restart
    fi
}

# Help
show_help() {
    echo "EcommerceERP - Script di Deploy"
    echo ""
    echo "Utilizzo: $0 <comando> [opzioni]"
    echo ""
    echo "Comandi:"
    echo "  setup       Setup iniziale server (solo prima volta)"
    echo "  deploy      Deploy completo applicazione"
    echo "  update      Aggiorna applicazione"
    echo "  rollback    Rollback all'ultimo deploy"
    echo "  status      Mostra stato servizi"
    echo "  logs [svc]  Mostra logs (opzionale: servizio specifico)"
    echo "  restart [s] Riavvia servizi (opzionale: servizio specifico)"
    echo "  help        Mostra questo messaggio"
    echo ""
    echo "Esempi:"
    echo "  $0 deploy           # Deploy completo"
    echo "  $0 logs backend     # Logs solo backend"
    echo "  $0 restart redis    # Riavvia solo Redis"
}

# Main
case "${1:-help}" in
    setup)
        check_prerequisites
        setup_server
        ;;
    deploy)
        check_prerequisites
        deploy
        ;;
    update)
        check_prerequisites
        update
        ;;
    rollback)
        rollback
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$@"
        ;;
    restart)
        restart_service "$@"
        ;;
    health)
        verify_health
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Comando sconosciuto: $1"
        show_help
        exit 1
        ;;
esac
