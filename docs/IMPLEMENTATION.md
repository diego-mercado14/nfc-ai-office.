# Entrega 1.0

Rama: `feat/nfc-office-1`, base: `main`.

## Etapas realizadas

1. Inspección del repositorio completo y ejecución de las 5 pruebas originales.
2. Autenticación para dos socios, sesiones de 8 horas, scrypt, CSRF, validación de Host/origen y bitácora. Migración aditiva.
3. CRM editable, notas con autor y tareas asignadas; cotizaciones, pedidos únicos, pagos parciales y gastos.
4. Separación de ventas y cobros, centavos en pedidos y reparto por pedido. Agentes de consulta y borradores sin acciones externas.
5. Interfaz oscura responsive, formularios con validación y documentación de operación/despliegue.
6. Pruebas de API y recorrido real de navegador con datos temporales.

## Evidencia

- 11 pruebas de integración HTTP aprobadas: autenticación/CSRF/origen, contraseñas y sesiones, limitación de intentos y máximo de socios, CRM compartido, finanzas y deduplicación, validación, agentes/fallback, migración repetible, pedidos aceptados, concurrencia de pagos y migración desde v0.1.
- Recorrido Chromium aprobado: acceso, creación de negocio, nota, tarea, cotización, pedido, pago, gasto, agente de finanzas y cierre de sesión. Viewports 1440×1000 y 390×844; sin errores JavaScript ni desbordamiento de página.
- Compilación Python, sintaxis JavaScript y revisión de espacios del diff aprobadas.
- Ollama real y despliegue externo no verificados; ninguna publicación en producción realizada.

Las pruebas usan exclusivamente información temporal y eliminan sus bases. Revisa LIMITATIONS.md antes de decidir usar la aplicación con datos comerciales reales.
