import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, FormsModule],
  template: `
    <section class="newsletter">
      <div>
        <p class="eyebrow">El boletín de Trama</p>
        <h2>Menos ruido. Mayor calidad.</h2>
        <p>Nuevos lanzamientos, guías de cuidado y beneficios exclusivos sin saturar tu correo.</p>
      </div>
      <form (ngSubmit)="subscribe()" novalidate>
        <label for="newsletter-email">Correo electrónico</label>
        <div>
          <input id="newsletter-email" type="email" name="email" [(ngModel)]="email" placeholder="nombre@correo.cl" required>
          <button type="submit">{{subscribed?'¡Suscrito!':'Suscribirme'}}</button>
        </div>
        <small>Al suscribirte aceptas recibir novedades por correo. Consulta nuestra <a routerLink="/legal/privacidad">Política de Privacidad</a>. Puedes cancelar tu suscripción cuando quieras.</small>
      </form>
    </section>
    <footer>
      <div class="footer-brand">
        <a class="footer-mark" routerLink="/">TRAMA <span>SUR</span></a>
        <p class="company-id"><b>Trama Sur SpA</b> · RUT 77.892.341-K<br>Av. Providencia 1208, Of. 601, Santiago, Chile.<br>Atención: <a href="mailto:ayuda@tramasur.cl">ayuda@tramasur.cl</a> · Privacidad: <a href="mailto:privacidad@tramasur.cl">privacidad@tramasur.cl</a></p>
      </div>
      <div>
        <h3>Colección</h3>
        <a routerLink="/coleccion">Toda la colección</a>
        <a routerLink="/mujer">Mujer</a>
        <a routerLink="/hombre">Hombre</a>
        <a routerLink="/unisex">Unisex</a>
      </div>
      <div>
        <h3>Servicio al Cliente</h3>
        <a routerLink="/legal/despachos">Despachos a todo Chile</a>
        <a routerLink="/legal/cambios-devoluciones">Cambios (30 días)</a>
        <a routerLink="/legal/garantia">Garantía legal (6 meses)</a>
        <a routerLink="/legal/guia-tallas">Guía de tallas y medidas</a>
        <a routerLink="/legal/ayuda">Canales de atención y SLA</a>
      </div>
      <div>
        <h3>Legal y Privacidad</h3>
        <a routerLink="/legal/terminos">Términos y condiciones</a>
        <a routerLink="/legal/privacidad">Privacidad y Derechos ARCO</a>
        <a routerLink="/legal/retracto">Derecho a retracto (10 días)</a>
        <a href="javascript:void(0)" (click)="openCookieManager()">Configurar Cookies</a>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Trama Sur SpA (RUT 77.892.341-K). Todos los derechos reservados.</span>
        <span>Precios en CLP (19% IVA incluido) · Boleta electrónica SII · Pagos certificados Webpay Plus (PCI-DSS)</span>
      </div>
    </footer>
  `,
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  email = '';
  subscribed = false;

  subscribe(): void {
    if (!this.email) return;
    this.subscribed = true;
  }

  openCookieManager(): void {
    window.dispatchEvent(new Event('trama:open-cookie-settings'));
  }
}

