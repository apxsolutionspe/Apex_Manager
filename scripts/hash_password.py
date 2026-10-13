"""Genera un hash de contraseña local, sin subirlo a servicios externos."""
import getpass
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.security import hash_password

if __name__ == '__main__':
    password = getpass.getpass('Contraseña de administrador (mín. 12 caracteres): ')
    confirmation = getpass.getpass('Repetir contraseña: ')
    if password != confirmation:
        raise SystemExit('Las contraseñas no coinciden.')
    print("ADMIN_PASSWORD_HASH='" + hash_password(password) + "'")
