import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, switchMap } from 'rxjs';
import { AdminCategory, AdminCollection, AdminInventory, AdminOrder, AdminProduct, AdminService, CreateAdminProduct } from '../../core/admin.service';
import { AuthSessionService } from '../../core/auth-session.service';
import { clp } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

@Component({selector:'app-admin-page',imports:[FormsModule,IconComponent,RouterLink,NgTemplateOutlet],template:`
  <section class="admin"><aside><div class="admin-brand">TRAMA <span>SUR</span><small>Administración</small></div><nav>@for(item of menu;track item.label){<button [class.active]="section()===item.label" (click)="section.set(item.label)"><span>{{item.icon}}</span>{{item.label}}@if(item.badge){<b>{{badge(item.label)}}</b>}</button>}</nav><div class="admin-user"><i>{{initials()}}</i><span><b>{{userName()}}</b><small>Administrador · MFA</small></span></div></aside>
  <main><header><div><p>Panel / {{section()}}</p><h1>{{section()}}</h1></div><div><button class="square" aria-label="Estado del sistema">●</button><button class="button" (click)="openEditor()"><app-icon name="plus"/> Nuevo producto</button></div></header>
  @if(error()){<div class="admin-error" role="alert">{{error()}}</div>}@if(loading()){<p class="loading">Cargando datos operacionales…</p>}
  @if(section()==='Resumen'){<div class="metrics">@for(metric of metrics();track metric.label){<article><span>{{metric.label}}</span><b>{{metric.value}}</b><small>{{metric.change}}</small></article>}</div><div class="dashboard-grid"><section class="chart"><div class="section-title"><div><h2>Ventas últimos 7 días</h2><p>Ingresos con pago confirmado</p></div><span class="live-label">Datos reales</span></div><div class="bars">@for(bar of bars();track bar.key){<div><span [style.height.%]="bar.value"><i>{{format(bar.amount)}}</i></span><small>{{bar.day}}</small></div>}</div></section><section class="alerts"><div class="section-title"><h2>Requiere atención</h2></div><button (click)="section.set('Inventario')"><span class="alert-icon warning">!</span><div><b>{{lowStock().length}} variantes con stock bajo</b><small>Stock disponible bajo el umbral</small></div><strong>→</strong></button><button (click)="section.set('Pedidos')"><span class="alert-icon">⌁</span><div><b>{{pendingOrders()}} pedidos pendientes</b><small>Pago o preparación por completar</small></div><strong>→</strong></button><div class="health-row"><span class="alert-icon safe">✓</span><div><b>API y base conectadas</b><small>Lectura administrativa protegida</small></div></div></section></div><section class="orders"><div class="section-title"><div><h2>Pedidos recientes</h2><p>Estado operacional y de pago separados</p></div><button (click)="section.set('Pedidos')">Ver todos →</button></div><ng-container [ngTemplateOutlet]="ordersTable"/></section>}
  @else if(section()==='Pedidos'){<section class="orders"><div class="section-title"><div><h2>Pedidos</h2><p>{{orders().length}} registros recientes</p></div></div><ng-container [ngTemplateOutlet]="ordersTable"/></section>}
  @else if(section()==='Productos'){<section class="products"><div class="section-title"><div><h2>Catálogo</h2><p>{{products().length}} productos cargados desde PostgreSQL</p></div><label>Buscar <input [(ngModel)]="productSearch"></label></div><table><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>@for(p of filteredProducts();track p.id){<tr><td><div class="product-cell"><img [src]="p.imageUrl||'/assets/images/polera-organica.png'" alt=""><span><b>{{p.name}}</b><small>{{p.slug}}</small></span></div></td><td>{{p.category}}</td><td>{{format(p.basePriceClp)}}@if(p.compareAtPriceClp){<br/><small style="text-decoration:line-through;color:var(--muted)">{{format(p.compareAtPriceClp)}}</small>}</td><td>{{p.stockAvailable}} en {{p.variants}} var.</td><td><span class="status" [class.paid]="p.status==='Active'">{{statusLabel(p.status)}}</span></td><td><div style="display:flex;gap:0.5rem;"><button type="button" class="button secondary" style="padding:0.2rem 0.5rem;font-size:0.7rem" (click)="openStockEditor(p)">+ Stock</button><button type="button" class="button secondary" style="padding:0.2rem 0.5rem;font-size:0.7rem" (click)="openEditor(p)">Editar</button><button type="button" class="button secondary" style="padding:0.2rem 0.5rem;font-size:0.7rem" (click)="openPriceEditor(p)">$ Precio</button>@if(p.status!=='Archived'){<button type="button" class="button secondary" style="padding:0.2rem 0.5rem;font-size:0.7rem" (click)="archiveProduct(p.id)">Ocultar</button>}@else{<button type="button" class="button secondary" style="padding:0.2rem 0.5rem;font-size:0.7rem" (click)="unarchiveProduct(p.id)">Mostrar</button>}</div></td></tr>}@empty{<tr><td colspan="6">No hay resultados.</td></tr>}</tbody></table></section>}
  @else if(section()==='Inventario'){<section class="products"><div class="section-title"><div><h2>Inventario por variante</h2><p>{{inventory().length}} filas · disponible = físico − reservado</p></div><div style="display:flex;gap:1rem;align-items:center"><button type="button" class="button secondary" (click)="setGlobalThreshold()">Cambiar umbral global</button><label>Buscar <input [(ngModel)]="inventorySearch"></label></div></div><table><thead><tr><th>SKU</th><th>Color / talla</th><th>Umbral (Stock Bajo)</th><th>Físico</th><th>Reservado</th><th>Disponible</th></tr></thead><tbody>@for(row of filteredInventory();track row.id){<tr [class.low-row]="row.available<=row.lowStockThreshold"><td><b>{{row.sku}}</b></td><td>{{row.color}} · {{row.size}}</td><td><input type="number" class="custom-input" style="width:70px;padding:0.2rem" [value]="row.lowStockThreshold" (change)="updateThreshold(row, $any($event.target).value)"></td><td>{{row.onHand}}</td><td>{{row.reserved}}</td><td><span class="status" [class.paid]="row.available>row.lowStockThreshold">{{row.available}}</span></td></tr>}</tbody></table></section>}
  @else if(section()==='Editar Landingpage'){<section class="placeholder"><span>✦</span><h2>Contenido de la portada</h2><p>Edita un borrador con campos seguros, revisa la vista previa y publica una versión auditable.</p><a class="button" routerLink="/admin/contenido/inicio">Abrir editor visual</a></section>}
  @else if(section()==='Clientes'){<section class="placeholder"><span>♙</span><h2>Clientes</h2><p>Actualmente no hay clientes registrados en el sistema.</p></section>}
  @else if(section()==='Configuración'){<section class="products"><div class="section-title"><div><h2>Configuración de la Tienda</h2><p>Administración del sistema y apariencia</p></div></div><div class="config-grid"><article class="config-card"><h3>Apariencia</h3><label class="toggle-switch"><input type="checkbox" [(ngModel)]="darkMode" (change)="saveSettings()"><b>Modo Oscuro</b></label><hr style="border:0;border-bottom:1px solid var(--line);margin:1.5rem 0"/><label style="display:block;margin-bottom:0.5rem">Logo de la tienda</label><div style="display:flex;gap:1rem;align-items:center">@if(storeLogo){<img [src]="storeLogo" alt="Logo" style="height:40px;border-radius:4px;border:1px solid var(--line)">}<input type="file" accept="image/*" (change)="uploadLogo($event)" #logoInput style="display:none"><button type="button" class="button secondary" style="padding:0.4rem 1rem" (click)="logoInput.click()">Subir Imagen</button></div><label style="margin-top:1.5rem;display:block;margin-bottom:0.5rem">Nombre en la pestaña (Título web)</label><input type="text" class="custom-input" [(ngModel)]="storeName" (change)="saveSettings()"><div style="margin-top:1rem">@if(savingSettings){<small style="color:var(--muted)">Guardando...</small>}@else{<small style="color:var(--forest)">Los cambios se guardan automáticamente.</small>}</div></article><article class="config-card"><h3>Acceso Administrativo</h3><p style="font-size:0.8rem;color:var(--muted);margin-bottom:1.5rem">Gestiona quién tiene acceso a este panel y sus roles.</p><button type="button" class="button secondary" onclick="alert('Próximamente: Panel de gestión de usuarios.')">Gestionar administradores</button><button type="button" class="button secondary mt-2" style="display:block" onclick="alert('La API ya exige MFA (autenticador) para todas las operaciones de catálogo, órdenes y configuración.')">Forzar doble factor (MFA)</button></article></div></section>}
  @else{<section class="placeholder"><span>TS</span><h2>Módulo {{section()}}</h2><p>Este módulo está en construcción.</p></section>}
  </main></section>

  <ng-template #ordersTable><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Pago</th><th>Estado</th></tr></thead><tbody>@for(order of recentOrders();track order.id){<tr><td><b>{{order.number}}</b></td><td>{{order.customerEmail}}</td><td>{{date(order.createdAt)}}</td><td>{{format(order.totalClp)}}</td><td><span class="status" [class.paid]="!!order.paidAt">{{order.paidAt?'Autorizado':'Pendiente'}}</span></td><td><span class="status">{{statusLabel(order.status)}}</span></td></tr>}@empty{<tr><td colspan="6">Aún no hay pedidos.</td></tr>}</tbody></table></ng-template>

  @if(showEditor()){<div class="drawer-backdrop" (click)="showEditor.set(false)"></div><aside class="editor wide"><header><div><p class="eyebrow">Catálogo</p><h2>{{editingProductId?'Editar producto':'Nuevo producto'}}</h2></div><button type="button" (click)="showEditor.set(false)" aria-label="Cerrar"><app-icon name="close"/></button></header><form (ngSubmit)="saveProduct()"><div class="field"><label for="new-name">Nombre</label><input id="new-name" required maxlength="180" [(ngModel)]="draft.name" name="name" (input)="syncSlug()"></div><div class="field"><label for="new-slug">Slug</label><input id="new-slug" required maxlength="200" pattern="[a-z0-9-]+" [(ngModel)]="draft.slug" name="slug"></div><div class="two"><div class="field"><label for="new-price">Precio CLP</label><input id="new-price" required type="number" min="1000" step="10" [(ngModel)]="draft.basePriceClp" name="price"></div><div class="field"><label for="new-category">Categoría principal</label><select id="new-category" required [(ngModel)]="draft.categoryId" name="category" (change)="isNewCategory = draft.categoryId === 'new'">@for(category of categories();track category.id){<option [value]="category.id">{{category.name}}</option>}<option value="new">+ Crear nueva...</option></select>@if(isNewCategory){<input type="text" placeholder="Nombre de categoría" required [(ngModel)]="customCategoryName" name="customCategory" class="custom-input">}</div></div><div class="field"><label for="new-audience">Público / Género</label><select id="new-audience" required [(ngModel)]="draft.audience" name="audience"><option value="Hombre">Hombre</option><option value="Mujer">Mujer</option><option value="Unisex">Unisex</option></select></div><div class="field"><label>Colecciones (Opcional)</label><div class="checkbox-group">@for(c of collections();track c.id){<label><input type="checkbox" [value]="c.id" [checked]="draft.collectionIds.includes(c.id)" (change)="toggleCollection(c.id, $event)"> {{c.name}}</label>}</div></div><div class="field"><label for="new-description">Descripción breve</label><textarea id="new-description" required maxlength="300" rows="3" [(ngModel)]="draft.shortDescription" name="description"></textarea></div><div class="variants-section"><h3>Variantes</h3>@for(v of draft.variants;track $index){<div class="variant-row"><div class="two"><div class="field"><label>Color</label><select required [(ngModel)]="v.color" [name]="'color'+$index" (change)="v.isNewColor = v.color === 'new'">@for(c of uniqueColors();track c){<option [value]="c">{{c}}</option>}<option value="new">+ Crear nuevo...</option></select>@if(v.isNewColor){<input type="text" placeholder="Nuevo color" required [(ngModel)]="v.customColor" [name]="'customColor'+$index" class="custom-input">}</div><div class="field"><label>Talla</label><select required [(ngModel)]="v.size" [name]="'size'+$index" (change)="v.isNewSize = v.size === 'new'">@for(s of uniqueSizes();track s){<option [value]="s">{{s}}</option>}<option value="new">+ Crear nueva...</option></select>@if(v.isNewSize){<input type="text" placeholder="Nueva talla" required [(ngModel)]="v.customSize" [name]="'customSize'+$index" class="custom-input">}</div></div><div class="two"><div class="field"><label>SKU</label><input required maxlength="80" [(ngModel)]="v.sku" [name]="'sku'+$index"></div><div class="field"><label>Stock inicial</label><input required type="number" min="0" [(ngModel)]="v.initialStock" [name]="'stock'+$index"></div></div>@if(draft.variants.length > 1){<button type="button" class="button secondary mt-2" (click)="removeVariant($index)">Eliminar variante</button>}<hr/></div>}<button type="button" class="button secondary" (click)="addVariant()">+ Agregar otra variante</button></div><div class="editor-note">Se guarda como {{editingProductId?'versión final':'borrador'}} y registra cambios en auditoría.</div>@if(saveStatus()){<p class="save-status" role="status">{{saveStatus()}}</p>}<button type="submit" class="button" [disabled]="saving()||!canSave()">{{saving()?'Guardando…':(editingProductId?'Guardar Cambios':'Guardar borrador')}}</button></form></aside>}
  @if(showPriceEditor()){<div class="drawer-backdrop" (click)="showPriceEditor.set(false)"></div><aside class="editor"><header><div><p class="eyebrow">Ofertas</p><h2>Actualizar Precio</h2></div><button type="button" (click)="showPriceEditor.set(false)" aria-label="Cerrar"><app-icon name="close"/></button></header><form (ngSubmit)="savePrice()"><p style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem">Modifica el precio o crea una oferta relámpago.</p><div class="field" style="margin-bottom:1rem;background:var(--surface);padding:1rem;border-radius:8px;border:1px solid var(--line)"><label class="toggle-switch"><input type="checkbox" [(ngModel)]="isOfferMode" name="offerMode" (change)="toggleOfferMode()"><b>Crear oferta relámpago</b></label></div><div class="field"><label>{{isOfferMode?'Precio Oferta (CLP)':'Precio de Venta (CLP)'}}</label><input required type="number" min="1000" step="10" [(ngModel)]="editingPrice.base" name="eprice"></div>@if(isOfferMode){<div class="field"><label>Precio Original Tachado (Opcional)</label><input type="number" min="1000" step="10" [(ngModel)]="editingPrice.compare" name="ecompare"></div>}@if(saveStatus()){<p class="save-status" role="status">{{saveStatus()}}</p>}<button type="submit" class="button" [disabled]="saving()">{{saving()?'Guardando…':'Guardar Precio'}}</button></form></aside>}
  @if(showStockEditor()){<div class="drawer-backdrop" (click)="showStockEditor.set(false)"></div><aside class="editor wide"><header><div><p class="eyebrow">Operaciones</p><h2>Recibir Stock: {{stockProduct?.name}}</h2></div><button type="button" (click)="showStockEditor.set(false)" aria-label="Cerrar"><app-icon name="close"/></button></header><form (ngSubmit)="saveStock()"><p style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem">Indica las cantidades a AGREGAR al stock físico actual de cada talla/color. Usa números negativos si necesitas restar stock por merma.</p><table><thead><tr><th>SKU</th><th>Color / Talla</th><th>Stock Físico Actual</th><th>Cantidad a Agregar</th></tr></thead><tbody>@for(row of stockVariants;track row.id){<tr><td><small>{{row.sku}}</small></td><td>{{row.color}} · {{row.size}}</td><td>{{row.onHand}}</td><td><input type="number" class="custom-input" style="width:100px" [(ngModel)]="stockDeltas[row.id]" [name]="'delta_'+row.id"></td></tr>}</tbody></table>@if(saveStatus()){<p class="save-status" role="status">{{saveStatus()}}</p>}<button type="submit" class="button" [disabled]="saving()" style="margin-top:2rem">{{saving()?'Guardando…':'Guardar y Recibir Stock'}}</button></form></aside>}
  `,styleUrl:'./admin.page.scss'})
export class AdminPage{
  private readonly api=inject(AdminService);private readonly session=inject(AuthSessionService);
  readonly section=signal('Resumen');readonly showEditor=signal(false);readonly showPriceEditor=signal(false);readonly showStockEditor=signal(false);readonly loading=signal(true);readonly saving=signal(false);readonly error=signal('');readonly saveStatus=signal('');readonly products=signal<AdminProduct[]>([]);readonly orders=signal<AdminOrder[]>([]);readonly inventory=signal<AdminInventory[]>([]);readonly categories=signal<AdminCategory[]>([]);readonly collections=signal<AdminCollection[]>([]);readonly format=clp;productSearch='';inventorySearch='';
  readonly menu=[{icon:'⌂',label:'Resumen'},{icon:'□',label:'Pedidos',badge:true},{icon:'◇',label:'Productos'},{icon:'↕',label:'Inventario',badge:true},{icon:'↺',label:'Devoluciones'},{icon:'✦',label:'Editar Landingpage'},{icon:'♙',label:'Clientes'},{icon:'⚙',label:'Configuración'}];
  readonly lowStock=computed(()=>this.inventory().filter(x=>x.available<=x.lowStockThreshold));readonly pendingOrders=computed(()=>this.orders().filter(x=>!x.paidAt||x.status==='PendingPayment').length);readonly recentOrders=computed(()=>this.section()==='Resumen'?this.orders().slice(0,6):this.orders());
  readonly metrics=computed(()=>{const today=new Date().toDateString();const paid=this.orders().filter(x=>x.paidAt);const sales=paid.filter(x=>new Date(x.paidAt!).toDateString()===today).reduce((sum,x)=>sum+x.totalClp,0);const todayOrders=this.orders().filter(x=>new Date(x.createdAt).toDateString()===today).length;const ticket=paid.length?Math.round(paid.reduce((sum,x)=>sum+x.totalClp,0)/paid.length):0;return[{label:'Ventas hoy',value:this.format(sales),change:'Pagos confirmados'},{label:'Pedidos hoy',value:String(todayOrders),change:`${this.pendingOrders()} pendientes`},{label:'Ticket promedio',value:this.format(ticket),change:'Sobre ventas pagadas'},{label:'Stock bajo',value:String(this.lowStock().length),change:'Variantes bajo umbral'}]});
  readonly bars=computed(()=>{const rows=Array.from({length:7},(_,index)=>{const day=new Date();day.setHours(0,0,0,0);day.setDate(day.getDate()-(6-index));const amount=this.orders().filter(x=>x.paidAt&&new Date(x.paidAt).toDateString()===day.toDateString()).reduce((sum,x)=>sum+x.totalClp,0);return{key:day.toISOString(),day:day.toLocaleDateString('es-CL',{weekday:'short'}),amount,value:0}});const max=Math.max(1,...rows.map(x=>x.amount));return rows.map(x=>({...x,value:x.amount?Math.max(15,Math.round(x.amount/max*95)):4}))});
  readonly uniqueColors=computed(()=>Array.from(new Set(this.inventory().map(i=>i.color))).sort());
  readonly uniqueSizes=computed(()=>Array.from(new Set(this.inventory().map(i=>i.size))).sort());
  
  isNewCategory=false;customCategoryName='';
  isNewColor=false;customColor='';
  isNewSize=false;customSize='';
  darkMode=false;storeName='TRAMA SUR';storeLogo='';savingSettings=false;
  draft=this.newDraft();
  editingPrice={id:'',base:0,compare:null as number|null};
  editingProductId = '';
  stockProduct: AdminProduct | null = null;
  stockVariants: AdminInventory[] = [];
  stockDeltas: Record<string, number> = {};
  constructor(){this.load()}
  load():void{this.loading.set(true);this.error.set('');forkJoin({products:this.api.products(),orders:this.api.orders(),inventory:this.api.inventory(),categories:this.api.categories(),collections:this.api.collections(),settings:this.api.getSettings()}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>{this.products.set(r.products);this.orders.set(r.orders);this.inventory.set(r.inventory);this.categories.set(r.categories);this.collections.set(r.collections);if(!this.draft.categoryId&&r.categories.length)this.draft.categoryId=r.categories[0].id;this.darkMode=r.settings['darkMode']==='true';this.storeName=r.settings['storeName']||'TRAMA SUR';this.storeLogo=r.settings['storeLogo']||'';this.applyTheme();},error:e=>this.error.set(e.status===403?'Tu sesión no tiene MFA verificado. Vuelve a ingresar con el código de tu autenticador.':'No pudimos cargar el panel administrativo.')})}
  badge(section:string):string{return section==='Pedidos'?String(this.pendingOrders()):section==='Inventario'?String(this.lowStock().length):''}
  initials():string{const u=this.session.user();return `${u?.firstName?.[0]??'A'}${u?.lastName?.[0]??''}`.toUpperCase()}
  userName():string{const u=this.session.user();return u?`${u.firstName} ${u.lastName}`:'Administrador'}
  filteredProducts():AdminProduct[]{const q=this.productSearch.trim().toLowerCase();return this.products().filter(p=>!q||p.name.toLowerCase().includes(q)||p.slug.includes(q))}
  filteredInventory():AdminInventory[]{const q=this.inventorySearch.trim().toLowerCase();return this.inventory().filter(i=>!q||i.sku.toLowerCase().includes(q)||i.color.toLowerCase().includes(q)||i.size.toLowerCase().includes(q)).sort((a,b)=>(a.available<=a.lowStockThreshold?-1:1)-(b.available<=b.lowStockThreshold?-1:1))}
  statusLabel(status:string):string{return ({Active:'Publicado',Draft:'Borrador',Archived:'Archivado',PendingPayment:'Pago pendiente',Paid:'Pagado',Confirmed:'Confirmado',Preparing:'Preparando',Shipped:'Enviado',Delivered:'Entregado',Cancelled:'Cancelado',Expired:'Vencido'} as Record<string,string>)[status]??status}
  date(value:string):string{return new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
  openEditor(p?:AdminProduct):void{
    if(p){
      this.editingProductId = p.id;
      this.saving.set(true);this.showEditor.set(true);
      this.api.getProduct(p.id).subscribe({next:res=>{
        this.draft={name:res.name,slug:res.slug,categoryId:res.categoryId,shortDescription:res.shortDescription,basePriceClp:res.basePriceClp,audience:res.audience||'Unisex',collectionIds:[],variants:res.variants.map((v:any)=>({sku:v.sku,color:v.color,customColor:'',isNewColor:false,size:v.size,customSize:'',isNewSize:false,initialStock:0}))};
        this.saving.set(false);
      }});
    }else{
      this.editingProductId = '';
      this.draft=this.newDraft();if(!this.draft.categoryId&&this.categories().length)this.draft.categoryId=this.categories()[0].id;if(!this.draft.variants[0].color&&this.uniqueColors().length)this.draft.variants[0].color=this.uniqueColors()[0];if(!this.draft.variants[0].size&&this.uniqueSizes().length)this.draft.variants[0].size=this.uniqueSizes()[0];this.saveStatus.set('');this.showEditor.set(true);
    }
  }
  syncSlug():void{this.draft.slug=this.draft.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
  canSave():boolean{const validCategory=this.isNewCategory?!!this.customCategoryName:!!this.draft.categoryId;const variantsValid=this.draft.variants.every(v=>v.sku&&(v.isNewColor?!!v.customColor:!!v.color)&&(v.isNewSize?!!v.customSize:!!v.size)&&v.initialStock>=0);return !!(this.draft.name&&this.draft.slug&&validCategory&&this.draft.shortDescription&&this.draft.basePriceClp>=1000&&variantsValid)}
  
  toggleCollection(id: string, event: any):void {
    if (event.target.checked) this.draft.collectionIds.push(id);
    else this.draft.collectionIds = this.draft.collectionIds.filter(x => x !== id);
  }
  
  addVariant():void{
    const defColor = this.uniqueColors().length ? this.uniqueColors()[0] : '';
    const defSize = this.uniqueSizes().length ? this.uniqueSizes()[0] : '';
    this.draft.variants.push({sku:'',color:defColor,customColor:'',isNewColor:false,size:defSize,customSize:'',isNewSize:false,initialStock:0});
  }
  removeVariant(idx:number):void{this.draft.variants.splice(idx, 1);}
  
  saveProduct():void{
    if(!this.canSave())return;
    this.saving.set(true);this.saveStatus.set('');
    
    const finalVariants = this.draft.variants.map(v => ({
      sku: v.sku,
      color: v.isNewColor ? v.customColor : v.color,
      colorHex: '#2f4738', // Por defecto para simplificar
      size: v.isNewSize ? v.customSize : v.size,
      cut: 'Regular',
      barcode: null,
      priceClp: null,
      weightGrams: 500,
      lowStockThreshold: 3,
      initialStock: v.initialStock
    }));
    
    const createProductCall=(catId:string)=>{
      const request:CreateAdminProduct={name:this.draft.name,slug:this.draft.slug,categoryId:catId,shortDescription:this.draft.shortDescription,description:this.draft.shortDescription,materials:'Materiales por completar antes de publicar.',careInstructions:'Instrucciones de cuidado por completar antes de publicar.',audience:this.draft.audience,basePriceClp:this.draft.basePriceClp,compareAtPriceClp:null,metaTitle:this.draft.name,metaDescription:this.draft.shortDescription,imageUrl:'/assets/images/chaqueta-commuter.png',imageAlt:`${this.draft.name} en fotografía de catálogo`,variants:finalVariants, collectionIds: this.draft.collectionIds};
      return this.editingProductId ? this.api.updateProduct(this.editingProductId, request) : this.api.createProduct(request);
    };
    const operation=this.isNewCategory
      ?this.api.createCategory({name:this.customCategoryName,slug:this.customCategoryName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),description:'',displayOrder:99,isVisible:true}).pipe(switchMap(cat=>createProductCall(cat.id)))
      :createProductCall(this.draft.categoryId);
    operation.pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.saveStatus.set(this.editingProductId?'Producto actualizado exitosamente.':'Producto guardado como borrador.');this.showEditor.set(false);this.load()},error:e=>this.saveStatus.set(e.error?.detail??'No pudimos guardar el producto.')});
  }
  private newDraft(){this.isNewCategory=false;this.customCategoryName='';return{name:'',slug:'',categoryId:'',shortDescription:'',basePriceClp:49990,audience:'Unisex',collectionIds:[] as string[],variants:[{sku:'',color:'',customColor:'',isNewColor:false,size:'',customSize:'',isNewSize:false,initialStock:0}]}}
  
  updateThreshold(i: AdminInventory, val: string) {
    const newVal = parseInt(val, 10);
    if (!isNaN(newVal) && newVal >= 0 && newVal !== i.lowStockThreshold) {
      this.api.updateInventoryThreshold(i.variantId, newVal).subscribe({
        next: () => {
          this.inventory.update(list => list.map(x => x.id === i.id ? { ...x, lowStockThreshold: newVal } : x));
        }
      });
    }
  }
  
  setGlobalThreshold() {
    const res = prompt('Ingresa el nuevo umbral (stock bajo) para TODAS las prendas:');
    if (!res) return;
    const val = parseInt(res, 10);
    if (isNaN(val) || val < 0) {
      alert('Número inválido.');
      return;
    }
    if(confirm(`¿Estás seguro de establecer el umbral global en ${val} para TODAS las variantes de inventario?`)){
      this.saving.set(true);
      this.api.bulkUpdateInventoryThreshold(val).subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
        },
        error: () => { this.saving.set(false); alert('Error actualizando el umbral.'); }
      });
    }
  }

  archiveProduct(id:string){
    if(confirm('¿Seguro que deseas ocultar (archivar) este producto?')){
      this.api.archiveProduct(id).subscribe(()=>{
        this.products.update(list => list.map(p => p.id === id ? { ...p, status: 'Archived' } : p));
      });
    }
  }

  unarchiveProduct(id:string){
    if(confirm('¿Seguro que deseas volver a mostrar este producto en la tienda?')){
      this.api.unarchiveProduct(id).subscribe(()=>{
        this.products.update(list => list.map(p => p.id === id ? { ...p, status: 'Active' } : p));
      });
    }
  }
  
  isOfferMode = false;
  oldBasePrice = 0;
  
  openPriceEditor(p:any){
    this.editingPrice={id:p.id,base:p.basePriceClp,compare:p.compareAtPriceClp};
    this.oldBasePrice = p.basePriceClp;
    this.isOfferMode = !!p.compareAtPriceClp;
    this.saveStatus.set('');
    this.showPriceEditor.set(true);
  }
  
  toggleOfferMode(){
    if(this.isOfferMode){
      if(!this.editingPrice.compare){
        this.editingPrice.compare = this.oldBasePrice;
      }
    }else{
      this.editingPrice.base = this.editingPrice.compare || this.oldBasePrice;
      this.editingPrice.compare = null;
    }
  }
  
  savePrice(){
    this.saving.set(true);this.saveStatus.set('');
    this.api.getProduct(this.editingPrice.id).subscribe({
      next:full=>{
        const req:CreateAdminProduct={name:full.name,slug:full.slug,categoryId:full.categoryId,shortDescription:full.shortDescription,description:full.description,materials:full.materials,careInstructions:full.careInstructions,audience:full.audience,basePriceClp:this.editingPrice.base,compareAtPriceClp:this.editingPrice.compare||null,metaTitle:full.metaTitle,metaDescription:full.metaDescription,imageUrl:'',imageAlt:'',variants:[]};
        this.api.updateProduct(this.editingPrice.id,req).subscribe({
          next:()=>{
            this.saveStatus.set('Precio actualizado.');
            this.showPriceEditor.set(false);
            this.saving.set(false);
            this.products.update(list => list.map(p => p.id === this.editingPrice.id ? { ...p, basePriceClp: this.editingPrice.base, compareAtPriceClp: this.editingPrice.compare || null } : p));
          },
          error:e=>{this.saveStatus.set(e.error?.detail??'Error.');this.saving.set(false);}
        });
      },
      error:e=>{this.saveStatus.set('Error.');this.saving.set(false);}
    });
  }

  openStockEditor(p: AdminProduct) {
    this.saving.set(true);
    this.api.getProduct(p.id).subscribe({
      next: full => {
        this.stockProduct = p;
        this.stockVariants = [];
        this.stockDeltas = {};
        for (const variant of full.variants) {
          const inv = this.inventory().find(i => i.sku === variant.sku);
          if (inv) {
            this.stockVariants.push(inv);
            this.stockDeltas[inv.id] = 0;
          }
        }
        this.saveStatus.set('');
        this.showStockEditor.set(true);
        this.saving.set(false);
      },
      error: e => { this.saving.set(false); alert('No pudimos cargar los datos.'); }
    });
  }

  saveStock() {
    const calls = [];
    for (const id of Object.keys(this.stockDeltas)) {
      const delta = this.stockDeltas[id];
      if (delta && delta !== 0) {
        calls.push(this.api.adjustInventory(id, delta, 'Recepción de stock manual'));
      }
    }
    
    if (calls.length === 0) {
      this.saveStatus.set('No ingresaste ninguna cantidad nueva.');
      return;
    }
    
    this.saving.set(true);
    this.saveStatus.set('');
    
    forkJoin(calls).subscribe({
      next: () => {
        this.saveStatus.set('Stock recibido y actualizado exitosamente.');
        this.showStockEditor.set(false);
        this.saving.set(false);
        this.load();
      },
      error: e => {
        this.saveStatus.set('Error al actualizar el stock.');
        this.saving.set(false);
      }
    });
  }

  applyTheme(){
    if(this.darkMode)document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
    document.title = this.storeName + ' - Administración';
  }
  saveSettings(){
    this.savingSettings=true;
    this.api.saveSettings({darkMode:String(this.darkMode),storeName:this.storeName,storeLogo:this.storeLogo}).pipe(finalize(()=>this.savingSettings=false)).subscribe({next:()=>this.applyTheme(),error:()=>alert('Error guardando configuración')});
  }
  uploadLogo(event:any){
    const file=event.target.files?.[0];
    if(!file)return;
    this.savingSettings=true;
    this.api.uploadSettingImage(file).subscribe({next:res=>{this.storeLogo=res.url;this.saveSettings();},error:()=>{this.savingSettings=false;alert('Error subiendo logo');}});
  }
}
