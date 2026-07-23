import { Component, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  template: `
    @switch (name()) {
      @case ('menu') { <svg viewBox="0 0 24 24"><path d="M3 7h18M3 17h18"/></svg> }
      @case ('search') { <svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg> }
      @case ('user') { <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.2 3.3-6.3 7.5-6.3s6.7 2.1 7.5 6.3"/></svg> }
      @case ('bag') { <svg viewBox="0 0 24 24"><path d="M4 8h16l-1 13H5L4 8Z"/><path d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9"/></svg> }
      @case ('heart') { <svg viewBox="0 0 24 24"><path d="M20.8 5.8c-2-2-5.1-2-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/></svg> }
      @case ('chevron') { <svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg> }
      @case ('arrow') { <svg viewBox="0 0 24 24"><path d="M4 12h15M14 6l6 6-6 6"/></svg> }
      @case ('close') { <svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg> }
      @case ('plus') { <svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg> }
      @case ('minus') { <svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg> }
      @case ('check') { <svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg> }
    }
  `,
  styles: [`:host{display:inline-flex;width:1.25rem;height:1.25rem}svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}`]
})
export class IconComponent { readonly name = input.required<string>(); }

