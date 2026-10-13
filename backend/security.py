"""Autenticación sin servicios de terceros (PBKDF2-HMAC + token HMAC)."""
import base64
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
        return payload.get("sub") == "admin" and isinstance(payload.get("exp"), int) and payload["exp"] > int(time.time())
    except (ValueError, TypeError, KeyError, UnicodeDecodeError):
        return False
