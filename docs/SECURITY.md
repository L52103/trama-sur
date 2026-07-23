# Modelo de seguridad operativo

## Límites de confianza

- El navegador es no confiable.
- La API valida propiedad, permisos, precio, promociones, inventario y transición de estados.
- PostgreSQL no se expone al navegador.
- Las claves de Supabase, Resend y Transbank existen solo en el backend y en el proveedor de secretos.
- Webpay aloja el formulario de tarjeta; la tienda no captura ni registra PAN, CVV ni datos equivalentes.

## Controles obligatorios

- TLS, HSTS en producción, CORS por lista permitida y límites de tamaño.
- Rate limiting distinto para autenticación, contacto y pagos.
- Identity con email confirmado, bloqueo progresivo y roles/policies.
- Refresh tokens rotativos almacenados por hash; detección de reutilización.
- CSRF para endpoints autenticados por cookie.
- Idempotencia en creación/confirmación de pago y comandos críticos.
- Transacciones cortas y bloqueo consistente de inventario.
- Logs estructurados sin secretos, tokens, RUT completo, dirección completa ni datos de tarjeta.
- Auditoría de precio, stock, roles, pedidos, publicación y exportaciones.
- Dependencias y contenedores escaneados en CI.

## Incidentes

Ante sospecha de compromiso: deshabilitar despliegues, rotar secretos, revocar sesiones, preservar logs, revisar auditoría, notificar responsables y evaluar obligaciones legales. Ver `docs/RUNBOOK.md`.

