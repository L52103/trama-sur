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
          <h1>{{p.name}}</h1><p class="subtitle">{{p.shortDescription}}</p><div class="price"><strong>{{format(p.priceClp)}}</strong>@if(p.compareAtPriceClp){<del>{{format(p.compareAtPriceClp)}}</del>}<small>Precio incluye IVA</small></div>
          <div class="choice"><div class="choice-head"><b>Color</b><span>{{selectedColor()}}</span></div><div class="colors">@for(color of p.colors;track color){<button [class.selected]="selectedColor()===color" (click)="selectColor(color)" [attr.aria-label]="'Elegir color '+color"><span [style.background]="colorValue(p,color)"></span></button>}</div></div>
          <div class="choice"><div class="choice-head"><b>Talla</b><a routerLink="/legal/guia-tallas">Guía de tallas</a></div><div class="sizes">@for(size of sizes;track size){<button [class.selected]="selectedSize()===size" [disabled]="!isSizeAvailable(p,size)" (click)="selectedSize.set(size)">{{size}}</button>}</div></div>
          @if(sizeError()){<p class="size-error" role="alert">Selecciona una talla para continuar.</p>}
          <button class="button add" (click)="addToCart(p)">{{added()?'Agregado al carrito':'Agregar al carrito'}} <app-icon [name]="added()?'check':'bag'"/></button>
          <p class="stock"><span></span> Disponible para despacho · entrega estimada 2 a 5 días hábiles</p>
          <details open><summary>Descripción <app-icon name="chevron"/></summary><p>{{p.description}}</p></details>
          <details><summary>Función y materiales <app-icon name="chevron"/></summary><ul>@for(attribute of p.functionalAttributes;track attribute.name){<li><b>{{attribute.name}}</b><span>{{attribute.value}}</span></li>}</ul><p>{{p.materials}}</p></details>
          <details><summary>Cuidado <app-icon name="chevron"/></summary><p>{{p.careInstructions}}</p></details>
          <div class="assurances"><span>↗ Despacho a todo Chile</span><span>↺ Cambios hasta 30 días</span><span>✓ Garantía legal de 6 meses</span></div>
        </aside>
      </section>
    } @else if(notFound()){<section class="not-found"><h1>Producto no encontrado</h1><a class="button" routerLink="/coleccion">Volver a la colección</a></section>} @else {<div class="loading">Cargando producto…</div>}
  `,
  styleUrl:'./product.page.scss'
})
export class ProductPage{
  private readonly route=inject(ActivatedRoute);private readonly service=inject(CatalogService);private readonly cart=inject(CartStore);private readonly destroyRef=inject(DestroyRef);
  readonly product=signal<ProductDetail|undefined>(undefined);readonly notFound=signal(false);readonly selectedColor=signal('');readonly selectedSize=signal('');readonly added=signal(false);readonly sizeError=signal(false);readonly sizes=['XS','S','M','L','XL'];readonly format=clp;
  constructor(){this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params=>{const slug=params.get('slug')??'';this.service.product(slug).subscribe(product=>{if(!product){this.notFound.set(true);return}this.product.set(product);this.selectedColor.set(product.colors[0]??'');});});}
  selectColor(color:string):void{this.selectedColor.set(color);this.selectedSize.set('');}
  isSizeAvailable(p:ProductDetail,size:string):boolean{return p.variants.some(v=>v.color===this.selectedColor()&&v.size===size&&v.available)}
  colorValue(p:ProductDetail,color:string):string{return p.variants.find(v=>v.color===color)?.colorHex??'#444'}
  addToCart(p:ProductDetail):void{if(!this.selectedSize()){this.sizeError.set(true);return}const variant=this.variant(p);if(!variant)return;this.cart.add(p,variant.id,variant.size,variant.color);this.sizeError.set(false);this.added.set(true);setTimeout(()=>this.added.set(false),1800)}
  private variant(p:ProductDetail):ProductVariant|undefined{return p.variants.find(v=>v.color===this.selectedColor()&&v.size===this.selectedSize()&&v.available)}
}

