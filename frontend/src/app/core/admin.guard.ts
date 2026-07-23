import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

export const adminGuard:CanActivateFn=()=>{
  const user=inject(AuthSessionService).user();
  return user?.roles.includes('Admin')&&user.mfaVerified
    ? true
    : inject(Router).createUrlTree(['/cuenta'],{queryParams:{reason:'admin-mfa'}});
};
