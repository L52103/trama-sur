# Despliegue

Objetivo: frontend en Cloudflare Pages, API en Render y PostgreSQL/Storage en Supabase Pro.

## Reglas

- Producción usa secretos del proveedor, no archivos versionados.
- SSL en modo Full (strict), TLS 1.2 mínimo y redirección HTTPS.
- La API usa conexión PostgreSQL con SSL requerido, pool máximo 20 y `Include Error Detail=false`.
- Migraciones se revisan, prueban en staging y se ejecutan como paso controlado con backup previo.
- `/health/live` verifica proceso y `/health/ready` verifica dependencias críticas sin exponer detalles.
- No se activa producción hasta completar el checklist de `docs/LEGAL_CHILE.md` y probar Webpay con credenciales oficiales.

