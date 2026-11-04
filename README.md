# NFC AI Office

Centro de operaciones gratuito y local para tarjetas NFC: prospectos, cotizaciones, indicadores y agentes de apoyo a ventas. Interfaz oscura adaptable a móvil y escritorio.

> **Estado: MVP v0.1.** Aplicación local en desarrollo. No es un CRM de producción, no tiene cuentas ni sincronización multiusuario, y no está alojada en Internet.

## Funciones incluidas

- Dashboard: prospectos, oportunidades activas, cotizaciones pendientes y utilidad estimada.
- Prospectos: crear negocios con contacto, teléfono, notas y etapa comercial.
- Cotizaciones: registrar cantidad, importe total, costo por tarjeta y estado.
- Coordinador: resumen y prioridades mediante reglas locales, sin un LLM.
- Prospección: analiza la información de un negocio ya registrado (no busca en la web).
- Ventas: prepara un borrador de WhatsApp con Ollama si está disponible; de lo contrario usa una plantilla. Nunca envía mensajes.
- SQLite: conserva los registros en la computadora, sin nube ni API de pago.
- Todas las acciones de contacto con clientes requieren revisión humana.

## Iniciar en Windows

Requisitos: **Python 3.10+**, Git y un navegador. No requiere instalar paquetes de Python.

1. En PowerShell, clona el repositorio usando un nombre de carpeta sin punto final:

   ~~~powershell
   git clone "https://github.com/diego-mercado14/nfc-ai-office." nfc-ai-office
   cd nfc-ai-office
   ~~~

2. Ejecuta el servidor:

   ~~~powershell
   py server.py
   ~~~

   Si tu PC no reconoce el comando py, usa python server.py.

3. Abre **http://127.0.0.1:8765** en el navegador.
4. Cuando quieras apagar el sistema, presiona Ctrl+C en PowerShell.

**Importante:** GitHub guardó el nombre del repositorio con un punto al final: nfc-ai-office. Utiliza la URL exacta que aparece arriba. La carpeta local puede tener el nombre normal sin punto.

Los registros aparecerán en **data/office.db** al iniciar el servidor. Este archivo queda fuera de GitHub: realiza copias de seguridad privadas si guardas datos reales.

## IA local gratuita (opcional)

El software funciona sin Ollama. Para que el agente de ventas use un modelo local:

1. Instala Ollama: https://ollama.com/.
2. Con Ollama ejecutándose, abre otra terminal y descarga un modelo pequeño:

   ~~~powershell
   ollama pull qwen2.5:1.5b
   ~~~

3. Recarga el dashboard. En Sistema podrás ver si Ollama está accesible.
4. En Agentes IA → Ventas, selecciona un prospecto y genera un borrador.

Si el modelo no está disponible o falla, el agente utiliza una plantilla. Con 8 GB de RAM conviene probar modelos pequeños y ejecutarlos de uno en uno. La descarga inicial sí requiere Internet.

Variables opcionales: PORT (predeterminado 8765), OLLAMA_MODEL (qwen2.5:1.5b), OLLAMA_URL (http://127.0.0.1:11434) y NFC_DB_PATH (ruta de SQLite).

## Código

- server.py — servidor HTTP en Python, SQLite y agentes.
- web/index.html — estructura visual del dashboard.
- web/styles.css — diseño responsive.
- web/app.js — interacciones y peticiones a la API.
- tests/ — pruebas automatizadas.
- data/ — datos locales (ignorados por Git).

El MVP usa **JavaScript sin dependencias**, en lugar de React, para arrancar sin Node ni npm. Podemos migrar la interfaz a React/TypeScript cuando validemos su utilidad real.

## Limitaciones y seguridad

- **NO publicar el servidor en Internet ni abrir puertos en el router.** Escucha únicamente en 127.0.0.1 y no cuenta con login.
- Tu primo puede usarlo por ahora en la misma computadora. Para entrar desde otro equipo o casa hará falta un servidor seguro, autenticación, sincronización y permisos.
- No realiza scraping de negocios, prospección en Internet, envíos automáticos de WhatsApp ni publicaciones.
- La prioridad calculada es una heurística de completitud de datos y etapa comercial; NO una probabilidad de cierre.
- La utilidad estimada descuenta solo costo directo por tarjeta de cotizaciones aceptadas; excluye envío, comisiones, impuestos y otros gastos.
- La división 50/50 mostrada es orientativa. Apliquen los acuerdos comerciales reales.
- No subas datos privados de clientes, credenciales, tokens ni la base de datos a GitHub.

## Colaboración

- Tú: supervisión técnica, código, decisiones y pruebas.
- Tu primo: operación comercial, pruebas y comentarios; no necesita saber programar.
- El código se cambia mediante ramas y pull requests; los pendientes se documentan como Issues.

## Próximas fases

1. MVP local con prospectos, cotizaciones y tres agentes — implementado.
2. Pruebas y ajuste del catálogo de precios y costos reales.
3. Cuentas seguras para los dos y sincronización multiusuario.
4. Investigación de negocios con fuentes públicas permitidas.
5. Automatizaciones con aprobación humana y registro de auditoría.

## Pruebas

~~~powershell
python -m unittest discover -s tests -v
~~~

Esta aplicación es una herramienta de apoyo. Toda acción de venta, cobro o envío debe ser aprobada por una persona.
