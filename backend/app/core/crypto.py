from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.encryption_key:
            raise RuntimeError(
                "ENCRYPTION_KEY is not configured — required to store payment credentials. "
                'Generate one with: python -c "from cryptography.fernet import Fernet; '
                'print(Fernet.generate_key().decode())" and set it in backend/.env'
            )
        _fernet = Fernet(settings.encryption_key.encode())
    return _fernet


def encrypt_secret(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return _get_fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        raise ValueError("Stored value could not be decrypted — was it encrypted with a different key?")
