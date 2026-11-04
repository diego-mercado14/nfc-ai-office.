# Verificación manual del MVP

Realiza estas pruebas después de ejecutar python server.py:

1. Abre http://127.0.0.1:8765. Debe cargar la interfaz sin instalar npm.
2. En Visión general comprueba que los cuatro indicadores inician en cero.
3. Agrega un negocio de prueba (ej. Café Ejemplo) con contacto y teléfono.
4. En Prospectos cambia de Nuevo a Contactado; recarga la página y verifica que se conservó.
5. Crea una cotización de 2 tarjetas por un total de 500 MXN, con costo unitario de 20 MXN.
6. Acepta la cotización; el dashboard debe mostrar ventas de 500 MXN y utilidad estimada de 460 MXN; la participación orientativa por socio es 230 MXN.
7. Abre Agentes IA y ejecuta Coordinador, Prospección y Ventas. Todos deben mostrar un resultado.
8. Sin Ollama, Ventas debe indicar modo PLANTILLA. Con Ollama y qwen2.5:1.5b disponible, debe intentar modo OLLAMA.
9. Pulsa Copiar texto y comprueba que puedes pegar el borrador en otra aplicación.
10. Reinicia el servidor y verifica que los registros siguen guardados en SQLite.
11. Comprueba que al abrir http://127.0.0.1:8765 en otra computadora no será accesible: esta edición es solo local.
12. Prueba la interfaz desde un navegador móvil usando herramientas de desarrollo, sin abrir el servidor a una red pública.

## Pruebas automáticas

Ejecuta:

    python -m unittest discover -s tests -v

Las pruebas no deben modificar la base de datos real. Usan un directorio temporal.
GitHub Actions ejecuta esta suite en cada cambio a main y en cada pull request.

## Seguridad

- No publiques una base de datos real ni credenciales en el repositorio.
- No abras el puerto local a Internet.
- Los borradores generados por IA requieren revisión humana.
- Antes de acceso para dos personas en línea, implementar usuarios y permisos, HTTPS, respaldo y validación de entradas.
