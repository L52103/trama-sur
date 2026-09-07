import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface AdminProduct { id:string;name:string;slug:string;category:string;status:string;basePriceClp:number;compareAtPriceClp:number|null;variants:number;imageUrl:string|null;updatedAt:string;stockAvailable:number }
export interface AdminOrder { id:string;number:string;customerEmail:string;status:string;totalClp:number;currency:string;paidAt:string|null;createdAt:string;itemCount:number }
export interface AdminInventory { id:string;warehouseId:string;variantId:string;sku:string;color:string;size:string;onHand:number;reserved:number;available:number;lowStockThreshold:number }
export interface AdminCategory { id:string;name:string;slug:string;description:string|null;displayOrder:number;isVisible:boolean }
export interface AdminCollection { id:string;name:string;slug:string;description:string|null;displayOrder:number;isVisible:boolean }
export interface AdminAnalytics { totalProducts:number;lowStockCount:number;lowStockItems:Array<{id:string;productName:string;sku:string;color:string;size:string;available:number;lowStockThreshold:number}>;totalOrders:number;totalRevenueClp:number;averageOrderValueClp:number;audienceBreakdown:Array<{audience:string;count:number}> }

export interface OrderItemDetail { id:string;productName:string;sku:string;size:string;color:string;quantity:number;unitPriceClp:number;totalPriceClp:number }
export interface OrderHistoryItem { id:string;fromStatus:string;toStatus:string;reason:string;createdAt:string }
export interface OrderAddressDetail { streetAddress:string;apartmentOrSuite?:string;commune:string;region:string;postalCode?:string;receiverName:string;receiverPhone:string }
export interface AdminOrderDetail {
  order: {
    id:string;number:string;customerEmail:string;customerFirstName?:string;customerLastName?:string;customerPhone?:string;status:string;totalClp:number;subtotalClp:number;shippingClp:number;discountClp:number;currency:string;paidAt:string|null;createdAt:string;
    items:OrderItemDetail[];history:OrderHistoryItem[];
  };
  address:OrderAddressDetail|null;
}

export interface AdminReturn {
  id: string;
  orderId: string;
  number: string;
  customerEmail: string;
  status: string;
  reason: string;
  customerNotes: string;
  items: number;
  createdAt: string;
}

export interface AdminReturnItem {
  id: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  unitPriceClp: number;
  quantityReturned: number;
  originalQuantity: number;
}

export interface AdminReturnHistory {
  action: string;
  changesJson: string;
  createdAt: string;
}

export interface AdminReturnDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  status: string;
  reason: string;
  customerNotes: string;
  createdAt: string;
  items: AdminReturnItem[];
  history: AdminReturnHistory[];
}

export interface AdminCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isRegistered: boolean;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  createdAt: string;
  ordersCount: number;
  totalSpentClp: number;
  lastOrderAt: string | null;
}

export interface CustomerAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  region: string;
  commune: string;
  addressLine1: string;
  addressLine2?: string;
  instructions?: string;
  isDefault: boolean;
}

export interface CustomerOrderSummary {
  id: string;
  number: string;
  status: string;
  totalClp: number;
  paidAt: string | null;
  createdAt: string;
  itemsCount: number;
}

export interface AdminCustomerDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  isRegistered: boolean;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  addresses: CustomerAddress[];
  orders: CustomerOrderSummary[];
  metrics: {
    ordersCount: number;
    totalSpentClp: number;
    averageOrderValueClp: number;
  };
}

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
  getOrder(id:string):Observable<AdminOrderDetail>{return this.http.get<AdminOrderDetail>(`${this.api}/orders/${id}`)}
  updateOrderStatus(id:string,status:string,reason:string):Observable<void>{return this.http.put<void>(`${this.api}/orders/${id}/status`,{status,reason})}
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
  
  returns():Observable<AdminReturn[]>{return this.http.get<AdminReturn[]>(`${this.api}/returns`)}
  getReturn(id:string):Observable<AdminReturnDetail>{return this.http.get<AdminReturnDetail>(`${this.api}/returns/${id}`)}
  updateReturnStatus(id:string,status:string,resolutionNote:string):Observable<void>{return this.http.put<void>(`${this.api}/returns/${id}`,{status,resolutionNote})}

  customers(search?:string):Observable<AdminCustomer[]>{
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<AdminCustomer[]>(`${this.api}/customers${params}`);
  }
  getCustomer(id:string):Observable<AdminCustomerDetail>{return this.http.get<AdminCustomerDetail>(`${this.api}/customers/${id}`)}

  getSettings():Observable<Record<string, string>>{return this.http.get<Record<string, string>>(`${this.api}/settings`)}
  saveSettings(settings:Record<string, string>):Observable<any>{return this.http.put<any>(`${this.api}/settings`, settings)}
  uploadSettingImage(file:File):Observable<{url:string}>{const fd=new FormData();fd.append('file',file);return this.http.post<{url:string}>(`${this.api}/media/upload`, fd)}
}
