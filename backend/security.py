"""Autenticación sin servicios de terceros (PBKDF2-HMAC + token HMAC)."""
import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time

ITERATIONS = 500_000


def hash_password(password: str, salt: bytes | None = None) -> str:
    if len(password) < 12:
        raise ValueError("La contraseña debe tener al menos 12 caracteres")
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def valid_password_hash(stored: str) -> bool:
    """Validate PBKDF2 hash metadata before accepting admin readiness.

    This checks encoding, algorithm, work factor and salt/digest lengths;
    only a successful password verification proves the password itself.
    """
    if not isinstance(stored, str):
        return False
    parts = stored.split('$')
    if len(parts) != 4:
        return False
    algorithm, iterations, salt, digest = parts
    if (algorithm != 'pbkdf2_sha256' or not iterations.isascii() or
            not iterations.isdecimal() or not 1 <= len(iterations) <= 7):
        return False
    if not 100_000 <= int(iterations) <= 2_000_000:
        return False
    if len(salt) < 32 or len(salt) % 2 or len(digest) != 64:
        return False
    hexdigits = '0123456789abcdefABCDEF'
    return all(char in hexdigits for char in salt + digest)


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, digest = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(iterations)
        if rounds < 100_000 or rounds > 2_000_000:
            return False
        expected = bytes.fromhex(digest)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), rounds)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _decode(raw: str) -> bytes:
    return base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))


def issue_token(secret: str, ttl: int = 8 * 3600) -> str:
    payload = {"sub": "admin", "exp": int(time.time()) + ttl, "nonce": secrets.token_hex(8)}
    body = _encode(json.dumps(payload, separators=(",", ":")).encode())
    signature = _encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}"


def verify_token(token: str, secret: str) -> bool:
    try:
        body, signature = token.split(".")
        expected = _encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return False
        payload = json.loads(_decode(body))
        if not isinstance(payload, dict):
            return False
        return payload.get("sub") == "admin" and type(payload.get("exp")) is int and payload["exp"] > int(time.time())
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, binascii.Error):
        return False
