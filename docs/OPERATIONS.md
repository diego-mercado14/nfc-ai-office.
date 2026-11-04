# Operación

## Respaldo y restauración

Conserva respaldos privados cifrados fuera del repositorio y restringe su acceso. Usa la API de respaldo SQLite para obtener una copia consistente incluso mientras el servidor corre:

```sh
python3 - <<'PY'
import sqlite3
source=sqlite3.connect('data/office.db')
backup=sqlite3.connect('/ruta/privada/office-backup.db')
source.backup(backup)
backup.close()
source.close()
PY
```

Ajusta ambas rutas a tu instalación y no sobrescribas una copia valiosa. Antes de restaurar, detén el servicio, conserva una copia recuperable de la base actual, reemplaza el archivo con el respaldo y verifica `PRAGMA integrity_check`. Elimina las sesiones restauradas (`DELETE FROM sessions`) antes de arrancar. Los respaldos contienen datos personales y hashes de contraseñas. Define una política de retención y comprueba periódicamente una restauración en una instalación aislada.

## Recuperación y errores

- Cuenta bloqueada por intentos: espera 15 minutos. El límite comparte IP si utilizas proxy.
- Contraseña olvidada: `python3 server.py reset-password --username socio_a` desde la consola autorizada; revoca sesiones de esa cuenta.
- Host no autorizado: revisa `NFC_ORIGIN`, puerto y Host del proxy.
- Error al guardar: revisa campos obligatorios, fecha válida, existencia del negocio, saldo y estado aceptado de la cotización.
- Ollama no responde: ventas usa plantilla; no se pierde el resto del flujo.
- Cambios de reparto solo afectan pedidos nuevos. Revisa cada porcentaje antes de confirmar el pedido.

Los registros de pago son declaraciones manuales y deben conciliarse contra comprobantes reales. No existen devoluciones ni cancelaciones financieras automáticas. Para correcciones, conserva la evidencia y solicita una migración revisada; no edites una base activa improvisadamente.
