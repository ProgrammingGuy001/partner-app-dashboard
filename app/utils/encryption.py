import base64
import binascii
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

from app.config import settings

ENC_PREFIX = "enc:"

_key_cache: Optional[bytes] = None


def _get_key() -> bytes:
    global _key_cache
    if _key_cache is None:
        raw = settings.KYC_ENCRYPTION_KEY.strip()
        key = bytes.fromhex(raw)

        if len(key) != 32:
            raise ValueError("KYC_ENCRYPTION_KEY must be 64 hex characters (32 bytes)")

        _key_cache = key

    return _key_cache


# 🔐 Encrypt (AES-256-GCM)
def encrypt(plaintext: str) -> str:
    if plaintext is None:
        return None

    # Avoid double encryption
    if isinstance(plaintext, str) and plaintext.startswith(ENC_PREFIX):
        return plaintext

    key = _get_key()
    nonce = os.urandom(12)  # 96-bit nonce (GCM standard)

    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)

    token = base64.b64encode(nonce + ciphertext).decode()

    return ENC_PREFIX + token


# 🔓 Decrypt (safe for mixed data)
def decrypt(token: str) -> str:
    if token is None:
        return None

    # 👉 Plaintext fallback (critical for migration)
    if not isinstance(token, str) or not token.startswith(ENC_PREFIX):
        return token

    token = token[len(ENC_PREFIX):]

    try:
        raw = base64.b64decode(token.encode())
    except ValueError:
        return token  # corrupted or not base64

    if len(raw) < 12:
        return token  # invalid

    nonce, ciphertext = raw[:12], raw[12:]

    key = _get_key()
    aesgcm = AESGCM(key)

    try:
        return aesgcm.decrypt(nonce, ciphertext, None).decode()
    except Exception:
        # tampered or wrong key
        return token


# 🧱 SQLAlchemy field type
class EncryptedString(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt(value)