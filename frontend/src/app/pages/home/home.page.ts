import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import { ContentService, DEFAULT_HOME_CONTENT, HomeContent, HomeSlide } from '../../core/content.service';
import { DEMO_PRODUCTS } from '../../core/demo-data';
import { ProductCard } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, ProductCardComponent, IconComponent],
  template: `
    <!-- CARRUSEL / HERO PRINCIPAL -->
    @if (activeSlides().length > 0) {
      <section
        class="hero carousel-hero"
        (mouseenter)="pauseCarousel()"
        (mouseleave)="resumeCarousel()"
        aria-roledescription="carousel"
        aria-label="Colecciones destacadas"
      >
        @for (slide of activeSlides(); track slide.id; let idx = $index) {
          <div
            class="carousel-slide"
            [class.active]="currentSlideIndex() === idx"
            [attr.aria-hidden]="currentSlideIndex() !== idx"
          >
            <img
              [src]="slide.imageUrl || '/assets/images/hero-trama-sur.png'"
              [alt]="slide.imageAlt || slide.title"
              width="1792"
              height="1024"
              [attr.fetchpriority]="idx === 0 ? 'high' : 'auto'"
              [loading]="idx === 0 ? 'eager' : 'lazy'"
            />
            <div class="hero-copy">
              <p class="eyebrow">{{ slide.eyebrow }}</p>
              <h1>
                {{ slide.title }}<br />
                <em>{{ slide.accent }}</em>
              </h1>
              <p>{{ slide.description }}</p>
              <div>
                <a class="button" [routerLink]="slide.ctaLink || '/coleccion'">
                  {{ slide.ctaLabel || 'Ver colección' }} <app-icon name="arrow" />
                </a>
                <a class="text-link" routerLink="/legal/manifiesto">
                  Conoce nuestro estándar de calidad
                </a>
              </div>
            </div>
            <div class="hero-note">
              <strong>0{{ idx + 1 }}</strong>
              <span>Confección superior<br />y materiales nobles</span>
            </div>
          </div>
        }

        <!-- CONTROLES DEL CARRUSEL SI HAY MÁS DE 1 SLIDE -->
        @if (activeSlides().length > 1) {
          <button
            type="button"
            class="carousel-arrow prev"
            (click)="prevSlide()"
            aria-label="Diapositiva anterior"
          >
            ‹
          </button>
          <button
            type="button"
            class="carousel-arrow next"
            (click)="nextSlide()"
            aria-label="Siguiente diapositiva"
          >
            ›
          </button>

          <div class="carousel-dots" role="tablist">
            @for (slide of activeSlides(); track slide.id; let idx = $index) {
              <button
                type="button"
                class="dot"
                [class.active]="currentSlideIndex() === idx"
                (click)="goToSlide(idx)"
                [attr.aria-label]="'Ir a diapositiva ' + (idx + 1)"
                role="tab"
              ></button>
            }
          </div>
        }
      </section>
    } @else {
      <!-- FALLBACK HERO TRADICIONAL -->
      <section class="hero">
        <img
          [src]="content().hero.imageUrl || '/assets/images/hero-trama-sur.png'"
          [alt]="content().hero.imageAlt || 'Prendas de alta calidad Trama Sur'"
          width="1792"
          height="1024"
          fetchpriority="high"
        />
        <div class="hero-copy">
          <p class="eyebrow">{{ content().hero.eyebrow }}</p>
          <h1>
            {{ content().hero.title }}<br />
            <em>{{ content().hero.accent }}</em>
          </h1>
          <p>{{ content().hero.description }}</p>
          <div>
            <a class="button" [routerLink]="content().hero.ctaLink || '/coleccion'">
              {{ content().hero.ctaLabel }} <app-icon name="arrow" />
            </a>
            <a class="text-link" routerLink="/legal/manifiesto">Conoce nuestro estándar de calidad</a>
          </div>
        </div>
        <div class="hero-note">
          <strong>01</strong>
          <span>Confección superior<br />y materiales nobles</span>
        </div>
      </section>
    }

    <!-- BENEFICIOS DE COMPRA -->
    <section class="benefits" aria-label="Beneficios de compra">
      @for (b of benefitsList(); track b.title) {
        <div>
          <b>{{ b.title }}</b>
          <span>{{ b.description }}</span>
        </div>
      }
    </section>

    <!-- PRODUCTOS DESTACADOS -->
    <section class="featured container">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{{ content().featured.eyebrow }}</p>
          <h2>{{ content().featured.heading }}</h2>
        </div>
        <a routerLink="/coleccion">Ver todo <app-icon name="arrow" /></a>
      </div>
      <div class="product-grid">
        @for (product of displayFeatured(); track product.id) {
          <app-product-card [product]="product" />
        }
      </div>
    </section>

    <!-- HISTORIA DE MARCA -->
    <section class="story">
      <div class="story-photo">
        <img
          [src]="content().story.imageUrl || '/assets/images/sobrecamisa-bosque.png'"
          [alt]="content().story.imageAlt || 'Sobrecamisa verde bosque de tejido respirable'"
          loading="lazy"
        />
      </div>
      <div class="story-copy">
        <p class="eyebrow">{{ content().story.eyebrow }}</p>
        <h2>{{ content().story.heading }}</h2>
        <p>{{ content().story.description }}</p>
        <a class="button secondary" [routerLink]="content().story.ctaLink || '/legal/manifiesto'">
          {{ content().story.ctaLabel || 'Nuestro enfoque' }} <app-icon name="arrow" />
        </a>
        <dl>
          @for (stat of storyStats(); track stat.label) {
            <div>
              <dt>{{ stat.number }}</dt>
              <dd>{{ stat.label }}</dd>
            </div>
          }
        </dl>
      </div>
    </section>

    <!-- ENCUENTRA TU ESTILO / CATEGORÍAS -->
    <section class="shop-by container">
      <p class="eyebrow">Encuentra tu estilo</p>
      <h2>Diseño y confección de calidad</h2>
      <div class="category-grid">
        @for (cat of categoriesList(); track cat.link) {
          <a [routerLink]="cat.link">
            <img [src]="cat.imageUrl" [alt]="cat.imageAlt || cat.label" />
            <span>{{ cat.label }} <app-icon name="arrow" /></span>
          </a>
        }
      </div>
    </section>
  `,
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly cms = inject(ContentService);

  readonly allCatalogProducts = signal<ProductCard[]>([]);
  readonly content = signal<HomeContent>(DEFAULT_HOME_CONTENT);
  readonly currentSlideIndex = signal<number>(0);

  private carouselTimer: any = null;
  private isPaused = false;

  readonly activeSlides = computed<HomeSlide[]>(() => {
    const slides = this.content().carousel;
    if (slides && slides.length > 0) {
      const filtered = slides.filter(s => s.isActive !== false);
      if (filtered.length > 0) return filtered;
    }
    // Fallback al hero si no hay diapositivas activas
    const hero = this.content().hero;
    return [
      {
        id: 'hero-default',
        eyebrow: hero.eyebrow,
        title: hero.title,
        accent: hero.accent,
        description: hero.description,
        ctaLabel: hero.ctaLabel,
        ctaLink: hero.ctaLink || '/coleccion',
        imageUrl: hero.imageUrl || '/assets/images/hero-trama-sur.png',
        imageAlt: hero.imageAlt || 'Trama Sur',
        isActive: true,
      },
    ];
  });

  readonly benefitsList = computed(() => {
    return this.content().benefits?.length
      ? this.content().benefits!
      : DEFAULT_HOME_CONTENT.benefits!;
  });

  readonly storyStats = computed(() => {
    return this.content().story.stats?.length
      ? this.content().story.stats!
      : DEFAULT_HOME_CONTENT.story.stats!;
  });

  readonly categoriesList = computed(() => {
    return this.content().categories?.length
      ? this.content().categories!
      : DEFAULT_HOME_CONTENT.categories!;
  });

  readonly displayFeatured = computed<ProductCard[]>(() => {
    const conf = this.content().featured;
    const all = this.allCatalogProducts();

    if (conf.productIds && conf.productIds.length > 0 && all.length > 0) {
      const selected = conf.productIds
        .map(id => all.find(p => p.id === id))
        .filter((p): p is ProductCard => p !== undefined);

      if (selected.length > 0) {
        return selected;
      }
    }

    return all.length > 0 ? all.slice(0, 4) : DEMO_PRODUCTS.slice(0, 4);
  });

  ngOnInit(): void {
    this.catalog.products({ pageSize: 24 }).subscribe({
      next: res => this.allCatalogProducts.set(res.items),
      error: () => this.allCatalogProducts.set(DEMO_PRODUCTS),
    });

    this.cms.home().subscribe({
      next: val => {
        this.content.set({ ...DEFAULT_HOME_CONTENT, ...val });
        this.startCarousel();
      },
      error: () => {
        this.startCarousel();
      },
    });
  }

  ngOnDestroy(): void {
    this.stopCarousel();
  }

  startCarousel(): void {
    this.stopCarousel();
    if (this.activeSlides().length <= 1) return;

    this.carouselTimer = setInterval(() => {
      if (!this.isPaused) {
        this.nextSlide();
      }
    }, 6000);
  }

  stopCarousel(): void {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer);
      this.carouselTimer = null;
    }
  }

  pauseCarousel(): void {
    this.isPaused = true;
  }

  resumeCarousel(): void {
    this.isPaused = false;
  }

  nextSlide(): void {
    const total = this.activeSlides().length;
    if (total <= 1) return;
    this.currentSlideIndex.update(idx => (idx + 1) % total);
  }

  prevSlide(): void {
    const total = this.activeSlides().length;
    if (total <= 1) return;
    this.currentSlideIndex.update(idx => (idx - 1 + total) % total);
  }

  goToSlide(idx: number): void {
    this.currentSlideIndex.set(idx);
  }
}
