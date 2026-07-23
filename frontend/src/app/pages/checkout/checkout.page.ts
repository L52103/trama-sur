import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart.store';
import { clp } from '../../core/format';
import {
  CommerceService,
  PaymentRedirect
} from '../../core/commerce.service';
import { ShippingAddress } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-checkout-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IconComponent
  ],
  template: `
    <section class="checkout container">
      <div class="checkout-head">
        <a routerLink="/carrito">← Volver al carrito</a>
        <span>Pago protegido · SSL/TLS</span>
      </div>

      @if (!cart.lines().length && pendingOrderId()) {
        <div class="empty">
          <p class="step">Pedido reservado</p>

          <h1>Tu pago sigue pendiente.</h1>

          <p>
            Conservamos tu pedido durante 15 minutos. Puedes volver a intentar
            Webpay sin crear otra orden.
          </p>

          <button
            class="button"
            type="button"
            [disabled]="submitting()"
            (click)="retryPayment()"
          >
            {{ submitting() ? 'Procesando…' : 'Reintentar pago' }}
          </button>

          @if (error()) {
            <div class="api-error" role="alert">
              <b>No pudimos iniciar el pago.</b>
              <span>{{ error() }}</span>
            </div>
          }
        </div>
      } @else if (!cart.lines().length) {
        <div class="empty">
          <h1>No hay productos para pagar.</h1>
          <a class="button" routerLink="/coleccion">Ver colección</a>
        </div>
      } @else {
        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          <div class="form-area">
            <p class="step">01 / 03</p>

            <h1>Datos de entrega</h1>

            <p class="intro">
              Usaremos estos datos exclusivamente para procesar y despachar tu
              compra.
            </p>

            <fieldset>
              <legend>Contacto</legend>

              <div class="fields two">
                <div class="field">
                  <label for="firstName">Nombre</label>

                  <input
                    id="firstName"
                    formControlName="firstName"
                    autocomplete="given-name"
                  >

                  @if (invalid('firstName')) {
                    <span class="error">Ingresa tu nombre.</span>
                  }
                </div>

                <div class="field">
                  <label for="lastName">Apellido</label>

                  <input
                    id="lastName"
                    formControlName="lastName"
                    autocomplete="family-name"
                  >

                  @if (invalid('lastName')) {
                    <span class="error">Ingresa tu apellido.</span>
                  }
                </div>

                <div class="field">
                  <label for="email">Correo</label>

                  <input
                    id="email"
                    type="email"
                    formControlName="email"
                    autocomplete="email"
                  >

                  @if (invalid('email')) {
                    <span class="error">Ingresa un correo válido.</span>
                  }
                </div>

                <div class="field">
                  <label for="phone">Teléfono chileno</label>

                  <input
                    id="phone"
                    formControlName="phone"
                    autocomplete="tel"
                    placeholder="+56 9 1234 5678"
                  >

                  @if (invalid('phone')) {
                    <span class="error">
                      Usa un teléfono chileno válido.
                    </span>
                  }
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Dirección</legend>

              <div class="fields two">
                <div class="field">
                  <label for="region">Región</label>

                  <select
                    id="region"
                    formControlName="region"
                  >
                    <option value="">Selecciona</option>

                    @for (region of regions; track region) {
                      <option [value]="region">{{ region }}</option>
                    }
                  </select>
                </div>

                <div class="field">
                  <label for="commune">Comuna</label>

                  <input
                    id="commune"
                    formControlName="commune"
                    autocomplete="address-level2"
                  >
                </div>

                <div class="field wide">
                  <label for="address">Calle y número</label>

                  <input
                    id="address"
                    formControlName="addressLine1"
                    autocomplete="street-address"
                  >
                </div>

                <div class="field">
                  <label for="detail">Depto., oficina (opcional)</label>

                  <input
                    id="detail"
                    formControlName="addressLine2"
                  >
                </div>

                <div class="field">
                  <label for="instructions">
                    Instrucciones (opcional)
                  </label>

                  <input
                    id="instructions"
                    formControlName="instructions"
                  >
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Método de pago</legend>

              <div class="payment-method">
                <span class="radio"></span>

                <div>
                  <b>Webpay Plus</b>
                  <small>
                    Crédito, débito y prepago emitidas en Chile
                  </small>
                </div>

                <span class="webpay">webpay</span>
              </div>

              <p class="security-note">
                Serás redirigido al entorno seguro de Transbank. Trama Sur
                nunca recibe ni almacena el número de tu tarjeta.
              </p>
            </fieldset>

            <label class="check">
              <input
                type="checkbox"
                formControlName="acceptedTerms"
              >

              <span>
                Acepto los
                <a
                  routerLink="/legal/terminos"
                  target="_blank"
                >
                  términos y condiciones
                </a>,
                la política de privacidad y confirmo que revisé el precio total
                y despacho.
              </span>
            </label>

            @if (invalid('acceptedTerms')) {
              <p class="terms-error">
                Debes aceptar los términos para continuar.
              </p>
            }

            <label class="check">
              <input
                type="checkbox"
                formControlName="marketingConsent"
              >

              <span>
                Quiero recibir novedades y beneficios (opcional).
              </span>
            </label>

            @if (error()) {
              <div class="api-error" role="alert">
                <b>No pudimos iniciar el pago.</b>
                <span>{{ error() }}</span>
              </div>
            }

            <button
              class="button pay"
              type="submit"
              [disabled]="submitting()"
            >
              {{
                submitting()
                  ? 'Procesando…'
                  : pendingOrderId()
                    ? 'Reintentar pago'
                    : 'Pagar ' + format(cart.total())
              }}

              <app-icon name="arrow"/>
            </button>

            <p class="legal-note">
              Al finalizar recibirás la confirmación escrita del contrato por
              correo. Tienes derecho a retracto dentro de 10 días desde que
              recibes el producto, salvo las excepciones legales informadas.
            </p>
          </div>

          <aside>
            <h2>Resumen del pedido</h2>

            @for (line of cart.lines(); track line.id) {
              <article>
                <img
                  [src]="line.product.imageUrl"
                  [alt]="line.product.imageAlt"
                >

                <div>
                  <b>{{ line.product.name }}</b>

                  <span>
                    {{ line.color }} · {{ line.size }} · Cant.
                    {{ line.quantity }}
                  </span>
                </div>

                <strong>
                  {{ format(line.product.priceClp * line.quantity) }}
                </strong>
              </article>
            }

            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{{ format(cart.subtotal()) }}</dd>
              </div>

              <div>
                <dt>Despacho estándar</dt>
                <dd>{{ cart.shipping() ? '$4.990' : 'Gratis' }}</dd>
              </div>

              <div class="total">
                <dt>Total</dt>

                <dd>
                  {{ format(cart.total()) }}
                  <small>IVA incluido</small>
                </dd>
              </div>
            </dl>

            <div class="delivery">
              <b>Entrega estimada</b>
              <span>
                2–5 días hábiles después de la confirmación.
              </span>
            </div>
          </aside>
        </form>
      }
    </section>
  `,
  styleUrl: './checkout.page.scss'
})
export class CheckoutPage {
  readonly cart = inject(CartStore);

  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly router = inject(Router);

  readonly format = clp;
  readonly submitting = signal(false);
  readonly error = signal('');

  readonly regions = [
    'Arica y Parinacota',
    'Tarapacá',
    'Antofagasta',
    'Atacama',
    'Coquimbo',
    'Valparaíso',
    'Metropolitana de Santiago',
    'O’Higgins',
    'Maule',
    'Ñuble',
    'Biobío',
    'La Araucanía',
    'Los Ríos',
    'Los Lagos',
    'Aysén',
    'Magallanes'
  ];

  readonly pendingOrderId = signal(
    sessionStorage.getItem('trama_pending_order') ?? ''
  );

  private readonly paymentKey = signal(
    sessionStorage.getItem('trama_payment_key') ?? ''
  );

  readonly form = this.fb.nonNullable.group({
    firstName: [
      '',
      [
        Validators.required,
        Validators.maxLength(80)
      ]
    ],
    lastName: [
      '',
      [
        Validators.required,
        Validators.maxLength(80)
      ]
    ],
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(254)
      ]
    ],
    phone: [
      '',
      [
        Validators.required,
        Validators.pattern(/^\+?56\s?\d(?:[\s-]?\d){7,8}$/)
      ]
    ],
    region: [
      '',
      Validators.required
    ],
    commune: [
      '',
      Validators.required
    ],
    addressLine1: [
      '',
      Validators.required
    ],
    addressLine2: [''],
    instructions: [''],
    acceptedTerms: [
      false,
      Validators.requiredTrue
    ],
    marketingConsent: [false]
  });

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];

    return control.invalid && (
      control.touched ||
      this.submitting()
    );
  }

  submit(): void {
    if (this.pendingOrderId()) {
      this.startPayment(this.pendingOrderId());
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    const value = this.form.getRawValue();

    const address: ShippingAddress = {
      firstName: value.firstName,
      lastName: value.lastName,
      email: value.email,
      phone: value.phone,
      region: value.region,
      commune: value.commune,
      addressLine1: value.addressLine1,
      addressLine2: value.addressLine2,
      instructions: value.instructions
    };

    this.commerce.createOrder(
      address,
      value.acceptedTerms,
      value.marketingConsent,
      crypto.randomUUID()
    ).subscribe({
      next: order => {
        this.pendingOrderId.set(order.orderId);

        sessionStorage.setItem(
          'trama_pending_order',
          order.orderId
        );

        this.startPayment(order.orderId);
      },
      error: e => {
        if (
          e.status === 0 &&
          !this.cart.connected()
        ) {
          this.demoSuccess();
          return;
        }

        this.error.set(
          e.error?.detail ??
          'Revisa tu carrito y los datos de entrega antes de volver a intentar.'
        );

        this.submitting.set(false);
      }
    });
  }

  retryPayment(): void {
    const orderId = this.pendingOrderId();

    if (orderId) {
      this.startPayment(orderId);
    }
  }

  private startPayment(orderId: string): void {
    this.submitting.set(true);
    this.error.set('');

    let key = this.paymentKey();

    if (!key) {
      key = crypto.randomUUID();

      this.paymentKey.set(key);

      sessionStorage.setItem(
        'trama_payment_key',
        key
      );
    }

    this.commerce.createPayment(
      orderId,
      key
    ).subscribe({
      next: payment => {
        /*
         * No limpiamos el carrito aquí.
         * Primero se debe completar y confirmar el pago en Webpay.
         */
        this.redirect(payment);
      },
      error: e => {
        this.error.set(
          e.error?.detail ??
          'El pedido quedó reservado, pero Webpay no respondió. Reintenta el pago; no crearemos otra orden.'
        );

        this.submitting.set(false);
      }
    });
  }

  private redirect(payment: PaymentRedirect): void {
    if (!payment.redirectUrl || !payment.token) {
      console.error(
        'La respuesta de Webpay está incompleta:',
        payment
      );

      this.error.set(
        'Webpay no devolvió una dirección válida para continuar con el pago.'
      );

      this.submitting.set(false);
      return;
    }

    const form = document.createElement('form');

    form.method = 'POST';
    form.action = payment.redirectUrl;

    const input = document.createElement('input');

    input.type = 'hidden';
    input.name = 'token_ws';
    input.value = payment.token;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }

  private demoSuccess(): void {
    const demoOrder =
      `TS-${new Date().getFullYear()}-${Math.floor(
        100000 + Math.random() * 899999
      )}`;

    sessionStorage.setItem(
      'trama_demo_order',
      demoOrder
    );

    this.cart.clear();

    this.router.navigate(
      ['/pago/resultado'],
      {
        queryParams: {
          status: 'demo',
          order: demoOrder
        }
      }
    );
  }
}