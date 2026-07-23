import { Category, ProductCard, ProductDetail } from './models';

export const CATEGORIES: Category[] = [
  { id: '01', name: 'Mujer', slug: 'mujer', description: 'Capas versátiles para todos los ritmos.' },
  { id: '02', name: 'Hombre', slug: 'hombre', description: 'Diseño técnico para la vida diaria.' },
  { id: '03', name: 'Unisex', slug: 'unisex', description: 'Esenciales sin etiquetas.' },
  { id: '04', name: 'Abrigos', slug: 'abrigos', description: 'Protección liviana para el clima chileno.' },
  { id: '05', name: 'Tops', slug: 'tops', description: 'Primeras capas respirables.' },
  { id: '06', name: 'Pantalones', slug: 'pantalones', description: 'Movimiento y durabilidad.' },
];

const imageByType: Record<string, string> = {
  chaqueta: '/assets/images/chaqueta-commuter.png',
  sobrecamisa: '/assets/images/sobrecamisa-bosque.png',
  polera: '/assets/images/polera-organica.png',
  pantalon: '/assets/images/pantalon-travel.png',
};

const seed: Array<[string, string, number, string, string[], string[], string?]> = [
  ['Chaqueta Commuter', 'chaqueta', 79990, 'abrigos', ['Grafito', 'Bosque'], ['Repelente al agua', 'Cortaviento'], 'Nuevo'],
  ['Sobrecamisa Nativa', 'sobrecamisa', 56990, 'mujer', ['Bosque', 'Arena'], ['Respirable', 'Bolsillos seguros']],
  ['Polera Base 240', 'polera', 24990, 'unisex', ['Crudo', 'Negro'], ['Algodón orgánico', 'Antiolor']],
  ['Pantalón Ruta', 'pantalon', 62990, 'pantalones', ['Negro', 'Grafito'], ['Elasticidad 4D', 'Secado rápido'], 'Más vendido'],
  ['Cortaviento Pacífico', 'chaqueta', 69990, 'abrigos', ['Bosque', 'Grafito'], ['Ultraliviano', 'Compactable']],
  ['Camisa Travesía', 'sobrecamisa', 47990, 'hombre', ['Oliva', 'Arena'], ['Control térmico', 'UPF 40']],
  ['Polera Merino Sur', 'polera', 39990, 'tops', ['Crudo', 'Carbón'], ['Termorreguladora', 'Antiolor']],
  ['Pantalón Metro', 'pantalon', 58990, 'hombre', ['Negro', 'Oliva'], ['Antimanchas', 'Elasticidad 4D']],
  ['Parka Lluvia Cero', 'chaqueta', 94990, 'mujer', ['Grafito', 'Bosque'], ['Impermeable', 'Costuras selladas'], 'Edición limitada'],
  ['Sobrecamisa Litoral', 'sobrecamisa', 54990, 'unisex', ['Bosque', 'Azul noche'], ['Respirable', 'Resistente']],
  ['Polera Movimiento', 'polera', 27990, 'mujer', ['Crudo', 'Bosque'], ['Secado rápido', 'Elasticidad']],
  ['Jogger Nómada', 'pantalon', 51990, 'pantalones', ['Negro', 'Grafito'], ['Liviano', 'Bolsillos seguros']],
  ['Chaqueta Andina', 'chaqueta', 89990, 'hombre', ['Grafito', 'Arena'], ['Aislación ligera', 'Cortaviento']],
  ['Camisa Modular', 'sobrecamisa', 49990, 'tops', ['Oliva', 'Crudo'], ['Ventilación', 'Fácil cuidado']],
  ['Polera Segunda Piel', 'polera', 29990, 'unisex', ['Negro', 'Crudo'], ['Suavidad', 'Respirable']],
  ['Pantalón Oficina Activa', 'pantalon', 64990, 'mujer', ['Negro', 'Grafito'], ['Sin arrugas', 'Elasticidad 4D']],
  ['Chaqueta Bruma', 'chaqueta', 74990, 'abrigos', ['Bosque', 'Carbón'], ['Repelente al agua', 'Respirable']],
  ['Sobrecamisa Cordillera', 'sobrecamisa', 59990, 'hombre', ['Bosque', 'Arena'], ['Térmica', 'Durable']],
  ['Polera Essential', 'polera', 21990, 'tops', ['Crudo', 'Negro'], ['Algodón orgánico', 'Prelavada']],
  ['Pantalón Expedición Urbana', 'pantalon', 67990, 'unisex', ['Negro', 'Oliva'], ['Resistente', 'Secado rápido']],
];

const titleSlug = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const DEMO_PRODUCTS: ProductCard[] = seed.map(([name, type, price, category, colors, features, badge], index) => ({
  id: `01950000-0000-7000-8000-${String(index + 1).padStart(12, '0')}`,
  name,
  slug: titleSlug(name),
  shortDescription: `${features[0]}. Diseñada en Chile para acompañarte todos los días.`,
  priceClp: price,
  compareAtPriceClp: index === 3 || index === 8 ? price + 15000 : null,
  currency: 'CLP',
  imageUrl: imageByType[type],
  imageAlt: `${name} en fotografía de producto sobre fondo claro`,
  colors,
  available: true,
  category,
  features,
  badge,
}));

const colorHex: Record<string, string> = { Grafito: '#3e4143', Bosque: '#38493b', Arena: '#c6bba9', Crudo: '#eeeae1', Negro: '#171717', Oliva: '#59604b', 'Azul noche': '#28333f', Carbón: '#303234' };

export function demoProductDetail(slug: string): ProductDetail | undefined {
  const product = DEMO_PRODUCTS.find(item => item.slug === slug);
  if (!product) return undefined;
  const categoryInfo = CATEGORIES.find(item => item.slug === product.category) ?? CATEGORIES[2];
  const variants = product.colors.flatMap((color, colorIndex) => ['XS', 'S', 'M', 'L', 'XL'].map((size, sizeIndex) => ({
    id: `${product.id.slice(0, -2)}${String(colorIndex * 5 + sizeIndex + 1).padStart(2, '0')}`,
    sku: `TS-${product.slug.slice(0, 5).toUpperCase()}-${colorIndex + 1}-${size}`,
    color,
    colorHex: colorHex[color] ?? '#444444',
    size,
    priceClp: product.priceClp,
    available: !(colorIndex === 1 && size === 'XS'),
    availableQuantity: colorIndex === 1 && size === 'XS' ? 0 : 5 + sizeIndex,
  })));
  return {
    ...product,
    basePriceClp: product.priceClp,
    categoryInfo,
    description: `${product.name} combina una silueta limpia con prestaciones reales para desplazarte, trabajar y viajar. Cada detalle fue simplificado para entregar comodidad duradera sin una estética excesivamente técnica.`,
    images: [
      { url: product.imageUrl, altText: product.imageAlt, isPrimary: true, width: 1365, height: 1706 },
      { url: product.imageUrl, altText: `Detalle de material de ${product.name}`, isPrimary: false, width: 1365, height: 1706 },
    ],
    variants,
    functionalAttributes: [
      { name: 'Protección', value: product.features[0] },
      { name: 'Rendimiento', value: product.features[1] },
      { name: 'Origen', value: 'Diseñada en Chile' },
    ],
    materials: 'Material principal seleccionado por durabilidad y fácil cuidado. Componentes libres de PFC añadidos.',
    careInstructions: 'Lavar a máquina con agua fría, ciclo suave. No usar blanqueador. Secar a la sombra.',
  };
}

