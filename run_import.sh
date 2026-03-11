#!/usr/bin/env bash
set -euo pipefail

# Simple import script for WSL (Ubuntu). Edit variables below if needed.
SQLPATH="/mnt/c/Users/icile/OneDrive/Desktop/SMS/compostela_sms_postgresql_converted.sql"
DBHOST="${DBHOST:-127.0.0.1}"
DBUSER="${DBUSER:-pg_user}"
DBNAME="${DBNAME:-compostela-sms}"

echo "Importing $SQLPATH into $DBUSER@$DBHOST/$DBNAME"

# Prefer to set PGPASSWORD in the environment to avoid interactive prompt:
# export PGPASSWORD='yourpassword'

if [ -z "${PGPASSWORD:-}" ]; then
  echo "PGPASSWORD not set — psql will prompt for password if required."
fi

psql -h "$DBHOST" -U "$DBUSER" -d "$DBNAME" -f "$SQLPATH"

echo "Import finished. If there were no errors, run sequence/boolean fixes next."
