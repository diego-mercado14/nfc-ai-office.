"""Password hashing and opaque, expiring sessions; no credentials in source."""

import hashlib
import hmac
import secrets
import time


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    key = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return salt + ":" + key.hex()


def verify(password, stored):
    return hmac.compare_digest(password_hash(password, stored.split(":")[0]), stored)


def create_user(c, username, password):
    if (
        not username
        or len(username) > 60
        or not username.isascii()
        or not username.replace("_", "").isalnum()
    ):
        raise ValueError(
            "Usuario: letras ASCII, números o guion bajo, máximo 60 caracteres"
        )
    if not 12 <= len(password) <= 256:
        raise ValueError("La contraseña debe tener entre 12 y 256 caracteres")
    if c.execute("SELECT count(*) FROM users").fetchone()[0] >= 2:
        raise ValueError("Solo se permiten dos socios")
    c.execute(
        "INSERT INTO users(username,password) VALUES (?,?)",
        (username, password_hash(password)),
    )


def login(c, username, password, address):
    now = time.time()
    c.execute("DELETE FROM attempts WHERE created < ?", (now - 900,))
    if (
        c.execute(
            "SELECT count(*) FROM attempts WHERE address=?", (address,)
        ).fetchone()[0]
        >= 10
    ):
        raise ValueError("Demasiados intentos. Espera 15 minutos")
    c.execute("INSERT INTO attempts VALUES (?,?)", (address, now))
    user = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    # Equal-cost hash for unknown usernames.
    stored = user["password"] if user else password_hash("unused-password", "00" * 16)
    valid = verify(password, stored)
    if not user or not valid:
        return None
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    c.execute("DELETE FROM sessions WHERE expires < ?", (now,))
    c.execute(
        "INSERT INTO sessions VALUES (?,?,?,?)",
        (digest(token), user["id"], csrf, now + 28800),
    )
    return {
        "token": token,
        "csrf": csrf,
        "username": user["username"],
        "id": user["id"],
    }
