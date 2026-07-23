# Sistema visual provisional - TRAMA SUR

Fuente visual: `design/concepts/*.png`. Los conceptos fijan jerarquía, ritmo, densidad y tratamiento editorial; la interfaz final debe mantener texto y controles en HTML.

## Tokens

```scss
--color-bg: #ffffff;
--color-text: #151515;
--color-muted: #60635f;
--color-border: #d9dcd9;
--color-surface: #f5f6f5;
--color-brand: #1f5a3d;
--color-brand-strong: #17442f;
--color-error: #b42318;
--color-success: #17653a;
--radius-control: 2px;
--shadow-focus: 0 0 0 3px rgba(31, 90, 61, .25);
--content-max: 1440px;
```

## Tipografía

- Interfaz y cuerpo: `Inter`, `Arial`, sans-serif; fallback del sistema sin bloquear render.
- Titulares editoriales: `Georgia`, `Times New Roman`, serif.
- Controles: 14-16 px, peso 550-650, nunca tipografía por defecto del navegador.
- Cuerpo: 16 px / 1.55. Etiquetas: 13-14 px. H1 desktop: 56-72 px; móvil: 40-48 px.

## Geometría y contenedores

- Fondo verdadero blanco, sin crema ni degradados.
- Bordes de 1 px y radios de 0-2 px.
- Nada de tarjetas flotantes o bento grids como estructura por defecto.
- Catálogo: dos columnas móvil, tres o cuatro escritorio según ancho.
- Imágenes con relación estable y `object-fit: cover`; sin overlays de color.

## Componentes

Header, announcement bar, mega menú/drawer, búsqueda, hero editorial, rail de categorías, product card/grid, filtros, galería, selector de variantes, mini-cart, carrito, checkout, cuenta, timeline, tablas y editores administrativos.

## Interacción y accesibilidad

- Focus visible de alto contraste y touch targets mínimos de 44 px.
- Modales/drawers con focus trap, Escape y restauración de foco.
- Estado agotado expresado en texto y semántica, no solo color.
- Animación 160-240 ms; se elimina con `prefers-reduced-motion`.
- Loading, vacío, error y éxito diseñados para cada flujo.

## Inventario de iconos

Iconos lineales de 1.75 px, extremos redondeados, `currentColor`: menú, buscar, cuenta, corazón, bolsa, cerrar, chevron, filtro, ordenar, ubicación, camión, candado, eliminar y más/menos. Se implementan con una biblioteca consistente o SVG accesible; no se usan glifos de texto.

