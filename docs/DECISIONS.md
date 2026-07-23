# Decisiones de arquitectura

## ADR-001 - Monolito modular

Se usa Angular 22 + ASP.NET Core 10 + PostgreSQL. El backend se divide en Domain, Application, Infrastructure y API. No se introducen microservicios en la primera versión.

## ADR-002 - Dinero y autoridad comercial

Todos los montos CLP se representan como enteros (`long` / `bigint`). El backend recalcula precio, promociones, despacho y stock. Los ítems de pedido guardan snapshots inmutables.

## ADR-003 - Pagos

Webpay Plus REST es el único medio de pago previsto para el lanzamiento. El backend crea y confirma transacciones, valida monto y orden, y procesa el resultado de forma idempotente. Nunca se confía en la redirección del navegador por sí sola.

## ADR-004 - Identidad y sesiones

ASP.NET Core Identity administra contraseñas y roles. El access token es corto y vive en memoria. El refresh token será aleatorio, rotativo, almacenado como hash y transportado en cookie HttpOnly, Secure y acotada a la ruta de refresh.

## ADR-005 - Marca provisional

TRAMA SUR es un nombre de trabajo para construir una experiencia coherente. No se declara disponibilidad marcaria ni de dominio. Debe reemplazarse o validarse antes del lanzamiento.

