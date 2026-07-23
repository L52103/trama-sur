import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEMO_PRODUCTS } from '../../core/demo-data';
import { ProductCardComponent } from '../../shared/product-card.component';
import { IconComponent } from '../../shared/icon.component';
import { CatalogService } from '../../core/catalog.service';
import { ProductCard } from '../../core/models';
import { ContentService, DEFAULT_HOME_CONTENT, HomeContent } from '../../core/content.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, ProductCardComponent, IconComponent],
  template: `
    <section class="hero">
      <img src="/assets/images/hero-trama-sur.png" alt="Dos personas usando chaquetas técnicas en arquitectura urbana clara" width="1792" height="1024" fetchpriority="high">
      <div class="hero-copy"><p class="eyebrow">{{content().hero.eyebrow}}</p><h1>{{content().hero.title}}<br><em>{{content().hero.accent}}</em></h1><p>{{content().hero.description}}</p><div><a class="button" routerLink="/coleccion">{{content().hero.ctaLabel}} <app-icon name="arrow"/></a><a class="text-link" routerLink="/legal/manifiesto">Conoce nuestra función</a></div></div>
      <div class="hero-note"><strong>01</strong><span>Protección ligera<br>sin peso extra</span></div>
    </section>
    <section class="benefits" aria-label="Beneficios de compra"><div><b>Despacho a todo Chile</b><span>Seguimiento en cada etapa</span></div><div><b>Pago seguro</b><span>Webpay Plus de Transbank</span></div><div><b>30 días para cambios</b><span>Y garantía legal de 6 meses</span></div></section>
    <section class="featured container">
      <div class="section-heading"><div><p class="eyebrow">{{content().featured.eyebrow}}</p><h2>{{content().featured.heading}}</h2></div><a routerLink="/coleccion">Ver todo <app-icon name="arrow"/></a></div>
      <div class="product-grid">@for(product of featured(); track product.id){<app-product-card [product]="product"/>}</div>
    </section>
    <section class="story">
      <div class="story-photo"><img src="/assets/images/sobrecamisa-bosque.png" alt="Sobrecamisa verde bosque de tejido respirable" loading="lazy"></div>
      <div class="story-copy"><p class="eyebrow">{{content().story.eyebrow}}</p><h2>{{content().story.heading}}</h2><p>{{content().story.description}}</p><a class="button secondary" routerLink="/legal/manifiesto">Nuestro enfoque <app-icon name="arrow"/></a><dl><div><dt>20</dt><dd>productos iniciales, seleccionados con intención</dd></div><div><dt>6 meses</dt><dd>de garantía legal, sin letra chica</dd></div></dl></div>
    </section>
    <section class="shop-by container"><p class="eyebrow">Encuentra tu capa</p><h2>Diseñada para cada movimiento</h2><div class="category-grid"><a routerLink="/abrigos"><img src="/assets/images/chaqueta-commuter.png" alt="Chaquetas funcionales"><span>Abrigos <app-icon name="arrow"/></span></a><a routerLink="/tops"><img src="/assets/images/polera-organica.png" alt="Poleras y primeras capas"><span>Primeras capas <app-icon name="arrow"/></span></a><a routerLink="/pantalones"><img src="/assets/images/pantalon-travel.png" alt="Pantalones técnicos"><span>Pantalones <app-icon name="arrow"/></span></a></div></section>
  `,
  styleUrl: './home.page.scss',
})
export class HomePage { private readonly catalog=inject(CatalogService);private readonly cms=inject(ContentService);readonly featured=signal<ProductCard[]>(DEMO_PRODUCTS.slice(0,4));readonly content=signal<HomeContent>(DEFAULT_HOME_CONTENT);constructor(){this.catalog.products({pageSize:4}).subscribe(result=>this.featured.set(result.items.slice(0,4)));this.cms.home().subscribe({next:value=>this.content.set({...DEFAULT_HOME_CONTENT,...value}),error:()=>undefined});} }
