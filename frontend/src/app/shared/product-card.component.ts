import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductCard } from '../core/models';
import { clp } from '../core/format';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, IconComponent],
  template: `
    <article>
      <a class="image-wrap" [routerLink]="['/', product().slug]">
        @if(product().badge){<span class="badge">{{product().badge}}</span>}
        <img [src]="product().imageUrl" [alt]="product().imageAlt" loading="lazy" width="640" height="800">
      </a>
      <button class="wish" type="button" [attr.aria-label]="'Guardar '+product().name"><app-icon name="heart"/></button>
      <a class="info" [routerLink]="['/', product().slug]">
        <div><h3>{{product().name}}</h3><p>{{product().shortDescription}}</p></div>
        <div class="price"><span [class.sale]="product().compareAtPriceClp">{{format(product().priceClp)}}</span>@if(product().compareAtPriceClp){<del>{{format(product().compareAtPriceClp!)}}</del>}</div>
        <div class="swatches">@for(color of product().colors; track color){<span [title]="color"></span>}<small>{{product().colors.length}} colores</small></div>
      </a>
    </article>
  `,
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent { readonly product = input.required<ProductCard>(); readonly format = clp; }

