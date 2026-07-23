import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface HomeContent{
  announcement:string;
  hero:{eyebrow:string;title:string;accent:string;description:string;ctaLabel:string};
  featured:{eyebrow:string;heading:string};
  story:{eyebrow:string;heading:string;description:string};
}

export const DEFAULT_HOME_CONTENT:HomeContent={announcement:'Despacho gratis desde $79.990 · Cambios simples por 30 días',hero:{eyebrow:'Colección invierno 2026',title:'Hecha para',accent:'seguir tu ritmo.',description:'Ropa funcional para días que no caben en una sola categoría.',ctaLabel:'Ver colección'},featured:{eyebrow:'Selección Trama',heading:'Esenciales funcionales'},story:{eyebrow:'Diseño con propósito',heading:'Función que se ve bien. Calidad que se siente.',description:'Elegimos tejidos, cortes y detalles que resuelven fricción real: cambios de clima, trayectos largos y prendas que deben durar.'}};

@Injectable({providedIn:'root'})
export class ContentService{
  private readonly http=inject(HttpClient);
  home():Observable<HomeContent>{return this.http.get<HomeContent>('/api/v1/content/home')}
  draft(){return this.http.get<{pageId?:string;draft?:{id:string;contentJson:string;versionNumber:number}}>('/api/v1/admin/pages/home/draft')}
  saveDraft(content:HomeContent){return this.http.put<{pageId:string;versionId:string;versionNumber:number}>('/api/v1/admin/pages/home/draft',{content})}
  publish(versionId:string,note:string){return this.http.post('/api/v1/admin/pages/home/publish',{versionId,note})}
}
