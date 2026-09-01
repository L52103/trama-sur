import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface LegalContent {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
}

const common = { updated: 'Septiembre de 2026' };

const CONTENT: Record<string, LegalContent> = {
  terminos: {
    ...common,
    title: 'Términos y Condiciones de Uso y Compra',
    intro: 'Estas condiciones regulan el acceso, uso y las compras realizadas en la tienda en línea de Trama Sur en Chile, en estricto cumplimiento con la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores y el Reglamento de Comercio Electrónico (D.S. N° 6 del Ministerio de Economía).',
    sections: [
      {
        heading: '1. Identificación del Proveedor y Canales de Contacto',
        paragraphs: [
          'Razón Social: Trama Sur SpA.',
          'RUT: 77.892.341-K.',
          'Domicilio legal: Av. Providencia 1208, Of. 601, Santiago, Región Metropolitana, Chile.',
          'Canales de atención oficial: Correo electrónico ayuda@tramasur.cl | Teléfono / WhatsApp: +56 9 8765 4321.',
          'Horario de atención al cliente: Lunes a viernes de 09:00 a 18:00 hrs (días hábiles). Tiempo máximo de respuesta: 24 horas hábiles.'
        ]
      },
      {
        heading: '2. Formación del Consentimiento y Proceso de Compra',
        paragraphs: [
          'La exhibición de productos en nuestro catálogo constituye una oferta vinculante sujeta a disponibilidad efectiva de inventario.',
          'El contrato de compraventa a distancia se perfecciona en el momento en que el pago es debidamente autorizado por la pasarela de pago y Trama Sur envía de forma automática el correo electrónico de confirmación de compra junto al comprobante y detalle del pedido.',
          'Antes del pago final, el consumidor cuenta con una pantalla de resumen donde se exhiben claramente las características esenciales del producto, la talla seleccionada, el precio unitario, el IVA (19%) desglosado, el costo exacto del despacho y el plazo estimado de entrega.'
        ]
      },
      {
        heading: '3. Precios, Moneda y Emisión Tributaria (SII)',
        paragraphs: [
          'Todos los precios publicados en el sitio están expresados en pesos chilenos (CLP) e incluyen el Impuesto al Valor Agregado (IVA del 19%).',
          'Trama Sur emite automáticamente una Boleta Electrónica de Ventas y Servicios autorizada por el Servicio de Impuestos Internos (SII) por cada transacción exitosa, la cual es enviada directamente al correo electrónico registrado por el comprador.'
        ]
      },
      {
        heading: '4. Pasarelas de Pago y Seguridad Financiera (PCI-DSS)',
        paragraphs: [
          'Los pagos son procesados exclusivamente a través de plataformas de pago certificadas bajo estándares internacionales PCI-DSS (Transbank Webpay Plus, tarjetas de crédito, débito y prepago nacionales).',
          'Trama Sur nunca almacena, captura ni tiene acceso a los números completos de tarjeta de crédito/débito, fechas de vencimiento ni códigos de seguridad CVV/CVC. Todo el procesamiento financiero es 100% delegado en servidores seguros bancarios.'
        ]
      },
      {
        heading: '5. Solución de Controversias y Jurisdicción',
        paragraphs: [
          'Ante cualquier disconformidad, el cliente podrá acudir a nuestros canales de atención directa o presentar un reclamo ante el Servicio Nacional del Consumidor (SERNAC).',
          'Cualquier controversia se someterá a la jurisdicción de los Tribunales Ordinarios de Justicia de Chile de acuerdo a la Ley del Consumidor.'
        ]
      }
    ]
  },
  privacidad: {
    ...common,
    title: 'Política de Privacidad y Tratamiento de Datos Personales',
    intro: 'Trama Sur SpA protege tus datos personales en estricto cumplimiento con la Ley N° 21.719 sobre Protección de la Vida Privada y Tratamiento de Datos Personales en Chile. A continuación te explicamos qué datos tratamos, con qué bases de licitud y cómo ejercer tus derechos ARCO+.',
    sections: [
      {
        heading: '1. Identidad del Responsable del Tratamiento',
        paragraphs: [
          'Responsable: Trama Sur SpA (RUT 77.892.341-K).',
          'Domicilio: Av. Providencia 1208, Of. 601, Santiago, Chile.',
          'Correo exclusivo del Oficial de Privacidad: privacidad@tramasur.cl.'
        ]
      },
      {
        heading: '2. Datos Recopilados y Finalidades del Tratamiento',
        paragraphs: [
          'Recopilamos: Nombre, apellidos, RUT, correo electrónico, teléfono de contacto y dirección de despacho.',
          'Finalidades principales: Procesar tus pedidos, gestionar los envíos a domicilio, emitir boletas electrónicas legales ante el SII y brindarte servicio posventa.',
          'Finalidades de marketing: Envío de ofertas, guías de estilo y novedades, únicamente cuando el usuario haya otorgado su consentimiento expreso mediante la casilla desmarcada por defecto en el checkout o registro.'
        ]
      },
      {
        heading: '3. Bases de Licitud para el Tratamiento',
        paragraphs: [
          'Ejecución del contrato de compraventa (Art. Ley 21.719): Necesaria para procesar el pedido, despachar la mercadería y cobrar.',
          'Cumplimiento de obligación legal tributaria: Emisión de boletas electrónicas y conservación de registros contables exigidos por el Servicio de Impuestos Internos (SII).',
          'Consentimiento libre, previo, expreso e informado: Para el envío de boletines de marketing o promociones (revocable en cualquier momento sin costo).'
        ]
      },
      {
        heading: '4. Transferencias Internacionales y Almacenamiento Seguro',
        paragraphs: [
          'Tus datos son almacenados en infraestructura cloud con cifrado en tránsito (TLS 1.3) y en reposo (AES-256), aplicando estrictos controles de acceso por rol y auditoría.',
          'Los datos se alojan en centros de datos que cumplen con estándares internacionales de seguridad de la industria y la normativa de la Agencia de Protección de Datos Personales (APDP).'
        ]
      },
      {
        heading: '5. Tiempos de Conservación de Datos',
        paragraphs: [
          'Datos de transacciones y compras: Conservados durante 5 años conforme a las obligaciones de respaldo tributario y prescripción legal del SII.',
          'Datos de marketing: Eliminados o bloqueados inmediatamente tras la revocación del consentimiento del usuario.',
          'Datos de navegación y cookies: Conservados según los plazos de expiración definidos en la Política de Cookies (máximo 12 meses).'
        ]
      },
      {
        heading: '6. Derechos ARCO+ y Canal de Ejercicio',
        paragraphs: [
          'De acuerdo con la Ley N° 21.719, como titular de los datos tienes derecho a: Acceso (conocer qué datos tenemos), Rectificación (corregir datos erróneos), Supresión / Derecho al Olvido (eliminar tus datos cuando no exista obligación legal de conservarlos), Oposición (oponerte a tratamientos específicos) y Portabilidad (descargar tus datos en formato JSON).',
          'Puedes ejercer cualquiera de estos derechos enviando un correo a privacidad@tramasur.cl o utilizando el formulario interactivo al pie de esta página.'
        ]
      },
      {
        heading: '7. Protocolo de Incidentes y Brechas de Seguridad',
        paragraphs: [
          'Ante cualquier evento de vulneración de seguridad o acceso no autorizado, Trama Sur tiene la obligación legal de documentar y notificar a la Agencia de Protección de Datos Personales (APDP) y a los titulares afectados dentro de los plazos establecidos por ley.'
        ]
      }
    ]
  },
  retracto: {
    ...common,
    title: 'Derecho a Retracto en Compras Online (Ley N° 19.496)',
    intro: 'En compras celebradas a distancia a través de nuestro sitio web, la Ley del Consumidor te otorga el derecho irrenunciable a retractarte de tu compra sin expresión de causa.',
    sections: [
      {
        heading: '1. Plazo Legal de Retracto (10 Días Corridos)',
        paragraphs: [
          'Tienes 10 días corridos contados desde la fecha de recepción física del producto en tu domicilio para poner término unilateral al contrato.',
          'Si la confirmación escrita exigida por el D.S. N° 6 no hubiese sido debidamente enviada, el plazo de retracto se extiende a 90 días conforme a la ley.'
        ]
      },
      {
        heading: '2. Condiciones y Procedimiento',
        paragraphs: [
          'El producto debe restituirse en buen estado, con sus etiquetas originales y embalaje correspondiente.',
          'Para ejercer el retracto, escríbenos a ayuda@tramasur.cl con tu número de pedido o boleta indicando tu voluntad de retracto. Te entregaremos una etiqueta o instrucciones de retiro sin demoras indebidas.'
        ]
      },
      {
        heading: '3. Reembolso Total e Inmediato',
        paragraphs: [
          'Una vez recibido el producto en bodega y verificado su estado, se procederá a la devolución íntegra de todas las sumas pagadas (incluyendo el costo del producto y el costo de despacho original) en un plazo no superior a 5 días hábiles a través del mismo medio de pago utilizado.'
        ]
      }
    ]
  },
  garantia: {
    ...common,
    title: 'Garantía Legal de 6 Meses (Triple Opción SERNAC)',
    intro: 'Todos los productos adquiridos en Trama Sur cuentan con la Garantía Legal de 6 meses establecida en el artículo 20 de la Ley N° 19.496.',
    sections: [
      {
        heading: '1. Cobertura de 6 Meses y la Triple Opción del Consumidor',
        paragraphs: [
          'Si una prenda presenta defectos de fábrica, fallas en costuras, cierres rotos, decoloración prematura o no es apta para su uso habitual, tienes derecho legal a exigir durante los primeros 6 meses contados desde la recepción:',
          'Opción 1: Devolución íntegra del dinero pagado.',
          'Opción 2: Cambio inmediato por un producto nuevo idéntico o de similar valor.',
          'Opción 3: Reparación gratuita de la prenda.',
          'La elección entre estas tres opciones es un derecho exclusivo del consumidor y no del vendedor.'
        ]
      },
      {
        heading: '2. Procedimiento sin Burocracia ni Letra Chica',
        paragraphs: [
          'Para hacer efectiva la garantía legal, sólo debes presentar la boleta electrónica, comprobante de transferencia o número de orden.',
          'No te derivaremos a intermediarios ni fabricantes externos: gestionamos tu requerimiento de forma directa y trazable.'
        ]
      }
    ]
  },
  'cambios-devoluciones': {
    ...common,
    title: 'Política Voluntaria de Cambios (30 Días de Satisfacción)',
    intro: 'Además de tus derechos legales de Retracto (10 días) y Garantía Legal (6 meses), en Trama Sur te ofrecemos una política comercial de satisfacción garantizada para cambios de talla o modelo.',
    sections: [
      {
        heading: '1. Política Comercial de 30 Días para Cambios de Talla',
        paragraphs: [
          'Si la talla o el color no te acomodan, puedes solicitar un cambio voluntario dentro de 30 días corridos desde la entrega.',
          'La prenda debe encontrarse sin uso, sin lavado y con sus etiquetas intactas.',
          'Esta política voluntaria complementa y en ningún caso restringe tu derecho legal a retracto de 10 días ni tu garantía de 6 meses.'
        ]
      },
      {
        heading: '2. ¿Cómo solicitar un cambio?',
        paragraphs: [
          'Ingresa a tu cuenta o escríbenos a ayuda@tramasur.cl con tu número de pedido y la talla deseada. Coordinaremos el cambio de forma ágil.'
        ]
      }
    ]
  },
  despachos: {
    ...common,
    title: 'Política de Despachos, Envíos y Tiempos de Entrega',
    intro: 'Realizamos despachos a todas las comunas de Chile mediante operadores logísticos certificados con número de seguimiento en tiempo real.',
    sections: [
      {
        heading: '1. Plazos Máximos de Entrega según Región',
        paragraphs: [
          'Región Metropolitana de Santiago: 1 a 2 días hábiles.',
          'Regiones de Valparaíso, O’Higgins, Maule, Biobío, Ñuble, La Araucanía, Los Ríos y Los Lagos: 2 a 4 días hábiles.',
          'Regiones de Arica y Parinacota, Tarapacá, Antofagasta, Atacama, Coquimbo, Aysén y Magallanes: 4 a 7 días hábiles.',
          'Los plazos son informados de manera clara y desglosada antes de que el cliente realice el pago.'
        ]
      },
      {
        heading: '2. Costo del Despacho y Envío Gratuito',
        paragraphs: [
          'El despacho estándar tiene un costo de $4.990 en la mayor parte del territorio nacional.',
          'El despacho es 100% Gratuito en todas las compras superiores a $79.990 CLP.'
        ]
      },
      {
        heading: '3. Trazabilidad y Notificaciones',
        paragraphs: [
          'Una vez entregado el paquete al operador logístico, enviamos automáticamente a tu correo el número de seguimiento (tracking) con enlace directo para revisar el estado del trayecto.'
        ]
      }
    ]
  },
  cookies: {
    ...common,
    title: 'Política de Cookies y Preferencias de Privacidad',
    intro: 'Te explicamos qué son las cookies, qué tipos usamos y cómo puedes gestionar tus preferencias en cualquier momento según la Ley 21.719.',
    sections: [
      {
        heading: '1. Cookies Técnicas y Esenciales (Obligatorias)',
        paragraphs: [
          'Permiten el funcionamiento del carrito de compras, la protección de la sesión de usuario, la prevención de ataques CSRF y la navegación segura.',
          'No pueden ser desactivadas porque la tienda no podría operar sin ellas.'
        ]
      },
      {
        heading: '2. Cookies Analíticas y de Medición (Opcionales)',
        paragraphs: [
          'Nos permiten medir de forma anónima y agregada el rendimiento del sitio web para optimizar los tiempos de carga y mejorar el catálogo.',
          'Solo se activan si otorgas tu consentimiento voluntario en el banner inicial.'
        ]
      },
      {
        heading: '3. Panel de Configuración de Consentimiento',
        paragraphs: [
          'Puedes modificar tu elección en cualquier momento haciendo clic en el botón de configuración de cookies disponible en este sitio.'
        ]
      }
    ]
  },
  'guia-tallas': {
    ...common,
    title: 'Guía Oficial de Tallas y Medidas Corporales',
    intro: 'Para asegurar un calce perfecto y reducir devoluciones de vestuario (SERNAC / Ley 19.496), te recomendamos comparar tus medidas con nuestra tabla oficial expresada en centímetros.',
    sections: [
      {
        heading: '1. Tabla de Medidas Generales (Prendas Superiores e Inferiores)',
        paragraphs: [
          'Talla XS: Pecho 84-88 cm | Cintura 66-70 cm | Cadera 90-94 cm | Largo 66 cm',
          'Talla S: Pecho 88-94 cm | Cintura 70-76 cm | Cadera 94-98 cm | Largo 68 cm',
          'Talla M: Pecho 94-102 cm | Cintura 76-84 cm | Cadera 98-104 cm | Largo 71 cm',
          'Talla L: Pecho 102-110 cm | Cintura 84-92 cm | Cadera 104-112 cm | Largo 74 cm',
          'Talla XL: Pecho 110-118 cm | Cintura 92-100 cm | Cadera 112-120 cm | Largo 76 cm'
        ]
      },
      {
        heading: '2. Consejos para Medirte en Casa',
        paragraphs: [
          'Mide una prenda tuya que te quede cómoda extendida sobre una mesa lisa.',
          'Pecho: Mide el ancho de axila a axila y multiplica por 2.',
          'Cintura: Mide la parte más estrecha del torso.',
          'Si estás entre dos tallas, te recomendamos elegir la talla mayor para mayor holgura.'
        ]
      }
    ]
  },
  ayuda: {
    ...common,
    title: 'Centro de Ayuda, Soporte y Contacto Legal',
    intro: 'Estamos a tu disposición para responder dudas sobre compras, despachos, cambios, garantías o privacidad con atención humana y plazos definidos.',
    sections: [
      {
        heading: '1. Canales de Atención al Cliente',
        paragraphs: [
          'Correo de Soporte y Pedidos: ayuda@tramasur.cl',
          'Correo de Oficial de Privacidad y Derechos ARCO+: privacidad@tramasur.cl',
          'WhatsApp y Teléfono Oficial: +56 9 8765 4321',
          'Horario de Atención: Lunes a viernes de 09:00 a 18:00 hrs (días hábiles).',
          'SLA de respuesta garantizado: Menos de 24 horas hábiles.'
        ]
      },
      {
        heading: '2. Datos de la Empresa (SERNAC / Ley 19.496)',
        paragraphs: [
          'Razón Social: Trama Sur SpA',
          'RUT: 77.892.341-K',
          'Dirección Comercial: Av. Providencia 1208, Of. 601, Santiago, Chile',
          'Actividad Económica: Venta al por menor por internet de prendas de vestir y accesorios.'
        ]
      }
    ]
  }
};

@Component({
  selector: 'app-legal-page',
  imports: [RouterLink, FormsModule],
  template: `
    @if (content(); as page) {
      <section class="legal container">
        <aside class="legal-sidebar">
          <nav aria-label="Menú de documentos legales">
            <a routerLink="/legal/terminos" routerLinkActive="active">Términos y Condiciones</a>
            <a routerLink="/legal/privacidad" routerLinkActive="active">Política de Privacidad</a>
            <a routerLink="/legal/retracto" routerLinkActive="active">Derecho a Retracto (10 días)</a>
            <a routerLink="/legal/garantia" routerLinkActive="active">Garantía Legal (6 meses)</a>
            <a routerLink="/legal/cambios-devoluciones" routerLinkActive="active">Cambios y Devoluciones</a>
            <a routerLink="/legal/despachos" routerLinkActive="active">Despachos y Entregas</a>
            <a routerLink="/legal/cookies" routerLinkActive="active">Política de Cookies</a>
            <a routerLink="/legal/guia-tallas" routerLinkActive="active">Guía de Tallas</a>
            <a routerLink="/legal/ayuda" routerLinkActive="active">Contacto y Ayuda</a>
          </nav>
        </aside>

        <article class="legal-article">
          <div class="article-header">
            <span class="compliance-badge">Cumplimiento Legal Chile</span>
            <h1>{{ page.title }}</h1>
            <p class="updated">Última actualización: {{ page.updated }} · Conforme a la legislación vigente y D.S. N° 6</p>
            <p class="lead">{{ page.intro }}</p>
          </div>

          @for (section of page.sections; track section.heading) {
            <section class="legal-section">
              <h2>{{ section.heading }}</h2>
              @for (paragraph of section.paragraphs; track paragraph) {
                <p>{{ paragraph }}</p>
              }
            </section>
          }

          @if (currentSlug() === 'cookies') {
            <div class="cookie-trigger-card" style="margin: 2rem 0; padding: 1.5rem; background: var(--mist); border-radius: 8px;">
              <h3>Gestionar preferencias de Cookies</h3>
              <p>Puedes cambiar o retirar tu consentimiento para cookies analíticas y de marketing en cualquier momento.</p>
              <button class="button primary" type="button" (click)="openCookieManager()">Abrir gestor de preferencias de cookies</button>
            </div>
          }

          @if (currentSlug() === 'privacidad') {
            <div class="arco-form-card" style="margin: 2.5rem 0; padding: 1.5rem; background: #fafafa; border: 1px solid var(--line); border-radius: 8px;">
              <h3>Canal de Ejercicio de Derechos ARCO</h3>
              <p style="font-size: 0.85rem; color: var(--muted);">Envía tu solicitud formal de Acceso, Rectificación, Supresión, Oposición o Portabilidad. Responderemos a tu correo en un plazo máximo de 10 días hábiles.</p>
              
              @if (arcoSubmitted()) {
                <div style="padding: 1rem; background: #eef2ed; border-radius: 6px; color: var(--forest); font-size: 0.88rem;">
                  <b>✓ Solicitud recibida con éxito.</b> Se ha generado el comprobante de atención para el correo {{ arcoEmail }}. El Oficial de Privacidad responderá en el plazo legal establecido.
                </div>
              } @else {
                <form (ngSubmit)="submitArco()" style="display: grid; gap: 0.8rem; margin-top: 1rem;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                    <div>
                      <label style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem;">Nombre completo</label>
                      <input type="text" [(ngModel)]="arcoName" name="arcoName" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--line); border-radius: 4px;">
                    </div>
                    <div>
                      <label style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem;">RUT del titular</label>
                      <input type="text" [(ngModel)]="arcoRut" name="arcoRut" placeholder="12.345.678-9" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--line); border-radius: 4px;">
                    </div>
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem;">Correo electrónico de contacto</label>
                    <input type="email" [(ngModel)]="arcoEmail" name="arcoEmail" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--line); border-radius: 4px;">
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem;">Tipo de derecho que deseas ejercer</label>
                    <select [(ngModel)]="arcoType" name="arcoType" style="width: 100%; padding: 0.6rem; border: 1px solid var(--line); border-radius: 4px; background: #fff;">
                      <option value="acceso">Acceso (Conocer qué datos personales tratamos)</option>
                      <option value="rectificacion">Rectificación (Actualizar o corregir datos inexactos)</option>
                      <option value="supresion">Supresión / Derecho al Olvido (Eliminación de datos)</option>
                      <option value="oposicion">Oposición (Revocar consentimiento de marketing o finalidades)</option>
                      <option value="portabilidad">Portabilidad (Solicitar copia estructurada en JSON)</option>
                    </select>
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem;">Detalle de tu solicitud</label>
                    <textarea [(ngModel)]="arcoDetail" name="arcoDetail" rows="3" placeholder="Describe brevemente los antecedentes de tu solicitud…" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--line); border-radius: 4px;"></textarea>
                  </div>
                  <button class="button primary" type="submit" style="justify-self: start; padding: 0.65rem 1.5rem; font-size: 0.85rem;">Enviar solicitud ARCO+</button>
                </form>
              }
            </div>
          }

          <div class="company-footer-card" style="margin-top: 3rem; padding: 1.2rem; background: var(--mist); border-radius: 6px; font-size: 0.76rem; color: var(--muted); line-height: 1.5;">
            <b>TRAMA SUR SpA</b> · RUT 77.892.341-K · Av. Providencia 1208, Of. 601, Santiago, Chile.<br>
            Contacto general: <a href="mailto:ayuda@tramasur.cl">ayuda@tramasur.cl</a> · Privacidad: <a href="mailto:privacidad@tramasur.cl">privacidad@tramasur.cl</a> · Tel: +56 9 8765 4321.
          </div>
        </article>
      </section>
    }
  `,
  styleUrl: './legal.page.scss'
})
export class LegalPage {
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly content = signal<LegalContent>(CONTENT['terminos']);
  readonly currentSlug = signal<string>('terminos');

  arcoName = '';
  arcoRut = '';
  arcoEmail = '';
  arcoType = 'acceso';
  arcoDetail = '';
  arcoSubmitted = signal(false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(p => {
      const slug = p.get('slug') ?? 'terminos';
      this.currentSlug.set(slug);
      this.content.set(CONTENT[slug] ?? CONTENT['terminos']);
    });
  }

  openCookieManager(): void {
    window.dispatchEvent(new Event('trama:open-cookie-settings'));
  }

  submitArco(): void {
    if (!this.arcoName || !this.arcoEmail || !this.arcoRut) return;
    this.arcoSubmitted.set(true);
  }
}

