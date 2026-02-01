#!/bin/bash

# ============================================
# EcommerceERP - Backup Script
# ============================================
# Esegue backup automatico di:
# - Database PostgreSQL
# - File uploads
# - Redis (opzionale)
#
# Utilizzo: ./backup.sh [daily|weekly|monthly]
# ============================================

set -e

# Configurazione
BACKUP_TYPE="${1:-daily}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAILY=7
RETENTION_WEEKLY=4
RETENTION_MONTHLY=12

# Variabili ambiente (da .env o docker)
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-ecommerce_erp}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Hetzner Storage Box (opzionale)
SFTP_HOST="${BACKUP_SFTP_HOST:-}"
SFTP_USER="${BACKUP_SFTP_USER:-}"
SFTP_PATH="${BACKUP_SFTP_PATH:-/backups}"

# Colori output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Crea directory backup
create_backup_dirs() {
    mkdir -p "$BACKUP_DIR/database/$BACKUP_TYPE"
    mkdir -p "$BACKUP_DIR/uploads/$BACKUP_TYPE"
    mkdir -p "$BACKUP_DIR/redis/$BACKUP_TYPE"
    log_info "Directory backup create"
}

# Backup Database PostgreSQL
backup_database() {
    log_info "Inizio backup database..."

    BACKUP_FILE="$BACKUP_DIR/database/$BACKUP_TYPE/ecommerceerp_${DATE}.sql.gz"

    # Se in docker, usa docker exec
    if command -v docker &> /dev/null && docker ps -q -f name=ecommerceerp-postgres &> /dev/null; then
        docker exec ecommerceerp-postgres pg_dump \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-acl \
            -F c \
            | gzip > "$BACKUP_FILE"
    else
        # Esecuzione diretta
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-acl \
            -F c \
            | gzip > "$BACKUP_FILE"
    fi

    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
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

    # Cerca directory uploads
    if [ -d "/app/uploads" ]; then
        UPLOADS_DIR="/app/uploads"
    elif [ -d "./uploads" ]; then
        UPLOADS_DIR="./uploads"
    else
        # Prova a copiare da docker volume
        if command -v docker &> /dev/null; then
            docker cp ecommerceerp-backend:/app/uploads /tmp/uploads_backup 2>/dev/null || true
            if [ -d "/tmp/uploads_backup" ]; then
                UPLOADS_DIR="/tmp/uploads_backup"
            fi
        fi
    fi

    if [ -n "$UPLOADS_DIR" ] && [ -d "$UPLOADS_DIR" ]; then
        tar -czf "$BACKUP_FILE" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)/"
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Uploads backup completato: $BACKUP_FILE ($SIZE)"
        # Cleanup temp
        rm -rf /tmp/uploads_backup 2>/dev/null || true
    else
        log_warn "Directory uploads non trovata, skip"
    fi
}

# Backup Redis (RDB snapshot)
backup_redis() {
    log_info "Inizio backup Redis..."

    BACKUP_FILE="$BACKUP_DIR/redis/$BACKUP_TYPE/redis_${DATE}.rdb"

    if command -v docker &> /dev/null && docker ps -q -f name=ecommerceerp-redis &> /dev/null; then
        # Trigger BGSAVE e copia il file
        docker exec ecommerceerp-redis redis-cli -a "$REDIS_PASSWORD" BGSAVE 2>/dev/null || true
        sleep 2
        docker cp ecommerceerp-redis:/data/dump.rdb "$BACKUP_FILE" 2>/dev/null || true

        if [ -f "$BACKUP_FILE" ]; then
            gzip "$BACKUP_FILE"
            log_info "Redis backup completato: ${BACKUP_FILE}.gz"
        else
            log_warn "Redis backup non disponibile, skip"
        fi
    else
        log_warn "Container Redis non trovato, skip"
    fi
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
    find "$BACKUP_DIR/redis/$BACKUP_TYPE" -type f -mtime +$RETENTION -delete 2>/dev/null || true

    log_info "Pulizia completata (retention: $RETENTION giorni)"
}

# Upload su Hetzner Storage Box (SFTP)
upload_to_storagebox() {
    if [ -z "$SFTP_HOST" ] || [ -z "$SFTP_USER" ]; then
        log_warn "Hetzner Storage Box non configurato, skip upload offsite"
        return
    fi

    log_info "Upload backup su Hetzner Storage Box..."

    # Usa lftp per sync (più robusto di scp)
    if command -v lftp &> /dev/null; then
        lftp -c "
            set sftp:auto-confirm yes
            open sftp://$SFTP_USER@$SFTP_HOST
            mirror -R --newer-than=now-1days $BACKUP_DIR $SFTP_PATH
            quit
        "
    else
        # Fallback a rsync via SSH
        rsync -avz --progress \
            -e "ssh -o StrictHostKeyChecking=no" \
            "$BACKUP_DIR/" \
            "$SFTP_USER@$SFTP_HOST:$SFTP_PATH/"
    fi

    if [ $? -eq 0 ]; then
        log_info "Upload Hetzner Storage Box completato"
    else
        log_error "Errore upload Hetzner Storage Box"
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

# Mostra statistiche
show_stats() {
    log_info "Statistiche backup:"

    for TYPE in daily weekly monthly; do
        if [ -d "$BACKUP_DIR/database/$TYPE" ]; then
            COUNT=$(ls -1 "$BACKUP_DIR/database/$TYPE/"*.gz 2>/dev/null | wc -l)
            SIZE=$(du -sh "$BACKUP_DIR/database/$TYPE" 2>/dev/null | cut -f1)
            log_info "  $TYPE: $COUNT backup, $SIZE"
        fi
    done

    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log_info "Spazio totale backup: $TOTAL_SIZE"
}

# Main
main() {
    log_info "============================================"
    log_info "EcommerceERP - Backup $BACKUP_TYPE"
    log_info "Data: $(date)"
    log_info "============================================"

    create_backup_dirs
    backup_database
    backup_uploads
    backup_redis
    verify_backup
    cleanup_old_backups
    upload_to_storagebox
    show_stats

    log_info "============================================"
    log_info "Backup completato con successo!"
    log_info "============================================"
}

main
