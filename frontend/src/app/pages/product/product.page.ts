import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogService } from '../../core/catalog.service';
import { CartStore } from '../../core/cart.store';
import { ProductDetail, ProductVariant } from '../../core/models';
import { clp } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector:'app-product-page',imports:[RouterLink,IconComponent],
  template:`
    @if(product();as p){
      <nav class="breadcrumbs container" aria-label="Migas de pan"><a routerLink="/">Inicio</a><span>/</span><a routerLink="/coleccion">Colección</a><span>/</span><span>{{p.name}}</span></nav>
      <section class="product-layout container">
        <div class="gallery"><div class="main-image"><img [src]="p.imageUrl" [alt]="p.imageAlt" width="900" height="1125"></div><div class="detail-image"><img [src]="p.imageUrl" [alt]="'Vista alternativa de '+p.name" loading="lazy"></div></div>
        <aside class="product-info">
          @if(p.badge){<span class="badge">{{p.badge}}</span>}
          <h1>{{p.name}}</h1><p class="subtitle">{{p.shortDescription}}</p><div class="price"><strong>{{format(p.priceClp)}}</strong>@if(p.compareAtPriceClp){<del>{{format(p.compareAtPriceClp)}}</del>}<small>Precio incluye 19% IVA (Boleta SII)</small></div>
          <div class="choice"><div class="choice-head"><b>Color</b><span>{{selectedColor()}}</span></div><div class="colors">@for(color of p.colors;track color){<button [class.selected]="selectedColor()===color" (click)="selectColor(color)" [attr.aria-label]="'Elegir color '+color"><span [style.background]="colorValue(p,color)"></span></button>}</div></div>
          <div class="choice"><div class="choice-head"><b>Talla</b><button type="button" class="size-guide-btn" (click)="sizeModalOpen.set(true)" aria-label="Abrir guía de tallas y medidas">📏 Guía de tallas y medidas</button></div><div class="sizes">@for(size of sizes;track size){<button [class.selected]="selectedSize()===size" [disabled]="!isSizeAvailable(p,size)" (click)="selectedSize.set(size)">{{size}}</button>}</div></div>
          @if(sizeError()){<p class="size-error" role="alert">Selecciona una talla para continuar.</p>}
          <button class="button add" (click)="addToCart(p)">{{added()?'Agregado al carrito':'Agregar al carrito'}} <app-icon [name]="added()?'check':'bag'"/></button>
          
          @if(currentStock(p) > 0 && currentStock(p) <= 3){
            <p class="stock warning"><span></span> ¡Últimas {{currentStock(p)}} unidades disponibles en stock!</p>
          } @else {
            <p class="stock"><span></span> Stock disponible · Despacho a todo Chile con seguimiento</p>
          }

          <details open><summary>Descripción <app-icon name="chevron"/></summary><p>{{p.description}}</p></details>
          <details><summary>Detalles de calidad y materiales <app-icon name="chevron"/></summary><ul>@for(attribute of p.functionalAttributes;track attribute.name){<li><b>{{attribute.name}}</b><span>{{attribute.value}}</span></li>}</ul><p>{{p.materials}}</p></details>
          <details><summary>Cuidado y conservación <app-icon name="chevron"/></summary><p>{{p.careInstructions}}</p></details>
          
          <div class="assurances">
            <span>✓ <b>Garantía Legal de 6 Meses:</b> Cambio, reparación o devolución total (SERNAC / Ley 19.496).</span>
            <span>↺ <b>10 Días de Retracto:</b> Devolución sin costo ni expresión de causa en compras online.</span>
            <span>✨ <b>30 Días para Cambios:</b> Satisfacción garantizada para cambio voluntario de talla.</span>
            <span>↗ <b>Despacho a todo Chile:</b> Con boleta electrónica oficial y tracking.</span>
          </div>
        </aside>
      </section>

      @if(sizeModalOpen()){
        <div class="size-modal-backdrop" (click)="sizeModalOpen.set(false)"></div>
        <div class="size-modal" role="dialog" aria-label="Tabla de tallas y medidas">
          <div class="size-modal-header">
            <h2>Guía de tallas y medidas en centímetros</h2>
            <button class="close-btn" (click)="sizeModalOpen.set(false)" aria-label="Cerrar guía de tallas">✕</button>
          </div>
          <div class="size-modal-body">
            <p>Mide una prenda similar sobre una superficie plana para elegir con exactitud y evitar cambios.</p>
            <table class="size-table">
              <thead>
                <tr>
                  <th>Talla</th>
                  <th>Pecho (cm)</th>
                  <th>Cintura (cm)</th>
                  <th>Cadera (cm)</th>
                  <th>Largo (cm)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><b>XS</b></td><td>84 - 88</td><td>66 - 70</td><td>90 - 94</td><td>66</td></tr>
                <tr><td><b>S</b></td><td>88 - 94</td><td>70 - 76</td><td>94 - 98</td><td>68</td></tr>
                <tr><td><b>M</b></td><td>94 - 102</td><td>76 - 84</td><td>98 - 104</td><td>71</td></tr>
                <tr><td><b>L</b></td><td>102 - 110</td><td>84 - 92</td><td>104 - 112</td><td>74</td></tr>
                <tr><td><b>XL</b></td><td>110 - 118</td><td>92 - 100</td><td>112 - 120</td><td>76</td></tr>
              </tbody>
            </table>
            <div class="how-to-measure">
              <b>¿Cómo tomar tus medidas?</b>
              <ul>
                <li><b>Pecho:</b> Contorno más amplio del tórax de axila a axila x 2.</li>
                <li><b>Cintura:</b> Contorno natural a la altura del ombligo.</li>
                <li><b>Cadera:</b> Parte más ancha de la cadera con pies juntos.</li>
                <li><b>Largo:</b> Desde la costura del hombro hasta el borde inferior.</li>
              </ul>
            </div>
          </div>
          <div class="size-modal-footer">
            <button class="button primary" (click)="sizeModalOpen.set(false)">Entendido</button>
            <a routerLink="/legal/guia-tallas" (click)="sizeModalOpen.set(false)">Ver guía extendida →</a>
          </div>
        </div>
      }
    } @else if(notFound()){<section class="not-found"><h1>Producto no encontrado</h1><a class="button" routerLink="/coleccion">Volver a la colección</a></section>} @else {<div class="loading">Cargando producto…</div>}
  `,
  styleUrl:'./product.page.scss'
})
export class ProductPage{
  private readonly route=inject(ActivatedRoute);private readonly service=inject(CatalogService);private readonly cart=inject(CartStore);private readonly destroyRef=inject(DestroyRef);
  readonly product=signal<ProductDetail|undefined>(undefined);readonly notFound=signal(false);readonly selectedColor=signal('');readonly selectedSize=signal('');readonly added=signal(false);readonly sizeError=signal(false);readonly sizeModalOpen=signal(false);readonly sizes=['XS','S','M','L','XL'];readonly format=clp;
  constructor(){this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params=>{const slug=params.get('slug')??'';this.service.product(slug).subscribe(product=>{if(!product){this.notFound.set(true);return}this.product.set(product);this.selectedColor.set(product.colors[0]??'');});});}
  selectColor(color:string):void{this.selectedColor.set(color);this.selectedSize.set('');}
  isSizeAvailable(p:ProductDetail,size:string):boolean{return p.variants.some(v=>v.color===this.selectedColor()&&v.size===size&&v.available)}
  currentStock(p:ProductDetail):number{const v=p.variants.find(item=>item.color===this.selectedColor()&&(this.selectedSize()?item.size===this.selectedSize():item.available));return v?v.availableQuantity:10;}
  colorValue(p:ProductDetail,color:string):string{return p.variants.find(v=>v.color===color)?.colorHex??'#444'}
  addToCart(p:ProductDetail):void{if(!this.selectedSize()){this.sizeError.set(true);return}const variant=this.variant(p);if(!variant)return;this.cart.add(p,variant.id,variant.size,variant.color);this.sizeError.set(false);this.added.set(true);setTimeout(()=>this.added.set(false),1800)}
  private variant(p:ProductDetail):ProductVariant|undefined{return p.variants.find(v=>v.color===this.selectedColor()&&v.size===this.selectedSize()&&v.available)}
}

