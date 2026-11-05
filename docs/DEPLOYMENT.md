# Compartir la instalación de forma segura

Usa una única máquina y base SQLite para los dos socios. El backend siempre escucha en 127.0.0.1. No compartas la base por Dropbox/NFS ni ejecutes varias instancias contra copias diferentes.

1. Crea un usuario de sistema dedicado, instala Python actualizado y coloca el checkout fuera de directorios públicos. Restringe la carpeta de datos a ese usuario (0700 y archivos 0600).
2. Crea las dos cuentas por consola. Usa contraseñas únicas y largas. No existen usuarios públicos ni cuentas automáticas.
3. Configura `NFC_DB_PATH` fuera del checkout, `PORT=8765` y `NFC_ORIGIN=https://office.tudominio.mx` en el servicio. El origen HTTPS activa cookies Secure y HSTS. No establezcas HTTPS sin un proxy TLS real.
4. Configura un proxy inverso actualizado con certificado válido, límite de cuerpo 30 KB, tiempos de espera de 75 segundos y límite de solicitudes/conexiones. Conserva el encabezado Host original. Ejemplo conceptual para Caddy:

```caddyfile
office.tudominio.mx {
    request_body {
        max_size 30KB
    }
    reverse_proxy 127.0.0.1:8765
}
```

Este ejemplo necesita tu dominio y DNS reales; no se ejecutó un despliegue. El límite de intentos de login interno se aplica a la IP directa del proxy (10 intentos/15 min compartidos). Usa adicionalmente restricciones de acceso por VPN/red privada y límites del proxy; el backend no confía en X-Forwarded-For proporcionado por clientes.

5. Ejecuta `python3 server.py` bajo un supervisor como systemd con usuario dedicado, directorio de trabajo correcto, reinicio controlado y variables exportadas. No uses el servidor de desarrollo con un túnel público sin TLS/proxy.
6. Verifica desde ambos equipos: login, cierre de sesión, datos compartidos, rechazo del API sin cookie, cookie Secure y certificado válido. Comprueba que el puerto 8765 no es accesible externamente.
7. Ensaya respaldo y restauración antes de cargar datos reales. Mantén el sistema operativo actualizado.

SQLite y el servidor estándar son apropiados para bajo volumen, pero no se verificaron bajo cargas hostiles o muchas conexiones. Para exposición pública sostenida, realiza revisión de seguridad y migra el adaptador HTTP a un servidor/framework mantenido con controles de concurrencia y observabilidad. No hay MFA, restablecimiento por correo ni recuperación remota. Los socios tienen acceso completo al negocio.

No registres cuerpos, cookies, contraseñas ni prompts en logs del proxy. No publiques Ollama; escucha únicamente en una interfaz privada. La app no necesita Internet para el flujo principal.
