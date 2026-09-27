#!/bin/sh
set -e

echo "Initialisation/seed de la base de donnees..."
python seed.py || true

echo "Demarrage de gunicorn..."
# 1 processus (SQLite + état en mémoire) mais plusieurs threads : une requête
# lente (géocodage externe) ne bloque plus tout le site.
exec gunicorn --preload --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 8 --timeout 120 app:app
