import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import {
  ContentService,
  DEFAULT_HOME_CONTENT,
  HomeBenefitItem,
  HomeCategoryItem,
  HomeContent,
  HomeSlide,
  HomeStoryStat
} from '../../core/content.service';
import { clp } from '../../core/format';
import { ProductCard } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

export type CmsTab = 'announcement' | 'carousel' | 'featured' | 'story' | 'benefits' | 'categories';

@Component({
  selector: 'app-cms-editor-page',
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <section class="cms-layout">
      <!-- ENCABEZADO PRINCIPAL DEL CMS STUDIO -->
      <header class="cms-topbar">
        <div class="topbar-left">
          <a routerLink="/admin" class="back-link">
            <app-icon name="arrow" class="back-icon" />
            <span>Volver al panel</span>
          </a>
          <div class="divider"></div>
          <div class="cms-branding">
            <h1>Estudio CMS <span>Portada</span></h1>
            <div class="status-indicator" [class]="statusType()">
              <span class="status-pulse"></span>
              <span>{{ statusText() }}</span>
            </div>
          </div>
        </div>

        <div class="topbar-center">
          <!-- CONMUTADOR DE DISPOSITIVO (DESKTOP / MOBILE) -->
          <div class="device-switcher" role="radiogroup" aria-label="Vista de dispositivo">
            <button
              type="button"
              [class.active]="desktop()"
              (click)="desktop.set(true)"
              title="Vista de escritorio (100% fluido)"
            >
              <span class="dev-icon">🖥️</span>
              <span>Escritorio</span>
            </button>
            <button
              type="button"
              [class.active]="!desktop()"
              (click)="desktop.set(false)"
              title="Vista móvil (iPhone 390px)"
            >
              <span class="dev-icon">📱</span>
              <span>Móvil</span>
            </button>
          </div>
        </div>

        <div class="topbar-right">
          <a href="/" target="_blank" rel="noopener" class="preview-store-btn" title="Abrir tienda en vivo en una pestaña nueva">
            <span>👁️</span> Ver tienda
          </a>
          <button
            type="button"
            class="button secondary discard-btn"
            [disabled]="!hasChanges() || saving() || publishing()"
            (click)="discardChanges()"
          >
            Descartar
          </button>
          <button
            type="button"
            class="button secondary save-btn"
            [disabled]="saving() || publishing()"
            (click)="saveDraft()"
          >
            @if (saving()) {
              <span class="mini-spinner"></span>
              <span>Guardando…</span>
            } @else {
              <span>💾 Guardar borrador</span>
            }
          </button>
          <button
            type="button"
            class="button primary publish-btn"
            [disabled]="publishing() || saving() || !versionId()"
            (click)="openPublishModal()"
          >
            @if (publishing()) {
              <span class="mini-spinner"></span>
              <span>🚀 Publicar en vivo</span>
            } @else {
              <span>🚀 Publicar en vivo</span>
            }
          </button>
        </div>
      </header>

      <!-- ÁREA DE TRABAJO SPLIT: INSPECTOR (IZQ) + LIENZO (DER) -->
      <div class="cms-workspace">
        <!-- BARRA LATERAL DEL INSPECTOR -->
        <aside class="cms-inspector">
          <!-- PESTAÑAS DE NAVEGACIÓN DE SECCIONES -->
          <nav class="inspector-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              [class.active]="activeTab() === 'carousel'"
              (click)="activeTab.set('carousel')"
            >
              <span class="tab-icon">🎠</span>
              <span class="tab-label">Carrusel</span>
              <span class="tab-count">{{ (content().carousel || []).length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="activeTab() === 'announcement'"
              (click)="activeTab.set('announcement')"
            >
              <span class="tab-icon">📢</span>
              <span class="tab-label">Anuncio</span>
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="activeTab() === 'featured'"
              (click)="activeTab.set('featured')"
            >
              <span class="tab-icon">✨</span>
              <span class="tab-label">Destacados</span>
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="activeTab() === 'story'"
              (click)="activeTab.set('story')"
            >
              <span class="tab-icon">📖</span>
              <span class="tab-label">Historia</span>
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="activeTab() === 'benefits'"
              (click)="activeTab.set('benefits')"
            >
              <span class="tab-icon">🛡️</span>
              <span class="tab-label">Beneficios</span>
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="activeTab() === 'categories'"
              (click)="activeTab.set('categories')"
            >
              <span class="tab-icon">🏷️</span>
              <span class="tab-label">Categorías</span>
            </button>
          </nav>

          <!-- CUERPO DEL INSPECTOR CON EL FORMULARIO DE LA SECCIÓN ACTIVA -->
          <div class="inspector-content">
            <!-- ================= TAB: CARRUSEL HERO ================= -->
            @if (activeTab() === 'carousel') {
              <div class="panel-section">
                <div class="panel-header">
                  <div>
                    <h2>Carrusel de Portada</h2>
                    <p>Gestiona las diapositivas con imágenes de fondo, titulares y enlaces.</p>
                  </div>
                  <button type="button" class="btn-action-add" (click)="addSlide()">
                    <span>+</span> Diapositiva
                  </button>
                </div>

                <!-- LISTA DE DIAPOSITIVAS (CARDS COMPACTAS REORDENABLES) -->
                <div class="slides-list">
                  @for (slide of content().carousel; track slide.id; let i = $index) {
                    <div
                      class="slide-summary-card"
                      [class.selected]="selectedSlideIndex() === i"
                      (click)="selectedSlideIndex.set(i); previewSlideIndex.set(i)"
                    >
                      <div class="slide-thumb">
                        <img [src]="slide.imageUrl" [alt]="slide.title" (error)="onImgError($event)" />
                        <span class="slide-index">{{ i + 1 }}</span>
                      </div>
                      <div class="slide-info">
                        <b>{{ slide.title || 'Diapositiva sin título' }}</b>
                        <small>{{ slide.eyebrow || 'Sin antetítulo' }}</small>
                      </div>
                      <div class="slide-tools" (click)="$event.stopPropagation()">
                        <button
                          type="button"
                          class="tool-btn"
                          [disabled]="i === 0"
                          (click)="moveSlide(i, 'up')"
                          title="Subir orden"
                        >↑</button>
                        <button
                          type="button"
                          class="tool-btn"
                          [disabled]="i === (content().carousel?.length || 1) - 1"
                          (click)="moveSlide(i, 'down')"
                          title="Bajar orden"
                        >↓</button>
                        <button
                          type="button"
                          class="tool-btn"
                          (click)="duplicateSlide(i)"
                          title="Duplicar"
                        >⧉</button>
                        <button
                          type="button"
                          class="tool-btn danger"
                          (click)="deleteSlide(i)"
                          title="Eliminar diapositiva"
                        >✕</button>
                      </div>
                    </div>
                  }
                  @if (!content().carousel || content().carousel!.length === 0) {
                    <div class="empty-state-notice">
                      <p>No hay diapositivas activas en el carrusel. Se mostrará el Hero estático predeterminado.</p>
                      <button type="button" class="button secondary" (click)="addSlide()">Crear primera diapositiva</button>
                    </div>
                  }
                </div>

                <!-- EDITOR DE LA DIAPOSITIVA SELECCIONADA -->
                @if (currentSlide(); as slide) {
                  <div class="card-editor-box">
                    <div class="box-title">
                      <h3>Editar Diapositiva #{{ selectedSlideIndex() + 1 }}</h3>
                      <label class="toggle-switch">
                        <input
                          type="checkbox"
                          [(ngModel)]="slide.isActive"
                          (change)="markDirty()"
                        />
                        <span class="slider"></span>
                        <span class="toggle-text">{{ slide.isActive ? 'Activa' : 'Oculta' }}</span>
                      </label>
                    </div>

                    <!-- FOTO DE FONDO & SUBIDA -->
                    <div class="field">
                      <label>Imagen de Fondo</label>
                      <div class="image-uploader-wrapper">
                        <div class="image-preview-slot">
                          <img [src]="slide.imageUrl" [alt]="slide.imageAlt" (error)="onImgError($event)" />
                        </div>
                        <div class="image-uploader-actions">
                          <input
                            type="text"
                            [(ngModel)]="slide.imageUrl"
                            placeholder="URL o sube una imagen…"
                            (input)="markDirty()"
                            class="input-clean"
                          />
                          <div class="upload-btn-row">
                            <label class="btn-file-upload">
                              <span>📁 Subir archivo</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                (change)="onUploadSlideImage($event, slide)"
                                class="hidden-file-input"
                              />
                            </label>
                            @if (uploading()) {
                              <span class="uploading-chip">Subiendo…</span>
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="field">
                      <label for="slide-alt">Texto alternativo accesible (SEO)</label>
                      <input
                        id="slide-alt"
                        type="text"
                        [(ngModel)]="slide.imageAlt"
                        (input)="markDirty()"
                        placeholder="Descripción de la imagen"
                        maxlength="160"
                      />
                    </div>

                    <div class="two-columns">
                      <div class="field">
                        <label for="slide-eyebrow">Antetítulo (Cintillo)</label>
                        <input
                          id="slide-eyebrow"
                          type="text"
                          [(ngModel)]="slide.eyebrow"
                          (input)="markDirty()"
                          placeholder="Ej. Colección Otoño 2026"
                          maxlength="80"
                        />
                      </div>
                      <div class="field">
                        <label for="slide-title">Título Principal</label>
                        <input
                          id="slide-title"
                          type="text"
                          [(ngModel)]="slide.title"
                          (input)="markDirty()"
                          placeholder="Ej. Hecha con"
                          maxlength="80"
                        />
                      </div>
                    </div>

                    <div class="field">
                      <label for="slide-accent">Palabra con Acento (Cursiva Nórdica)</label>
                      <input
                        id="slide-accent"
                        type="text"
                        [(ngModel)]="slide.accent"
                        (input)="markDirty()"
                        placeholder="Ej. máxima calidad."
                        maxlength="80"
                      />
                    </div>

                    <div class="field">
                      <label for="slide-desc">Descripción</label>
                      <textarea
                        id="slide-desc"
                        rows="2"
                        [(ngModel)]="slide.description"
                        (input)="markDirty()"
                        placeholder="Ropa de confección cuidada y materiales nobles…"
                        maxlength="250"
                      ></textarea>
                    </div>

                    <div class="two-columns">
                      <div class="field">
                        <label for="slide-cta">Texto del Botón</label>
                        <input
                          id="slide-cta"
                          type="text"
                          [(ngModel)]="slide.ctaLabel"
                          (input)="markDirty()"
                          placeholder="Ej. Ver colección"
                          maxlength="40"
                        />
                      </div>
                      <div class="field">
                        <label for="slide-link">Enlace de Destino</label>
                        <input
                          id="slide-link"
                          type="text"
                          [(ngModel)]="slide.ctaLink"
                          (input)="markDirty()"
                          placeholder="/coleccion o /abrigos"
                          maxlength="120"
                        />
                      </div>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- ================= TAB: ANUNCIO SUPERIOR ================= -->
            @if (activeTab() === 'announcement') {
              <div class="panel-section">
                <div class="panel-header">
                  <div>
                    <h2>Barra de Anuncios</h2>
                    <p>Mensaje promocional fijo en la franja superior de toda la tienda.</p>
                  </div>
                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      [(ngModel)]="content().announcementActive"
                      (change)="markDirty()"
                    />
                    <span class="slider"></span>
                    <span class="toggle-text">{{ content().announcementActive !== false ? 'Visible' : 'Oculto' }}</span>
                  </label>
                </div>

                <div class="field">
                  <div class="field-label-row">
                    <label for="ann-text">Texto del anuncio</label>
                    <span class="char-count">{{ (content().announcement || '').length }}/160</span>
                  </div>
                  <input
                    id="ann-text"
                    type="text"
                    [(ngModel)]="content().announcement"
                    (input)="markDirty()"
                    placeholder="Ej. Despacho gratis desde $79.990 · Cambios simples por 30 días"
                    maxlength="160"
                  />
                </div>

                <div class="field">
                  <label for="ann-link">Enlace al hacer clic (opcional)</label>
                  <input
                    id="ann-link"
                    type="text"
                    [(ngModel)]="content().announcementLink"
                    (input)="markDirty()"
                    placeholder="/coleccion o https://..."
                    maxlength="160"
                  />
                  <small class="field-help">Si se define, toda la barra será un enlace hacia esa URL.</small>
                </div>

                <div class="preview-box-sample">
                  <small>Vista previa de la franja:</small>
                  <div class="sample-bar">
                    {{ content().announcement || 'Escribe un mensaje de anuncio…' }}
                  </div>
                </div>
              </div>
            }

            <!-- ================= TAB: PRODUCTOS DESTACADOS ================= -->
            @if (activeTab() === 'featured') {
              <div class="panel-section">
                <div class="panel-header">
                  <div>
                    <h2>Productos Destacados</h2>
                    <p>Define la sección de vitrina principal de prendas en la portada.</p>
                  </div>
                </div>

                <div class="two-columns">
                  <div class="field">
                    <label for="feat-eyebrow">Antetítulo</label>
                    <input
                      id="feat-eyebrow"
                      type="text"
                      [(ngModel)]="content().featured.eyebrow"
                      (input)="markDirty()"
                      placeholder="Ej. Selección Trama"
                      maxlength="80"
                    />
                  </div>
                  <div class="field">
                    <label for="feat-heading">Título Principal</label>
                    <input
                      id="feat-heading"
                      type="text"
                      [(ngModel)]="content().featured.heading"
                      (input)="markDirty()"
                      placeholder="Ej. Esenciales de calidad"
                      maxlength="100"
                    />
                  </div>
                </div>

                <div class="field">
                  <label>Modo de selección de productos</label>
                  <div class="mode-selector-tabs">
                    <button
                      type="button"
                      [class.active]="content().featured.autoSelect !== false"
                      (click)="content().featured.autoSelect = true; markDirty()"
                    >
                      <span class="m-icon">⚡</span>
                      <div>
                        <b>Automático</b>
                        <small>Muestra los 4 productos más recientes del catálogo</small>
                      </div>
                    </button>
                    <button
                      type="button"
                      [class.active]="content().featured.autoSelect === false"
                      (click)="content().featured.autoSelect = false; markDirty()"
                    >
                      <span class="m-icon">🎯</span>
                      <div>
                        <b>Curaduría Manual</b>
                        <small>Selecciona a mano qué prendas mostrar</small>
                      </div>
                    </button>
                  </div>
                </div>

                @if (content().featured.autoSelect === false) {
                  <div class="curated-products-box">
                    <div class="curated-header">
                      <div>
                        <b>Prendas Seleccionadas</b>
                        <small>{{ (content().featured.productIds || []).length }} productos en vitrina</small>
                      </div>
                      <button type="button" class="button secondary btn-picker" (click)="openProductPicker()">
                        <span>+</span> Elegir del catálogo
                      </button>
                    </div>

                    <div class="selected-product-chips">
                      @for (slug of content().featured.productIds; track slug) {
                        <div class="product-chip">
                          <span class="chip-name">{{ getProductName(slug) }}</span>
                          <button type="button" class="chip-remove" (click)="removeCuratedProduct(slug)" title="Quitar de destacados">✕</button>
                        </div>
                      }
                      @if (!content().featured.productIds || content().featured.productIds!.length === 0) {
                        <div class="curated-empty">
                          <p>No has seleccionado prendas aún. Haz clic en "Elegir del catálogo" para añadir productos a la vitrina.</p>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }

            <!-- ================= TAB: HISTORIA DE MARCA ================= -->
            @if (activeTab() === 'story') {
              <div class="panel-section">
                <div class="panel-header">
                  <div>
                    <h2>Historia de Marca</h2>
                    <p>La sección editorial que transmite los valores, confección y nobleza textil.</p>
                  </div>
                </div>

                <div class="two-columns">
                  <div class="field">
                    <label for="story-eyebrow">Antetítulo</label>
                    <input
                      id="story-eyebrow"
                      type="text"
                      [(ngModel)]="content().story.eyebrow"
                      (input)="markDirty()"
                      placeholder="Ej. Confección y detalle"
                      maxlength="80"
                    />
                  </div>
                  <div class="field">
                    <label for="story-heading">Título Principal</label>
                    <input
                      id="story-heading"
                      type="text"
                      [(ngModel)]="content().story.heading"
                      (input)="markDirty()"
                      placeholder="Ej. Materiales nobles. Calidad que se siente."
                      maxlength="120"
                    />
                  </div>
                </div>

                <div class="field">
                  <label for="story-desc">Descripción Editorial</label>
                  <textarea
                    id="story-desc"
                    rows="3"
                    [(ngModel)]="content().story.description"
                    (input)="markDirty()"
                    placeholder="Seleccionamos los mejores tejidos, cortes precisos y costuras reforzadas…"
                    maxlength="500"
                  ></textarea>
                </div>

                <!-- FOTO DE HISTORIA -->
                <div class="field">
                  <label>Fotografía Editorial</label>
                  <div class="image-uploader-wrapper">
                    <div class="image-preview-slot">
                      <img [src]="content().story.imageUrl" [alt]="content().story.imageAlt || 'Historia Trama'" (error)="onImgError($event)" />
                    </div>
                    <div class="image-uploader-actions">
                      <input
                        type="text"
                        [(ngModel)]="content().story.imageUrl"
                        placeholder="URL de imagen…"
                        (input)="markDirty()"
                        class="input-clean"
                      />
                      <div class="upload-btn-row">
                        <label class="btn-file-upload">
                          <span>📁 Subir archivo</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            (change)="onUploadStoryImage($event)"
                            class="hidden-file-input"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="two-columns">
                  <div class="field">
                    <label for="story-cta-label">Texto del Enlace</label>
                    <input
                      id="story-cta-label"
                      type="text"
                      [(ngModel)]="content().story.ctaLabel"
                      (input)="markDirty()"
                      placeholder="Ej. Nuestro enfoque"
                      maxlength="40"
                    />
                  </div>
                  <div class="field">
                    <label for="story-cta-link">Enlace de Destino</label>
                    <input
                      id="story-cta-link"
                      type="text"
                      [(ngModel)]="content().story.ctaLink"
                      (input)="markDirty()"
                      placeholder="Ej. /legal/manifiesto"
                      maxlength="120"
                    />
                  </div>
                </div>

                <!-- ESTADÍSTICAS O HITOS EDITORIALES -->
                <div class="stats-editor-box">
                  <div class="stats-header">
                    <b>Cifras y Compromisos de Calidad</b>
                    <button type="button" class="tool-btn-sm" (click)="addStoryStat()">+ Añadir cifra</button>
                  </div>
                  @for (stat of content().story.stats; track $index; let i = $index) {
                    <div class="stat-row">
                      <input
                        type="text"
                        [(ngModel)]="stat.number"
                        placeholder="Cifra (ej. 100%)"
                        (input)="markDirty()"
                        class="stat-val-input"
                      />
                      <input
                        type="text"
                        [(ngModel)]="stat.label"
                        placeholder="Etiqueta explicativa"
                        (input)="markDirty()"
                        class="stat-lbl-input"
                      />
                      <button type="button" class="tool-btn danger" (click)="removeStoryStat(i)">✕</button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- ================= TAB: BENEFICIOS ================= -->
            @if (activeTab() === 'benefits') {
              <div class="panel-section">
                <div class="panel-header">
                  <div>
                    <h2>Propuesta de Valor & Beneficios</h2>
                    <p>Tarjetas de confianza que garantizan tranquilidad al comprador.</p>
                  </div>
                </div>

                <div class="benefits-editor-list">
                  @for (item of content().benefits; track $index; let i = $index) {
                    <div class="benefit-card-editor">
                      <div class="benefit-card-top">
                        <span class="benefit-badge">Pilar #{{ i + 1 }}</span>
                      </div>
                      <div class="field">
                        <label>Título</label>
                        <input
                          type="text"
                          [(ngModel)]="item.title"
                          (input)="markDirty()"
                          placeholder="Ej. Despacho a todo Chile"
                          maxlength="60"
                        />
                      </div>
                      <div class="field">
                        <label>Descripción corta</label>
                        <input
                          type="text"
                          [(ngModel)]="item.description"
                          (input)="markDirty()"
                          placeholder="Ej. Seguimiento en cada etapa"
                          maxlength="100"
                        />
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- ================= TAB: CATEGORÍAS RÁPIDAS ================= -->
            @if (activeTab() === 'categories') {
              <div class="panel-section">
                <div class="panel-header">
                  <div>
                    <h2>Accesos Directos a Categorías</h2>
                    <p>Mosaico visual para que el usuario navegue rápidamente a secciones clave.</p>
                  </div>
                </div>

                <div class="categories-editor-list">
                  @for (cat of content().categories; track $index; let i = $index) {
                    <div class="category-card-editor">
                      <div class="cat-thumb">
                        <img [src]="cat.imageUrl" [alt]="cat.label" (error)="onImgError($event)" />
                      </div>
                      <div class="cat-fields">
                        <div class="two-columns">
                          <div class="field">
                            <label>Nombre de Categoría</label>
                            <input
                              type="text"
                              [(ngModel)]="cat.label"
                              (input)="markDirty()"
                              placeholder="Ej. Abrigos"
                              maxlength="50"
                            />
                          </div>
                          <div class="field">
                            <label>Enlace</label>
                            <input
                              type="text"
                              [(ngModel)]="cat.link"
                              (input)="markDirty()"
                              placeholder="Ej. /abrigos"
                              maxlength="100"
                            />
                          </div>
                        </div>
                        <div class="field">
                          <label>URL de imagen</label>
                          <input
                            type="text"
                            [(ngModel)]="cat.imageUrl"
                            (input)="markDirty()"
                            placeholder="URL de fotografía"
                            class="input-clean"
                          />
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </aside>

        <!-- LIENZO DE PREVISUALIZACIÓN EN VIVO (CANVAS DERECHO) -->
        <main class="cms-canvas-stage">
          <div class="canvas-viewport-wrapper" [class.device-mobile]="!desktop()">
            <!-- MARCO DEL DISPOSITIVO SI ES MÓVIL -->
            @if (!desktop()) {
              <div class="mobile-speaker-notch">
                <div class="camera-lens"></div>
                <div class="speaker-slot"></div>
              </div>
            }

            <div class="canvas-screen">
              <!-- BARRA DE ANUNCIO EN VIVO -->
              @if (content().announcementActive !== false && content().announcement) {
                <div class="live-announcement-bar" (click)="activeTab.set('announcement')">
                  <span>{{ content().announcement }}</span>
                </div>
              }

              <!-- NAVEGACIÓN SIMULADA -->
              <header class="live-mock-nav">
                <div class="mock-nav-left">
                  <span class="mock-logo">TRAMA <b>SUR</b></span>
                </div>
                <div class="mock-nav-center">
                  <span>Colección</span>
                  <span>Abrigos</span>
                  <span>Tops</span>
                  <span>Pantalones</span>
                </div>
                <div class="mock-nav-right">
                  <span>🔍</span>
                  <span>👤</span>
                  <span>👜 (0)</span>
                </div>
              </header>

              <!-- HERO / CARRUSEL EN VIVO -->
              <section class="live-hero-section" (click)="activeTab.set('carousel')">
                @if (activeSlide(); as slide) {
                  <div class="live-slide-container">
                    <img
                      [src]="slide.imageUrl"
                      [alt]="slide.imageAlt || slide.title"
                      class="live-slide-bg"
                      (error)="onImgError($event)"
                    />
                    <div class="live-slide-overlay"></div>
                    <div class="live-slide-content">
                      <span class="live-eyebrow">{{ slide.eyebrow }}</span>
                      <h2 class="live-title">
                        {{ slide.title }} <em>{{ slide.accent }}</em>
                      </h2>
                      <p class="live-desc">{{ slide.description }}</p>
                      <a class="live-cta-btn">{{ slide.ctaLabel || 'Ver colección' }} →</a>
                    </div>

                    <!-- CONTROLES DEL CARRUSEL EN EL LIENZO -->
                    @if ((content().carousel || []).length > 1) {
                      <button
                        type="button"
                        class="live-arrow live-arrow-prev"
                        (click)="$event.stopPropagation(); prevSlidePreview()"
                        aria-label="Diapositiva anterior"
                      >‹</button>
                      <button
                        type="button"
                        class="live-arrow live-arrow-next"
                        (click)="$event.stopPropagation(); nextSlidePreview()"
                        aria-label="Diapositiva siguiente"
                      >›</button>

                      <div class="live-slide-dots">
                        @for (s of content().carousel; track s.id; let i = $index) {
                          <button
                            type="button"
                            class="live-dot"
                            [class.active]="previewSlideIndex() === i"
                            (click)="$event.stopPropagation(); previewSlideIndex.set(i); selectedSlideIndex.set(i)"
                            [title]="'Ir a diapositiva ' + (i + 1)"
                          ></button>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <!-- HERO ESTÁTICO DE RESERVA -->
                  <div class="live-slide-container">
                    <img
                      [src]="content().hero.imageUrl || '/assets/images/hero-trama-sur.png'"
                      [alt]="content().hero.imageAlt"
                      class="live-slide-bg"
                    />
                    <div class="live-slide-overlay"></div>
                    <div class="live-slide-content">
                      <span class="live-eyebrow">{{ content().hero.eyebrow }}</span>
                      <h2 class="live-title">
                        {{ content().hero.title }} <em>{{ content().hero.accent }}</em>
                      </h2>
                      <p class="live-desc">{{ content().hero.description }}</p>
                      <a class="live-cta-btn">{{ content().hero.ctaLabel }} →</a>
                    </div>
                  </div>
                }
              </section>

              <!-- BENEFICIOS EN VIVO -->
              @if (content().benefits?.length) {
                <section class="live-benefits-bar" (click)="activeTab.set('benefits')">
                  @for (benefit of content().benefits; track benefit.title) {
                    <div class="live-benefit-item">
                      <b>{{ benefit.title }}</b>
                      <small>{{ benefit.description }}</small>
                    </div>
                  }
                </section>
              }

              <!-- PRODUCTOS DESTACADOS EN VIVO -->
              <section class="live-featured-section" (click)="activeTab.set('featured')">
                <div class="live-section-header">
                  <span class="live-sec-eyebrow">{{ content().featured.eyebrow }}</span>
                  <h3 class="live-sec-title">{{ content().featured.heading }}</h3>
                </div>
                <div class="live-products-grid">
                  @for (prod of previewProducts(); track prod.id) {
                    <div class="live-product-card">
                      <div class="live-card-thumb">
                        <img [src]="prod.imageUrl" [alt]="prod.name" (error)="onImgError($event)" />
                      </div>
                      <div class="live-card-body">
                        <b>{{ prod.name }}</b>
                        <span>{{ formatPrice(prod.priceClp) }}</span>
                      </div>
                    </div>
                  }
                </div>
              </section>

              <!-- HISTORIA DE MARCA EN VIVO -->
              <section class="live-story-section" (click)="activeTab.set('story')">
                <div class="live-story-grid">
                  <div class="live-story-photo">
                    <img
                      [src]="content().story.imageUrl || '/assets/images/sobrecamisa-bosque.png'"
                      [alt]="content().story.imageAlt || 'Historia Trama'"
                      (error)="onImgError($event)"
                    />
                  </div>
                  <div class="live-story-text">
                    <span class="live-sec-eyebrow">{{ content().story.eyebrow }}</span>
                    <h3 class="live-story-title">{{ content().story.heading }}</h3>
                    <p class="live-story-desc">{{ content().story.description }}</p>

                    @if (content().story.stats?.length) {
                      <div class="live-story-stats">
                        @for (stat of content().story.stats; track stat.label) {
                          <div class="live-stat-card">
                            <b>{{ stat.number }}</b>
                            <small>{{ stat.label }}</small>
                          </div>
                        }
                      </div>
                    }

                    @if (content().story.ctaLabel) {
                      <span class="live-story-link">{{ content().story.ctaLabel }} →</span>
                    }
                  </div>
                </div>
              </section>

              <!-- CATEGORÍAS EN VIVO -->
              @if (content().categories?.length) {
                <section class="live-categories-section" (click)="activeTab.set('categories')">
                  <div class="live-categories-grid">
                    @for (cat of content().categories; track cat.label) {
                      <div class="live-cat-card">
                        <img [src]="cat.imageUrl" [alt]="cat.label" (error)="onImgError($event)" />
                        <div class="live-cat-overlay">
                          <b>{{ cat.label }}</b>
                          <small>Explorar prendas →</small>
                        </div>
                      </div>
                    }
                  </div>
                </section>
              }

              <!-- FOOTER SIMULADO -->
              <footer class="live-mock-footer">
                <div>
                  <span class="mock-footer-brand">TRAMA SUR</span>
                  <small>Vestimenta atemporal y sobria. Confección en el sur de Chile.</small>
                </div>
                <small class="mock-footer-copy">© 2026 Trama Sur. Calidad que perdura.</small>
              </footer>
            </div>
          </div>
        </main>
      </div>

      <!-- ================= MODAL: SELECTOR DE PRODUCTOS DEL CATÁLOGO ================= -->
      @if (showProductPicker()) {
        <div class="cms-modal-backdrop" (click)="showProductPicker.set(false)">
          <div class="cms-modal-box" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <div>
                <h3>Curaduría de Productos Destacados</h3>
                <p>Selecciona los productos que aparecerán en la vitrina de la portada principal.</p>
              </div>
              <button type="button" class="btn-modal-close" (click)="showProductPicker.set(false)">✕</button>
            </div>

            <div class="modal-search-row">
              <input
                type="text"
                placeholder="Buscar por nombre de producto…"
                [(ngModel)]="productSearch"
                class="modal-search-input"
              />
              <span class="modal-selection-badge">
                {{ (content().featured.productIds || []).length }} seleccionados
              </span>
            </div>

            <div class="modal-product-grid">
              @for (prod of filteredCatalogProducts(); track prod.id) {
                <div
                  class="picker-card"
                  [class.selected]="isProductSelected(prod.slug)"
                  (click)="toggleProductSelection(prod.slug)"
                >
                  <div class="picker-thumb">
                    <img [src]="prod.imageUrl" [alt]="prod.name" (error)="onImgError($event)" />
                    @if (isProductSelected(prod.slug)) {
                      <span class="check-badge">✓</span>
                    }
                  </div>
                  <div class="picker-info">
                    <b>{{ prod.name }}</b>
                    <small>{{ formatPrice(prod.priceClp) }}</small>
                  </div>
                </div>
              }
            </div>

            <div class="modal-footer">
              <button type="button" class="button secondary" (click)="showProductPicker.set(false)">
                Listo
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: CONFIRMAR PUBLICACIÓN ================= -->
      @if (showPublishModal()) {
        <div class="cms-modal-backdrop" (click)="showPublishModal.set(false)">
          <div class="cms-modal-box publish-modal" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <div>
                <h3>Publicar Cambios en la Portada</h3>
                <p>Esta acción actualizará la versión pública de la portada para todos los visitantes de la tienda.</p>
              </div>
              <button type="button" class="btn-modal-close" (click)="showPublishModal.set(false)">✕</button>
            </div>

            <div class="modal-body-pad">
              <div class="publish-summary-card">
                <p><b>Versión a publicar:</b> Borrador v{{ currentVersionNumber() || 'actual' }}</p>
                <p><b>Diapositivas de carrusel:</b> {{ (content().carousel || []).length }} configuradas</p>
                <p><b>Modo vitrina:</b> {{ content().featured.autoSelect !== false ? 'Automático' : 'Curaduría manual (' + (content().featured.productIds?.length || 0) + ' productos)' }}</p>
              </div>

              <div class="field">
                <label for="pub-note">Nota de auditoría (opcional)</label>
                <input
                  id="pub-note"
                  type="text"
                  [(ngModel)]="publicationNote"
                  placeholder="Ej. Actualización de campaña invierno 2026"
                  maxlength="200"
                />
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="button secondary" (click)="showPublishModal.set(false)">Cancelar</button>
              <button type="button" class="button primary" [disabled]="publishing()" (click)="confirmPublish()">
                @if (publishing()) {
                  <span>Publicando…</span>
                } @else {
                  <span>Publicar Ahora</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- TOAST DE MENSAJES FLOTANTE -->
      @if (toast()) {
        <div class="cms-toast" [class]="toast()!.type">
          <span>{{ toast()!.msg }}</span>
          <button type="button" (click)="toast.set(null)">✕</button>
        </div>
      }
    </section>
  `,
  styleUrl: './cms-editor.page.scss'
})
export class CmsEditorPage implements OnInit {
  private readonly cms = inject(ContentService);
  private readonly catalog = inject(CatalogService);

  readonly content = signal<HomeContent>(structuredClone(DEFAULT_HOME_CONTENT));
  readonly versionId = signal('');
  readonly currentVersionNumber = signal<number | null>(null);
  readonly statusText = signal('Cargando contenido…');
  readonly statusType = signal<'saved' | 'unsaved' | 'warning' | 'idle'>('idle');
  readonly desktop = signal(true);
  readonly activeTab = signal<CmsTab>('carousel');

  readonly hasChanges = signal(false);
  readonly saving = signal(false);
  readonly publishing = signal(false);
  readonly uploading = signal(false);

  readonly selectedSlideIndex = signal(0);
  readonly previewSlideIndex = signal(0);

  readonly catalogProducts = signal<ProductCard[]>([]);
  productSearch = '';
  readonly showProductPicker = signal(false);
  readonly showPublishModal = signal(false);
  publicationNote = 'Publicación desde Estudio CMS';

  readonly toast = signal<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  readonly formatPrice = clp;

  // Diapositiva actualmente seleccionada en el inspector
  readonly currentSlide = computed<HomeSlide | null>(() => {
    const slides = this.content().carousel;
    if (!slides || slides.length === 0) return null;
    const idx = Math.min(this.selectedSlideIndex(), slides.length - 1);
    return slides[idx] ?? null;
  });

  // Diapositiva actualmente visible en el lienzo
  readonly activeSlide = computed<HomeSlide | null>(() => {
    const slides = this.content().carousel;
    if (!slides || slides.length === 0) return null;
    const idx = Math.min(this.previewSlideIndex(), slides.length - 1);
    return slides[idx] ?? null;
  });

  // Productos para la vista previa de la sección destacados
  readonly previewProducts = computed<ProductCard[]>(() => {
    const all = this.catalogProducts();
    if (all.length === 0) return [];
    const feat = this.content().featured;
    if (feat.autoSelect !== false || !feat.productIds || feat.productIds.length === 0) {
      return all.slice(0, 4);
    }
    const matched = feat.productIds
      .map(slug => all.find(p => p.slug === slug))
      .filter((p): p is ProductCard => !!p);
    return matched.length > 0 ? matched.slice(0, 4) : all.slice(0, 4);
  });

  // Filtrado de productos en el modal picker
  readonly filteredCatalogProducts = computed(() => {
    const q = this.productSearch.trim().toLowerCase();
    if (!q) return this.catalogProducts();
    return this.catalogProducts().filter(p =>
      p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.loadCatalogProducts();
    this.loadDraftOrPublished();
  }

  markDirty(): void {
    this.hasChanges.set(true);
    this.statusText.set('Cambios sin guardar');
    this.statusType.set('unsaved');
  }

  private loadCatalogProducts(): void {
    this.catalog.products().subscribe({
      next: res => this.catalogProducts.set(res.items || []),
      error: () => this.catalogProducts.set([])
    });
  }

  private loadDraftOrPublished(): void {
    this.statusText.set('Cargando borrador…');
    this.cms.draft().subscribe({
      next: r => {
        if (r.draft) {
          try {
            const parsed = JSON.parse(r.draft.contentJson) as HomeContent;
            this.normalizeContent(parsed);
            this.content.set(parsed);
            this.versionId.set(r.draft.id);
            this.currentVersionNumber.set(r.draft.versionNumber);
            this.statusText.set(`Borrador v${r.draft.versionNumber} cargado`);
            this.statusType.set('saved');
            this.hasChanges.set(false);
          } catch {
            this.fallbackToDefault();
          }
        } else {
          // No draft exists yet, load published home content
          this.cms.home().subscribe({
            next: published => {
              this.normalizeContent(published);
              this.content.set(published);
              this.statusText.set('Portada publicada cargada');
              this.statusType.set('idle');
              this.hasChanges.set(false);
            },
            error: () => this.fallbackToDefault()
          });
        }
      },
      error: () => this.fallbackToDefault()
    });
  }

  private fallbackToDefault(): void {
    this.content.set(structuredClone(DEFAULT_HOME_CONTENT));
    this.statusText.set('Contenido predeterminado');
    this.statusType.set('idle');
    this.hasChanges.set(false);
  }

  private normalizeContent(c: HomeContent): void {
    if (!c.carousel || !Array.isArray(c.carousel) || c.carousel.length === 0) {
      c.carousel = structuredClone(DEFAULT_HOME_CONTENT.carousel);
    }
    if (!c.featured) c.featured = structuredClone(DEFAULT_HOME_CONTENT.featured);
    if (!c.story) c.story = structuredClone(DEFAULT_HOME_CONTENT.story);
    if (!c.benefits) c.benefits = structuredClone(DEFAULT_HOME_CONTENT.benefits);
    if (!c.categories) c.categories = structuredClone(DEFAULT_HOME_CONTENT.categories);
  }

  // ================= ACCIONES DE DIAPOSITIVAS =================
  addSlide(): void {
    const current = this.content().carousel || [];
    const newSlide: HomeSlide = {
      id: 'slide-' + Date.now(),
      eyebrow: 'Nueva Colección',
      title: 'Título del',
      accent: 'Banner.',
      description: 'Prendas con confección artesanal y calidad garantizada.',
      ctaLabel: 'Ver colección',
      ctaLink: '/coleccion',
      imageUrl: '/assets/images/hero-trama-sur.png',
      imageAlt: 'Prendas de alta calidad Trama Sur',
      isActive: true
    };
    const updated = [...current, newSlide];
    this.content.update(c => ({ ...c, carousel: updated }));
    this.selectedSlideIndex.set(updated.length - 1);
    this.previewSlideIndex.set(updated.length - 1);
    this.markDirty();
    this.showToast('Nueva diapositiva añadida', 'info');
  }

  deleteSlide(index: number): void {
    const current = [...(this.content().carousel || [])];
    if (current.length <= 1) {
      this.showToast('Debe existir al menos una diapositiva en el carrusel', 'error');
      return;
    }
    current.splice(index, 1);
    this.content.update(c => ({ ...c, carousel: current }));
    const newIdx = Math.max(0, Math.min(this.selectedSlideIndex(), current.length - 1));
    this.selectedSlideIndex.set(newIdx);
    this.previewSlideIndex.set(newIdx);
    this.markDirty();
    this.showToast('Diapositiva eliminada', 'info');
  }

  moveSlide(index: number, direction: 'up' | 'down'): void {
    const current = [...(this.content().carousel || [])];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= current.length) return;
    const temp = current[index];
    current[index] = current[target];
    current[target] = temp;
    this.content.update(c => ({ ...c, carousel: current }));
    this.selectedSlideIndex.set(target);
    this.previewSlideIndex.set(target);
    this.markDirty();
  }

  duplicateSlide(index: number): void {
    const current = [...(this.content().carousel || [])];
    const orig = current[index];
    if (!orig) return;
    const copy: HomeSlide = {
      ...structuredClone(orig),
      id: 'slide-' + Date.now(),
      title: `${orig.title} (Copia)`
    };
    current.splice(index + 1, 0, copy);
    this.content.update(c => ({ ...c, carousel: current }));
    this.selectedSlideIndex.set(index + 1);
    this.previewSlideIndex.set(index + 1);
    this.markDirty();
    this.showToast('Diapositiva duplicada', 'info');
  }

  nextSlidePreview(): void {
    const slides = this.content().carousel || [];
    if (slides.length <= 1) return;
    const next = (this.previewSlideIndex() + 1) % slides.length;
    this.previewSlideIndex.set(next);
  }

  prevSlidePreview(): void {
    const slides = this.content().carousel || [];
    if (slides.length <= 1) return;
    const prev = (this.previewSlideIndex() - 1 + slides.length) % slides.length;
    this.previewSlideIndex.set(prev);
  }

  // ================= GESTIÓN DE SUBIDA DE IMÁGENES =================
  onUploadSlideImage(event: Event, slide: HomeSlide): void {
    const target = event.target as HTMLInputElement;
    const file = target?.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.cms.uploadMedia(file, slide.title || 'Slide image').subscribe({
      next: res => {
        slide.imageUrl = res.publicUrl;
        this.uploading.set(false);
        this.markDirty();
        this.showToast('Imagen subida correctamente', 'success');
        target.value = '';
      },
      error: () => {
        this.uploading.set(false);
        this.showToast('Error al subir imagen (máx 5MB, PNG/JPEG/WEBP)', 'error');
        target.value = '';
      }
    });
  }

  onUploadStoryImage(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target?.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.cms.uploadMedia(file, 'Historia de marca').subscribe({
      next: res => {
        this.content.update(c => ({
          ...c,
          story: { ...c.story, imageUrl: res.publicUrl }
        }));
        this.uploading.set(false);
        this.markDirty();
        this.showToast('Fotografía de historia subida correctamente', 'success');
        target.value = '';
      },
      error: () => {
        this.uploading.set(false);
        this.showToast('Error al subir imagen', 'error');
        target.value = '';
      }
    });
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) img.src = '/assets/images/hero-trama-sur.png';
  }

  // ================= CURADURÍA DE PRODUCTOS =================
  openProductPicker(): void {
    this.showProductPicker.set(true);
  }

  isProductSelected(slug: string): boolean {
    return !!this.content().featured.productIds?.includes(slug);
  }

  toggleProductSelection(slug: string): void {
    const current = [...(this.content().featured.productIds || [])];
    const idx = current.indexOf(slug);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(slug);
    }
    this.content.update(c => ({
      ...c,
      featured: { ...c.featured, productIds: current, autoSelect: false }
    }));
    this.markDirty();
  }

  removeCuratedProduct(slug: string): void {
    const current = [...(this.content().featured.productIds || [])].filter(s => s !== slug);
    this.content.update(c => ({
      ...c,
      featured: { ...c.featured, productIds: current }
    }));
    this.markDirty();
  }

  getProductName(slug: string): string {
    const p = this.catalogProducts().find(x => x.slug === slug);
    return p?.name || slug;
  }

  // ================= CIFRAS Y ESTADÍSTICAS DE HISTORIA =================
  addStoryStat(): void {
    const current = [...(this.content().story.stats || [])];
    current.push({ number: '100%', label: 'Compromiso con la confección' });
    this.content.update(c => ({
      ...c,
      story: { ...c.story, stats: current }
    }));
    this.markDirty();
  }

  removeStoryStat(index: number): void {
    const current = [...(this.content().story.stats || [])];
    current.splice(index, 1);
    this.content.update(c => ({
      ...c,
      story: { ...c.story, stats: current }
    }));
    this.markDirty();
  }

  // ================= PERSISTENCIA: GUARDAR BORRADOR & PUBLICAR =================
  discardChanges(): void {
    if (!confirm('¿Deseas descartar los cambios no guardados y recargar el último borrador?')) return;
    this.loadDraftOrPublished();
  }

  saveDraft(): void {
    this.saving.set(true);
    this.statusText.set('Guardando borrador…');
    try {
      localStorage.setItem('trama_cms_draft_backup', JSON.stringify(this.content()));
    } catch {
      // Ignorar cuota excedida de localStorage
    }

    this.cms.saveDraft(this.content()).subscribe({
      next: res => {
        this.versionId.set(res.versionId);
        this.currentVersionNumber.set(res.versionNumber);
        this.saving.set(false);
        this.hasChanges.set(false);
        this.statusText.set(`Borrador v${res.versionNumber} guardado en BD`);
        this.statusType.set('saved');
        this.showToast(`Borrador v${res.versionNumber} guardado exitosamente`, 'success');
      },
      error: err => {
        this.saving.set(false);
        const detail = err.error?.detail || err.error?.message || (typeof err.error === 'string' ? err.error : null) || err.message;
        const msg = err.status === 403
          ? 'Se requiere verificación MFA para guardar cambios'
          : detail ? `Error al guardar: ${detail}` : 'Error al guardar el borrador';
        this.statusText.set(err.status === 403 ? 'MFA requerido' : 'Error al guardar');
        this.statusType.set('warning');
        this.showToast(msg, 'error');
      }
    });
  }

  openPublishModal(): void {
    if (this.hasChanges()) {
      // Prompt user that we must save draft first
      if (confirm('Tienes cambios sin guardar. ¿Deseas guardarlos primero antes de publicar?')) {
        this.saving.set(true);
        this.cms.saveDraft(this.content()).subscribe({
          next: res => {
            this.versionId.set(res.versionId);
            this.currentVersionNumber.set(res.versionNumber);
            this.saving.set(false);
            this.hasChanges.set(false);
            this.showPublishModal.set(true);
          },
          error: err => {
            this.saving.set(false);
            const detail = err.error?.detail || err.error?.message || err.message;
            this.showToast(detail ? `Error al guardar: ${detail}` : 'Error al guardar el borrador antes de publicar', 'error');
          }
        });
        return;
      }
    }
    this.showPublishModal.set(true);
  }

  confirmPublish(): void {
    const vid = this.versionId();
    if (!vid) return;
    this.publishing.set(true);
    this.cms.publish(vid, this.publicationNote.trim() || 'Publicación desde Estudio CMS').subscribe({
      next: () => {
        this.publishing.set(false);
        this.showPublishModal.set(false);
        this.statusText.set('¡Publicado en vivo con éxito!');
        this.statusType.set('saved');
        this.showToast('¡La portada ha sido publicada con éxito en la tienda!', 'success');
      },
      error: err => {
        this.publishing.set(false);
        const detail = err.error?.detail || err.error?.message || (typeof err.error === 'string' ? err.error : null) || err.message;
        const msg = err.status === 403
          ? 'Se requiere verificación MFA para publicar'
          : detail ? `Error al publicar: ${detail}` : 'Error al publicar';
        this.showToast(msg, 'error');
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error' | 'info'): void {
    this.toast.set({ msg, type });
    setTimeout(() => {
      if (this.toast()?.msg === msg) this.toast.set(null);
    }, 4500);
  }
}

