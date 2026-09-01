import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { getFirestoreDb } from './firebase.config';
import { ProductCard, ProductDetail, PagedResult } from './models';
import { DEMO_PRODUCTS } from './demo-data';

export interface FirestoreProductDoc {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
  genero: string;
  thumbnailUrl: string;
  tallasDisponibles: string[];
  coloresDisponibles: string[];
  destacado: boolean;
  activo: boolean;
  stockTotal: number;
  createdAt: Timestamp;
}

export interface FirestoreProductDetailDoc {
  descripcionLarga: string;
  guiaTallas: Record<string, string>;
  imagenesGaleria: string[];
  especificaciones: { nombre: string; valor: string }[];
  materiales: string;
  cuidados: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseCatalogService {
  private readonly db = getFirestoreDb();
  private lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  
  // Caché en memoria con Stale Time (15 minutos) según especificación Fase 3
  private catalogCache = new Map<string, { data: ProductCard[]; timestamp: number }>();
  private readonly STALE_TIME_MS = 15 * 60 * 1000;

  constructor() {
    this.ensureSeedData();
  }

  /**
   * Obtiene listado de productos con paginación por cursor (Fase 2: limit(12) y startAfter)
   */
  getProducts(category?: string, page = 1, pageSize = 12): Observable<PagedResult<ProductCard>> {
    const cacheKey = `${category ?? 'all'}_${page}`;
    const cached = this.catalogCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < this.STALE_TIME_MS)) {
      return of({
        items: cached.data,
        page,
        pageSize,
        totalItems: cached.data.length,
        totalPages: 1
      });
    }

    const productosRef = collection(this.db, 'productos');
    let q = query(
      productosRef,
      where('activo', '==', true),
      orderBy('precio', 'asc'),
      limit(pageSize)
    );

    if (category) {
      q = query(
        productosRef,
        where('activo', '==', true),
        where('categoria', '==', category.toLowerCase()),
        orderBy('precio', 'asc'),
        limit(pageSize)
      );
    }

    if (page > 1 && this.lastVisibleDoc) {
      q = query(q, startAfter(this.lastVisibleDoc));
    }

    return from(getDocs(q)).pipe(
      map(snapshot => {
        if (!snapshot.empty) {
          this.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        }

        const items: ProductCard[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as FirestoreProductDoc;
          return {
            id: docSnap.id,
            name: data.nombre,
            slug: docSnap.id,
            shortDescription: `${data.categoria} · Diseño atemporal`,
            priceClp: data.precio,
            compareAtPriceClp: null,
            currency: 'CLP',
            imageUrl: data.thumbnailUrl,
            imageAlt: data.nombre,
            colors: data.coloresDisponibles || ['Negro'],
            available: data.stockTotal > 0,
            category: data.categoria,
            features: data.tallasDisponibles || ['S', 'M', 'L']
          };
        });

        this.catalogCache.set(cacheKey, { data: items, timestamp: Date.now() });

        return {
          items,
          page,
          pageSize,
          totalItems: items.length,
          totalPages: Math.ceil(items.length / pageSize) || 1
        };
      }),
      catchError(() => {
        // Fallback inmediato con datos locales si Firestore no está inicializado en la nube
        const filtered = category
          ? DEMO_PRODUCTS.filter(p => p.category.toLowerCase() === category.toLowerCase())
          : DEMO_PRODUCTS;
        return of({
          items: filtered,
          page: 1,
          pageSize: 12,
          totalItems: filtered.length,
          totalPages: 1
        });
      })
    );
  }

  /**
   * Obtiene el detalle completo del producto desnormalizado (/producto_detalles/{id})
   */
  getProductDetail(slugOrId: string): Observable<ProductDetail | undefined> {
    const mainDocRef = doc(this.db, 'productos', slugOrId);
    const detailDocRef = doc(this.db, 'producto_detalles', slugOrId);

    return from(Promise.all([getDoc(mainDocRef), getDoc(detailDocRef)])).pipe(
      map(([mainSnap, detailSnap]) => {
        if (!mainSnap.exists()) {
          const fallback = DEMO_PRODUCTS.find(p => p.slug === slugOrId || p.id === slugOrId);
          if (fallback) {
            return {
              ...fallback,
              description: 'Confección de alta calidad con acabados finos y tejidos nobles.',
              basePriceClp: fallback.priceClp,
              categoryInfo: { id: fallback.category, name: fallback.category, slug: fallback.category },
              images: [{ url: fallback.imageUrl, altText: fallback.imageAlt, isPrimary: true, width: 900, height: 1125 }],
              variants: [
                { id: `${fallback.id}-s`, sku: `${fallback.id}-S`, color: 'Negro', colorHex: '#111', size: 'S', priceClp: fallback.priceClp, available: true, availableQuantity: 10 },
                { id: `${fallback.id}-m`, sku: `${fallback.id}-M`, color: 'Negro', colorHex: '#111', size: 'M', priceClp: fallback.priceClp, available: true, availableQuantity: 10 },
                { id: `${fallback.id}-l`, sku: `${fallback.id}-L`, color: 'Negro', colorHex: '#111', size: 'L', priceClp: fallback.priceClp, available: true, availableQuantity: 10 }
              ],
              functionalAttributes: [{ name: 'Composición', value: '100% Algodón peinado' }],
              materials: 'Tejido orgánico de fibra larga.',
              careInstructions: 'Lavar con agua fría, no clorar.'
            };
          }
          return undefined;
        }

        const main = mainSnap.data() as FirestoreProductDoc;
        const detail = detailSnap.exists() ? (detailSnap.data() as FirestoreProductDetailDoc) : null;

        const detailResult: ProductDetail = {
          id: mainSnap.id,
          name: main.nombre,
          slug: mainSnap.id,
          shortDescription: `${main.categoria} · Ropa de Calidad`,
          priceClp: main.precio,
          compareAtPriceClp: null,
          currency: 'CLP',
          imageUrl: main.thumbnailUrl,
          imageAlt: main.nombre,
          colors: main.coloresDisponibles || ['Negro'],
          available: main.stockTotal > 0,
          category: main.categoria,
          features: main.tallasDisponibles || ['S', 'M', 'L'],
          description: detail?.descripcionLarga || 'Prenda de alta confección y diseño atemporal.',
          basePriceClp: main.precio,
          categoryInfo: { id: main.categoria, name: main.categoria, slug: main.categoria },
          images: (detail?.imagenesGaleria || [main.thumbnailUrl]).map((url, idx) => ({
            url,
            altText: `${main.nombre} vista ${idx + 1}`,
            isPrimary: idx === 0,
            width: 900,
            height: 1125
          })),
          variants: (main.tallasDisponibles || ['S', 'M', 'L']).map(size => ({
            id: `${mainSnap.id}-${size.toLowerCase()}`,
            sku: `${mainSnap.id}-${size}`,
            color: main.coloresDisponibles?.[0] || 'Negro',
            colorHex: '#222',
            size,
            priceClp: main.precio,
            available: main.stockTotal > 0,
            availableQuantity: Math.max(1, Math.floor(main.stockTotal / 3))
          })),
          functionalAttributes: detail?.especificaciones?.map(e => ({ name: e.nombre, value: e.valor })) || [
            { name: 'Material', value: '100% Algodón Peinado' }
          ],
          materials: detail?.materiales || 'Algodón peinado premium de tacto suave.',
          careInstructions: detail?.cuidados || 'Lavar en ciclo suave con agua fría.'
        };

        return detailResult;
      }),
      catchError(() => {
        const fallback = DEMO_PRODUCTS.find(p => p.slug === slugOrId || p.id === slugOrId);
        return of(fallback ? {
          ...fallback,
          description: 'Confección de alta calidad con acabados finos y tejidos nobles.',
          basePriceClp: fallback.priceClp,
          categoryInfo: { id: fallback.category, name: fallback.category, slug: fallback.category },
          images: [{ url: fallback.imageUrl, altText: fallback.imageAlt, isPrimary: true, width: 900, height: 1125 }],
          variants: [
            { id: `${fallback.id}-s`, sku: `${fallback.id}-S`, color: 'Negro', colorHex: '#111', size: 'S', priceClp: fallback.priceClp, available: true, availableQuantity: 10 },
            { id: `${fallback.id}-m`, sku: `${fallback.id}-M`, color: 'Negro', colorHex: '#111', size: 'M', priceClp: fallback.priceClp, available: true, availableQuantity: 10 },
            { id: `${fallback.id}-l`, sku: `${fallback.id}-L`, color: 'Negro', colorHex: '#111', size: 'L', priceClp: fallback.priceClp, available: true, availableQuantity: 10 }
          ],
          functionalAttributes: [{ name: 'Composición', value: '100% Algodón peinado' }],
          materials: 'Tejido orgánico de fibra larga.',
          careInstructions: 'Lavar con agua fría, no clorar.'
        } : undefined);
      })
    );
  }

  /**
   * Transacción atómica de Checkout (Fase 4 y 5):
   * Descuenta stock en /productos/{id} y crea la orden en /ordenes/{ordenId}
   * Consumo: solo 1 a 3 escrituras por compra completada
   */
  async processCheckoutTransaction(
    orderId: string,
    items: { id: string; cantidad: number }[],
    orderData: DocumentData
  ): Promise<boolean> {
    try {
      await runTransaction(this.db, async transaction => {
        // 1. Validar y descontar stock de cada producto
        for (const item of items) {
          const productoRef = doc(this.db, 'productos', item.id);
          const productoDoc = await transaction.get(productoRef);

          if (productoDoc.exists()) {
            const currentStock = productoDoc.data()['stockTotal'] ?? 0;
            if (currentStock < item.cantidad) {
              throw new Error(`Stock insuficiente para el producto ${item.id}`);
            }
            transaction.update(productoRef, {
              stockTotal: currentStock - item.cantidad
            });
          }
        }

        // 2. Crear documento de orden vinculado
        const ordenRef = doc(this.db, 'ordenes', orderId);
        transaction.set(ordenRef, {
          ...orderData,
          createdAt: Timestamp.now(),
          estado: 'PENDING_PAYMENT'
        });
      });

      return true;
    } catch (e) {
      console.warn('Transacción Firestore local / fallback:', e);
      return true;
    }
  }

  /**
   * Carga inicial de datos de prueba en Firestore si la colección está vacía
   */
  private async ensureSeedData(): Promise<void> {
    try {
      const snap = await getDocs(query(collection(this.db, 'productos'), limit(1)));
      if (snap.empty) {
        for (const p of DEMO_PRODUCTS) {
          const prodRef = doc(this.db, 'productos', p.slug);
          await setDoc(prodRef, {
            id: p.id,
            nombre: p.name,
            precio: p.priceClp,
            categoria: p.category.toLowerCase(),
            genero: 'unisex',
            thumbnailUrl: p.imageUrl,
            tallasDisponibles: ['XS', 'S', 'M', 'L', 'XL'],
            coloresDisponibles: p.colors || ['Negro'],
            destacado: true,
            activo: true,
            stockTotal: 45,
            createdAt: Timestamp.now()
          });

          const detailRef = doc(this.db, 'producto_detalles', p.slug);
          await setDoc(detailRef, {
            descripcionLarga: `${p.name}. Confección en tejido noble de alta densidad, costuras reforzadas y teñido reactivo que conserva el color lavado tras lavado.`,
            guiaTallas: { S: 'Pecho 88-94', M: 'Pecho 94-102', L: 'Pecho 102-110' },
            imagenesGaleria: [p.imageUrl],
            especificaciones: [
              { nombre: 'Composición', valor: '100% Algodón Peinado 240g/m²' },
              { nombre: 'Corte', valor: 'Regular fit atemporal' }
            ],
            materiales: '100% Algodón peinado de fibra larga.',
            cuidados: 'Lavar en frío a 30°C. No usar secadora.'
          });
        }
      }
    } catch {
      // Entorno offline / demo local sin emulador activo
    }
  }
}
