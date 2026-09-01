import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

@Component({
  selector: 'app-cookie-banner',
  imports: [RouterLink, FormsModule],
  template: `
    @if (visible()) {
      <aside class="cookie-banner" role="dialog" aria-label="Preferencias de privacidad y cookies" aria-modal="true">
        <div class="cookie-container">
          <div class="cookie-header">
            <h2>Privacidad y Cookies</h2>
            <p>
              Usamos cookies esenciales para tu sesión y compra, y cookies analíticas para mejorar tu experiencia.
            </p>
          </div>

          @if (showSettings()) {
            <div class="cookie-settings">
              <div class="cookie-option">
                <div class="option-info">
                  <strong>Cookies técnicas y esenciales <small>(Obligatorias)</small></strong>
                  <p>Necesarias para conservar el carrito, procesar compras seguras y prevenir fraudes. No se pueden desactivar.</p>
                </div>
                <input type="checkbox" checked disabled aria-label="Cookies esenciales activadas siempre">
              </div>

              <div class="cookie-option">
                <div class="option-info">
                  <strong>Cookies analíticas y de medición <small>(Opcionales)</small></strong>
                  <p>Nos ayudan a entender de forma anónima cómo navegan los usuarios para optimizar la velocidad y el diseño del sitio.</p>
                </div>
                <input type="checkbox" [(ngModel)]="analyticsAllowed" id="analytics-cookie" name="analyticsAllowed">
              </div>

              <div class="cookie-option">
                <div class="option-info">
                  <strong>Cookies de preferencias y marketing <small>(Opcionales)</small></strong>
                  <p>Permiten recordar preferencias y ofrecerte recomendaciones relevantes cuando nos visites.</p>
                </div>
                <input type="checkbox" [(ngModel)]="marketingAllowed" id="marketing-cookie" name="marketingAllowed">
              </div>
            </div>
          }

          <div class="cookie-actions">
            @if (!showSettings()) {
              <button class="button primary" type="button" (click)="acceptAll()">Aceptar todas</button>
              <button class="button secondary" type="button" (click)="rejectNonEssential()">Rechazar no esenciales</button>
              <button class="button text" type="button" (click)="showSettings.set(true)">Personalizar</button>
            } @else {
              <button class="button primary" type="button" (click)="saveCustom()">Guardar mis preferencias</button>
              <button class="button secondary" type="button" (click)="acceptAll()">Aceptar todas</button>
            }
          </div>

          <div class="cookie-footer">
            <small>
              Consulta nuestra <a routerLink="/legal/privacidad" (click)="visible.set(false)">Política de Privacidad</a> y
              <a routerLink="/legal/cookies" (click)="visible.set(false)">Política de Cookies</a>. Puedes cambiar tu decisión en cualquier momento.
            </small>
          </div>
        </div>
      </aside>
    }
  `,
  styleUrl: './cookie-banner.component.scss'
})
export class CookieBannerComponent implements OnInit {
  readonly visible = signal(false);
  readonly showSettings = signal(false);
  analyticsAllowed = false;
  marketingAllowed = false;

  private readonly STORAGE_KEY = 'trama_cookie_consent';

  ngOnInit(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) {
      this.visible.set(true);
    } else {
      try {
        const prefs: CookiePreferences = JSON.parse(saved);
        this.analyticsAllowed = prefs.analytics;
        this.marketingAllowed = prefs.marketing;
      } catch {
        this.visible.set(true);
      }
    }

    window.addEventListener('trama:open-cookie-settings', () => {
      this.showSettings.set(true);
      this.visible.set(true);
    });
  }

  acceptAll(): void {
    this.analyticsAllowed = true;
    this.marketingAllowed = true;
    this.save({
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString()
    });
  }

  rejectNonEssential(): void {
    this.analyticsAllowed = false;
    this.marketingAllowed = false;
    this.save({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString()
    });
  }

  saveCustom(): void {
    this.save({
      essential: true,
      analytics: this.analyticsAllowed,
      marketing: this.marketingAllowed,
      timestamp: new Date().toISOString()
    });
  }

  minimize(): void {
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      this.rejectNonEssential();
    } else {
      this.visible.set(false);
    }
  }

  private save(prefs: CookiePreferences): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
    this.visible.set(false);
    this.showSettings.set(false);
  }
}
