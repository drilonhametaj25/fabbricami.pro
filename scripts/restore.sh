#!/bin/bash

# ============================================
# EcommerceERP - Restore Script
# ============================================
# Ripristina backup database
#
# Utilizzo:
#   ./restore.sh list                    # Lista backup disponibili
#   ./restore.sh <backup_file>           # Ripristina backup specifico
#   ./restore.sh latest                  # Ripristina ultimo backup
# ============================================

set -e

# Configurazione
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${POSTGRES_DB:-ecommerce_erp}"
DB_USER="${POSTGRES_USER:-postgres}"

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

# Lista backup disponibili
list_backups() {
    log_info "Backup database disponibili:"
    echo ""

    for TYPE in daily weekly monthly; do
        if [ -d "$BACKUP_DIR/database/$TYPE" ]; then
            COUNT=$(ls -1 "$BACKUP_DIR/database/$TYPE/"*.gz 2>/dev/null | wc -l)
            if [ "$COUNT" -gt 0 ]; then
                echo "=== $TYPE ($COUNT backup) ==="
                ls -lh "$BACKUP_DIR/database/$TYPE/"*.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
                echo ""
            fi
        fi
    done

    LATEST=$(find "$BACKUP_DIR/database" -name "*.gz" -type f 2>/dev/null | sort -r | head -1)
    if [ -n "$LATEST" ]; then
        log_info "Ultimo backup: $LATEST"
    fi
}

# Trova ultimo backup
get_latest_backup() {
    find "$BACKUP_DIR/database" -name "*.gz" -type f 2>/dev/null | sort -r | head -1
}

# Ripristina backup
restore_backup() {
    BACKUP_FILE="$1"

    # Se "latest", trova ultimo backup
    if [ "$BACKUP_FILE" == "latest" ]; then
        BACKUP_FILE=$(get_latest_backup)
        if [ -z "$BACKUP_FILE" ]; then
            log_error "Nessun backup trovato"
            exit 1
        fi
        log_info "Ultimo backup: $BACKUP_FILE"
    fi

    # Verifica file esiste
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "File backup non trovato: $BACKUP_FILE"
        exit 1
    fi

    # Conferma
    log_warn "ATTENZIONE: Questo sovrascriverà il database corrente!"
    read -p "Sei sicuro di voler procedere? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Operazione annullata"
        exit 0
    fi

    # Stop applicazione (opzionale ma consigliato)
    log_info "Fermando applicazione..."
    docker compose -f docker-compose.prod.yml stop backend 2>/dev/null || true

    # Ripristino
    log_info "Inizio ripristino da: $BACKUP_FILE"

    # Decomprimi e ripristina
    if command -v docker &> /dev/null && docker ps -q -f name=ecommerceerp-postgres &> /dev/null; then
        # Via Docker
        log_info "Ripristino via Docker..."

        # Drop e ricrea database
        docker exec ecommerceerp-postgres psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
        docker exec ecommerceerp-postgres psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true

        # Ripristina
        gunzip -c "$BACKUP_FILE" | docker exec -i ecommerceerp-postgres pg_restore \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-acl \
            --clean \
            --if-exists \
            2>/dev/null || {
                # Se pg_restore fallisce, prova con psql (per dump plain text)
                gunzip -c "$BACKUP_FILE" | docker exec -i ecommerceerp-postgres psql -U "$DB_USER" -d "$DB_NAME" 2>/dev/null
            }
    else
        log_error "Container PostgreSQL non in esecuzione"
        exit 1
    fi

    if [ $? -eq 0 ]; then
        log_info "Ripristino completato con successo!"
    else
        log_error "Errore durante il ripristino"
        exit 1
    fi

    # Riavvia applicazione
    log_info "Riavvio applicazione..."
    docker compose -f docker-compose.prod.yml start backend

    # Verifica
    sleep 5
    log_info "Verifica connessione database..."
    docker compose -f docker-compose.prod.yml exec -T backend npx prisma db pull --force 2>/dev/null && \
        log_info "Connessione database OK" || \
        log_warn "Verifica manualmente la connessione"

    log_info "Ripristino completato!"
}

# Help
show_help() {
    echo "EcommerceERP - Script di Restore"
    echo ""
    echo "Utilizzo: $0 <comando>"
    echo ""
    echo "Comandi:"
    echo "  list                  Lista backup disponibili"
    echo "  latest                Ripristina ultimo backup"
    echo "  <path/to/backup.gz>   Ripristina backup specifico"
    echo ""
    echo "Esempi:"
    echo "  $0 list"
    echo "  $0 latest"
    echo "  $0 /backups/database/daily/ecommerceerp_20240115_030000.sql.gz"
}

# Main
case "${1:-help}" in
    list)
        list_backups
        ;;
    latest)
        restore_backup "latest"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -f "$1" ]; then
            restore_backup "$1"
        else
            log_error "Comando o file non riconosciuto: $1"
            show_help
            exit 1
        fi
        ;;
esac
