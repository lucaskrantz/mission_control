import * as PIXI from 'pixi.js';

interface RadialGradientOptions {
  outer: string;   // Outer color (lighter)
  mid: string;     // Middle color
  inner: string;   // Inner color (darkest, center)
  radius?: number; // Radius in pixels (default: 128)
}

/**
 * Creates a radial gradient texture for PixiJS using an offscreen canvas.
 * Gradient goes from outer (lighter) to inner (darker) toward the center.
 */
export function makeRadialGradient(options: RadialGradientOptions): PIXI.Texture {
  const { outer, mid, inner, radius = 128 } = options;
  
  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  const size = radius * 2;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for gradient canvas');
  }
  
  // Clear canvas with transparent background
  ctx.clearRect(0, 0, size, size);
  
  // Create radial gradient from center
  const gradient = ctx.createRadialGradient(
    radius, radius, 0,           // Inner circle (center)
    radius, radius, radius       // Outer circle
  );
  
  // Add color stops: outer (lighter) → mid → inner (darkest at center)
  gradient.addColorStop(0, inner);    // Center (darkest)
  gradient.addColorStop(0.5, mid);    // Middle
  gradient.addColorStop(1, outer);    // Edge (lightest)
  
  // Fill a CIRCLE with gradient (not a rectangle)
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Create PixiJS texture from canvas
  return PIXI.Texture.from(canvas);
}

/**
 * Helper to convert hex color to rgba string with alpha
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
