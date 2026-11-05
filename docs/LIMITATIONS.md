# Límites y siguientes pasos

- Dos socios con permisos equivalentes; no MFA, roles diferenciados ni registro de clientes externos.
- Servidor estándar con SQLite pensado para uso privado y poco tráfico; sin prueba de carga ni auditoría independiente.
- Sin CFDI, impuestos automáticos, inventario, devoluciones, cancelaciones financieras o retiros de socios. No reemplaza contabilidad fiscal.
- Precio sugerido por tarjeta; el total de cada cotización se captura manualmente. No incluye catálogo de productos, PDF ni facturación.
- No se borran registros desde la interfaz. Falta un flujo revisado para rectificar pagos/gastos y gestionar solicitudes de eliminación de datos personales.
- Las pantallas recargan el estado al guardar o pulsar Actualizar; no hay actualizaciones en tiempo real. Ediciones simultáneas del mismo negocio siguen la última escritura; movimientos financieros se serializan en transacciones SQLite.
- Bitácora identifica socio y operación, sin contenido personal; no es un registro inviolable ni un historial completo de valores anteriores.
- Se mantiene REAL en cotizaciones heredadas; los pedidos convierten importes a centavos. No hay multicurrency.
- Agentes basados en registros y reglas; Ollama opcional no se validó con un modelo descargado. No investigan fuentes externas ni ejecutan herramientas elegidas por el modelo.
- Pruebas visuales automatizadas en Chromium de escritorio y móvil; no se verificaron Safari/Firefox, lectores de pantalla ni dispositivos físicos NFC.

Prioridades posteriores: rectificaciones auditadas, respaldo automatizado cifrado con restauración probada, control de conflictos, documentos de cotización, MFA y adaptador HTTP de producción antes de exposición pública amplia.
