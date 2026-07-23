import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart.store';
import { clp } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

@Component({selector:'app-cart-page',imports:[RouterLink,IconComponent],template:`
  <section class="cart container"><div class="cart-title"><p class="eyebrow">Tu selección</p><h1>Carrito <span>({{cart.itemCount()}})</span></h1></div>
  @if(cart.lines().length){<div class="cart-layout"><div class="lines">@for(line of cart.lines();track line.id){<article><a [routerLink]="['/',line.product.slug]"><img [src]="line.product.imageUrl" [alt]="line.product.imageAlt"></a><div class="line-copy"><div><a [routerLink]="['/',line.product.slug]"><h2>{{line.product.name}}</h2></a><p>{{line.color}} · Talla {{line.size}}</p><small>SKU {{line.variantId.slice(-8)}}</small></div><div class="quantity"><button (click)="cart.update(line.id,line.quantity-1)" aria-label="Restar una unidad"><app-icon name="minus"/></button><span>{{line.quantity}}</span><button (click)="cart.update(line.id,line.quantity+1)" aria-label="Sumar una unidad"><app-icon name="plus"/></button></div><strong>{{format(line.product.priceClp*line.quantity)}}</strong><button class="remove" (click)="cart.remove(line.id)">Eliminar</button></div></article>}</div>
  <aside><h2>Resumen</h2><dl><div><dt>Subtotal</dt><dd>{{format(cart.subtotal())}}</dd></div><div><dt>Despacho</dt><dd>{{cart.shipping()===0?'Gratis':format(cart.shipping())}}</dd></div><div class="total"><dt>Total</dt><dd>{{format(cart.total())}} <small>IVA incluido</small></dd></div></dl>@if(cart.subtotal()<79990){<div class="shipping-progress"><p>Te faltan <b>{{format(79990-cart.subtotal())}}</b> para despacho gratis</p><span><i [style.width.%]="cart.subtotal()/79990*100"></i></span></div>}<a class="button checkout" routerLink="/checkout">Continuar al pago <app-icon name="arrow"/></a><div class="pay-note"><b>Pago seguro con Webpay</b><span>No almacenamos datos de tu tarjeta.</span></div><a class="continue" routerLink="/coleccion">← Seguir comprando</a></aside></div>}
  @else{<div class="empty"><h2>Tu carrito está esperando.</h2><p>Descubre prendas funcionales hechas para acompañarte.</p><a class="button" routerLink="/coleccion">Explorar colección</a></div>}
  </section>`,styleUrl:'./cart.page.scss'})
export class CartPage{readonly cart=inject(CartStore);readonly format=clp;}
