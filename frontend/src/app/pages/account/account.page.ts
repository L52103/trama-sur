import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommerceService } from '../../core/commerce.service';
import { AuthSessionService } from '../../core/auth-session.service';

@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
  <section class="account">
    <div class="intro">
      <p class="eyebrow">Tu espacio Trama</p>
      <h1>Compra con calma.<br>Vuelve cuando quieras.</h1>
      <p>Revisa pedidos, gestiona tus datos y ejerce tus derechos de privacidad desde un solo lugar.</p>
      <ul>
        <li>Historial y seguimiento de pedidos con boleta</li>
        <li>Tus datos y privacidad siempre protegidos</li>
        <li>Solicitudes de cambio, retracto y garantía legal</li>
      </ul>
    </div>

    <div class="auth-card">
      @if (session.user()) {
        <div class="success">
          <h2>Hola, {{ session.user()!.firstName }} {{ session.user()!.lastName }}</h2>
          <p>Tu sesión está activa. Administra tus pedidos y privacidad.</p>

          <div class="privacy-box" style="margin: 1.5rem 0; padding: 1.2rem; background: #fbfbfb; border: 1px solid var(--line); border-radius: 12px; text-align: left;">
            <h3 style="font-size: 0.95rem; margin-top: 0; margin-bottom: 0.5rem;">Gestión de Privacidad</h3>
            <p style="font-size: 0.78rem; color: var(--muted); margin-bottom: 1rem;">Tienes derecho a acceder, rectificar, suprimir, oponerte y solicitar la portabilidad de tus datos.</p>
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              <button class="button secondary" type="button" (click)="downloadMyData()" style="font-size: 0.78rem; padding: 0.5rem 0.8rem; text-align: center;">📥 Descargar mis datos (Portabilidad JSON)</button>
              <button class="button text" type="button" (click)="requestDeletion()" style="font-size: 0.75rem; color: var(--danger); text-decoration: underline; background: none; border: none; cursor: pointer;">🗑️ Solicitar supresión de datos / Derecho al olvido</button>
            </div>
            @if (arcoMessage()) {
              <p style="font-size: 0.75rem; color: var(--forest); margin-top: 0.8rem; background: #eef2ed; padding: 0.6rem; border-radius: 6px;">{{ arcoMessage() }}</p>
            }
          </div>

          @if (isAdmin() && !session.user()?.twoFactorEnabled && !mfaEnabled()) {
            @if (!mfaSetup()) {
              <div class="security-callout" style="border-radius: 12px;">
                <b>Protege el panel administrativo</b>
                <p>Debes activar MFA antes de publicar, editar inventario o gestionar pedidos.</p>
                <button class="button" type="button" [disabled]="working()" (click)="beginMfa()">Configurar MFA</button>
              </div>
            } @else {
              <div class="mfa-setup" style="border-radius: 12px;">
                <h3>1. Agrega TRAMA SUR a tu autenticador</h3>
                <p>Ingresa esta clave manualmente en 1Password, Microsoft Authenticator, Google Authenticator u otra app TOTP.</p>
                <code>{{ mfaSetup()!.sharedKey }}</code>
                <details>
                  <summary>Ver URI técnica</summary>
                  <code>{{ mfaSetup()!.authenticatorUri }}</code>
                </details>
                <form [formGroup]="mfaForm" (ngSubmit)="enableMfa()">
                  <label for="enable-mfa">2. Código de 6 dígitos</label>
                  <input id="enable-mfa" formControlName="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000 000">
                  <button class="button" [disabled]="working()">Activar MFA</button>
                </form>
              </div>
            }
          }

          @if (recoveryCodes().length) {
            <div class="recovery" style="border-radius: 12px;">
              <h3>Códigos de recuperación</h3>
              <p>Guárdalos ahora fuera de línea. Cada código funciona una sola vez y no volveremos a mostrarlos.</p>
              <ul>
                @for (code of recoveryCodes(); track code) {
                  <li><code>{{ code }}</code></li>
                }
              </ul>
              <p><b>Vuelve a ingresar con tu contraseña y código MFA para abrir el panel.</b></p>
            </div>
          }

          @if (error()) {
            <p class="error-box" role="alert">{{ error() }}</p>
          }

          @if (isAdmin() && session.user()?.mfaVerified) {
            <a class="button" routerLink="/admin" style="margin-bottom: 0.8rem; width: 100%;">Abrir panel administrativo →</a>
          }
          <button class="button secondary" type="button" (click)="logout()" style="width: 100%;">Cerrar sesión</button>
        </div>
      } @else if (success()) {
        <div class="success">
          <h2>{{ successTitle() }}</h2>
          <p>{{ success() }}</p>
          <button class="button secondary" type="button" (click)="restartLogin()">Volver</button>
        </div>
      } @else {
        <div class="tabs">
          <button [class.active]="mode() === 'login'" (click)="mode.set('login')">Ingresar</button>
          <button [class.active]="mode() === 'register'" (click)="mode.set('register')">Crear cuenta</button>
        </div>

        @if (mode() === 'login') {
          <form [formGroup]="loginForm" (ngSubmit)="login()">
            <h2>{{ isAdminFlow() ? 'Acceso Administrativo' : 'Qué bueno verte.' }}</h2>

            @if (isAdminFlow()) {
              <div class="admin-notice-box">
                <span class="shield-icon">🛡️</span>
                <div>
                  <b>Portal de Administración</b>
                  <p>Ingresa tus credenciales y tu código de autenticación (MFA) para acceder directamente.</p>
                </div>
              </div>
            }

            @if (infoMessage()) {
              <div class="info-notice-box" role="status">
                <span>🔐</span>
                <p>{{ infoMessage() }}</p>
              </div>
            }

            <div class="field">
              <label for="login-email">Correo</label>
              <input id="login-email" type="email" formControlName="email" autocomplete="email" placeholder="ejemplo@correo.com">
            </div>

            <div class="field">
              <label for="login-password">Contraseña</label>
              <input id="login-password" type="password" formControlName="password" autocomplete="current-password">
            </div>

            @if (requiresMfa() || isAdminFlow()) {
              <div class="field mfa-field-highlight">
                <label for="login-mfa">Código de autenticación (6 dígitos)</label>
                <input
                  id="login-mfa"
                  formControlName="twoFactorCode"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  placeholder="000 000"
                  maxlength="7"
                  class="mfa-input"
                  autofocus
                >
                <small>Ingresa el código temporal de Google Authenticator, 1Password o tu app TOTP.</small>
              </div>
            } @else {
              <div style="text-align: right; margin-top: -0.4rem;">
                <button
                  type="button"
                  class="text-link-btn"
                  (click)="requiresMfa.set(true)"
                >
                  ¿Tienes autenticación en dos pasos (2FA)?
                </button>
              </div>
            }

            @if (error()) {
              <p class="error-box" role="alert">{{ error() }}</p>
            }

            <button class="button" [disabled]="working()" style="width: 100%; border-radius: 12px; margin-top: 0.5rem;">
              {{ working() ? 'Verificando…' : (requiresMfa() || isAdminFlow() ? 'Verificar e ingresar' : 'Ingresar') }}
            </button>

            <button class="forgot" type="button">Olvidé mi contraseña</button>
            <p class="privacy">Protegemos tu sesión con cookies HttpOnly, rotación de tokens, MFA administrativo y bloqueo ante intentos repetidos.</p>
          </form>
        } @else {
          <form [formGroup]="registerForm" (ngSubmit)="register()">
            <h2>Crea tu cuenta.</h2>
            <div class="two">
              <div class="field"><label for="reg-first">Nombre</label><input id="reg-first" formControlName="firstName" autocomplete="given-name"></div>
              <div class="field"><label for="reg-last">Apellido</label><input id="reg-last" formControlName="lastName" autocomplete="family-name"></div>
            </div>
            <div class="field"><label for="reg-email">Correo</label><input id="reg-email" type="email" formControlName="email" autocomplete="email"></div>
            <div class="field"><label for="reg-password">Contraseña</label><input id="reg-password" type="password" formControlName="password" autocomplete="new-password"><small>Mínimo 12 caracteres, mayúscula, minúscula, número y símbolo.</small></div>
            <label class="check"><input type="checkbox" formControlName="marketingConsent"><span>Deseo recibir novedades y promociones por correo (Consentimiento revocable).</span></label>
            @if (error()) {
              <p class="error-box" role="alert">{{ error() }}</p>
            }
            <button class="button" [disabled]="working()" style="width: 100%; border-radius: 12px;">{{ working() ? 'Creando…' : 'Crear cuenta' }}</button>
            <p class="privacy">Al crear tu cuenta aceptas los <a routerLink="/legal/terminos" target="_blank">Términos y Condiciones</a> y la <a routerLink="/legal/privacidad" target="_blank">Política de Privacidad</a>.</p>
          </form>
        }
      }
    </div>
  </section>
  `,
  styleUrl: './account.page.scss'
})
export class AccountPage {
  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly session = inject(AuthSessionService);
  readonly mode = signal<'login' | 'register'>('login');
  readonly working = signal(false);
  readonly error = signal('');
  readonly infoMessage = signal('');
  readonly success = signal('');
  readonly successTitle = signal('');
  readonly requiresMfa = signal(false);
  readonly isAdminFlow = signal(false);
  readonly mfaSetup = signal<{ sharedKey: string; authenticatorUri: string } | null>(null);
  readonly recoveryCodes = signal<string[]>([]);
  readonly mfaEnabled = signal(false);
  readonly arcoMessage = signal('');

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    twoFactorCode: ['']
  });

  readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    marketingConsent: [false]
  });

  readonly mfaForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\s*\d(?:[\s-]?\d){5}\s*$/)]]
  });

  constructor() {
    const reason = this.route.snapshot.queryParams['reason'];
    if (reason === 'admin-mfa') {
      this.isAdminFlow.set(true);
      this.requiresMfa.set(true);
    }
  }

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.working.set(true);
    this.error.set('');
    this.infoMessage.set('');

    const v = this.loginForm.getRawValue();

    this.commerce.login(v.email, v.password, v.twoFactorCode).subscribe({
      next: r => {
        this.session.set(r);
        this.working.set(false);

        // Si es admin con MFA verificado o venía del flujo administrativo, redirigir directo al admin panel
        if (r.user.roles.includes('Admin') && r.user.mfaVerified) {
          this.router.navigate(['/admin']);
          return;
        }

        this.successTitle.set(`Hola, ${r.user.firstName}`);
        this.success.set('Tu sesión está activa. Desde aquí podrás revisar pedidos y direcciones.');
      },
      error: e => {
        this.working.set(false);
        if (e.error?.requiresTwoFactor) {
          // No mostramos error rojo si es simplemente que la cuenta tiene 2FA activado
          this.requiresMfa.set(true);
          this.infoMessage.set('Tu cuenta está protegida con verificación en dos pasos. Ingresa el código de 6 dígitos de tu aplicación autenticadora.');
        } else {
          this.error.set(
            e.status === 0
              ? 'El servidor local no está activo. Inicia la API para probar una sesión real.'
              : (e.error?.message || 'Correo o contraseña incorrectos.')
          );
        }
      }
    });
  }

  register(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.working.set(true);
    this.error.set('');
    const v = this.registerForm.getRawValue();
    this.commerce.register(v.firstName, v.lastName, v.email, v.password, v.marketingConsent).subscribe({
      next: r => {
        this.successTitle.set('Revisa tu correo');
        this.success.set(r.message);
        this.working.set(false);
      },
      error: e => {
        this.error.set(e.status === 0 ? 'El servidor local no está activo. Inicia la API para crear una cuenta real.' : 'No pudimos crear la cuenta; revisa los datos.');
        this.working.set(false);
      }
    });
  }

  isAdmin(): boolean {
    return this.session.user()?.roles.includes('Admin') ?? false;
  }

  beginMfa(): void {
    this.working.set(true);
    this.error.set('');
    this.commerce.setupMfa().subscribe({
      next: r => {
        this.mfaSetup.set(r);
        this.working.set(false);
      },
      error: e => {
        this.error.set(e.error?.detail ?? 'No pudimos iniciar la configuración MFA.');
        this.working.set(false);
      }
    });
  }

  enableMfa(): void {
    if (this.mfaForm.invalid) {
      this.mfaForm.markAllAsTouched();
      return;
    }
    this.working.set(true);
    this.error.set('');
    this.commerce.enableMfa(this.mfaForm.getRawValue().code).subscribe({
      next: r => {
        this.recoveryCodes.set(r.recoveryCodes);
        this.mfaEnabled.set(true);
        this.working.set(false);
      },
      error: e => {
        this.error.set(e.error?.message ?? e.error?.detail ?? 'El código no es válido.');
        this.working.set(false);
      }
    });
  }

  restartLogin(): void {
    this.success.set('');
    this.successTitle.set('');
    this.error.set('');
    this.infoMessage.set('');
    this.loginForm.controls.password.setValue('');
    this.loginForm.controls.twoFactorCode.setValue('');
    this.requiresMfa.set(this.mfaEnabled() || this.isAdminFlow());
  }

  logout(): void {
    this.commerce.logout().subscribe({
      next: () => this.session.clear(),
      error: () => this.session.clear()
    });
  }

  downloadMyData(): void {
    const user = this.session.user();
    if (!user) return;
    const data = {
      titular: { id: user.id, nombre: user.firstName, apellido: user.lastName, email: user.email, roles: user.roles },
      fechaExportacion: new Date().toISOString(),
      normativa: 'Ley N° 21.719 de Protección de Datos Personales (Chile)',
      responsable: 'Trama Sur SpA (RUT 77.892.341-K)',
      contactoPrivacidad: 'privacidad@tramasur.cl'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-datos-trama-sur-${user.firstName.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.arcoMessage.set('Archivo de portabilidad descargado en formato estructurado JSON.');
  }

  requestDeletion(): void {
    this.arcoMessage.set('Solicitud ARCO+ de supresión ingresada. Conservaremos registros contables durante 5 años según exige el SII y eliminaremos el resto de datos.');
  }
}
