import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface HomeSlide {
  id: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
  imageUrl: string;
  imageAlt: string;
  isActive: boolean;
}

export interface HomeFeaturedConfig {
  eyebrow: string;
  heading: string;
  productIds?: string[];
  autoSelect?: boolean;
}

export interface HomeStoryStat {
  number: string;
  label: string;
}

export interface HomeStoryConfig {
  eyebrow: string;
  heading: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaLink?: string;
  stats?: HomeStoryStat[];
}

export interface HomeBenefitItem {
  title: string;
  description: string;
  icon?: string;
}

export interface HomeCategoryItem {
  label: string;
  link: string;
  imageUrl: string;
  imageAlt?: string;
}

export interface HomeContent {
  announcement: string;
  announcementLink?: string;
  announcementActive?: boolean;
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    ctaLabel: string;
    ctaLink?: string;
    imageUrl?: string;
    imageAlt?: string;
  };
  carousel?: HomeSlide[];
  featured: HomeFeaturedConfig;
  story: HomeStoryConfig;
  benefits?: HomeBenefitItem[];
  categories?: HomeCategoryItem[];
}

export const DEFAULT_HOME_CONTENT: HomeContent = {
  announcement: 'Despacho gratis desde $79.990 · Cambios simples por 30 días',
  announcementLink: '/coleccion',
  announcementActive: true,
  hero: {
    eyebrow: 'Colección Invierno 2026',
    title: 'Hecha con',
    accent: 'máxima calidad.',
    description: 'Ropa de calidad superior, confección cuidada y materiales nobles para el día a día.',
    ctaLabel: 'Ver colección',
    ctaLink: '/coleccion',
    imageUrl: '/assets/images/hero-trama-sur.png',
    imageAlt: 'Prendas de alta calidad Trama Sur en fotografía sobria y cuidada'
  },
  carousel: [
    {
      id: 'slide-1',
      eyebrow: 'Colección Invierno 2026',
      title: 'Hecha con',
      accent: 'máxima calidad.',
      description: 'Ropa de calidad superior, confección cuidada y materiales nobles para el día a día.',
      ctaLabel: 'Ver colección',
      ctaLink: '/coleccion',
      imageUrl: '/assets/images/hero-trama-sur.png',
      imageAlt: 'Prendas de alta calidad Trama Sur en fotografía sobria y cuidada',
      isActive: true
    },
    {
      id: 'slide-2',
      eyebrow: 'Edición Limitada',
      title: 'Abrigos &',
      accent: 'Sobrecamisas.',
      description: 'Prendas térmicas con lana merino y algodón grueso para bajas temperaturas.',
      ctaLabel: 'Explorar abrigos',
      ctaLink: '/abrigos',
      imageUrl: '/assets/images/chaqueta-commuter.png',
      imageAlt: 'Chaqueta commuter en tonos tierra y textura artesanal',
      isActive: true
    },
    {
      id: 'slide-3',
      eyebrow: 'Diseño Atemporal',
      title: 'Básicos que',
      accent: 'trascienden.',
      description: 'Prendas versátiles pensadas para durar años manteniendo su forma y textura.',
      ctaLabel: 'Ver poleras y tops',
      ctaLink: '/tops',
      imageUrl: '/assets/images/polera-organica.png',
      imageAlt: 'Polera de corte regular en algodón premium',
      isActive: true
    }
  ],
  featured: {
    eyebrow: 'Selección Trama',
    heading: 'Esenciales de calidad',
    productIds: [],
    autoSelect: true
  },
  story: {
    eyebrow: 'Confección y detalle',
    heading: 'Materiales nobles. Calidad que se siente.',
    description: 'Seleccionamos los mejores tejidos, cortes precisos y costuras reforzadas para crear prendas duraderas, cómodas y atemporales.',
    imageUrl: '/assets/images/sobrecamisa-bosque.png',
    imageAlt: 'Sobrecamisa verde bosque de tejido respirable',
    ctaLabel: 'Nuestro enfoque',
    ctaLink: '/legal/manifiesto',
    stats: [
      { number: '20', label: 'productos iniciales, seleccionados con intención' },
      { number: '6 meses', label: 'de garantía legal, sin letra chica' }
    ]
  },
  benefits: [
    { title: 'Despacho a todo Chile', description: 'Seguimiento en cada etapa', icon: 'truck' },
    { title: 'Pago seguro', description: 'Webpay Plus de Transbank', icon: 'shield' },
    { title: '30 días para cambios', description: 'Y garantía legal de 6 meses', icon: 'rotate' }
  ],
  categories: [
    { label: 'Abrigos', link: '/abrigos', imageUrl: '/assets/images/chaqueta-commuter.png', imageAlt: 'Abrigos y chaquetas de calidad' },
    { label: 'Tops y Poleras', link: '/tops', imageUrl: '/assets/images/polera-organica.png', imageAlt: 'Poleras y tops de algodón orgánico' },
    { label: 'Pantalones', link: '/pantalones', imageUrl: '/assets/images/pantalon-travel.png', imageAlt: 'Pantalones de alta durabilidad' }
  ]
};

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);

  home(): Observable<HomeContent> {
    return this.http.get<HomeContent>('/api/v1/content/home');
  }

  draft(): Observable<{ pageId?: string; draft?: { id: string; contentJson: string; versionNumber: number } }> {
    return this.http.get<{ pageId?: string; draft?: { id: string; contentJson: string; versionNumber: number } }>('/api/v1/admin/pages/home/draft');
  }

  saveDraft(content: HomeContent): Observable<{ pageId: string; versionId: string; versionNumber: number }> {
    return this.http.put<{ pageId: string; versionId: string; versionNumber: number }>('/api/v1/admin/pages/home/draft', { content });
  }

  publish(versionId: string, note: string): Observable<{ pageId: string; currentPublishedVersionId: string; publishedAt: string }> {
    return this.http.post<{ pageId: string; currentPublishedVersionId: string; publishedAt: string }>('/api/v1/admin/pages/home/publish', { versionId, note });
  }

  uploadMedia(file: File, altText: string = ''): Observable<{ id: string; publicUrl: string; altText: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('altText', altText);
    return this.http.post<{ id: string; publicUrl: string; altText: string }>('/api/v1/admin/media', formData);
  }

  listMedia(): Observable<Array<{ id: string; publicUrl: string; contentType: string; sizeBytes: number; altText: string; createdAt: string }>> {
    return this.http.get<Array<{ id: string; publicUrl: string; contentType: string; sizeBytes: number; altText: string; createdAt: string }>>('/api/v1/admin/media');
  }

  versions(key: string = 'home'): Observable<Array<{ id: string; versionNumber: number; status: string; createdByUserId?: string; publishedByUserId?: string; publishedAt?: string; publicationNote?: string }>> {
    return this.http.get<Array<{ id: string; versionNumber: number; status: string; createdByUserId?: string; publishedByUserId?: string; publishedAt?: string; publicationNote?: string }>>(`/api/v1/admin/pages/${key}/versions`);
  }
}
