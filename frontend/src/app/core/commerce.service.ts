import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthPayload } from './auth-session.service';
import { ShippingAddress } from './models';

export interface OrderCreated {
  orderId: string;
  orderNumber: string;
  totalClp: number;
  currency: string;
  paymentStatus: string;
}

export interface PaymentRedirect {
  paymentId: string;
  token: string;
  redirectUrl: string;
  amountClp: number;
}

@Injectable({
  providedIn: 'root'
})
export class CommerceService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/v1';

  createOrder(
    address: ShippingAddress,
    acceptedTerms: boolean,
    marketingConsent: boolean,
    idempotencyKey: string
  ): Observable<OrderCreated> {
    return this.http.post<OrderCreated>(
      `${this.api}/checkout/create-order`,
      {
        shippingAddress: address,
        couponCode: null,
        acceptedTerms,
        marketingConsent,
        idempotencyKey
      },
      {
        withCredentials: true
      }
    );
  }

  createPayment(
    orderId: string,
    idempotencyKey: string
  ): Observable<PaymentRedirect> {
    return this.http.post<PaymentRedirect>(
      `${this.api}/payments/webpay/create`,
      {
        orderId,
        idempotencyKey
      },
      {
        headers: new HttpHeaders({
          'Idempotency-Key': idempotencyKey
        }),
        withCredentials: true
      }
    );
  }

  login(
    email: string,
    password: string,
    twoFactorCode?: string
  ): Observable<AuthPayload> {
    return this.http.post<AuthPayload>(
      `${this.api}/auth/login`,
      {
        email,
        password,
        twoFactorCode: twoFactorCode || null
      },
      {
        withCredentials: true
      }
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.api}/auth/logout`,
      {},
      { withCredentials: true }
    );
  }

  register(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    marketingConsent: boolean
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/auth/register`,
      {
        firstName,
        lastName,
        email,
        password,
        marketingConsent
      },
      {
        withCredentials: true
      }
    );
  }

  setupMfa(): Observable<{
    sharedKey: string;
    authenticatorUri: string;
  }> {
    return this.http.post<{
      sharedKey: string;
      authenticatorUri: string;
    }>(
      `${this.api}/auth/mfa/setup`,
      {}
    );
  }

  enableMfa(
    code: string
  ): Observable<{
    message: string;
    recoveryCodes: string[];
  }> {
    return this.http.post<{
      message: string;
      recoveryCodes: string[];
    }>(
      `${this.api}/auth/mfa/enable`,
      {
        code
      }
    );
  }
}