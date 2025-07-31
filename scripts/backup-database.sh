#!/bin/bash

# Database Backup Script for Lab Results System
# This script creates automated backups with rotation

set -e

# Configuration from environment variables
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-laborresults_prod}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_LOCATION:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/laborresults_backup_${TIMESTAMP}.sql"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to send notification (implement as needed)
send_notification() {
    local status=$1
    local message=$2
    
    # You can implement email notifications, Slack, etc.
    log "NOTIFICATION: $status - $message"
}

# Function to clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -name "laborresults_backup_*.sql*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "laborresults_backup_*.sql.gz*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    log "Cleanup completed"
}

# Function to verify backup
verify_backup() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file does not exist: $backup_file"
        return 1
    fi
    
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [ "$file_size" -lt 1000 ]; then
        log "ERROR: Backup file too small (${file_size} bytes): $backup_file"
        return 1
    fi
    
    # Test if the backup is a valid SQL file
    if ! head -n 10 "$backup_file" | grep -q "PostgreSQL database dump"; then
        log "ERROR: Backup file does not appear to be a valid PostgreSQL dump: $backup_file"
        return 1
    fi
    
    log "Backup verification successful: $backup_file ($file_size bytes)"
    return 0
}

# Main backup function
perform_backup() {
    log "Starting database backup..."
    log "Database: $DB_HOST:$DB_PORT/$DB_NAME"
    log "Backup file: $BACKUP_FILE"
    
    # Set PostgreSQL password from environment
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create the backup
    if pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        --file="$BACKUP_FILE" 2>>"$LOG_FILE"; then
        
        log "Database backup completed successfully"
        
        # Verify the backup
        if verify_backup "$BACKUP_FILE"; then
            # Compress the backup
            gzip "$BACKUP_FILE"
            BACKUP_FILE="${BACKUP_FILE}.gz"
            log "Backup compressed: $BACKUP_FILE"
            
            # Calculate final size
            local final_size=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
            log "Final backup size: $final_size bytes"
            
            send_notification "SUCCESS" "Database backup completed successfully: $BACKUP_FILE ($final_size bytes)"
            return 0
        else
            log "ERROR: Backup verification failed"
            rm -f "$BACKUP_FILE" 2>/dev/null || true
            send_notification "ERROR" "Backup verification failed"
            return 1
        fi
    else
        log "ERROR: Database backup failed"
        send_notification "ERROR" "Database backup failed"
        return 1
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file not found: $backup_file"
        exit 1
    fi
    
    log "Starting database restore from: $backup_file"
    
    # Confirm before restore
    read -p "Are you sure you want to restore the database? This will overwrite existing data. (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # If backup is compressed, decompress it first
    if [[ "$backup_file" == *.gz ]]; then
        log "Decompressing backup file..."
        gunzip -c "$backup_file" | psql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --username="$DB_USER" \
            --dbname="postgres" 2>>"$LOG_FILE"
    else
        psql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --username="$DB_USER" \
            --dbname="postgres" \
            --file="$backup_file" 2>>"$LOG_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        log "Database restore completed successfully"
        send_notification "SUCCESS" "Database restore completed from: $backup_file"
    else
        log "ERROR: Database restore failed"
        send_notification "ERROR" "Database restore failed from: $backup_file"
        exit 1
    fi
}

# Function to list available backups
list_backups() {
    log "Available backups in $BACKUP_DIR:"
    ls -lah "$BACKUP_DIR"/laborresults_backup_*.sql* 2>/dev/null || log "No backups found"
}

# Main script logic
case "${1:-backup}" in
    "backup")
        perform_backup
        cleanup_old_backups
        ;;
    "restore")
        restore_backup "$2"
        ;;
    "list")
        list_backups
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "verify")
        if [ -z "$2" ]; then
            echo "Usage: $0 verify <backup_file>"
            exit 1
        fi
        verify_backup "$2"
        ;;
    *)
        echo "Usage: $0 {backup|restore|list|cleanup|verify} [backup_file]"
        echo "  backup  - Create a new backup"
        echo "  restore - Restore from backup file"
        echo "  list    - List available backups"
        echo "  cleanup - Remove old backups"
        echo "  verify  - Verify backup file"
        exit 1
        ;;
esac