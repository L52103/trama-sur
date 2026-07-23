import { Component, ElementRef, Input, OnInit, OnDestroy, ViewChild, signal } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-product-3d-viewer',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="viewer-container" (mousedown)="onPointerDown($event)" (mousemove)="onPointerMove($event)" (mouseup)="onPointerUp()" (mouseleave)="onPointerUp()" (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)" (touchend)="onPointerUp()">
      <canvas #canvasRef></canvas>
      
      <div class="controls-overlay">
        <div class="badge-3d"><app-icon name="plus"/> VISTA 360° INTERACTIVA</div>
        <div class="hint">Arrastra para rotar · Rueda para zoom</div>
        <div class="actions">
          <button type="button" (click)="resetView()" title="Restablecer vista">↺ Centrar</button>
          <button type="button" (click)="toggleAutoRotate()" [class.active]="autoRotate()">{{autoRotate() ? '⏸ Pausar' : '▶ Rotar'}}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .viewer-container {
      position: relative;
      width: 100%;
      height: 480px;
      background: radial-gradient(circle at center, #fbfbf9 0%, #ecece6 100%);
      border-radius: 4px;
      overflow: hidden;
      cursor: grab;
      user-select: none;
      border: 1px solid var(--line, #e2e2dc);
    }
    .viewer-container:active { cursor: grabbing; }
    canvas { width: 100%; height: 100%; display: block; }
    .controls-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1rem;
    }
    .badge-3d {
      align-self: flex-start;
      background: rgba(31, 90, 61, 0.9);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .hint {
      align-self: center;
      background: rgba(21, 21, 21, 0.75);
      color: #fff;
      font-size: 0.7rem;
      padding: 0.3rem 0.8rem;
      border-radius: 12px;
      backdrop-filter: blur(4px);
    }
    .actions {
      align-self: flex-end;
      pointer-events: auto;
      display: flex;
      gap: 0.5rem;
    }
    .actions button {
      background: #fff;
      border: 1px solid #ccc;
      padding: 0.4rem 0.8rem;
      font-size: 0.72rem;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      transition: all 0.2s;
    }
    .actions button:hover { background: var(--ink, #151515); color: #fff; }
    .actions button.active { background: var(--forest, #1f5a3d); color: #fff; border-color: var(--forest, #1f5a3d); }
  `]
})
export class Product3DViewerComponent implements OnInit, OnDestroy {
  @Input() imageUrl = '';
  @Input() productName = '';
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly autoRotate = signal(true);
  private rotationY = 0;
  private scale = 1.0;
  private isDragging = false;
  private lastMouseX = 0;
  private animId = 0;
  private imgElement = new Image();
  private isLoaded = false;

  ngOnInit(): void {
    if (this.imageUrl) {
      this.imgElement.src = this.imageUrl;
      this.imgElement.crossOrigin = 'anonymous';
      this.imgElement.onload = () => {
        this.isLoaded = true;
      };
    }
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  onPointerDown(e: MouseEvent): void {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
  }

  onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastMouseX = e.touches[0].clientX;
    }
  }

  onPointerMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.lastMouseX;
    this.rotationY += deltaX * 0.015;
    this.lastMouseX = e.clientX;
  }

  onTouchMove(e: TouchEvent): void {
    if (!this.isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - this.lastMouseX;
    this.rotationY += deltaX * 0.015;
    this.lastMouseX = e.touches[0].clientX;
  }

  onPointerUp(): void {
    this.isDragging = false;
  }

  resetView(): void {
    this.rotationY = 0;
    this.scale = 1.0;
  }

  toggleAutoRotate(): void {
    this.autoRotate.set(!this.autoRotate());
  }

  private startAnimationLoop(): void {
    const render = () => {
      if (this.autoRotate() && !this.isDragging) {
        this.rotationY += 0.008;
      }
      this.drawCanvas();
      this.animId = requestAnimationFrame(render);
    };
    this.animId = requestAnimationFrame(render);
  }

  private drawCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Draw 3D shadow pedestal
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + height * 0.35, width * 0.28 * Math.cos(this.rotationY * 0.5) * 0.1 + width * 0.25, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fill();
    ctx.restore();

    // Draw 3D rotating product projection
    if (this.isLoaded) {
      ctx.save();
      ctx.translate(centerX, centerY);
      
      // Simulate 3D rotation transform along Y-axis
      const cosY = Math.cos(this.rotationY);
      const skewX = Math.sin(this.rotationY) * 0.12;

      ctx.transform(cosY * this.scale, skewX, 0, this.scale, 0, 0);

      const drawW = width * 0.55;
      const drawH = height * 0.72;
      ctx.drawImage(this.imgElement, -drawW / 2, -drawH / 2, drawW, drawH);

      // Subtle dynamic 3D lighting reflection overlay
      const gradient = ctx.createLinearGradient(-drawW / 2, 0, drawW / 2, 0);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);

      ctx.restore();
    }
  }
}
