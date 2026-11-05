# NFC AI Office 1.0

Oficina compartida para un negocio de tarjetas NFC operado por dos socios. Python 3.10+, SQLite y JavaScript sin dependencias de ejecución. Interfaz oscura responsive en español mexicano. No requiere una API de pago.

## Oficina virtual interactiva

Después del inicio de sesión se abre una oficina isométrica en pixel art original. Selecciona a Coordinador, Prospección, Ventas o Finanzas para ejecutar sus herramientas y consultar resultados reales. Las vistas empresariales tradicionales siguen en el menú. No hay ejecuciones automáticas ni nuevos paquetes de frontend.

Consulta [uso, arquitectura, capturas y pruebas de la oficina](docs/PIXEL_OFFICE.md).

## Instalar y arrancar

```sh
git clone https://github.com/diego-mercado14/nfc-ai-office. nfc-ai-office
cd nfc-ai-office
python3 server.py create-user --username socio_a
python3 server.py create-user --username socio_b
python3 server.py
```

En Windows utiliza `py` en lugar de `python3`. La consola solicita cada contraseña dos veces (mínimo 12 caracteres); nunca la pases como argumento ni la guardes en Git. Abre `http://127.0.0.1:8765` e inicia sesión. No hay credenciales predeterminadas ni registro público. Para recuperar una cuenta, ejecuta `python3 server.py reset-password --username socio_a`; se invalidan sus sesiones.

Las variables de `.env.example` se **exportan explícitamente** en la terminal o se configuran en el servicio; el servidor no carga archivos `.env`. `NFC_ORIGIN` debe coincidir con el origen del navegador. No se deben abrir puertos del servidor a Internet; sigue [despliegue seguro](docs/DEPLOYMENT.md) para compartir una instalación por HTTPS.

## Flujo de trabajo

1. Crea un negocio en **Prospectos y clientes**. Edita datos, cambia su etapa y agrega notas al historial. La etapa Cliente identifica negocios ganados.
2. En **Seguimiento**, asigna tareas a uno de los socios con fecha límite. Marca completadas o reabre pendientes.
3. En **Configuración**, establece precio y costo sugeridos por tarjeta y porcentaje del socio A; B recibe el resto. Ambos socios tienen los mismos permisos. A/B son etiquetas de su acuerdo, no IDs de cuenta.
4. Crea una cotización con cantidad, total acordado y costo unitario. El total se captura explícitamente para permitir paquetes y descuentos. El precio sugerido corresponde a una tarjeta; ajústalo al cambiar cantidad.
5. Marca aceptada la cotización después de la aceptación real y confirma **Crear pedido**. Solo se puede crear uno por cotización. El pedido fija precio, costo y reparto; queda bloqueado el estado de la cotización.
6. Registra pagos **ya recibidos** con referencia, gastos adicionales y avance del pedido. No se procesa ningún cobro. El servidor impide exceder el saldo y deduplica reintentos del mismo pago.
7. Consulta margen, saldo por cobrar y participación estimada por socio. Revisa la bitácora de operaciones.

Los pedidos y pagos usan centavos enteros MXN. Para conservar bases anteriores, las cotizaciones mantienen su esquema original y se convierten con redondeo decimal al crear el pedido. Margen = total del pedido − cantidad × costo directo − gastos adicionales. Cobrado = suma de pagos registrados. El reparto se fija por pedido; A recibe la división entera en centavos y B el resto, incluso si hay pérdida. No representa retiros, utilidad fiscal ni efectivo disponible. Agrega gastos solo una vez; el costo directo ya está descontado.

## Agentes y límites

- **Coordinador:** consulta métricas y tareas pendientes registradas; conserva el informe histórico.
- **Prospección asistida:** inspecciona un negocio registrado y señala datos faltantes. No investiga en la web ni estima probabilidad de compra.
- **Ventas:** crea un borrador con Ollama o una plantilla si el modelo no responde. Indica el modo utilizado. Los datos del cliente se incluyen en el prompt: usa únicamente un servidor Ollama de confianza.
- **Finanzas:** consulta pedidos, pagos, gastos, saldos y reparto en un informe verificable.

Son herramientas ejecutadas a petición del socio. No hay autonomía en segundo plano, envío de mensajes, publicaciones ni movimientos financieros. Los informes son fotografías del momento; vuelve a ejecutarlos si cambian los registros. El modelo puede equivocarse: revisa el borrador antes de usarlo.

Ollama es opcional. Instálalo por su canal oficial y ejecuta `ollama pull qwen2.5:1.5b` si tu equipo tiene recursos suficientes. No fue necesario descargar ni verificar ese modelo para validar el modo gratuito sin modelo. El alojamiento, electricidad, almacenamiento y dominio pueden tener costos; Python/SQLite no requieren licencias de pago.

## Verificar

```sh
python3 -m compileall -q server.py domain.py security.py tests
python3 -m unittest discover -s tests -v
node --check web/app.js
node --check web/office.js
```

Node solo se utiliza para comprobar sintaxis. Las pruebas crean bases temporales y servidores loopback. Para la prueba opcional de interfaz instala Playwright en un entorno de pruebas y Chromium; `python3 tests/browser_smoke.py` usa `/usr/bin/chromium` y genera capturas en `/tmp/nfc-office-ui`. Este recorrido comprueba login, CRM, notas, tareas, cotizaciones, pedidos, pagos, gastos, finanzas y logout en escritorio y móvil. No requiere datos reales.

## Datos y arquitectura

- `server.py`: HTTP, autenticación, CSRF y comandos de administración.
- `security.py`: scrypt, tokens opacos, expiración y limitación de intentos.
- `domain.py`: SQLite, migración aditiva, reglas comerciales y herramientas de agentes.
- `web/`: interfaz sin bibliotecas ni recursos de terceros.
- `tests/`: integración HTTP y prueba opcional de navegador.

La base predeterminada es `data/office.db`, ignorada por Git. Las migraciones son aditivas y conservan prospectos, cotizaciones y ejecuciones de v0.1. Haz un respaldo antes de actualizar. Los usuarios se crean después de migrar. Una cotización antigua aceptada no se considera ingreso hasta crear su pedido.

Consulta [operación y respaldos](docs/OPERATIONS.md), [despliegue](docs/DEPLOYMENT.md) y [limitaciones](docs/LIMITATIONS.md). Esta versión se valida como aplicación pequeña para dos usuarios; no se ha desplegado en producción ni sometido a una auditoría externa de seguridad.
