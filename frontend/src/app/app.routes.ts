import { Routes, UrlSegment } from '@angular/router';
import { adminGuard } from './core/admin.guard';

export function categoryMatcher(url: UrlSegment[]) {
  if (url.length === 1) {
    const p = url[0].path;
    if (['hombre', 'mujer', 'unisex', 'abrigos', 'tops', 'pantalones', 'coleccion'].includes(p)) {
      return { consumed: url, posParams: { category: new UrlSegment(p, {}) } };
    }
  }
  return null;
}

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage), title: 'Trama Sur — Ropa funcional para moverse' },
  { path: 'carrito', loadComponent: () => import('./pages/cart/cart.page').then(m => m.CartPage), title: 'Carrito — Trama Sur' },
  { path: 'checkout', loadComponent: () => import('./pages/checkout/checkout.page').then(m => m.CheckoutPage), title: 'Pago seguro — Trama Sur' },
  { path: 'pago/resultado', loadComponent: () => import('./pages/payment-result/payment-result.page').then(m => m.PaymentResultPage), title: 'Resultado del pago — Trama Sur' },
  { path: 'cuenta', loadComponent: () => import('./pages/account/account.page').then(m => m.AccountPage), title: 'Mi cuenta — Trama Sur' },
  { path: 'legal/:slug', loadComponent: () => import('./pages/legal/legal.page').then(m => m.LegalPage), title: 'Información legal — Trama Sur' },
  { path: 'admin', canActivate:[adminGuard], loadComponent: () => import('./pages/admin/admin.page').then(m => m.AdminPage), title: 'Administración — Trama Sur' },
  { path: 'admin/contenido/inicio', canActivate:[adminGuard], loadComponent: () => import('./pages/admin/cms-editor.page').then(m => m.CmsEditorPage), title: 'Editor de portada — Trama Sur' },
  { matcher: categoryMatcher, loadComponent: () => import('./pages/catalog/catalog.page').then(m => m.CatalogPage), title: 'Colección — Trama Sur' },
  { path: ':slug', loadComponent: () => import('./pages/product/product.page').then(m => m.ProductPage), title: 'Producto — Trama Sur' },
  { path: '**', redirectTo: '' },
];
