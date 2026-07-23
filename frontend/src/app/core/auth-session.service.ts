import { Injectable, signal } from '@angular/core';

export interface AuthUser { id:string;firstName:string;lastName:string;email:string;roles:string[];twoFactorEnabled:boolean;mfaVerified:boolean }
export interface AuthPayload { accessToken:string;expiresAt:string;csrfToken:string;user:AuthUser }

@Injectable({providedIn:'root'})
export class AuthSessionService{
  private readonly accessTokenState=signal<string|null>(null);
  readonly user=signal<AuthPayload['user']|null>(null);
  readonly accessToken=this.accessTokenState.asReadonly();

  set(payload:AuthPayload):void{
    this.accessTokenState.set(payload.accessToken);
    this.user.set(payload.user);
    localStorage.setItem('trama_csrf',payload.csrfToken);
  }

  clear():void{
    this.accessTokenState.set(null);this.user.set(null);localStorage.removeItem('trama_csrf');
  }

  async restore():Promise<void>{
    const csrf=localStorage.getItem('trama_csrf');
    if(!csrf)return;
    try{
      const response=await fetch('/api/v1/auth/refresh',{method:'POST',credentials:'include',headers:{'X-CSRF-Token':csrf,'Content-Type':'application/json'}});
      if(!response.ok){this.clear();return}
      this.set(await response.json() as AuthPayload);
    }catch{this.clear()}
  }
}
