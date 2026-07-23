import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartStore } from '../core/cart.store';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
    <div class="announcement">Despacho gratis desde $79.990 <span>·</span> Cambios simples por 30 días</div>
    <header class="site-header">
      <button class="icon-button mobile-only" type="button" aria-label="Abrir menú" (click)="menuOpen.set(true)"><app-icon name="menu"/></button>
      <a class="wordmark" routerLink="/" aria-label="Trama Sur, inicio">TRAMA <span>SUR</span></a>
      <nav class="desktop-nav" aria-label="Navegación principal">
        <a routerLink="/mujer" routerLinkActive="active">Mujer</a>
        <a routerLink="/hombre" routerLinkActive="active">Hombre</a>
        <a routerLink="/unisex" routerLinkActive="active">Unisex</a>
        <a routerLink="/coleccion" [queryParams]="{sort:'newest'}">Novedades</a>
        <a routerLink="/coleccion" class="function-link">Funcional</a>
      </nav>
      <div class="header-actions">
        <a class="icon-button desktop-search" routerLink="/coleccion" aria-label="Buscar"><app-icon name="search"/></a>
        <a class="icon-button desktop-only" routerLink="/cuenta" aria-label="Mi cuenta"><app-icon name="user"/></a>
        <a class="icon-button bag" routerLink="/carrito" aria-label="Carrito"><app-icon name="bag"/>@if(cart.itemCount() > 0){<span>{{cart.itemCount()}}</span>}</a>
      </div>
    </header>
    @if (menuOpen()) {
      <div class="menu-backdrop" (click)="menuOpen.set(false)"></div>
      <aside class="mobile-menu" aria-label="Menú móvil">
        <div class="menu-top"><span class="wordmark">TRAMA <span>SUR</span></span><button class="icon-button" (click)="menuOpen.set(false)" aria-label="Cerrar menú"><app-icon name="close"/></button></div>
        <a routerLink="/mujer" (click)="menuOpen.set(false)">Mujer <app-icon name="arrow"/></a>
        <a routerLink="/hombre" (click)="menuOpen.set(false)">Hombre <app-icon name="arrow"/></a>
        <a routerLink="/unisex" (click)="menuOpen.set(false)">Unisex <app-icon name="arrow"/></a>
        <a routerLink="/coleccion" (click)="menuOpen.set(false)">Toda la colección <app-icon name="arrow"/></a>
        <div class="menu-secondary"><a routerLink="/cuenta" (click)="menuOpen.set(false)">Mi cuenta</a><a routerLink="/legal/ayuda" (click)="menuOpen.set(false)">Ayuda</a></div>
      </aside>
    }
  `,
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly cart = inject(CartStore);
  readonly menuOpen = signal(false);
}
