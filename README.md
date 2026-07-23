# TRAMA SUR - ecommerce de ropa funcional

Monorepo de una tienda chilena de ropa funcional. La identidad **TRAMA SUR** es provisional: antes de producción se debe validar marca, dominio y razón social.

## Arquitectura

- `frontend/`: Angular 22, componentes standalone, signals y formularios reactivos.
- `backend/`: ASP.NET Core 10, arquitectura modular, Identity y EF Core con PostgreSQL.
- `docs/`: decisiones, seguridad, cumplimiento legal y despliegue.
- `design/`: conceptos visuales aprobables y tokens de diseño.

El navegador nunca es autoridad sobre precios, descuentos, stock ni estados de pago. Webpay se integra por redirección; la tienda no captura datos de tarjeta.

## Desarrollo local

1. Copiar `.env.example` a `.env` y reemplazar únicamente valores locales.
2. Iniciar PostgreSQL con `docker compose up -d postgres`.
3. Ejecutar el backend desde `backend/` con .NET 10.
4. Ejecutar el frontend desde `frontend/` con Node compatible y `pnpm start`.

No hay credenciales de producción en el repositorio. Los textos legales incluidos son plantillas técnicas y requieren completar los datos reales del proveedor y revisión profesional antes de publicar.

