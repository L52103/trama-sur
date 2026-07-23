# Runbook mínimo

## Pago pendiente o doble retorno

1. Consultar por identificador interno, nunca por datos de tarjeta.
2. Revisar `payment_transactions`, idempotency key y auditoría.
3. Consultar estado oficial en Webpay.
4. Ejecutar reconciliación; no editar stock manualmente.

## Stock inconsistente

1. Pausar publicación de la variante.
2. Revisar movimientos y reservas activas.
3. Corregir mediante movimiento de ajuste con motivo y usuario.
4. Nunca cambiar `on_hand` directamente.

## Proveedor externo caído

La compra queda en estado recuperable. El outbox aplica reintentos exponenciales y dead-letter lógico. No se mantiene una transacción PostgreSQL abierta durante llamadas HTTP.

