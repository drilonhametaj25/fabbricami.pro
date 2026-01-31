#!/bin/bash

# ============================================
# PegasoWorld ERP - Backup Script
# ============================================
# Esegue backup automatico di:
# - Database PostgreSQL
# - File uploads
# - Configurazioni
#
# Utilizzo: ./backup.sh [daily|weekly|monthly]
# ============================================

set -e

# Configurazione
BACKUP_TYPE="${1:-daily}"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAILY=7
RETENTION_WEEKLY=4
RETENTION_MONTHLY=12

# Variabili ambiente (da .env)
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-pegasoworld}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# S3 (opzionale)
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_REGION="${BACKUP_S3_REGION:-eu-central-1}"

# Colori output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Crea directory backup
create_backup_dirs() {
    mkdir -p "$BACKUP_DIR/database/$BACKUP_TYPE"
    mkdir -p "$BACKUP_DIR/uploads/$BACKUP_TYPE"
    mkdir -p "$BACKUP_DIR/config/$BACKUP_TYPE"
    log_info "Directory backup create"
}

# Backup Database PostgreSQL
backup_database() {
    log_info "Inizio backup database..."

    BACKUP_FILE="$BACKUP_DIR/database/$BACKUP_TYPE/pegasoworld_${DATE}.sql.gz"

    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        -F c \
        | gzip > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Database backup completato: $BACKUP_FILE ($SIZE)"
    else
        log_error "Errore backup database"
        exit 1
    fi
}

# Backup Uploads
backup_uploads() {
    log_info "Inizio backup uploads..."

    BACKUP_FILE="$BACKUP_DIR/uploads/$BACKUP_TYPE/uploads_${DATE}.tar.gz"

    if [ -d "/app/uploads" ]; then
        tar -czf "$BACKUP_FILE" -C /app uploads/
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Uploads backup completato: $BACKUP_FILE ($SIZE)"
    else
        log_warn "Directory uploads non trovata, skip"
    fi
}

# Backup Configurazioni
backup_config() {
    log_info "Inizio backup configurazioni..."

    BACKUP_FILE="$BACKUP_DIR/config/$BACKUP_TYPE/config_${DATE}.tar.gz"

    # Backup file di configurazione (senza secrets)
    tar -czf "$BACKUP_FILE" \
        --exclude="*.env" \
        --exclude="node_modules" \
        -C /app \
        docker-compose.yml \
        docker-compose.prod.yml \
        prisma/schema.prisma \
        docker/ \
        2>/dev/null || true

    log_info "Config backup completato: $BACKUP_FILE"
}

# Pulizia vecchi backup
cleanup_old_backups() {
    log_info "Pulizia vecchi backup..."

    case "$BACKUP_TYPE" in
        daily)
            RETENTION=$RETENTION_DAILY
            ;;
        weekly)
            RETENTION=$RETENTION_WEEKLY
            ;;
        monthly)
            RETENTION=$RETENTION_MONTHLY
            ;;
    esac

    # Elimina backup più vecchi della retention
    find "$BACKUP_DIR/database/$BACKUP_TYPE" -type f -mtime +$RETENTION -delete 2>/dev/null || true
    find "$BACKUP_DIR/uploads/$BACKUP_TYPE" -type f -mtime +$RETENTION -delete 2>/dev/null || true
    find "$BACKUP_DIR/config/$BACKUP_TYPE" -type f -mtime +$RETENTION -delete 2>/dev/null || true

    log_info "Pulizia completata (retention: $RETENTION giorni)"
}

# Upload su S3 (opzionale)
upload_to_s3() {
    if [ -z "$S3_BUCKET" ]; then
        log_warn "S3 non configurato, skip upload"
        return
    fi

    log_info "Upload backup su S3..."

    # Usa AWS CLI per upload
    aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/backups/" \
        --region "$S3_REGION" \
        --only-show-errors

    if [ $? -eq 0 ]; then
        log_info "Upload S3 completato"
    else
        log_error "Errore upload S3"
    fi
}

# Verifica integrità backup
verify_backup() {
    log_info "Verifica integrità backup..."

    # Verifica file database
    DB_BACKUP=$(ls -t "$BACKUP_DIR/database/$BACKUP_TYPE/"*.sql.gz 2>/dev/null | head -1)
    if [ -f "$DB_BACKUP" ]; then
        gunzip -t "$DB_BACKUP" 2>/dev/null
        if [ $? -eq 0 ]; then
            log_info "Backup database integro"
        else
            log_error "Backup database corrotto!"
            exit 1
        fi
    fi
}

# Notifica completamento
send_notification() {
    # Invia notifica via webhook (opzionale)
    WEBHOOK_URL="${BACKUP_WEBHOOK_URL:-}"

    if [ -n "$WEBHOOK_URL" ]; then
        TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"Backup $BACKUP_TYPE completato\",
                \"date\": \"$DATE\",
                \"size\": \"$TOTAL_SIZE\",
                \"status\": \"success\"
            }" > /dev/null
    fi
}

# Main
main() {
    log_info "============================================"
    log_info "PegasoWorld ERP - Backup $BACKUP_TYPE"
    log_info "Data: $(date)"
    log_info "============================================"

    create_backup_dirs
    backup_database
    backup_uploads
    backup_config
    verify_backup
    cleanup_old_backups
    upload_to_s3
    send_notification

    log_info "============================================"
    log_info "Backup completato con successo!"
    log_info "============================================"
}

main
