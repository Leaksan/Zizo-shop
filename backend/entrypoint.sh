#!/bin/sh
set -e

echo "Initialisation/seed de la base de donnees..."
python seed.py || true

echo "Demarrage de gunicorn..."
exec gunicorn --preload --bind 0.0.0.0:${PORT:-5000} --workers 1 --timeout 120 app:app
