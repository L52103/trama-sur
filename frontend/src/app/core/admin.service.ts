import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface AdminProduct { id:string;name:string;slug:string;category:string;status:string;basePriceClp:number;compareAtPriceClp:number|null;variants:number;imageUrl:string|null;updatedAt:string;stockAvailable:number }
export interface AdminOrder { id:string;number:string;customerEmail:string;status:string;totalClp:number;currency:string;paidAt:string|null;createdAt:string;itemCount:number }
export interface AdminInventory { id:string;warehouseId:string;variantId:string;sku:string;color:string;size:string;onHand:number;reserved:number;available:number;lowStockThreshold:number }
export interface AdminCategory { id:string;name:string;slug:string;description:string|null;displayOrder:number;isVisible:boolean }
export interface AdminCollection { id:string;name:string;slug:string;description:string|null;displayOrder:number;isVisible:boolean }
export interface AdminAnalytics { totalProducts:number;lowStockCount:number;lowStockItems:Array<{id:string;productName:string;sku:string;color:string;size:string;available:number;lowStockThreshold:number}>;totalOrders:number;totalRevenueClp:number;averageOrderValueClp:number;audienceBreakdown:Array<{audience:string;count:number}> }

export interface CreateAdminProduct {
  name:string;slug:string;categoryId:string;shortDescription:string;description:string;materials:string;careInstructions:string;audience:string;basePriceClp:number;compareAtPriceClp:number|null;metaTitle:string;metaDescription:string;imageUrl:string;imageAlt:string;
  collectionIds?:string[];
  variants:Array<{sku:string;color:string;colorHex:string;size:string;cut:string;barcode:null;priceClp:null;weightGrams:number;lowStockThreshold:number;initialStock:number}>;
}

@Injectable({providedIn:'root'})
export class AdminService{
  private readonly http=inject(HttpClient);private readonly api='/api/v1/admin';
  products():Observable<AdminProduct[]>{return this.http.get<AdminProduct[]>(`${this.api}/products`)}
  orders():Observable<AdminOrder[]>{return this.http.get<AdminOrder[]>(`${this.api}/orders`)}
  inventory():Observable<AdminInventory[]>{return this.http.get<AdminInventory[]>(`${this.api}/inventory`)}
  categories():Observable<AdminCategory[]>{return this.http.get<AdminCategory[]>(`${this.api}/categories`)}
  collections():Observable<AdminCollection[]>{return this.http.get<AdminCollection[]>(`${this.api}/collections`)}
  analytics():Observable<AdminAnalytics>{return this.http.get<AdminAnalytics>(`${this.api}/analytics`)}
  getProduct(id:string):Observable<any>{return this.http.get<any>(`${this.api}/products/${id}`)}
  createCategory(request:{name:string;slug:string;description:string;displayOrder:number;isVisible:boolean}):Observable<{id:string;name:string}>{return this.http.post<{id:string;name:string}>(`${this.api}/categories`,request)}
  createProduct(request:CreateAdminProduct):Observable<{id:string;name:string;status:string}>{return this.http.post<{id:string;name:string;status:string}>(`${this.api}/products`,request)}
  updateProduct(id:string, request:any):Observable<void>{return this.http.put<void>(`${this.api}/products/${id}`,request)}
  archiveProduct(id:string):Observable<void>{return this.http.post<void>(`${this.api}/products/${id}/archive`,{})}
  unarchiveProduct(id:string):Observable<void>{return this.http.post<void>(`${this.api}/products/${id}/unarchive`,{})}
  updateInventoryThreshold(variantId:string, threshold:number):Observable<void>{return this.http.put<void>(`${this.api}/inventory/${variantId}/threshold`, {threshold})}
  bulkUpdateInventoryThreshold(threshold:number):Observable<void>{return this.http.put<void>(`${this.api}/inventory/threshold/bulk`, {threshold})}
  adjustInventory(inventoryItemId:string, quantityDelta:number, reason:string):Observable<any>{return this.http.post<any>(`${this.api}/inventory/adjustments`, {inventoryItemId, quantityDelta, reason, reference:''})}
  
  getSettings():Observable<Record<string, string>>{return this.http.get<Record<string, string>>(`${this.api}/settings`)}
  saveSettings(settings:Record<string, string>):Observable<any>{return this.http.put<any>(`${this.api}/settings`, settings)}
  uploadSettingImage(file:File):Observable<{url:string}>{const fd=new FormData();fd.append('file',file);return this.http.post<{url:string}>(`${this.api}/media/upload`, fd)}
}
