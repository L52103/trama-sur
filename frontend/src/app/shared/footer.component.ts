import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, FormsModule],
  template: `
    <section class="newsletter">
      <div><p class="eyebrow">El boletín de Trama</p><h2>Menos ruido. Mejores capas.</h2><p>Nuevos lanzamientos, guías de cuidado y beneficios sin saturar tu correo.</p></div>
      <form (ngSubmit)="subscribed=true" novalidate>
        <label for="newsletter-email">Correo electrónico</label>
        <div><input id="newsletter-email" type="email" name="email" [(ngModel)]="email" placeholder="nombre@correo.cl" required><button type="submit">{{subscribed?'¡Listo!':'Suscribirme'}}</button></div>
        <small>Al suscribirte aceptas nuestra <a routerLink="/legal/privacidad">política de privacidad</a>. Puedes salir cuando quieras.</small>
      </form>
    </section>
    <footer>
      <a class="footer-mark" routerLink="/">TRAMA <span>SUR</span><small>Ropa funcional, hecha para moverse.</small></a>
      <div><h3>Comprar</h3><a routerLink="/coleccion">Toda la colección</a><a routerLink="/mujer">Mujer</a><a routerLink="/hombre">Hombre</a><a routerLink="/unisex">Unisex</a></div>
      <div><h3>Ayuda</h3><a routerLink="/legal/despachos">Despachos y entregas</a><a routerLink="/legal/cambios-devoluciones">Cambios y devoluciones</a><a routerLink="/legal/garantia">Garantía legal</a><a href="mailto:ayuda@tramasur.cl">Contacto</a></div>
      <div><h3>Legal</h3><a routerLink="/legal/terminos">Términos y condiciones</a><a routerLink="/legal/privacidad">Privacidad</a><a routerLink="/legal/cookies">Cookies</a><a routerLink="/legal/retracto">Derecho a retracto</a></div>
      <div class="footer-bottom"><span>© 2026 Trama Sur. Todos los derechos reservados.</span><span>Precios incluyen IVA · Pagos seguros con Webpay</span></div>
    </footer>
  `,
  styleUrl: './footer.component.scss',
})
export class FooterComponent { email = ''; subscribed = false; }

