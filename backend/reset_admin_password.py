"""Mot de passe admin oublié : en définir un nouveau.

Le mot de passe est demandé dans le terminal (rien ne s'affiche pendant la saisie).

En local, à la racine du projet :
    .venv\\Scripts\\python backend\\reset_admin_password.py
En production (Render > Shell, dans le dossier /app) :
    python reset_admin_password.py
"""
import getpass
import sys

from app import app
from models import db, set_setting

MIN_LENGTH = 8


def main():
    password = getpass.getpass("Nouveau mot de passe admin : ")
    if len(password) < MIN_LENGTH:
        sys.exit(f"Trop court : {MIN_LENGTH} caractères minimum. Rien n'a été changé.")
    if getpass.getpass("Retapez-le pour confirmer : ") != password:
        sys.exit("Les deux saisies sont différentes. Rien n'a été changé.")
    with app.app_context():
        set_setting("admin_password", password)
        db.session.commit()
    print("Mot de passe admin changé. Connectez-vous sur /admin avec le nouveau mot de passe.")


if __name__ == "__main__":
    main()
