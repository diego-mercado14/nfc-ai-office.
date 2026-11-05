# Oficina virtual NFC AI Office

La oficina es la primera pantalla después del acceso. Está integrada sobre la aplicación 1.0, conservando sus vistas de administración, API, autenticación y esquema SQLite. Rama: `feat/pixel-office`, basada en `feat/nfc-office-1`.

## Uso

Inicia la aplicación como antes:

```sh
python3 server.py
```

Abre `http://127.0.0.1:8765` e inicia sesión con una de las cuentas existentes. Si es una instalación nueva, crea las cuentas siguiendo el README. No necesitas instalar dependencias de frontend, descargar assets ni usar una API de pago.

- Selecciona un personaje o su tarjeta inferior: su panel muestra la herramienta, explicación y último resultado guardado.
- Coordinador consulta métricas y tareas; Prospección analiza un negocio registrado; Ventas prepara un borrador; Finanzas consulta pedidos y saldos.
- Selecciona un negocio antes de usar Prospección o Ventas. El selector conserva su elección en esta sesión.
- El tablero mural abre Seguimiento; el librero abre el CRM. Las métricas inferiores también son accesos a las vistas existentes.
- El menú lateral conserva todas las operaciones empresariales. **Visión general** mantiene el dashboard tradicional y **Centro de agentes** conserva la lista e historial.
- En móvil, el panel se coloca debajo del escenario. Al seleccionar un agente se desplaza al panel; los personajes también son accesibles mediante botones grandes en la lista inferior.
- Los botones funcionan con teclado y tienen nombres accesibles. Puedes pausar las animaciones o activar movimiento reducido en el sistema.

## Estados verificables

| Estado | Evidencia | Representación |
| --- | --- | --- |
| Disponible | Sin petición pendiente conocida en esta pestaña | Reposo y parpadeo decorativo; no implica trabajo |
| Ejecutando | Petición real a `/api/agents/run` pendiente de respuesta | Movimiento de manos; botón de ejecución deshabilitado |
| Resultado listo | Respuesta satisfactoria del servidor con ID y resultado | Gesto breve de finalización; texto del servidor |
| Sin confirmar | Fallo de red o error del servidor | Aviso explícito; nunca se presenta como éxito |

Entrar a la oficina, seleccionar personajes o abrir herramientas **no ejecuta agentes**. Solo el botón de herramienta inicia la petición. No hay temporizadores que fabriquen actividad ni resultados. En las pruebas se retiene una petición real antes de enviarla al servidor para observar la animación pendiente; la respuesta mostrada proviene del backend real.

El historial es una fotografía del momento de ejecución. El modo se muestra como reglas, plantilla sin modelo u Ollama. Un fallo de red puede ocurrir después de que el servidor haya guardado un resultado: consulta el historial antes de reintentar. No se envían mensajes, hacen cobros ni ejecutan acciones externas desde la oficina.

## Arquitectura y recursos originales

- `web/office.js`: escena Canvas 2D, mapa isométrico, mobiliario, sprites, controles HTML y estado transitorio por agente.
- `web/office.css`: escenario, menú, tarjetas, panel contextual y adaptación por ancho.
- `web/app.js`: navegación y puente único de ejecución usado tanto por la oficina como por la administración; conserva la sesión y CSRF existentes.
- `web/index.html`: carga local de los dos nuevos recursos.
- `domain.py`: únicamente se añaden los dos archivos a la lista explícita de recursos estáticos. No cambian reglas comerciales, migraciones ni tablas.

Los recursos son originales y están dibujados en código: parquet, paredes, ventana, tablero, libros, computadoras, escritorios, sillas, sofá, plantas y personajes con paletas distintas. Los sprites usan una matriz de píxeles y la escena coordenadas enteras. No se extrajeron imágenes, sprites, logotipos ni sonidos de TaskVille o las otras referencias. Para editar arte, modifica `painter`, `pixels` y las paletas de `agents`; no hace falta una herramienta propietaria.

Canvas tiene resolución lógica fija de 480×340 y escalado `pixelated`. El fondo se dibuja una vez por montaje, en un canvas auxiliar; solo los personajes se recomponen durante animación. No se usa PixiJS: cuatro personajes y una habitación estática no requieren su motor, dependencias ni GPU. Los dos buffers RGBA ocupan aproximadamente 1.25 MiB, sin contar navegador y DOM. No se cargan fuentes ni assets externos.

La escena se actualiza como máximo cada 125 ms (8 cuadros por segundo, estilo sprite). El planificador se detiene con pestaña oculta, pausa o movimiento reducido y se libera al navegar o cerrar sesión. El estado transitorio se limpia al cerrar sesión/expirar y las respuestas tardías no abren de nuevo la vista de un usuario anterior.

## Validación reproducible

```sh
python3 -m unittest discover -s tests -v
node --check web/app.js
node --check web/office.js
python3 tests/browser_smoke.py
python3 tests/office_browser.py
```

Las pruebas de navegador opcionales requieren Playwright para Python y Chromium en `/usr/bin/chromium`. No son dependencias de ejecución de la aplicación. Ambas crean una base temporal, cuenta de prueba y servidor local; eliminan los datos al finalizar.

`office_browser.py` verifica: entrada sin ejecuciones automáticas, cuatro agentes, solicitudes reales de las cuatro herramientas, estado pendiente y finalización, prevención de duplicados, navegación durante ejecución, errores de red, accesos del mobiliario, teclado, expiración de sesión, pausa, movimiento reducido, liberación del planificador al navegar, acceso administrativo sin Canvas y límites de redibujado. Comprueba ausencia de desbordamiento de página a 320, 390 y 1024 px y captura escritorio a 1560 px.

Capturas verificadas en Chromium, con cuenta y datos temporales de prueba:

- [Escritorio](screenshots/office-desktop.png)
- [Celular](screenshots/office-mobile.png)
- [Petición real pendiente](screenshots/office-working.png)
- [Resultado real de finanzas](screenshots/office-result.png)

Para regenerarlas, usa `NFC_SCREENSHOTS=/ruta/de/salida python3 tests/office_browser.py`. El directorio predeterminado es `/workspace/scratch/pixel-office`.

## Resultados de esta entrega

- Las 11 pruebas de API existentes pasaron.
- El recorrido empresarial anterior (`browser_smoke.py`) pasó: CRM, notas, tareas, cotizaciones, pedidos, pagos, gastos, finanzas y logout.
- El recorrido de oficina (`office_browser.py`) pasó, incluidas las cuatro herramientas y sus estados de error/éxito, móvil y accesibilidad por teclado.
- La instrumentación del canvas registró 8 redibujados en 1.1 segundos; pausa y movimiento reducido produjeron cuadros idénticos, y no hubo redibujado tras navegar fuera.
- Sintaxis JavaScript, compilación Python y revisión del diff aprobadas.

## Limitaciones pendientes

- Estado de ejecución observado únicamente en esta pestaña. El backend actual no ofrece cola de trabajos, progreso porcentual, cancelación o presencia entre socios. Recargar pierde el estado transitorio, pero conserva resultados guardados.
- Las animaciones no representan autonomía, productividad, energía ni trabajo de fondo. No se muestran barras de progreso inventadas.
- Si Canvas no está disponible, las pantallas administrativas siguen siendo la ruta de operación; la escena está pensada para navegadores modernos con Canvas 2D y CSS `:has()`.
- Se verificó Chromium en tamaños de escritorio, tableta y móvil, no Safari/Firefox ni lectores de pantalla físicos. No se hizo un benchmark en un equipo físico de 8 GB; el diseño limita resolución, frecuencia y recursos por construcción.
- Ollama sigue siendo opcional; la prueba de ventas permite el modo plantilla. No se descargó ni verificó un modelo real.
- El escenario no incluye desplazamiento libre de personajes, editor de mobiliario o persistencia de distribución. Se priorizó la interacción funcional con los cuatro agentes.
- Continúan aplicando las limitaciones de seguridad, despliegue y contabilidad de la versión 1.0. Esta entrega no despliega ni publica el entorno.
