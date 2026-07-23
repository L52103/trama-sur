import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CartLine, ProductCard } from './models';

interface ServerCartItem { id:string;variantId:string;productName:string;slug:string;sku:string;color:string;size:string;imageUrl:string;quantity:number;availableQuantity:number;unitPriceClp:number;lineTotalClp:number }
interface ServerCart { items:ServerCartItem[];couponCode:string|null }

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly http=inject(HttpClient);
  private readonly storageKey = 'trama_demo_cart_v1';
  private readonly state = signal<CartLine[]>(this.read());
  readonly lines = this.state.asReadonly();
  readonly itemCount = computed(() => this.state().reduce((sum, line) => sum + line.quantity, 0));
  readonly subtotal = computed(() => this.state().reduce((sum, line) => sum + line.product.priceClp * line.quantity, 0));
  readonly shipping = computed(() => this.subtotal() === 0 || this.subtotal() >= 79_990 ? 0 : 4_990);
  readonly total = computed(() => this.subtotal() + this.shipping());
  readonly connected=signal(false);

  constructor(){this.http.get<ServerCart>('/api/v1/cart',{withCredentials:true}).subscribe({next:cart=>{this.connected.set(true);this.sync(cart)},error:()=>this.connected.set(false)});}

  add(product: ProductCard, variantId: string, size: string, color: string): void {
    const key = `${product.id}-${variantId}`;
    const existing = this.state().find(line => line.id === key || line.variantId===variantId);
    const next = existing
      ? this.state().map(line => line.id === existing.id ? { ...line, quantity: Math.min(10, line.quantity + 1) } : line)
      : [...this.state(), { id: key, variantId, product, size, color, quantity: 1 }];
    this.write(next);
    this.http.post<ServerCart>('/api/v1/cart/items',{variantId,quantity:1},{withCredentials:true}).subscribe({next:cart=>{this.connected.set(true);this.sync(cart)},error:()=>this.connected.set(false)});
  }

  update(id: string, quantity: number): void {
    if (quantity < 1) { this.remove(id); return; }
    this.write(this.state().map(line => line.id === id ? { ...line, quantity: Math.min(10, quantity) } : line));
    if(this.isGuid(id))this.http.put<ServerCart>(`/api/v1/cart/items/${id}`,{quantity},{withCredentials:true}).subscribe({next:cart=>this.sync(cart)});
  }

  remove(id: string): void {
    this.write(this.state().filter(line => line.id !== id));
    if(this.isGuid(id))this.http.delete<ServerCart>(`/api/v1/cart/items/${id}`,{withCredentials:true}).subscribe({next:cart=>this.sync(cart)});
  }

  clear(): void {
    const ids=this.state().map(line=>line.id).filter(id=>this.isGuid(id));
    this.write([]);
    ids.forEach(id=>this.http.delete(`/api/v1/cart/items/${id}`,{withCredentials:true}).subscribe({error:()=>undefined}));
  }

  private sync(cart:ServerCart):void{
    const previous=this.state();
    const lines=cart.items.map(item=>{
      const known=previous.find(line=>line.variantId===item.variantId)?.product;
      const product:ProductCard=known??{id:item.variantId,name:item.productName,slug:item.slug,shortDescription:`${item.color} · ${item.size}`,priceClp:item.unitPriceClp,compareAtPriceClp:null,currency:'CLP',imageUrl:item.imageUrl,imageAlt:item.productName,colors:[item.color],available:item.availableQuantity>0,category:'',features:[]};
      return {id:item.id,variantId:item.variantId,product:{...product,priceClp:item.unitPriceClp,imageUrl:item.imageUrl},size:item.size,color:item.color,quantity:item.quantity};
    });
    this.write(lines);
  }

  private write(lines: CartLine[]): void { this.state.set(lines); if (typeof localStorage !== 'undefined') localStorage.setItem(this.storageKey, JSON.stringify(lines)); }
  private read(): CartLine[] { try { return typeof localStorage === 'undefined' ? [] : JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as CartLine[]; } catch { return []; } }
  private isGuid(value:string):boolean{return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
}
