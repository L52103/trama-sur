import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthSessionService } from './auth-session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthSessionService).accessToken();
  const csrf = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('trama_csrf') : null;
  const headers:Record<string,string>={};
  if(token)headers['Authorization']=`Bearer ${token}`;
  if(csrf&&(request.url.endsWith('/auth/refresh')||request.url.endsWith('/auth/logout')))headers['X-CSRF-Token']=csrf;
  const secured = request.clone({ setHeaders:headers, withCredentials:true });
  return next(secured);
};
