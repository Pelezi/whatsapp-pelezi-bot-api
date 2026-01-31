#!/bin/sh
set -e

# Config ---------------------------------------------------------------------
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_NAME=uvas
DB_USER=postgres
BACKUPS_PATH=backups
BACKUP_FILENAME=$DB_NAME.sql
JSON_BACKUP_FILENAME=$DB_NAME.json
# ----------------------------------------------------------------------------

# Display menu
echo "==================================="
echo "  Database Backup/Restore Menu"
echo "==================================="
echo "1) Backup remote into local"
echo "2) Restore remote from latest backup"
echo "3) Restore local from latest backup"
echo "4) Backup local and apply to remote"
echo "5) Exit"
echo "==================================="
read -p "Please select an option (1-5): " choice

case $choice in
  1)
    echo "==> Backup remote into local"
    
    echo "Removing potential existing backups..."
    if [ -d "$BACKUPS_PATH" ]; then rm -Rf $BACKUPS_PATH; fi
    
    echo "Creating a folder to handle backups"
    mkdir $BACKUPS_PATH && cd $BACKUPS_PATH
    
    echo "Backuping remote render db..."
    pg_dump -d $DATABASE_REMOTE_URL --clean --if-exists --no-owner --no-privileges > ${BACKUP_FILENAME}
    
    echo "Dropping local db..."
    dropdb --username=postgres $DB_NAME
    
    echo "Recreating local db..."
    createdb --owner=postgres --username=postgres $DB_NAME
    
    echo "Restoring local db from backup..."
    psql -d $DB_NAME -f $BACKUP_FILENAME --username=postgres
    
    echo "✓ Remote database backed up and restored to local successfully!"
    ;;
    
  2)
    echo "==> Restore remote from latest backup"
    
    if [ ! -f "$BACKUPS_PATH/$BACKUP_FILENAME" ]; then
      echo "Error: No backup file found at $BACKUPS_PATH/$BACKUP_FILENAME"
      exit 1
    fi
    
    echo "WARNING: This will overwrite the remote database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo "Operation cancelled."
      exit 0
    fi
    
    echo "Restoring remote database from backup..."
    psql -d $DATABASE_REMOTE_URL -f $BACKUPS_PATH/$BACKUP_FILENAME
    
    echo "✓ Remote database restored from backup successfully!"
    ;;
    
  3)
    echo "==> Restore local from latest backup"
    
    if [ ! -f "$BACKUPS_PATH/$BACKUP_FILENAME" ]; then
      echo "Error: No backup file found at $BACKUPS_PATH/$BACKUP_FILENAME"
      exit 1
    fi
    
    echo "WARNING: This will overwrite the local database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo "Operation cancelled."
      exit 0
    fi
    
    echo "Dropping local db..."
    dropdb --username=postgres $DB_NAME
    
    echo "Recreating local db..."
    createdb --owner=postgres --username=postgres $DB_NAME
    
    echo "Restoring local db from backup..."
    psql -d $DB_NAME -f $BACKUPS_PATH/$BACKUP_FILENAME --username=postgres
    
    echo "✓ Local database restored from backup successfully!"
    ;;
    
  4)
    echo "==> Backup local and apply to remote"
    
    echo "Removing potential existing backups..."
    if [ -d "$BACKUPS_PATH" ]; then rm -Rf $BACKUPS_PATH; fi
    
    echo "Creating a folder to handle backups"
    mkdir $BACKUPS_PATH && cd $BACKUPS_PATH
    
    echo "Backing up local database..."
    pg_dump -d $DB_NAME --username=postgres --clean --if-exists --no-owner --no-privileges > ${BACKUP_FILENAME}
    
    echo "WARNING: This will overwrite the remote database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo "Operation cancelled."
      exit 0
    fi
    
    echo "Applying local backup to remote database..."
    psql -d $DATABASE_REMOTE_URL -f $BACKUP_FILENAME
    
    echo "✓ Local database backed up and applied to remote successfully!"
    ;;
    
  5)
    echo "Exiting..."
    exit 0
    ;;
    
  *)
    echo "Invalid option. Please select 1-5."
    exit 1
    ;;
esac