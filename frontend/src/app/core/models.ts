export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  priceClp: number;
  compareAtPriceClp: number | null;
  currency: 'CLP';
  imageUrl: string;
  imageAlt: string;
  colors: string[];
  available: boolean;
  category: string;
  features: string[];
  badge?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  priceClp: number;
  available: boolean;
  availableQuantity: number;
}

export interface ProductDetail extends ProductCard {
  description: string;
  basePriceClp: number;
  categoryInfo: Category;
  images: { url: string; altText: string; isPrimary: boolean; width: number; height: number }[];
  variants: ProductVariant[];
  functionalAttributes: { name: string; value: string; unit?: string }[];
  materials: string;
  careInstructions: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CartLine {
  id: string;
  variantId: string;
  product: ProductCard;
  size: string;
  color: string;
  quantity: number;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  region: string;
  commune: string;
  addressLine1: string;
  addressLine2: string;
  instructions: string;
}

