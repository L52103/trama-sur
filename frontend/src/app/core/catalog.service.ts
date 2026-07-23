import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { CATEGORIES, DEMO_PRODUCTS, demoProductDetail } from './demo-data';
import { Category, PagedResult, ProductCard, ProductDetail } from './models';

interface ApiProductCard extends Omit<ProductCard, 'category' | 'features'> {}
interface ApiProductDetail {
  id: string; name: string; slug: string; description: string; shortDescription: string;
  basePriceClp: number; compareAtPriceClp: number | null; currency: 'CLP'; category: Category;
  images: ProductDetail['images']; variants: ProductDetail['variants'];
  functionalAttributes: ProductDetail['functionalAttributes']; materials: string; careInstructions: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/v1';

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.api}/categories`, { withCredentials: true }).pipe(catchError(() => of(CATEGORIES)));
  }

  products(filters: Record<string, string | number | undefined> = {}): Observable<PagedResult<ProductCard>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params = params.set(key, String(value)); });
    return this.http.get<PagedResult<ApiProductCard>>(`${this.api}/products`, { params, withCredentials: true }).pipe(
      map(result => ({ ...result, items: result.items.map(item => ({ ...item, category: String(filters['category'] ?? ''), features: [] })) })),
      catchError(() => {
        let items = [...DEMO_PRODUCTS];
        const search = String(filters['search'] ?? '').toLowerCase();
        const category = String(filters['category'] ?? '');
        if (search) items = items.filter(item => `${item.name} ${item.shortDescription} ${item.features.join(' ')}`.toLowerCase().includes(search));
        if (category) items = items.filter(item => item.category === category);
        const sort = filters['sort'];
        if (sort === 'price_asc') items.sort((a, b) => a.priceClp - b.priceClp);
        if (sort === 'price_desc') items.sort((a, b) => b.priceClp - a.priceClp);
        return of({ items, page: 1, pageSize: 24, totalItems: items.length, totalPages: 1 });
      }),
    );
  }

  product(slug: string): Observable<ProductDetail | undefined> {
    return this.http.get<ApiProductDetail>(`${this.api}/products/${encodeURIComponent(slug)}`, { withCredentials: true }).pipe(
      map(item => ({
        id: item.id, name: item.name, slug: item.slug, description: item.description, shortDescription: item.shortDescription,
        priceClp: item.basePriceClp, basePriceClp: item.basePriceClp, compareAtPriceClp: item.compareAtPriceClp,
        currency: item.currency, imageUrl: item.images[0]?.url ?? '/assets/images/polera-organica.png',
        imageAlt: item.images[0]?.altText ?? item.name, colors: [...new Set(item.variants.map(v => v.color))], available: item.variants.some(v => v.available),
        category: item.category.slug, categoryInfo: item.category, features: item.functionalAttributes.map(a => a.value), images: item.images,
        variants: item.variants, functionalAttributes: item.functionalAttributes, materials: item.materials, careInstructions: item.careInstructions,
      })),
      catchError(() => of(demoProductDetail(slug))),
    );
  }
}

