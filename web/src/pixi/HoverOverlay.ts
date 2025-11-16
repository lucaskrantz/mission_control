import * as PIXI from 'pixi.js';
import { theme } from '../theme';

/**
 * HoverOverlay manages the visual feedback when a planet is focused:
 * - Green halo around the planet
 * - Short arc highlight on the orbit ring
 */
export class HoverOverlay {
  private container: PIXI.Container;
  private halo: PIXI.Graphics;
  private arc: PIXI.Graphics;
  
  private visible: boolean = false;
  
  // Visual constants from theme
  private readonly HALO_EXTRA = theme.hover.haloExtra;
  private readonly ARC_SWEEP = theme.hover.arcSweep;

  constructor() {
    this.container = new PIXI.Container();
    this.container.visible = false;
    
    // Create halo (green glow around planet)
    this.halo = new PIXI.Graphics();
    this.container.addChild(this.halo);
    
    // Create arc (short ring segment highlight)
    this.arc = new PIXI.Graphics();
    this.container.addChild(this.arc);
  }

  /**
   * Show the overlay for a focused planet
   */
  show(
    planetX: number,
    planetY: number,
    planetRadius: number,
    orbitRadius: number,
    centerX: number,
    centerY: number
  ): void {
    this.visible = true;
    this.container.visible = true;
    
    // Draw halo
    this.drawHalo(planetX, planetY, planetRadius);
    
    // Draw arc on orbit ring
    this.drawArc(planetX, planetY, orbitRadius, centerX, centerY);
  }

  /**
   * Hide the overlay
   */
  hide(): void {
    this.visible = false;
    this.container.visible = false;
  }

  /**
   * Get the container to add to stage
   */
  getContainer(): PIXI.Container {
    return this.container;
  }

  /**
   * Check if overlay is currently visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Draw green halo around planet
   */
  private drawHalo(x: number, y: number, radius: number): void {
    this.halo.clear();
    
    const haloRadius = radius + this.HALO_EXTRA;
    const accentColor = parseInt(theme.colors.accent.replace('#', ''), 16);
    
    // Outer glow
    this.halo.beginFill(accentColor, 0.15);
    this.halo.drawCircle(x, y, haloRadius + 2);
    this.halo.endFill();
    
    // Inner glow
    this.halo.beginFill(accentColor, 0.25);
    this.halo.drawCircle(x, y, haloRadius);
    this.halo.endFill();
    
    // Ring outline
    this.halo.lineStyle(2, accentColor, 0.7);
    this.halo.drawCircle(x, y, radius + 2);
  }

  /**
   * Draw short arc segment on orbit ring
   */
  private drawArc(
    planetX: number,
    planetY: number,
    orbitRadius: number,
    centerX: number,
    centerY: number
  ): void {
    this.arc.clear();
    
    // Calculate angle from center to planet
    const angle = Math.atan2(planetY - centerY, planetX - centerX);
    
    // Draw arc segment
    const accentColor = parseInt(theme.colors.accent.replace('#', ''), 16);
    this.arc.lineStyle(3, accentColor, 0.9);
    this.arc.arc(
      centerX,
      centerY,
      orbitRadius,
      angle - this.ARC_SWEEP,
      angle + this.ARC_SWEEP
    );
  }
}
