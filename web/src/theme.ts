// Mission Control Theme - Light Blue with Green Accents
export const theme = {
  colors: {
    // Background
    bg: '#0B1522', // Dark blue canvas background
    
    // Primary light blue gradient (outer → inner, lighter → darker)
    primary: '#BFE9FF',      // Light blue (outer)
    primaryMid: '#8FD3FE',   // Medium blue
    primaryDeep: '#5BB6F2',  // Deep blue (center, darkest)
    
    // Accent
    accent: '#6EE7B7',       // Green accent
    
    // Orbit lines
    orbit: 'rgba(191, 233, 255, 0.4)', // Subtle light-blue orbit lines
    
    // HUD
    hudBg: 'rgba(11, 21, 34, 0.72)',
    hudText: '#E6FAFF',
    hudBorder: 'rgba(191, 233, 255, 0.6)',
    
    // State colors (adjusted for new scheme)
    running: '#6EE7B7',      // Green accent
    paused: '#8FD3FE',       // Medium blue
    restarting: '#BFE9FF',   // Light blue
    exited: '#8AA8B9',       // Desaturated blue-gray
    
    // Starfield
    starTint: 'rgba(91, 182, 242, 0.15)', // primaryDeep at low opacity
  },
  
  // HUD dimensions
  hud: {
    height: 52, // pixels
  },
  
  // Orbit configuration
  orbit: {
    minFactor: 0.12,    // ORBIT_MIN = viewport * 0.12
    stepFactor: 0.075,  // ORBIT_STEP = viewport * 0.075
    maxFactor: 0.46,    // MAX_ORBIT = viewport * 0.46
    compressionThreshold: 10, // Compress when > 10 containers
    compressionFactor: 0.85,  // Multiply step by 0.85 per 10+ containers
  },
  
  // Planet sizing
  planet: {
    minRadius: 12,
    maxRadius: 18,      // Cap for small planets
    largeMaxRadius: 12, // Cap for largest planets (high memory)
    glowMultiplier: 1.2, // Glow size = planet size * multiplier
    sunRadius: 24,      // Reduced by 50% from 48
    sunGlowRadius: 36,  // Reduced by 50% from 72
  },
  
  // Hover focus interaction
  hover: {
    focusScale: 1.5,        // Scale multiplier when planet is focused
    dimAlpha: 0.4,           // Alpha for non-focused planets/rings
    haloExtra: 4,            // Extra pixels for halo beyond planet radius
    arcSweep: Math.PI / 24,  // Arc segment angle (~15 degrees)
    calloutOffset: 14,       // Distance from planet center to callout
    debounceMs: 20,         // Debounce delay for unfocus (ms)
  },
};

export type Theme = typeof theme;
