import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { CatalogService } from '../../core/catalog.service';
import { Category, ProductCard } from '../../core/models';
import { ProductCardComponent } from '../../shared/product-card.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-catalog-page', imports: [FormsModule, ProductCardComponent, IconComponent],
  template: `
    <section class="catalog-head container"><p class="eyebrow">Colección completa</p><h1>Prendas que trabajan contigo.</h1><p>Capas versátiles y detalles útiles, pensados para el clima y el movimiento diario.</p></section>
    <section class="catalog-tools container">
      <button class="filter-button" type="button" (click)="filtersOpen.set(!filtersOpen())"><app-icon name="plus"/> Filtros</button>
      <label class="search"><app-icon name="search"/><span class="sr-only">Buscar productos</span><input type="search" [(ngModel)]="search" (ngModelChange)="apply()" placeholder="Buscar en la colección"></label>
      <label class="sort"><span>Ordenar:</span><select [(ngModel)]="sort" (change)="apply()"><option value="recommended">Recomendados</option><option value="newest">Novedades</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option></select></label>
    </section>
    @if(filtersOpen()){<div class="drawer-backdrop" (click)="filtersOpen.set(false)"></div>}
    <aside class="filter-drawer" [class.open]="filtersOpen()">
      <div class="drawer-header"><h2>Filtro</h2><button class="close-btn" (click)="filtersOpen.set(false)">✕</button></div>
      <div class="drawer-body">
        <details class="filter-section" open><summary><h3>Departamentos y Tipos</h3></summary><ul>@for(t of types;track t.slug){<li><button [class.selected]="category===t.slug" (click)="selectCategory(t.slug)">{{t.name}}</button></li>}</ul></details>
        <details class="filter-section"><summary><h3>Actividad</h3></summary><ul>@for(cat of categories();track cat.id){<li><button [class.selected]="category===cat.slug" (click)="selectCategory(cat.slug)">{{cat.name}}</button></li>}</ul></details>
        <details class="filter-section" open><summary><h3>Talla</h3></summary><ul>@for(s of sizes;track s){<li><button [class.selected]="size===s" (click)="selectSize(s)">{{s}}</button></li>}</ul></details>
        <details class="filter-section"><summary><h3>Color</h3></summary><ul>@for(c of colors;track c){<li><button [class.selected]="color===c" (click)="selectColor(c)">{{c}}</button></li>}</ul></details>
        <details class="filter-section"><summary><h3>Función</h3></summary><ul>@for(item of functions;track item.slug){<li><button [class.selected]="function===item.slug" (click)="selectFunction(item.slug)">{{item.name}}</button></li>}</ul></details>
        <details class="filter-section"><summary><h3>Precio</h3></summary><ul>@for(p of prices;track p.label){<li><button [class.selected]="minPrice===p.min&&maxPrice===p.max" (click)="selectPrice(p.min, p.max)">{{p.label}}</button></li>}</ul></details>
      </div>
      <div class="drawer-footer">
        <button class="button secondary" (click)="clear(); filtersOpen.set(false)">Borrar todo</button>
        <button class="button primary" (click)="filtersOpen.set(false)">Listo</button>
      </div>
    </aside>
    <section class="results container"><div class="count"><span>{{products().length}} productos</span>@if(category){<button (click)="selectCategory('')">{{category}} ×</button>}</div>
      @if(loading()){<div class="skeleton-grid" aria-label="Cargando productos">@for(i of [1,2,3,4,5,6,7,8];track i){<div></div>}</div>}
      @else if(products().length){<div class="product-grid">@for(product of products();track product.id){<app-product-card [product]="product"/>}</div>}
      @else{<div class="empty"><h2>No encontramos coincidencias</h2><p>Prueba con otro término o limpia los filtros.</p><button class="button secondary" (click)="clear()">Limpiar filtros</button></div>}
    </section>
  `,
  styleUrl: './catalog.page.scss'
})
export class CatalogPage {
  private readonly service = inject(CatalogService); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly destroyRef = inject(DestroyRef);
  readonly products = signal<ProductCard[]>([]); readonly categories = signal<Category[]>([]); readonly loading = signal(true); readonly filtersOpen = signal(false);
  readonly sizes = ['XS','S','M','L','XL']; 
  readonly functions = [{name:'Impermeable',slug:'impermeable'},{name:'Transpirable',slug:'transpirable'},{name:'Secado Rápido',slug:'secado-rapido'},{name:'Protección UV',slug:'proteccion-uv'},{name:'Cortaviento',slug:'cortaviento'},{name:'Térmico',slug:'abrigo'}];
  readonly colors = ['Negro', 'Blanco', 'Grafito', 'Azul noche', 'Bosque', 'Oliva', 'Piedra', 'Arena', 'Vino', 'Niebla', 'Gris'];
  readonly types = [{name:'Abrigos y Chaquetas',slug:'abrigos'},{name:'Partes de arriba',slug:'tops'},{name:'Partes de abajo',slug:'pantalones'},{name:'Mujer',slug:'mujer'},{name:'Hombre',slug:'hombre'}];
  readonly prices = [{label:'Hasta $50.000',min:0,max:50000},{label:'$50.000 - $100.000',min:50000,max:100000},{label:'Más de $100.000',min:100000,max:999999}];
  
  search=''; category=''; sort='recommended'; size=''; function=''; color=''; minPrice=0; maxPrice=999999; private debounce?: ReturnType<typeof setTimeout>;
  constructor(){ 
    this.service.categories().subscribe(items=>this.categories.set(items)); 
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([params, queryParams])=>{
      this.category=params.get('category') ?? queryParams.get('category') ?? '';
      this.sort=queryParams.get('sort')??'recommended';
      this.search=queryParams.get('search')??'';
      this.size=queryParams.get('size')??'';
      this.function=queryParams.get('function')??'';
      this.color=queryParams.get('color')??'';
      this.minPrice=Number(queryParams.get('minPriceClp'))||0;
      this.maxPrice=Number(queryParams.get('maxPriceClp'))||999999;
      this.load();
    }); 
  }
  apply():void{
    clearTimeout(this.debounce);
    this.debounce=setTimeout(()=>this.router.navigate(this.category ? ['/', this.category] : ['/coleccion'], {
      queryParams:{
        sort:this.sort==='recommended'?null:this.sort,
        search:this.search||null,
        size:this.size||null,
        function:this.function||null,
        color:this.color||null,
        minPriceClp:this.minPrice?this.minPrice:null,
        maxPriceClp:this.maxPrice!==999999?this.maxPrice:null
      }
    }),250)
  }
  selectCategory(slug:string):void{this.category=this.category===slug?'':slug;this.apply();}
  selectSize(val:string):void{this.size=this.size===val?'':val;this.apply();}
  selectFunction(val:string):void{this.function=this.function===val?'':val;this.apply();}
  selectColor(val:string):void{this.color=this.color===val?'':val;this.apply();}
  selectPrice(min:number,max:number):void{
    if(this.minPrice===min&&this.maxPrice===max){this.minPrice=0;this.maxPrice=999999;}
    else{this.minPrice=min;this.maxPrice=max;}
    this.apply();
  }
  clear():void{
    this.search='';this.category='';this.sort='recommended';this.size='';this.function='';this.color='';this.minPrice=0;this.maxPrice=999999;
    this.router.navigate(['/coleccion'], {queryParams:{}});
  }
  private load():void{
    this.loading.set(true);
    this.service.products({
      search:this.search,category:this.category,sort:this.sort,size:this.size,function:this.function,color:this.color,minPriceClp:this.minPrice,maxPriceClp:this.maxPrice
    }).subscribe(result=>{this.products.set(result.items);this.loading.set(false);});
  }
}

