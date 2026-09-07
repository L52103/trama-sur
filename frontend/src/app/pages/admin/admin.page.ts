import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, Observable, of, switchMap } from 'rxjs';
import {
  AdminCategory,
  AdminCollection,
  AdminInventory,
  AdminOrder,
  AdminOrderDetail,
  AdminProduct,
  AdminService,
  CreateAdminProduct
} from '../../core/admin.service';
import { AuthSessionService } from '../../core/auth-session.service';
import { clp } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

export interface PendingCache {
  thresholds: Record<string, number>; // variantId -> new threshold
  settings: Record<string, string>;   // key -> value
  stockAdjustments: Record<string, { delta: number; sku: string; reason: string }>; // inventoryItemId -> adjustment
}

const CACHE_KEY = 'trama_admin_draft_cache';

@Component({
  selector: 'app-admin-page',
  imports: [FormsModule, IconComponent, RouterLink, NgTemplateOutlet],
  template: `
  <section class="admin">
    <!-- BARRA LATERAL -->
    <aside>
      <div class="admin-brand">
        TRAMA <span>SUR</span>
        <small>Portal del Vendedor</small>
      </div>

      <nav>
        @for (item of menu; track item.label) {
          <button [class.active]="section() === item.label" (click)="setSection(item.label)">
            <span>{{ item.icon }}</span>
            {{ item.label }}
            @if (item.badge) {
              <b [class.alert-badge]="badgeIsAlert(item.label)">{{ badge(item.label) }}</b>
            }
          </button>
        }
      </nav>

      @if (hasPending()) {
        <div class="sidebar-cache-notice" (click)="section.set('Inventario')">
          <span class="pulse-dot"></span>
          <div>
            <b>{{ pendingCount() }} cambios en caché</b>
            <small>Pendientes de guardar</small>
          </div>
        </div>
      }

      <div class="admin-user">
        <i>{{ initials() }}</i>
        <span>
          <b>{{ userName() }}</b>
          <small>Administrador · MFA Activo</small>
        </span>
      </div>
    </aside>

    <!-- ÁREA PRINCIPAL -->
    <main>
      <!-- TOAST DE NOTIFICACIONES -->
      @if (toast()) {
        <div class="admin-toast" [class]="toast()!.type" role="status">
          <span>{{ toast()!.message }}</span>
          <button type="button" (click)="toast.set(null)" aria-label="Cerrar notificación">✕</button>
        </div>
      }

      <!-- ENCABEZADO -->
      <header>
        <div>
          <p class="breadcrumb">Panel de Control / {{ section() }}</p>
          <h1>{{ section() }}</h1>
        </div>
        <div class="header-actions">
          <div class="system-status-chip">
            <span class="status-dot"></span> Base de datos conectada
          </div>
          @if (section() === 'Productos' || section() === 'Resumen') {
            <button class="button" (click)="openEditor()">
              <app-icon name="plus" /> Nuevo producto
            </button>
          }
        </div>
      </header>

      @if (error()) {
        <div class="admin-error" role="alert">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Cargando datos operacionales…</p>
        </div>
      }

      <!-- ==================== RESUMEN / DASHBOARD ==================== -->
      @if (section() === 'Resumen') {
        <!-- MÉTRICAS PRINCIPALES -->
        <div class="metrics">
          @for (metric of metrics(); track metric.label) {
            <article class="metric-card">
              <span>{{ metric.label }}</span>
              <b>{{ metric.value }}</b>
              <small>{{ metric.change }}</small>
            </article>
          }
        </div>

        <!-- ACCIONES RÁPIDAS DEL VENDEDOR -->
        <div class="quick-actions-bar">
          <h3>Acciones rápidas para hoy</h3>
          <div class="quick-buttons">
            <button type="button" class="quick-btn" (click)="goToOrdersPending()">
              <span class="q-icon">📦</span>
              <div>
                <b>Pedidos por despachar ({{ pendingOrders() }})</b>
                <small>Ver pedidos pagados y pendientes</small>
              </div>
              <span class="arrow">→</span>
            </button>

            <button type="button" class="quick-btn" (click)="goToInventoryAlerts()">
              <span class="q-icon warning">⚠️</span>
              <div>
                <b>Revisar stock crítico ({{ lowStock().length }})</b>
                <small>Variantes bajo el umbral mínimo</small>
              </div>
              <span class="arrow">→</span>
            </button>

            <button type="button" class="quick-btn" (click)="openEditor()">
              <span class="q-icon plus">＋</span>
              <div>
                <b>Publicar nuevo producto</b>
                <small>Crear prenda y variantes</small>
              </div>
              <span class="arrow">→</span>
            </button>
          </div>
        </div>

        <!-- GRÁFICO Y ALERTAS -->
        <div class="dashboard-grid">
          <section class="chart-section">
            <div class="section-title">
              <div>
                <h2>Ventas últimos 7 días</h2>
                <p>Ingresos netos con pago confirmado</p>
              </div>
              <span class="live-label">● Datos en vivo</span>
            </div>
            <div class="bars">
              @for (bar of bars(); track bar.key) {
                <div class="bar-col">
                  <span class="bar-fill" [style.height.%]="bar.value">
                    <i class="bar-tooltip">{{ format(bar.amount) }}</i>
                  </span>
                  <small>{{ bar.day }}</small>
                </div>
              }
            </div>
          </section>

          <section class="alerts-section">
            <div class="section-title">
              <h2>Atención operativa</h2>
            </div>
            <button class="alert-item" (click)="goToInventoryAlerts()">
              <span class="alert-icon warning">!</span>
              <div>
                <b>{{ lowStock().length }} variantes con stock bajo</b>
                <small>Disponibilidad menor o igual a su umbral</small>
              </div>
              <strong>→</strong>
            </button>
            <button class="alert-item" (click)="goToOrdersPending()">
              <span class="alert-icon">⌁</span>
              <div>
                <b>{{ pendingOrders() }} pedidos pendientes</b>
                <small>Por autorizar pago o preparar despacho</small>
              </div>
              <strong>→</strong>
            </button>
            <div class="health-row">
              <span class="alert-icon safe">✓</span>
              <div>
                <b>Conexión segura & MFA activo</b>
                <small>PostgreSQL y autenticador validados</small>
              </div>
            </div>
          </section>
        </div>

        <!-- PEDIDOS RECIENTES -->
        <section class="orders-section">
          <div class="section-title">
            <div>
              <h2>Pedidos recientes</h2>
              <p>Haz clic en cualquier pedido para ver detalle o cambiar su estado</p>
            </div>
            <button class="link-btn" (click)="section.set('Pedidos')">Ver todos los pedidos →</button>
          </div>
          <ng-container [ngTemplateOutlet]="ordersTable" />
        </section>
      }

      <!-- ==================== PEDIDOS ==================== -->
      @else if (section() === 'Pedidos') {
        <section class="orders-section full-page">
          <div class="section-header-row">
            <div>
              <h2>Gestión de Pedidos</h2>
              <p>{{ filteredOrders().length }} pedidos encontrados · Despacho y seguimiento</p>
            </div>
            <div class="search-box">
              <input
                type="text"
                placeholder="Buscar por # o correo del cliente…"
                [(ngModel)]="orderSearchText"
                class="search-input"
              />
            </div>
          </div>

          <!-- CHIPS DE FILTRO DE ESTADO -->
          <div class="filter-chips">
            <button
              type="button"
              class="chip"
              [class.active]="orderFilter() === 'ALL'"
              (click)="orderFilter.set('ALL')"
            >
              Todos <span class="chip-count">{{ orders().length }}</span>
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="orderFilter() === 'Paid'"
              (click)="orderFilter.set('Paid')"
            >
              Por preparar <span class="chip-count">{{ countOrdersByStatus('Paid') }}</span>
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="orderFilter() === 'Preparing'"
              (click)="orderFilter.set('Preparing')"
            >
              En preparación <span class="chip-count">{{ countOrdersByStatus('Preparing') }}</span>
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="orderFilter() === 'Shipped'"
              (click)="orderFilter.set('Shipped')"
            >
              Enviados <span class="chip-count">{{ countOrdersByStatus('Shipped') }}</span>
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="orderFilter() === 'Delivered'"
              (click)="orderFilter.set('Delivered')"
            >
              Entregados <span class="chip-count">{{ countOrdersByStatus('Delivered') }}</span>
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="orderFilter() === 'PendingPayment'"
              (click)="orderFilter.set('PendingPayment')"
            >
              Pago Pendiente <span class="chip-count">{{ countOrdersByStatus('PendingPayment') }}</span>
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="orderFilter() === 'Cancelled'"
              (click)="orderFilter.set('Cancelled')"
            >
              Cancelados <span class="chip-count">{{ countOrdersByStatus('Cancelled') }}</span>
            </button>
          </div>

          <ng-container [ngTemplateOutlet]="ordersTable" />
        </section>
      }

      <!-- ==================== PRODUCTOS ==================== -->
      @else if (section() === 'Productos') {
        <section class="products-section full-page">
          <div class="section-header-row">
            <div>
              <h2>Catálogo de Productos</h2>
              <p>{{ filteredProducts().length }} productos visibles</p>
            </div>
            <div class="search-box">
              <input
                type="text"
                placeholder="Buscar por nombre o slug…"
                [(ngModel)]="productSearch"
                class="search-input"
              />
            </div>
          </div>

          <!-- CHIPS DE FILTRO DE PRODUCTOS -->
          <div class="filter-chips">
            <button
              type="button"
              class="chip"
              [class.active]="productStatusFilter() === 'ALL'"
              (click)="productStatusFilter.set('ALL')"
            >
              Todos ({{ products().length }})
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="productStatusFilter() === 'Active'"
              (click)="productStatusFilter.set('Active')"
            >
              Publicados ({{ countProductsByStatus('Active') }})
            </button>
            <button
              type="button"
              class="chip"
              [class.active]="productStatusFilter() === 'Archived'"
              (click)="productStatusFilter.set('Archived')"
            >
              Ocultos / Archivados ({{ countProductsByStatus('Archived') }})
            </button>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio Venta</th>
                  <th>Stock Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (p of filteredProducts(); track p.id) {
                  <tr>
                    <td>
                      <div class="product-cell">
                        <img [src]="p.imageUrl || '/assets/images/polera-organica.png'" alt="" />
                        <span>
                          <b>{{ p.name }}</b>
                          <small>{{ p.slug }}</small>
                        </span>
                      </div>
                    </td>
                    <td><span class="category-chip">{{ p.category }}</span></td>
                    <td>
                      <b>{{ format(p.basePriceClp) }}</b>
                      @if (p.compareAtPriceClp) {
                        <br />
                        <small class="strikethrough">{{ format(p.compareAtPriceClp) }}</small>
                      }
                    </td>
                    <td>
                      <span
                        class="stock-pill"
                        [class.good]="p.stockAvailable > 5"
                        [class.warning]="p.stockAvailable > 0 && p.stockAvailable <= 5"
                        [class.danger]="p.stockAvailable <= 0"
                      >
                        {{ p.stockAvailable }} un. ({{ p.variants }} var.)
                      </span>
                    </td>
                    <td>
                      <span class="status" [class.paid]="p.status === 'Active'">
                        {{ statusLabel(p.status) }}
                      </span>
                    </td>
                    <td>
                      <div class="action-buttons">
                        <button
                          type="button"
                          class="btn-sm secondary"
                          (click)="openStockEditor(p)"
                          title="Ajustar stock"
                        >
                          + Stock
                        </button>
                        <button
                          type="button"
                          class="btn-sm secondary"
                          (click)="openEditor(p)"
                          title="Editar información"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          class="btn-sm secondary"
                          (click)="openPriceEditor(p)"
                          title="Cambiar precio u oferta"
                        >
                          $ Precio
                        </button>
                        @if (p.status !== 'Archived') {
                          <button
                            type="button"
                            class="btn-sm secondary"
                            (click)="archiveProduct(p.id)"
                            title="Ocultar de la tienda"
                          >
                            Ocultar
                          </button>
                        } @else {
                          <button
                            type="button"
                            class="btn-sm secondary"
                            (click)="unarchiveProduct(p.id)"
                            title="Publicar en la tienda"
                          >
                            Mostrar
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty-cell">No se encontraron productos con ese filtro.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <!-- ==================== INVENTARIO ==================== -->
      @else if (section() === 'Inventario') {
        <section class="products-section full-page">
          <div class="section-header-row">
            <div>
              <h2>Control de Inventario por Variante</h2>
              <p>
                {{ inventory().length }} variantes registradas · Los ajustes de umbrales se guardan
                en <strong>caché local</strong> hasta que apliques los cambios a la base de datos.
              </p>
            </div>
            <div class="inventory-top-controls">
              <button
                type="button"
                class="chip"
                [class.active]="onlyLowStockFilter()"
                (click)="onlyLowStockFilter.set(!onlyLowStockFilter())"
              >
                ⚠️ Solo stock bajo ({{ lowStock().length }})
              </button>

              <button type="button" class="button secondary btn-sm" (click)="setGlobalThreshold()">
                Umbral global
              </button>

              <div class="search-box">
                <input
                  type="text"
                  placeholder="Buscar SKU, color, talla…"
                  [(ngModel)]="inventorySearch"
                  class="search-input"
                />
              </div>
            </div>
          </div>

          @if (pendingThresholdCount() > 0) {
            <div class="cache-alert-box">
              <span>⚡</span>
              <div>
                <b>Tienes {{ pendingThresholdCount() }} umbral(es) modificado(s) en caché local.</b>
                <small>No se ha escrito en PostgreSQL para evitar sobrecargas. Usa la barra inferior para guardar.</small>
              </div>
            </div>
          }

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Prenda y Variante</th>
                  <th>Físico</th>
                  <th>Reservado</th>
                  <th>Disponible</th>
                  <th>Umbral de Alerta (Editable)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredInventory(); track row.id) {
                  <tr [class.low-row]="row.available <= getEffectiveThreshold(row)">
                    <td>
                      <code class="sku-tag">{{ row.sku }}</code>
                    </td>
                    <td>
                      <b>{{ row.color }}</b> · Talla {{ row.size }}
                    </td>
                    <td>{{ row.onHand }}</td>
                    <td>{{ row.reserved }}</td>
                    <td>
                      <span
                        class="stock-pill"
                        [class.good]="row.available > getEffectiveThreshold(row)"
                        [class.warning]="row.available > 0 && row.available <= getEffectiveThreshold(row)"
                        [class.danger]="row.available <= 0"
                      >
                        {{ row.available }} un.
                      </span>
                    </td>
                    <td>
                      <div class="threshold-cell">
                        <input
                          type="number"
                          min="0"
                          class="threshold-input"
                          [class.cached]="isThresholdPending(row)"
                          [value]="getEffectiveThreshold(row)"
                          (input)="onThresholdInput(row, $any($event.target).value)"
                          title="Modifica el umbral. Se guardará en caché automáticamente."
                        />
                        @if (isThresholdPending(row)) {
                          <span class="cache-badge" title="Valor guardado localmente en caché">● En caché</span>
                        }
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="btn-sm secondary"
                        (click)="quickStockPrompt(row)"
                        title="Ajustar unidades"
                      >
                        + / - Stock
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty-cell">No hay variantes que coincidan con la búsqueda.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <!-- ==================== EDITAR LANDINGPAGE ==================== -->
      @else if (section() === 'Editar Landingpage') {
        <section class="placeholder-card">
          <span class="icon-hero">✦</span>
          <h2>Contenido de la Portada</h2>
          <p>
            Edita los titulares, imágenes promocionales y anuncios destacados con guardado en borrador y previsualización en vivo.
          </p>
          <a class="button" routerLink="/admin/contenido/inicio">Abrir editor visual</a>
        </section>
      }

      <!-- ==================== CLIENTES ==================== -->
      @else if (section() === 'Clientes') {
        <section class="placeholder-card">
          <span class="icon-hero">♙</span>
          <h2>Clientes & Fidelización</h2>
          <p>
            Módulo de visualización de clientes recurrentes, historial de pedidos por usuario y datos de contacto de compradores frecuentes.
          </p>
          <div class="info-tag">En preparación para la próxima versión</div>
        </section>
      }

      <!-- ==================== CONFIGURACIÓN ==================== -->
      @else if (section() === 'Configuración') {
        <section class="products-section full-page">
          <div class="section-title">
            <div>
              <h2>Configuración de la Tienda</h2>
              <p>Personalización de apariencia y accesos</p>
            </div>
          </div>

          <div class="config-grid">
            <article class="config-card">
              <h3>Apariencia & Marca</h3>

              <div class="field-row">
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    [(ngModel)]="darkMode"
                    (change)="onDarkModeToggle()"
                  />
                  <b>Modo Oscuro (Dark Theme)</b>
                </label>
                <small class="field-hint">Afecta al panel de administración y la experiencia visual.</small>
              </div>

              <hr class="separator" />

              <div class="field-group">
                <label>Nombre de la tienda (Título de la web)</label>
                <input
                  type="text"
                  class="custom-input"
                  [(ngModel)]="storeName"
                  (input)="onStoreNameInput()"
                  placeholder="Ej: TRAMA SUR"
                />
                <small class="field-hint">Se previsualiza de inmediato y se guardará al confirmar en la base de datos.</small>
              </div>

              <hr class="separator" />

              <div class="field-group">
                <label>Logo de la tienda</label>
                <div class="logo-upload-row">
                  @if (storeLogo) {
                    <img [src]="storeLogo" alt="Logo" class="preview-logo" />
                  }
                  <input
                    type="file"
                    accept="image/*"
                    (change)="uploadLogo($event)"
                    #logoInput
                    style="display:none"
                  />
                  <button
                    type="button"
                    class="button secondary"
                    (click)="logoInput.click()"
                    [disabled]="uploadingLogo"
                  >
                    {{ uploadingLogo ? 'Subiendo…' : 'Subir nueva imagen' }}
                  </button>
                </div>
              </div>
            </article>

            <article class="config-card">
              <h3>Seguridad & MFA</h3>
              <p class="card-desc">
                Este panel opera bajo estricta seguridad institucional. Todas las operaciones en la base de datos registran logs de auditoría criptográfica.
              </p>

              <div class="security-badge-card">
                <span class="sec-icon">🛡️</span>
                <div>
                  <b>MFA Requerido</b>
                  <small>Tu sesión actual está validada con autenticador OTP.</small>
                </div>
              </div>

              <div class="field-group" style="margin-top: 1.5rem">
                <label>Políticas operacionales</label>
                <p class="field-hint">
                  El guardado en lote evita ráfagas de escrituras concurrentes en PostgreSQL.
                </p>
              </div>
            </article>
          </div>
        </section>
      }

      <!-- ==================== OTROS MÓDULOS ==================== -->
      @else {
        <section class="placeholder-card">
          <span class="icon-hero">TS</span>
          <h2>Módulo {{ section() }}</h2>
          <p>Este módulo se encuentra actualmente en desarrollo.</p>
        </section>
      }
    </main>
  </section>

  <!-- ==================== TEMPLATE TABLA DE PEDIDOS ==================== -->
  <ng-template #ordersTable>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>N° Pedido</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Total</th>
            <th>Pago</th>
            <th>Estado Operacional</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          @for (order of (section() === 'Resumen' ? recentOrders() : filteredOrders()); track order.id) {
            <tr class="clickable-row" (click)="openOrderDetail(order)">
              <td>
                <b class="order-number">#{{ order.number }}</b>
              </td>
              <td>
                <div class="customer-cell">
                  <span>{{ order.customerEmail }}</span>
                  <small>{{ order.itemCount }} ítem(s)</small>
                </div>
              </td>
              <td>{{ date(order.createdAt) }}</td>
              <td>
                <b>{{ format(order.totalClp) }}</b>
              </td>
              <td>
                <span class="status" [class.paid]="!!order.paidAt">
                  {{ order.paidAt ? '✓ Pagado' : '⏳ Pendiente' }}
                </span>
              </td>
              <td>
                <span class="status-chip" [class]="'st-' + order.status.toLowerCase()">
                  {{ statusLabel(order.status) }}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  class="btn-sm primary"
                  (click)="$event.stopPropagation(); openOrderDetail(order)"
                >
                  Ver detalle →
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="empty-cell">No se encontraron pedidos.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </ng-template>

  <!-- ==================== DRAWER LATERAL DE DETALLE DE PEDIDO ==================== -->
  @if (showOrderDrawer()) {
    <div class="drawer-backdrop" (click)="closeOrderDrawer()"></div>
    <aside class="order-drawer" role="dialog" aria-modal="true">
      <header class="drawer-header">
        <div>
          <p class="eyebrow">Gestión de Orden</p>
          <h2>Pedido #{{ currentOrderDetails()?.order?.number || '...' }}</h2>
        </div>
        <button type="button" class="close-btn" (click)="closeOrderDrawer()" aria-label="Cerrar">
          <app-icon name="close" />
        </button>
      </header>

      @if (loadingOrderDetail()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Cargando información del pedido…</p>
        </div>
      } @else if (currentOrderDetails(); as detail) {
        <div class="drawer-content">
          <!-- ESTADO ACTUAL Y PROGRESO -->
          <div class="order-status-card">
            <div class="status-summary">
              <div>
                <small>Estado Operacional:</small>
                <h3>{{ statusLabel(detail.order.status) }}</h3>
              </div>
              <span class="status" [class.paid]="!!detail.order.paidAt">
                {{ detail.order.paidAt ? 'Pago Autorizado' : 'Pago Pendiente' }}
              </span>
            </div>

            <!-- ACCIONES RÁPIDAS DEL VENDEDOR PARA AVANZAR ESTADO -->
            <div class="operational-actions">
              <label>Actualizar estado operacional:</label>
              <div class="action-btn-group">
                @if (detail.order.status === 'Paid') {
                  <button
                    type="button"
                    class="button btn-action"
                    [disabled]="updatingOrderStatus()"
                    (click)="changeOrderStatus(detail.order.id, 'Preparing', 'Iniciando empaque del pedido')"
                  >
                    📦 Comenzar Preparación
                  </button>
                } @else if (detail.order.status === 'Preparing') {
                  <button
                    type="button"
                    class="button btn-action"
                    [disabled]="updatingOrderStatus()"
                    (click)="changeOrderStatus(detail.order.id, 'Shipped', 'Despachado con empresa de envíos')"
                  >
                    🚚 Marcar como Enviado
                  </button>
                } @else if (detail.order.status === 'Shipped') {
                  <button
                    type="button"
                    class="button btn-action safe"
                    [disabled]="updatingOrderStatus()"
                    (click)="changeOrderStatus(detail.order.id, 'Delivered', 'Entrega confirmada')"
                  >
                    ✓ Marcar como Entregado
                  </button>
                }

                @if (detail.order.status !== 'Cancelled' && detail.order.status !== 'Delivered') {
                  <button
                    type="button"
                    class="button secondary btn-cancel"
                    [disabled]="updatingOrderStatus()"
                    (click)="promptCancelOrder(detail.order.id)"
                  >
                    Cancelar pedido
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- DATOS DEL CLIENTE Y DESPACHO -->
          <div class="drawer-section">
            <h4>Datos de Envío y Contacto</h4>
            <div class="info-grid">
              <div>
                <small>Cliente:</small>
                <p>
                  {{ detail.address?.receiverName || detail.order.customerFirstName || 'Cliente Trama Sur' }}
                </p>
                <p class="email-sub">{{ detail.order.customerEmail }}</p>
              </div>
              <div>
                <small>Teléfono:</small>
                <p>{{ detail.address?.receiverPhone || detail.order.customerPhone || 'Sin teléfono' }}</p>
              </div>
              <div class="full-col">
                <small>Dirección de Despacho:</small>
                @if (detail.address) {
                  <p>
                    {{ detail.address.streetAddress }}
                    @if (detail.address.apartmentOrSuite) {
                      , Depto/Of. {{ detail.address.apartmentOrSuite }}
                    }
                  </p>
                  <p class="text-muted">{{ detail.address.commune }}, {{ detail.address.region }}</p>
                } @else {
                  <p class="text-muted">Dirección no registrada o entrega digital.</p>
                }
              </div>
            </div>
          </div>

          <!-- ÍTEMS COMPRADOS -->
          <div class="drawer-section">
            <h4>Prendas en el Pedido ({{ detail.order.items.length }})</h4>
            <div class="items-list">
              @for (item of detail.order.items; track item.id) {
                <div class="order-item-row">
                  <div class="item-info">
                    <b>{{ item.productName }}</b>
                    <small>Talla {{ item.size }} · {{ item.color }} · SKU: {{ item.sku }}</small>
                  </div>
                  <div class="item-pricing">
                    <span>{{ item.quantity }} × {{ format(item.unitPriceClp) }}</span>
                    <b>{{ format(item.totalPriceClp) }}</b>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- TOTALES -->
          <div class="drawer-section totals-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>{{ format(detail.order.subtotalClp || detail.order.totalClp) }}</span>
            </div>
            @if (detail.order.shippingClp) {
              <div class="total-row">
                <span>Costo de envío:</span>
                <span>{{ format(detail.order.shippingClp) }}</span>
              </div>
            }
            @if (detail.order.discountClp) {
              <div class="total-row discount">
                <span>Descuento aplicado:</span>
                <span>-{{ format(detail.order.discountClp) }}</span>
              </div>
            }
            <div class="total-row grand-total">
              <span>Total Pedido:</span>
              <b>{{ format(detail.order.totalClp) }}</b>
            </div>
          </div>
        </div>
      }
    </aside>
  }

  <!-- ==================== MODAL DE PRODUCTO ==================== -->
  @if (showEditor()) {
    <div class="drawer-backdrop" (click)="showEditor.set(false)"></div>
    <aside class="editor wide">
      <header>
        <div>
          <p class="eyebrow">Catálogo</p>
          <h2>{{ editingProductId ? 'Editar producto' : 'Nuevo producto' }}</h2>
        </div>
        <button type="button" (click)="showEditor.set(false)" aria-label="Cerrar">
          <app-icon name="close" />
        </button>
      </header>

      <form (ngSubmit)="saveProduct()">
        <div class="field">
          <label for="new-name">Nombre</label>
          <input id="new-name" required maxlength="180" [(ngModel)]="draft.name" name="name" (input)="syncSlug()" />
        </div>

        <div class="field">
          <label for="new-slug">Slug</label>
          <input id="new-slug" required maxlength="200" pattern="[a-z0-9-]+" [(ngModel)]="draft.slug" name="slug" />
        </div>

        <div class="two">
          <div class="field">
            <label for="new-price">Precio CLP</label>
            <input id="new-price" required type="number" min="1000" step="10" [(ngModel)]="draft.basePriceClp" name="price" />
          </div>
          <div class="field">
            <label for="new-category">Categoría principal</label>
            <select id="new-category" required [(ngModel)]="draft.categoryId" name="category" (change)="isNewCategory = draft.categoryId === 'new'">
              @for (category of categories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
              <option value="new">+ Crear nueva...</option>
            </select>
            @if (isNewCategory) {
              <input type="text" placeholder="Nombre de categoría" required [(ngModel)]="customCategoryName" name="customCategory" class="custom-input" />
            }
          </div>
        </div>

        <div class="field">
          <label for="new-audience">Público / Género</label>
          <select id="new-audience" required [(ngModel)]="draft.audience" name="audience">
            <option value="Hombre">Hombre</option>
            <option value="Mujer">Mujer</option>
            <option value="Unisex">Unisex</option>
          </select>
        </div>

        <div class="field">
          <label>Colecciones (Opcional)</label>
          <div class="checkbox-group">
            @for (c of collections(); track c.id) {
              <label>
                <input type="checkbox" [value]="c.id" [checked]="draft.collectionIds.includes(c.id)" (change)="toggleCollection(c.id, $event)" />
                {{ c.name }}
              </label>
            }
          </div>
        </div>

        <div class="field">
          <label for="new-description">Descripción breve</label>
          <textarea id="new-description" required maxlength="300" rows="3" [(ngModel)]="draft.shortDescription" name="description"></textarea>
        </div>

        <div class="variants-section">
          <h3>Variantes</h3>
          @for (v of draft.variants; track $index) {
            <div class="variant-row">
              <div class="two">
                <div class="field">
                  <label>Color</label>
                  <select required [(ngModel)]="v.color" [name]="'color' + $index" (change)="v.isNewColor = v.color === 'new'">
                    @for (c of uniqueColors(); track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                    <option value="new">+ Crear nuevo...</option>
                  </select>
                  @if (v.isNewColor) {
                    <input type="text" placeholder="Nuevo color" required [(ngModel)]="v.customColor" [name]="'customColor' + $index" class="custom-input" />
                  }
                </div>
                <div class="field">
                  <label>Talla</label>
                  <select required [(ngModel)]="v.size" [name]="'size' + $index" (change)="v.isNewSize = v.size === 'new'">
                    @for (s of uniqueSizes(); track s) {
                      <option [value]="s">{{ s }}</option>
                    }
                    <option value="new">+ Crear nueva...</option>
                  </select>
                  @if (v.isNewSize) {
                    <input type="text" placeholder="Nueva talla" required [(ngModel)]="v.customSize" [name]="'customSize' + $index" class="custom-input" />
                  }
                </div>
              </div>

              <div class="two">
                <div class="field">
                  <label>SKU</label>
                  <input required maxlength="80" [(ngModel)]="v.sku" [name]="'sku' + $index" />
                </div>
                <div class="field">
                  <label>Stock inicial</label>
                  <input required type="number" min="0" [(ngModel)]="v.initialStock" [name]="'stock' + $index" />
                </div>
              </div>

              @if (draft.variants.length > 1) {
                <button type="button" class="button secondary mt-2" (click)="removeVariant($index)">Eliminar variante</button>
              }
              <hr />
            </div>
          }
          <button type="button" class="button secondary" (click)="addVariant()">+ Agregar otra variante</button>
        </div>

        <div class="editor-note">
          Se guarda como {{ editingProductId ? 'versión final' : 'borrador' }} y registra cambios en auditoría.
        </div>

        @if (saveStatus()) {
          <p class="save-status" role="status">{{ saveStatus() }}</p>
        }

        <button type="submit" class="button" [disabled]="saving() || !canSave()">
          {{ saving() ? 'Guardando…' : (editingProductId ? 'Guardar Cambios' : 'Guardar borrador') }}
        </button>
      </form>
    </aside>
  }

  <!-- ==================== MODAL DE PRECIOS / OFERTAS ==================== -->
  @if (showPriceEditor()) {
    <div class="drawer-backdrop" (click)="showPriceEditor.set(false)"></div>
    <aside class="editor">
      <header>
        <div>
          <p class="eyebrow">Ofertas y Precios</p>
          <h2>Actualizar Precio</h2>
        </div>
        <button type="button" (click)="showPriceEditor.set(false)" aria-label="Cerrar">
          <app-icon name="close" />
        </button>
      </header>

      <form (ngSubmit)="savePrice()">
        <p class="field-hint">Modifica el precio de venta o programa una oferta visible con precio anterior tachado.</p>

        <div class="field offer-toggle-box">
          <label class="toggle-switch">
            <input type="checkbox" [(ngModel)]="isOfferMode" name="offerMode" (change)="toggleOfferMode()" />
            <b>Activar modo oferta con descuento</b>
          </label>
        </div>

        <div class="field">
          <label>{{ isOfferMode ? 'Precio de Oferta (CLP)' : 'Precio de Venta (CLP)' }}</label>
          <input required type="number" min="1000" step="10" [(ngModel)]="editingPrice.base" name="eprice" />
        </div>

        @if (isOfferMode) {
          <div class="field">
            <label>Precio Original Tachado (Opcional)</label>
            <input type="number" min="1000" step="10" [(ngModel)]="editingPrice.compare" name="ecompare" />
          </div>
        }

        @if (saveStatus()) {
          <p class="save-status" role="status">{{ saveStatus() }}</p>
        }

        <button type="submit" class="button" [disabled]="saving()">
          {{ saving() ? 'Guardando…' : 'Guardar Precio' }}
        </button>
      </form>
    </aside>
  }

  <!-- ==================== MODAL DE RECEPCIÓN DE STOCK ==================== -->
  @if (showStockEditor()) {
    <div class="drawer-backdrop" (click)="showStockEditor.set(false)"></div>
    <aside class="editor wide">
      <header>
        <div>
          <p class="eyebrow">Operaciones</p>
          <h2>Recibir Stock: {{ stockProduct?.name }}</h2>
        </div>
        <button type="button" (click)="showStockEditor.set(false)" aria-label="Cerrar">
          <app-icon name="close" />
        </button>
      </header>

      <form (ngSubmit)="saveStock()">
        <p class="field-hint">
          Indica las cantidades a <strong>AGREGAR</strong> al stock físico actual de cada variante. Usa números negativos para restar por merma o ajuste.
        </p>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Color / Talla</th>
                <th>Stock Físico Actual</th>
                <th>Cantidad a Agregar</th>
              </tr>
            </thead>
            <tbody>
              @for (row of stockVariants; track row.id) {
                <tr>
                  <td><code>{{ row.sku }}</code></td>
                  <td>{{ row.color }} · {{ row.size }}</td>
                  <td>{{ row.onHand }}</td>
                  <td>
                    <input
                      type="number"
                      class="custom-input"
                      style="width: 110px"
                      [(ngModel)]="stockDeltas[row.id]"
                      [name]="'delta_' + row.id"
                      placeholder="0"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (saveStatus()) {
          <p class="save-status" role="status">{{ saveStatus() }}</p>
        }

        <div style="display:flex;gap:1rem;margin-top:2rem;">
          <button type="submit" class="button" [disabled]="saving()">
            {{ saving() ? 'Guardando en BD…' : 'Guardar y Recibir Stock' }}
          </button>
        </div>
      </form>
    </aside>
  }

  <!-- ==================== BARRA FLOTANTE DE CACHÉ (STAGING BAR) ==================== -->
  @if (hasPending()) {
    <div class="staging-bar" role="region" aria-label="Cambios guardados en caché">
      <div class="staging-info">
        <span class="staging-icon">⚡</span>
        <div>
          <strong>Tienes {{ pendingCount() }} cambio(s) guardado(s) en caché local</strong>
          <small>Los datos se mantienen protegidos localmente y listos para sincronizarse sin colapsar la BD.</small>
        </div>
      </div>
      <div class="staging-actions">
        <button
          type="button"
          class="button secondary light"
          [disabled]="savingBatch()"
          (click)="discardPendingChanges()"
        >
          ↺ Descartar cambios
        </button>
        <button
          type="button"
          class="button accent"
          [disabled]="savingBatch()"
          (click)="applyPendingChangesToDatabase()"
        >
          {{ savingBatch() ? 'Guardando en BD…' : '💾 Guardar en Base de Datos' }}
        </button>
      </div>
    </div>
  }
  `,
  styleUrl: './admin.page.scss'
})
export class AdminPage {
  private readonly api = inject(AdminService);
  private readonly session = inject(AuthSessionService);

  readonly section = signal('Resumen');
  readonly showEditor = signal(false);
  readonly showPriceEditor = signal(false);
  readonly showStockEditor = signal(false);
  readonly showOrderDrawer = signal(false);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savingBatch = signal(false);
  readonly loadingOrderDetail = signal(false);
  readonly updatingOrderStatus = signal(false);

  readonly error = signal('');
  readonly saveStatus = signal('');
  readonly toast = signal<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  readonly products = signal<AdminProduct[]>([]);
  readonly orders = signal<AdminOrder[]>([]);
  readonly inventory = signal<AdminInventory[]>([]);
  readonly categories = signal<AdminCategory[]>([]);
  readonly collections = signal<AdminCollection[]>([]);
  readonly currentOrderDetails = signal<AdminOrderDetail | null>(null);

  readonly format = clp;

  // Filtros
  orderSearchText = '';
  readonly orderFilter = signal<string>('ALL');

  productSearch = '';
  readonly productStatusFilter = signal<'ALL' | 'Active' | 'Archived'>('ALL');

  inventorySearch = '';
  readonly onlyLowStockFilter = signal(false);

  // Almacén reactivo de cambios en caché
  readonly pending = signal<PendingCache>({
    thresholds: {},
    settings: {},
    stockAdjustments: {}
  });

  // Conteo de cambios en caché
  readonly pendingThresholdCount = computed(() => Object.keys(this.pending().thresholds).length);
  readonly pendingSettingsCount = computed(() => Object.keys(this.pending().settings).length);
  readonly pendingStockCount = computed(() => Object.keys(this.pending().stockAdjustments).length);
  readonly pendingCount = computed(() => this.pendingThresholdCount() + this.pendingSettingsCount() + this.pendingStockCount());
  readonly hasPending = computed(() => this.pendingCount() > 0);

  readonly menu = [
    { icon: '⌂', label: 'Resumen' },
    { icon: '□', label: 'Pedidos', badge: true },
    { icon: '◇', label: 'Productos' },
    { icon: '↕', label: 'Inventario', badge: true },
    { icon: '↺', label: 'Devoluciones' },
    { icon: '✦', label: 'Editar Landingpage' },
    { icon: '♙', label: 'Clientes' },
    { icon: '⚙', label: 'Configuración' }
  ];

  // Cálculo de stock bajo considerando los umbrales modificados en caché
  readonly lowStock = computed(() =>
    this.inventory().filter(x => x.available <= this.getEffectiveThreshold(x))
  );

  readonly pendingOrders = computed(() =>
    this.orders().filter(x => !x.paidAt || x.status === 'PendingPayment' || x.status === 'Paid').length
  );

  readonly recentOrders = computed(() => this.orders().slice(0, 6));

  readonly filteredOrders = computed(() => {
    const q = this.orderSearchText.trim().toLowerCase();
    const filter = this.orderFilter();

    return this.orders().filter(o => {
      // Filtro de estado
      if (filter !== 'ALL' && o.status !== filter) return false;
      // Filtro de texto
      if (q && !o.number.toLowerCase().includes(q) && !o.customerEmail.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  readonly filteredProducts = computed(() => {
    const q = this.productSearch.trim().toLowerCase();
    const st = this.productStatusFilter();

    return this.products().filter(p => {
      if (st !== 'ALL' && p.status !== st) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.slug.includes(q) && !p.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  readonly filteredInventory = computed(() => {
    const q = this.inventorySearch.trim().toLowerCase();
    const onlyLow = this.onlyLowStockFilter();

    return this.inventory()
      .filter(i => {
        const effThreshold = this.getEffectiveThreshold(i);
        if (onlyLow && i.available > effThreshold) return false;
        if (q && !i.sku.toLowerCase().includes(q) && !i.color.toLowerCase().includes(q) && !i.size.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aLow = a.available <= this.getEffectiveThreshold(a) ? -1 : 1;
        const bLow = b.available <= this.getEffectiveThreshold(b) ? -1 : 1;
        return aLow - bLow;
      });
  });

  readonly metrics = computed(() => {
    const today = new Date().toDateString();
    const paid = this.orders().filter(x => x.paidAt);
    const sales = paid
      .filter(x => new Date(x.paidAt!).toDateString() === today)
      .reduce((sum, x) => sum + x.totalClp, 0);
    const todayOrders = this.orders().filter(x => new Date(x.createdAt).toDateString() === today).length;
    const ticket = paid.length ? Math.round(paid.reduce((sum, x) => sum + x.totalClp, 0) / paid.length) : 0;

    return [
      { label: 'Ventas hoy', value: this.format(sales), change: 'Pagos confirmados' },
      { label: 'Pedidos hoy', value: String(todayOrders), change: `${this.pendingOrders()} por atender` },
      { label: 'Ticket promedio', value: this.format(ticket), change: 'Sobre ventas pagadas' },
      { label: 'Stock en riesgo', value: String(this.lowStock().length), change: 'Variantes bajo umbral' }
    ];
  });

  readonly bars = computed(() => {
    const rows = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - index));
      const amount = this.orders()
        .filter(x => x.paidAt && new Date(x.paidAt).toDateString() === day.toDateString())
        .reduce((sum, x) => sum + x.totalClp, 0);
      return {
        key: day.toISOString(),
        day: day.toLocaleDateString('es-CL', { weekday: 'short' }),
        amount,
        value: 0
      };
    });
    const max = Math.max(1, ...rows.map(x => x.amount));
    return rows.map(x => ({ ...x, value: x.amount ? Math.max(15, Math.round((x.amount / max) * 95)) : 4 }));
  });

  readonly uniqueColors = computed(() => Array.from(new Set(this.inventory().map(i => i.color))).sort());
  readonly uniqueSizes = computed(() => Array.from(new Set(this.inventory().map(i => i.size))).sort());

  // Estado del formulario de creación/edición de productos
  isNewCategory = false;
  customCategoryName = '';
  isNewColor = false;
  customColor = '';
  isNewSize = false;
  customSize = '';

  // Configuración de la tienda
  darkMode = false;
  storeName = 'TRAMA SUR';
  storeLogo = '';
  uploadingLogo = false;

  draft = this.newDraft();
  editingPrice = { id: '', base: 0, compare: null as number | null };
  editingProductId = '';

  stockProduct: AdminProduct | null = null;
  stockVariants: AdminInventory[] = [];
  stockDeltas: Record<string, number> = {};

  isOfferMode = false;
  oldBasePrice = 0;

  constructor() {
    this.restoreCache();
    this.load();
  }

  // Carga inicial desde PostgreSQL
  load(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      products: this.api.products(),
      orders: this.api.orders(),
      inventory: this.api.inventory(),
      categories: this.api.categories(),
      collections: this.api.collections(),
      settings: this.api.getSettings()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.products.set(r.products);
          this.orders.set(r.orders);
          this.inventory.set(r.inventory);
          this.categories.set(r.categories);
          this.collections.set(r.collections);

          if (!this.draft.categoryId && r.categories.length) {
            this.draft.categoryId = r.categories[0].id;
          }

          // Ajustes del servidor
          const serverDarkMode = r.settings['darkMode'] === 'true';
          const serverStoreName = r.settings['storeName'] || 'TRAMA SUR';
          this.storeLogo = r.settings['storeLogo'] || '';

          // Si hay valores pendientes en caché, tienen precedencia para la previsualización
          const pendingSettings = this.pending().settings;
          this.darkMode = pendingSettings['darkMode'] !== undefined ? pendingSettings['darkMode'] === 'true' : serverDarkMode;
          this.storeName = pendingSettings['storeName'] !== undefined ? pendingSettings['storeName'] : serverStoreName;

          this.applyTheme();
        },
        error: e => {
          this.error.set(
            e.status === 403
              ? 'Tu sesión no tiene MFA verificado. Vuelve a ingresar con el código de tu autenticador.'
              : 'No pudimos cargar el panel administrativo.'
          );
        }
      });
  }

  // ==================== SISTEMA DE CACHÉ LOCAL (STAGING) ====================

  private restoreCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.pending.set({
            thresholds: parsed.thresholds || {},
            settings: parsed.settings || {},
            stockAdjustments: parsed.stockAdjustments || {}
          });
        }
      }
    } catch {
      // Ignorar errores de lectura en localStorage
    }
  }

  private saveCache(): void {
    try {
      const current = this.pending();
      if (this.pendingCount() === 0) {
        localStorage.removeItem(CACHE_KEY);
      } else {
        localStorage.setItem(CACHE_KEY, JSON.stringify(current));
      }
    } catch {
      // Ignorar cuota excedida
    }
  }

  getEffectiveThreshold(row: AdminInventory): number {
    const cached = this.pending().thresholds[row.variantId];
    return cached !== undefined ? cached : row.lowStockThreshold;
  }

  isThresholdPending(row: AdminInventory): boolean {
    return this.pending().thresholds[row.variantId] !== undefined;
  }

  onThresholdInput(row: AdminInventory, rawValue: string): void {
    const val = parseInt(rawValue, 10);
    if (isNaN(val) || val < 0) return;

    this.pending.update(state => {
      const copy = { ...state.thresholds };
      if (val === row.lowStockThreshold) {
        delete copy[row.variantId];
      } else {
        copy[row.variantId] = val;
      }
      return { ...state, thresholds: copy };
    });

    this.saveCache();
  }

  onDarkModeToggle(): void {
    const strVal = String(this.darkMode);
    this.pending.update(state => ({
      ...state,
      settings: { ...state.settings, darkMode: strVal }
    }));
    this.saveCache();
    this.applyTheme();
  }

  onStoreNameInput(): void {
    this.pending.update(state => ({
      ...state,
      settings: { ...state.settings, storeName: this.storeName }
    }));
    this.saveCache();
    this.applyTheme();
  }

  discardPendingChanges(): void {
    if (!confirm('¿Deseas descartar los cambios guardados en caché y restaurar los datos de la base de datos?')) {
      return;
    }
    this.pending.set({ thresholds: {}, settings: {}, stockAdjustments: {} });
    this.saveCache();
    this.showToastNotification('Cambios en caché descartados.', 'info');
    this.load();
  }

  applyPendingChangesToDatabase(): void {
    if (!this.hasPending()) return;

    this.savingBatch.set(true);
    const calls: Observable<any>[] = [];

    const state = this.pending();

    // 1. Umbrales de inventario acumulados
    for (const [variantId, threshold] of Object.entries(state.thresholds)) {
      calls.push(this.api.updateInventoryThreshold(variantId, threshold));
    }

    // 2. Ajustes de stock físico acumulados
    for (const [invId, adj] of Object.entries(state.stockAdjustments)) {
      calls.push(this.api.adjustInventory(invId, adj.delta, adj.reason));
    }

    // 3. Configuraciones acumuladas
    if (Object.keys(state.settings).length > 0) {
      calls.push(this.api.saveSettings(state.settings));
    }

    forkJoin(calls)
      .pipe(finalize(() => this.savingBatch.set(false)))
      .subscribe({
        next: () => {
          this.pending.set({ thresholds: {}, settings: {}, stockAdjustments: {} });
          this.saveCache();
          this.showToastNotification('✓ Todos los cambios fueron aplicados en la base de datos con éxito.', 'success');
          this.load();
        },
        error: () => {
          this.showToastNotification('Error al aplicar algunos cambios a la base de datos. Intenta nuevamente.', 'error');
        }
      });
  }

  // ==================== DETALLE Y GESTIÓN DE PEDIDOS ====================

  openOrderDetail(order: AdminOrder): void {
    this.showOrderDrawer.set(true);
    this.loadingOrderDetail.set(true);
    this.currentOrderDetails.set(null);

    this.api.getOrder(order.id).subscribe({
      next: res => {
        this.currentOrderDetails.set(res);
        this.loadingOrderDetail.set(false);
      },
      error: () => {
        this.loadingOrderDetail.set(false);
        this.showToastNotification('No se pudo cargar el detalle del pedido.', 'error');
      }
    });
  }

  closeOrderDrawer(): void {
    this.showOrderDrawer.set(false);
    this.currentOrderDetails.set(null);
  }

  changeOrderStatus(orderId: string, targetStatus: string, reason: string): void {
    this.updatingOrderStatus.set(true);

    this.api.updateOrderStatus(orderId, targetStatus, reason).subscribe({
      next: () => {
        this.updatingOrderStatus.set(false);
        this.showToastNotification(`Pedido actualizado a estado: ${this.statusLabel(targetStatus)}`, 'success');

        // Actualizar datos locales sin recarga pesada
        this.orders.update(list =>
          list.map(o => (o.id === orderId ? { ...o, status: targetStatus } : o))
        );

        if (this.currentOrderDetails()?.order.id === orderId) {
          const cur = this.currentOrderDetails()!;
          cur.order.status = targetStatus;
          this.currentOrderDetails.set({ ...cur });
        }
      },
      error: () => {
        this.updatingOrderStatus.set(false);
        this.showToastNotification('No se pudo actualizar el estado del pedido.', 'error');
      }
    });
  }

  promptCancelOrder(orderId: string): void {
    const reason = prompt('Indica el motivo de la cancelación:');
    if (!reason || !reason.trim()) return;

    this.changeOrderStatus(orderId, 'Cancelled', reason.trim());
  }

  // ==================== ACCIONES RÁPIDAS Y NAVEGACIÓN ====================

  setSection(sec: string): void {
    this.section.set(sec);
  }

  goToOrdersPending(): void {
    this.orderFilter.set('Paid');
    this.section.set('Pedidos');
  }

  goToInventoryAlerts(): void {
    this.onlyLowStockFilter.set(true);
    this.section.set('Inventario');
  }

  quickStockPrompt(row: AdminInventory): void {
    const input = prompt(`Ajustar stock para ${row.sku} (${row.color} · ${row.size})\nStock físico actual: ${row.onHand}\nIngresa la cantidad a SUMAR (o número negativo para restar):`);
    if (!input) return;

    const delta = parseInt(input, 10);
    if (isNaN(delta) || delta === 0) {
      alert('Cantidad no válida.');
      return;
    }

    const mode = confirm('¿Deseas guardar este ajuste en CACHÉ LOCAL para aplicarlo luego junto a otros cambios?\n\n(Aceptar: Guardar en Caché · Cancelar: Enviar directo a la BD)');
    if (mode) {
      this.pending.update(state => ({
        ...state,
        stockAdjustments: {
          ...state.stockAdjustments,
          [row.id]: { delta, sku: row.sku, reason: 'Ajuste rápido desde inventario' }
        }
      }));
      this.saveCache();
      this.showToastNotification(`Ajuste de ${delta > 0 ? '+' : ''}${delta} unidades para ${row.sku} guardado en caché.`, 'info');
    } else {
      this.saving.set(true);
      this.api.adjustInventory(row.id, delta, 'Ajuste directo desde inventario').subscribe({
        next: () => {
          this.saving.set(false);
          this.showToastNotification(`Stock de ${row.sku} actualizado con éxito.`, 'success');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.showToastNotification('Error al ajustar el stock.', 'error');
        }
      });
    }
  }

  countOrdersByStatus(status: string): number {
    return this.orders().filter(x => x.status === status).length;
  }

  countProductsByStatus(status: string): number {
    return this.products().filter(x => x.status === status).length;
  }

  showToastNotification(message: string, type: 'success' | 'info' | 'error' = 'success'): void {
    this.toast.set({ message, type });
    setTimeout(() => {
      if (this.toast()?.message === message) {
        this.toast.set(null);
      }
    }, 4500);
  }

  badge(section: string): string {
    return section === 'Pedidos'
      ? String(this.pendingOrders())
      : section === 'Inventario'
      ? String(this.lowStock().length)
      : '';
  }

  badgeIsAlert(section: string): boolean {
    if (section === 'Inventario' && this.lowStock().length > 0) return true;
    if (section === 'Pedidos' && this.pendingOrders() > 0) return true;
    return false;
  }

  initials(): string {
    const u = this.session.user();
    return `${u?.firstName?.[0] ?? 'A'}${u?.lastName?.[0] ?? ''}`.toUpperCase();
  }

  userName(): string {
    const u = this.session.user();
    return u ? `${u.firstName} ${u.lastName}` : 'Administrador';
  }

  statusLabel(status: string): string {
    return (
      ({
        Active: 'Publicado',
        Draft: 'Borrador',
        Archived: 'Archivado',
        PendingPayment: 'Pago pendiente',
        Paid: 'Pagado',
        Confirmed: 'Confirmado',
        Preparing: 'Preparando',
        Shipped: 'Enviado',
        Delivered: 'Entregado',
        Cancelled: 'Cancelado',
        Expired: 'Vencido'
      } as Record<string, string>)[status] ?? status
    );
  }

  date(value: string): string {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  // ==================== GESTIÓN DE PRODUCTOS ====================

  openEditor(p?: AdminProduct): void {
    if (p) {
      this.editingProductId = p.id;
      this.saving.set(true);
      this.showEditor.set(true);
      this.api.getProduct(p.id).subscribe({
        next: res => {
          this.draft = {
            name: res.name,
            slug: res.slug,
            categoryId: res.categoryId,
            shortDescription: res.shortDescription,
            basePriceClp: res.basePriceClp,
            audience: res.audience || 'Unisex',
            collectionIds: [],
            variants: res.variants.map((v: any) => ({
              sku: v.sku,
              color: v.color,
              customColor: '',
              isNewColor: false,
              size: v.size,
              customSize: '',
              isNewSize: false,
              initialStock: 0
            }))
          };
          this.saving.set(false);
        }
      });
    } else {
      this.editingProductId = '';
      this.draft = this.newDraft();
      if (!this.draft.categoryId && this.categories().length) this.draft.categoryId = this.categories()[0].id;
      if (!this.draft.variants[0].color && this.uniqueColors().length) this.draft.variants[0].color = this.uniqueColors()[0];
      if (!this.draft.variants[0].size && this.uniqueSizes().length) this.draft.variants[0].size = this.uniqueSizes()[0];
      this.saveStatus.set('');
      this.showEditor.set(true);
    }
  }

  syncSlug(): void {
    this.draft.slug = this.draft.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  canSave(): boolean {
    const validCategory = this.isNewCategory ? !!this.customCategoryName : !!this.draft.categoryId;
    const variantsValid = this.draft.variants.every(
      v => v.sku && (v.isNewColor ? !!v.customColor : !!v.color) && (v.isNewSize ? !!v.customSize : !!v.size) && v.initialStock >= 0
    );
    return !!(this.draft.name && this.draft.slug && validCategory && this.draft.shortDescription && this.draft.basePriceClp >= 1000 && variantsValid);
  }

  toggleCollection(id: string, event: any): void {
    if (event.target.checked) this.draft.collectionIds.push(id);
    else this.draft.collectionIds = this.draft.collectionIds.filter(x => x !== id);
  }

  addVariant(): void {
    const defColor = this.uniqueColors().length ? this.uniqueColors()[0] : '';
    const defSize = this.uniqueSizes().length ? this.uniqueSizes()[0] : '';
    this.draft.variants.push({
      sku: '',
      color: defColor,
      customColor: '',
      isNewColor: false,
      size: defSize,
      customSize: '',
      isNewSize: false,
      initialStock: 0
    });
  }

  removeVariant(idx: number): void {
    this.draft.variants.splice(idx, 1);
  }

  saveProduct(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saveStatus.set('');

    const finalVariants = this.draft.variants.map(v => ({
      sku: v.sku,
      color: v.isNewColor ? v.customColor : v.color,
      colorHex: '#2f4738',
      size: v.isNewSize ? v.customSize : v.size,
      cut: 'Regular',
      barcode: null,
      priceClp: null,
      weightGrams: 500,
      lowStockThreshold: 3,
      initialStock: v.initialStock
    }));

    const createProductCall = (catId: string) => {
      const request: CreateAdminProduct = {
        name: this.draft.name,
        slug: this.draft.slug,
        categoryId: catId,
        shortDescription: this.draft.shortDescription,
        description: this.draft.shortDescription,
        materials: 'Materiales por completar antes de publicar.',
        careInstructions: 'Instrucciones de cuidado por completar antes de publicar.',
        audience: this.draft.audience,
        basePriceClp: this.draft.basePriceClp,
        compareAtPriceClp: null,
        metaTitle: this.draft.name,
        metaDescription: this.draft.shortDescription,
        imageUrl: '/assets/images/chaqueta-commuter.png',
        imageAlt: `${this.draft.name} en fotografía de catálogo`,
        variants: finalVariants,
        collectionIds: this.draft.collectionIds
      };
      return this.editingProductId ? this.api.updateProduct(this.editingProductId, request) : this.api.createProduct(request);
    };

    const operation = this.isNewCategory
      ? this.api
          .createCategory({
            name: this.customCategoryName,
            slug: this.customCategoryName
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, ''),
            description: '',
            displayOrder: 99,
            isVisible: true
          })
          .pipe(switchMap(cat => createProductCall(cat.id)))
      : createProductCall(this.draft.categoryId);

    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.showToastNotification(this.editingProductId ? 'Producto actualizado exitosamente.' : 'Producto guardado como borrador.', 'success');
        this.showEditor.set(false);
        this.load();
      },
      error: e => {
        this.saveStatus.set(e.error?.detail ?? 'No pudimos guardar el producto.');
      }
    });
  }

  private newDraft() {
    this.isNewCategory = false;
    this.customCategoryName = '';
    return {
      name: '',
      slug: '',
      categoryId: '',
      shortDescription: '',
      basePriceClp: 49990,
      audience: 'Unisex',
      collectionIds: [] as string[],
      variants: [{ sku: '', color: '', customColor: '', isNewColor: false, size: '', customSize: '', isNewSize: false, initialStock: 0 }]
    };
  }

  setGlobalThreshold(): void {
    const res = prompt('Ingresa el nuevo umbral (stock bajo) para TODAS las prendas:');
    if (!res) return;
    const val = parseInt(res, 10);
    if (isNaN(val) || val < 0) {
      alert('Número inválido.');
      return;
    }
    if (confirm(`¿Estás seguro de establecer el umbral en ${val} para TODAS las variantes de inventario en la base de datos?`)) {
      this.saving.set(true);
      this.api.bulkUpdateInventoryThreshold(val).subscribe({
        next: () => {
          this.saving.set(false);
          this.showToastNotification(`Umbral global establecido en ${val} para todas las prendas.`, 'success');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.showToastNotification('Error al actualizar el umbral global.', 'error');
        }
      });
    }
  }

  archiveProduct(id: string): void {
    if (confirm('¿Seguro que deseas ocultar (archivar) este producto?')) {
      this.api.archiveProduct(id).subscribe(() => {
        this.products.update(list => list.map(p => (p.id === id ? { ...p, status: 'Archived' } : p)));
        this.showToastNotification('Producto archivado.', 'info');
      });
    }
  }

  unarchiveProduct(id: string): void {
    if (confirm('¿Seguro que deseas volver a mostrar este producto en la tienda?')) {
      this.api.unarchiveProduct(id).subscribe(() => {
        this.products.update(list => list.map(p => (p.id === id ? { ...p, status: 'Active' } : p)));
        this.showToastNotification('Producto publicado en la tienda.', 'success');
      });
    }
  }

  openPriceEditor(p: any): void {
    this.editingPrice = { id: p.id, base: p.basePriceClp, compare: p.compareAtPriceClp };
    this.oldBasePrice = p.basePriceClp;
    this.isOfferMode = !!p.compareAtPriceClp;
    this.saveStatus.set('');
    this.showPriceEditor.set(true);
  }

  toggleOfferMode(): void {
    if (this.isOfferMode) {
      if (!this.editingPrice.compare) {
        this.editingPrice.compare = this.oldBasePrice;
      }
    } else {
      this.editingPrice.base = this.editingPrice.compare || this.oldBasePrice;
      this.editingPrice.compare = null;
    }
  }

  savePrice(): void {
    this.saving.set(true);
    this.saveStatus.set('');
    this.api.getProduct(this.editingPrice.id).subscribe({
      next: full => {
        const req: CreateAdminProduct = {
          name: full.name,
          slug: full.slug,
          categoryId: full.categoryId,
          shortDescription: full.shortDescription,
          description: full.description,
          materials: full.materials,
          careInstructions: full.careInstructions,
          audience: full.audience,
          basePriceClp: this.editingPrice.base,
          compareAtPriceClp: this.editingPrice.compare || null,
          metaTitle: full.metaTitle,
          metaDescription: full.metaDescription,
          imageUrl: '',
          imageAlt: '',
          variants: []
        };
        this.api.updateProduct(this.editingPrice.id, req).subscribe({
          next: () => {
            this.showToastNotification('Precio actualizado exitosamente.', 'success');
            this.showPriceEditor.set(false);
            this.saving.set(false);
            this.products.update(list =>
              list.map(p =>
                p.id === this.editingPrice.id
                  ? { ...p, basePriceClp: this.editingPrice.base, compareAtPriceClp: this.editingPrice.compare || null }
                  : p
              )
            );
          },
          error: e => {
            this.saveStatus.set(e.error?.detail ?? 'Error.');
            this.saving.set(false);
          }
        });
      },
      error: () => {
        this.saveStatus.set('Error cargando producto.');
        this.saving.set(false);
      }
    });
  }

  openStockEditor(p: AdminProduct): void {
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
      error: () => {
        this.saving.set(false);
        alert('No pudimos cargar los datos.');
      }
    });
  }

  saveStock(): void {
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
        this.showToastNotification('Stock recibido y actualizado en la base de datos.', 'success');
        this.showStockEditor.set(false);
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.saveStatus.set('Error al actualizar el stock.');
        this.saving.set(false);
      }
    });
  }

  applyTheme(): void {
    if (this.darkMode) document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
    document.title = this.storeName + ' - Administración';
  }

  uploadLogo(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    this.uploadingLogo = true;
    this.api.uploadSettingImage(file).subscribe({
      next: res => {
        this.storeLogo = res.url;
        this.uploadingLogo = false;
        // Guardar el logo en los cambios en caché
        this.pending.update(state => ({
          ...state,
          settings: { ...state.settings, storeLogo: this.storeLogo }
        }));
        this.saveCache();
        this.showToastNotification('Logo cargado en caché. Guarda cambios para sincronizarlo.', 'info');
      },
      error: () => {
        this.uploadingLogo = false;
        this.showToastNotification('Error al subir el logo.', 'error');
      }
    });
  }
}
