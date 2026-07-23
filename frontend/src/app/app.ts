import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';

import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router=inject(Router);
  private readonly http=inject(HttpClient);
  private readonly titleService=inject(Title);
  
  constructor() {
    this.http.get<Record<string, string>>('/api/v1/settings').subscribe({
      next: (settings) => {
        if (settings['darkMode'] === 'true') {
          document.body.classList.add('dark-theme');
        }
        if (settings['storeName']) {
          this.titleService.setTitle(settings['storeName']);
        }
        if (settings['storeLogo']) {
          (window as any).storeLogo = settings['storeLogo'];
        }
      }
    });
  }
  
  isAdminRoute():boolean{return this.router.url.startsWith('/admin')}
}
