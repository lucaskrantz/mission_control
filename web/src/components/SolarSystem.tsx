import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { ContainerStats, Group } from '../types';
import { theme } from '../theme';
import { makeRadialGradient } from '../pixi/makeRadialGradient';
import { groupContainers } from '../utils/grouping';
import { HoverOverlay } from '../pixi/HoverOverlay';
import { useSelectionStore } from '../state/selection';
import './SolarSystem.css';

interface SolarSystemProps {
  containers: ContainerStats[];
}

interface Planet {
  container: ContainerStats;
  sprite: PIXI.Sprite;
  glow: PIXI.Graphics;
  rimGlow: PIXI.Graphics;
  particles: PIXI.Graphics[];
  angle: number;
  orbitSpeed: number;
}

interface GroupOrbit {
  group: Group;
  orbitRadius: number;
  orbitLine: PIXI.Graphics;
  orbitGlow: PIXI.Graphics;
  labelText: PIXI.Text | null;
  planets: Map<string, Planet>;
  randomStartAngle: number;
  hitArea: PIXI.Graphics; // Interactive hit area for ring clicks
}

const SolarSystem: React.FC<SolarSystemProps> = ({ containers }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const groupOrbitsRef = useRef<Map<string, GroupOrbit>>(new Map());
  const sunRef = useRef<PIXI.Sprite | null>(null);
  const sunGlowRef = useRef<PIXI.Graphics | null>(null);
  const gradientTextureRef = useRef<PIXI.Texture | null>(null);
  const hoverOverlayRef = useRef<HoverOverlay | null>(null);
  const focusedPlanetIdRef = useRef<string | null>(null);
  const unfocusTimeoutRef = useRef<number | null>(null);
  const baseLayerRef = useRef<PIXI.Container | null>(null);
  const focusLayerRef = useRef<PIXI.Container | null>(null);
  // Get selection state
  const { selection, selectPlanet, selectGroup, clearSelection, setHover, clearHover } = useSelectionStore();

  // Calculate orbit radius for a group based on index and total count
  const calculateOrbitRadius = (index: number, totalGroups: number): number => {
    if (!appRef.current) return 120;
    
    const viewportSize = Math.min(appRef.current.screen.width, appRef.current.screen.height);
    const BASE = viewportSize * 0.12;
    let STEP = viewportSize * 0.075;
    const MAX_ORBIT = viewportSize * 0.46;
    
    // Adjust step if many groups (compress beyond 6 rings)
    if (totalGroups > 6) {
      STEP *= 0.85;
    }
    
    const radius = BASE + index * STEP;
    return Math.min(radius, MAX_ORBIT);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Parse theme background color
    const bgColor = parseInt(theme.colors.bg.replace('#', ''), 16);

    // Initialize PixiJS application
    const PANEL_WIDTH = 300;
    const app = new PIXI.Application({
      width: window.innerWidth - PANEL_WIDTH,
      height: window.innerHeight - theme.hud.height,
      backgroundColor: bgColor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // Create hover overlay (rendered below everything)
    const hoverOverlay = new HoverOverlay();
    app.stage.addChild(hoverOverlay.getContainer());
    hoverOverlayRef.current = hoverOverlay;

    // Create base layer for normal rendering
    const baseLayer = new PIXI.Container();
    app.stage.addChild(baseLayer);
    baseLayerRef.current = baseLayer;

    // Create focus layer for focused planets (rendered on top)
    const focusLayer = new PIXI.Container();
    app.stage.addChild(focusLayer);
    focusLayerRef.current = focusLayer;

    // Add background click handler to clear selection
    app.stage.interactive = true;
    app.stage.hitArea = app.screen;

    // Create radial gradient texture for sun and planets
    const gradientTexture = makeRadialGradient({
      outer: theme.colors.primary,
      mid: theme.colors.primaryMid,
      inner: theme.colors.primaryDeep,
      radius: 32,
    });
    gradientTextureRef.current = gradientTexture;

    // Add sun glow (behind sun)
    const sunGlow = new PIXI.Graphics();
    sunGlow.beginFill(parseInt(theme.colors.primaryDeep.replace('#', ''), 16), 0.3);
    sunGlow.drawCircle(0, 0, theme.planet.sunGlowRadius);
    sunGlow.endFill();
    sunGlow.position.set(app.screen.width / 2, app.screen.height / 2);
    baseLayer.addChild(sunGlow);
    sunGlowRef.current = sunGlow;

    // Create sun with gradient (on top of glow)
    const sun = new PIXI.Sprite(gradientTexture);
    sun.anchor.set(0.5);
    sun.width = theme.planet.sunRadius * 2;
    sun.height = theme.planet.sunRadius * 2;
    sun.position.set(app.screen.width / 2, app.screen.height / 2);
    baseLayer.addChild(sun);
    sunRef.current = sun;

    // Animation loop
    let lastTime = Date.now();
    app.ticker.add(() => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Animate sun glow
      if (sunRef.current) {
        sunRef.current.scale.x = 1 + Math.sin(now / 500) * 0.05;
        sunRef.current.scale.y = 1 + Math.sin(now / 500) * 0.05;
      }

      if (sunGlowRef.current) {
        const glowScale = 1 + Math.sin(now / 600) * 0.1;
        sunGlowRef.current.scale.set(glowScale);
      }

      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;

      // Update each group orbit
      groupOrbitsRef.current.forEach((groupOrbit) => {
        // Animate orbit glow for running groups
        if (groupOrbit.group.dominantState === 'running') {
          const glowAlpha = 0.15 + Math.sin(now / 800) * 0.1;
          groupOrbit.orbitGlow.alpha = glowAlpha;
        }

        // Update planets in this group
        groupOrbit.planets.forEach((planet) => {
          planet.angle += planet.orbitSpeed * delta;
          
          const x = centerX + Math.cos(planet.angle) * groupOrbit.orbitRadius;
          const y = centerY + Math.sin(planet.angle) * groupOrbit.orbitRadius;
          
          planet.sprite.position.set(x, y);
          planet.glow.position.set(x, y);
          planet.rimGlow.position.set(x, y);

          // Animate glow
          const glowScale = 1 + Math.sin(now / 300) * 0.2;
          planet.glow.scale.set(glowScale);

          // Pulsing alpha for restarting state
          if (planet.container.state === 'restarting') {
            planet.sprite.alpha = 0.7 + Math.sin(now / 200) * 0.3;
          } else {
            planet.sprite.alpha = 1;
          }

          // Update particles for high activity
          planet.particles.forEach((particle, idx) => {
            const particleAngle = (now / 1000 + idx * (Math.PI * 2 / planet.particles.length)) % (Math.PI * 2);
            const particleRadius = 25 + Math.sin(now / 200 + idx) * 5;
            particle.position.set(
              x + Math.cos(particleAngle) * particleRadius,
              y + Math.sin(particleAngle) * particleRadius
            );
          });
          
          // Update hover overlay position if this planet is focused
          if (focusedPlanetIdRef.current === planet.container.id && hoverOverlayRef.current) {
            const planetRadius = planet.sprite.width / 2;
            hoverOverlayRef.current.show(
              x,
              y,
              planetRadius,
              groupOrbit.orbitRadius,
              centerX,
              centerY
            );
          }
        });
      });
    });

    // Handle window resize
    const handleResize = () => {
      const PANEL_WIDTH = 300;
      app.renderer.resize(window.innerWidth - PANEL_WIDTH, window.innerHeight - theme.hud.height);
      if (sunRef.current) {
        sunRef.current.position.set(app.screen.width / 2, app.screen.height / 2);
      }
      if (sunGlowRef.current) {
        sunGlowRef.current.position.set(app.screen.width / 2, app.screen.height / 2);
      }
      // Recalculate orbit radii on resize
      let index = 0;
      groupOrbitsRef.current.forEach((groupOrbit) => {
        groupOrbit.orbitRadius = calculateOrbitRadius(index++, groupOrbitsRef.current.size);
        // Redraw orbit ring
        drawOrbitRing(groupOrbit);
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unfocusTimeoutRef.current) {
        clearTimeout(unfocusTimeoutRef.current);
      }
      app.destroy(true, { children: true });
    };
  }, []);

  // Handle hover (ephemeral, clears persistent selection if hovering different planet)
  const handleHover = React.useCallback((planetId: string) => {
    if (!appRef.current || !hoverOverlayRef.current) return;
    
    // If there's a persistent planet selection and we're hovering a DIFFERENT planet, clear it
    if (selection.kind === 'planet' && selection.persistent && selection.id !== planetId) {
      unfocusPlanet();
    }
    
    // Don't update hover if there's a group selection
    if (selection.kind === 'group') return;
    
    // Clear any pending unfocus
    if (unfocusTimeoutRef.current) {
      clearTimeout(unfocusTimeoutRef.current);
      unfocusTimeoutRef.current = null;
    }
    
    // Already focused
    if (focusedPlanetIdRef.current === planetId) return;
    
    // Find the planet
    let targetPlanet: Planet | undefined;
    let targetGroupOrbit: GroupOrbit | undefined;
    
    groupOrbitsRef.current.forEach((groupOrbit) => {
      const planet = groupOrbit.planets.get(planetId);
      if (planet) {
        targetPlanet = planet;
        targetGroupOrbit = groupOrbit;
      }
    });
    
    if (!targetPlanet || !targetGroupOrbit) return;
    
    // Type assertions for TypeScript
    const planet = targetPlanet;
    const groupOrbit = targetGroupOrbit;
    
    focusedPlanetIdRef.current = planetId;
    
    // Update hover state (not persistent selection)
    setHover(planetId, planet.container);
    
    // Move focused planet to focus layer and scale up
    if (focusLayerRef.current && baseLayerRef.current) {
      baseLayerRef.current.removeChild(planet.sprite);
      baseLayerRef.current.removeChild(planet.glow);
      baseLayerRef.current.removeChild(planet.rimGlow);
      
      focusLayerRef.current.addChild(planet.glow);
      focusLayerRef.current.addChild(planet.sprite);
      focusLayerRef.current.addChild(planet.rimGlow);
      
      // Scale up by multiplying width/height
      planet.sprite.width *= theme.hover.focusScale;
      planet.sprite.height *= theme.hover.focusScale;
    }
    
    // Show hover overlay (halo and arc)
    const centerX = appRef.current.screen.width / 2;
    const centerY = appRef.current.screen.height / 2;
    const planetX = planet.sprite.position.x;
    const planetY = planet.sprite.position.y;
    const planetRadius = planet.sprite.width / 2;
    
    hoverOverlayRef.current.show(
      planetX,
      planetY,
      planetRadius,
      groupOrbit.orbitRadius,
      centerX,
      centerY
    );
  }, [selection, setHover]);
  
  // Unfocus the current planet (restore alphas, hide overlay)
  const unfocusPlanet = React.useCallback(() => {
    if (!focusedPlanetIdRef.current || !hoverOverlayRef.current) return;
    
    const planetId = focusedPlanetIdRef.current;
    focusedPlanetIdRef.current = null;
    
    // Clear selection and hover
    clearSelection();
    clearHover();
    
    // Find the focused planet
    let targetPlanet: Planet | undefined;
    
    groupOrbitsRef.current.forEach((groupOrbit) => {
      const planet = groupOrbit.planets.get(planetId);
      if (planet) {
        targetPlanet = planet;
      }
    });
    
    // Move planet back to base layer and restore size
    if (targetPlanet && focusLayerRef.current && baseLayerRef.current) {
      const planet = targetPlanet;
      focusLayerRef.current.removeChild(planet.sprite);
      focusLayerRef.current.removeChild(planet.glow);
      focusLayerRef.current.removeChild(planet.rimGlow);
      
      baseLayerRef.current.addChild(planet.glow);
      baseLayerRef.current.addChild(planet.sprite);
      baseLayerRef.current.addChild(planet.rimGlow);
      
      // Restore size by dividing back
      planet.sprite.width /= theme.hover.focusScale;
      planet.sprite.height /= theme.hover.focusScale;
    }
    
    // Hide overlay
    hoverOverlayRef.current.hide();
  }, [clearSelection, clearHover]);
  
  // Handle click (persistent selection)
  const handleClick = React.useCallback((planetId: string, container: ContainerStats) => {
    if (!appRef.current || !hoverOverlayRef.current) return;
    
    // Clear any pending unfocus
    if (unfocusTimeoutRef.current) {
      clearTimeout(unfocusTimeoutRef.current);
      unfocusTimeoutRef.current = null;
    }
    
    // Find the planet
    let targetPlanet: Planet | undefined;
    let targetGroupOrbit: GroupOrbit | undefined;
    
    groupOrbitsRef.current.forEach((groupOrbit) => {
      const planet = groupOrbit.planets.get(planetId);
      if (planet) {
        targetPlanet = planet;
        targetGroupOrbit = groupOrbit;
      }
    });
    
    if (!targetPlanet || !targetGroupOrbit) return;
    
    const planet = targetPlanet;
    const groupOrbit = targetGroupOrbit;
    
    // If different planet was focused, unfocus it first
    if (focusedPlanetIdRef.current && focusedPlanetIdRef.current !== planetId) {
      unfocusPlanet();
    }
    
    focusedPlanetIdRef.current = planetId;
    
    // Set persistent selection
    selectPlanet(planetId, container, true);
    
    // Move to focus layer and scale up if not already there
    if (focusLayerRef.current && baseLayerRef.current) {
      if (planet.sprite.parent === baseLayerRef.current) {
        baseLayerRef.current.removeChild(planet.sprite);
        baseLayerRef.current.removeChild(planet.glow);
        baseLayerRef.current.removeChild(planet.rimGlow);
        
        focusLayerRef.current.addChild(planet.glow);
        focusLayerRef.current.addChild(planet.sprite);
        focusLayerRef.current.addChild(planet.rimGlow);
        
        planet.sprite.width *= theme.hover.focusScale;
        planet.sprite.height *= theme.hover.focusScale;
      }
    }
    
    // Show overlay
    const centerX = appRef.current.screen.width / 2;
    const centerY = appRef.current.screen.height / 2;
    const planetX = planet.sprite.position.x;
    const planetY = planet.sprite.position.y;
    const planetRadius = planet.sprite.width / 2;
    
    hoverOverlayRef.current.show(
      planetX,
      planetY,
      planetRadius,
      groupOrbit.orbitRadius,
      centerX,
      centerY
    );
  }, [selection, selectPlanet, unfocusPlanet]);
  
  // Maybe unfocus with debounce (only if not persistent)
  const maybeUnfocus = React.useCallback(() => {
    if (unfocusTimeoutRef.current) {
      clearTimeout(unfocusTimeoutRef.current);
    }
    
    unfocusTimeoutRef.current = window.setTimeout(() => {
      // Check if selection is persistent at the time of execution, not creation
      const currentSelection = useSelectionStore.getState().selection;
      if (currentSelection.kind === 'planet' && currentSelection.persistent) return;
      if (currentSelection.kind === 'group') return;
      
      unfocusPlanet();
    }, theme.hover.debounceMs);
  }, [unfocusPlanet]);

  // Helper function to draw orbit ring
  const drawOrbitRing = (groupOrbit: GroupOrbit) => {
    if (!appRef.current) return;
    
    const centerX = appRef.current.screen.width / 2;
    const centerY = appRef.current.screen.height / 2;
    const orbitColorHex = parseInt(theme.colors.primary.replace('#', ''), 16);
    const isSelected = selection.kind === 'group' && selection.key === groupOrbit.group.key;
    
    // Clear and redraw orbit line
    groupOrbit.orbitLine.clear();
    const lineWidth = isSelected ? 2 : 1;
    const lineAlpha = isSelected ? 0.8 : (selection.kind === 'group' ? 0.25 : 0.4);
    groupOrbit.orbitLine.lineStyle(lineWidth, orbitColorHex, lineAlpha);
    groupOrbit.orbitLine.drawCircle(centerX, centerY, groupOrbit.orbitRadius);
    
    // Draw subtle ticks for each container position
    const numContainers = groupOrbit.group.containers.length;
    for (let i = 0; i < numContainers; i++) {
      const angle = (i * Math.PI * 2) / numContainers;
      const innerRadius = groupOrbit.orbitRadius - 3;
      const outerRadius = groupOrbit.orbitRadius + 3;
      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * outerRadius;
      const y2 = centerY + Math.sin(angle) * outerRadius;
      groupOrbit.orbitLine.lineStyle(1, orbitColorHex, lineAlpha * 0.75);
      groupOrbit.orbitLine.moveTo(x1, y1);
      groupOrbit.orbitLine.lineTo(x2, y2);
    }
    
    // Clear and redraw orbit glow
    groupOrbit.orbitGlow.clear();
    const glowColor = parseInt(theme.colors.accent.replace('#', ''), 16);
    
    if (groupOrbit.group.dominantState === 'running') {
      const glowAlpha = isSelected ? 0.4 : (selection.kind === 'group' ? 0.1 : 0.2);
      groupOrbit.orbitGlow.lineStyle(isSelected ? 3 : 2, glowColor, glowAlpha);
      groupOrbit.orbitGlow.drawCircle(centerX, centerY, groupOrbit.orbitRadius);
    } else if (groupOrbit.group.dominantState === 'exited') {
      // Dim the orbit line for exited groups
      groupOrbit.orbitLine.alpha = isSelected ? 0.6 : 0.3;
    }
    
    // Update hit area for ring interaction (draw a thick ring as a filled shape)
    groupOrbit.hitArea.clear();
    groupOrbit.hitArea.beginFill(0xFFFFFF, 0.01); // Nearly invisible fill
    groupOrbit.hitArea.drawCircle(centerX, centerY, groupOrbit.orbitRadius + 15); // Outer circle
    groupOrbit.hitArea.beginHole();
    groupOrbit.hitArea.drawCircle(centerX, centerY, groupOrbit.orbitRadius - 15); // Inner circle (creates donut)
    groupOrbit.hitArea.endHole();
    groupOrbit.hitArea.endFill();
  };

  useEffect(() => {
    if (!appRef.current || !gradientTextureRef.current) return;

    const app = appRef.current;
    const gradientTexture = gradientTextureRef.current;

    // Group containers
    const groups = groupContainers(containers);
    
    // Remove group orbits that no longer exist
    const currentGroupKeys = new Set(groups.map(g => g.key));
    groupOrbitsRef.current.forEach((groupOrbit, key) => {
      if (!currentGroupKeys.has(key)) {
        // Remove all planets in this group
        groupOrbit.planets.forEach((planet) => {
          app.stage.removeChild(planet.sprite);
          app.stage.removeChild(planet.glow);
          app.stage.removeChild(planet.rimGlow);
          planet.particles.forEach(p => app.stage.removeChild(p));
        });
        // Remove orbit graphics
        app.stage.removeChild(groupOrbit.orbitLine);
        app.stage.removeChild(groupOrbit.orbitGlow);
        if (groupOrbit.labelText) {
          app.stage.removeChild(groupOrbit.labelText);
        }
        groupOrbitsRef.current.delete(key);
      }
    });

    // Add or update group orbits
    groups.forEach((group, groupIndex) => {
      let groupOrbit = groupOrbitsRef.current.get(group.key);

      if (!groupOrbit) {
        // Create new group orbit
        const orbitRadius = calculateOrbitRadius(groupIndex, groups.length);
        const orbitLine = new PIXI.Graphics();
        const orbitGlow = new PIXI.Graphics();
        
        baseLayerRef.current?.addChild(orbitLine);
        baseLayerRef.current?.addChild(orbitGlow);

        // Create label text (optional, can be null for now)
        const labelText = new PIXI.Text(group.title, {
          fontFamily: 'monospace',
          fontSize: 10,
          fill: parseInt(theme.colors.hudText.replace('#', ''), 16),
        });
        labelText.alpha = 0.6;
        labelText.anchor.set(0.5);
        labelText.position.set(
          app.screen.width / 2 + orbitRadius,
          app.screen.height / 2
        );
        // Disable inline labels (they clutter the UI)
        labelText.visible = false;
        baseLayerRef.current?.addChild(labelText);

        // Create interactive hit area for ring clicks
        const hitArea = new PIXI.Graphics();
        hitArea.interactive = true;
        hitArea.cursor = 'pointer';
        hitArea.eventMode = 'static'; // Ensure it receives events
        hitArea.on('pointerdown', () => {
          console.log('Ring clicked:', group.key); // Debug log
          selectGroup(group.key, group);
        });
        // Add to base layer, below planets
        baseLayerRef.current?.addChild(hitArea);

        groupOrbit = {
          group,
          orbitRadius,
          orbitLine,
          orbitGlow,
          labelText,
          planets: new Map(),
          randomStartAngle: Math.random() * Math.PI * 2, // Random starting angle for this group
          hitArea,
        };

        groupOrbitsRef.current.set(group.key, groupOrbit);
      }

      // Update group reference
      groupOrbit.group = group;

      // Draw orbit ring
      drawOrbitRing(groupOrbit);

      // Remove planets that no longer exist in this group
      const currentContainerIds = new Set(group.containers.map(c => c.id));
      groupOrbit.planets.forEach((planet, id) => {
        if (!currentContainerIds.has(id)) {
          // Unfocus if this planet is currently focused
          if (focusedPlanetIdRef.current === id) {
            unfocusPlanet();
          }
          app.stage.removeChild(planet.sprite);
          app.stage.removeChild(planet.glow);
          app.stage.removeChild(planet.rimGlow);
          planet.particles.forEach(p => app.stage.removeChild(p));
          groupOrbit.planets.delete(id);
        }
      });

      // Add or update planets in this group
      group.containers.forEach((container, containerIndex) => {
        if (!groupOrbit) return; // Type guard
        let planet = groupOrbit.planets.get(container.id);

        if (!planet) {
          // Create new planet with randomized starting position but even spacing
          const spacing = (Math.PI * 2) / Math.max(group.containers.length, 1);
          const angle = groupOrbit.randomStartAngle + (containerIndex * spacing);

          const sprite = new PIXI.Sprite(gradientTexture);
          sprite.anchor.set(0.5);
          const glow = new PIXI.Graphics();
          const rimGlow = new PIXI.Graphics();
          const particles: PIXI.Graphics[] = [];

          sprite.interactive = true;
          sprite.cursor = 'pointer';
          sprite.eventMode = 'static';
          
          // Click handler (persistent selection)
          sprite.on('pointerdown', () => {
            handleClick(container.id, container);
          });
          
          // Hover handlers (ephemeral, only when no persistent selection)
          sprite.on('pointerover', () => {
            handleHover(container.id);
          });
          sprite.on('pointerout', () => {
            maybeUnfocus();
          });

          planet = {
            container,
            sprite,
            glow,
            rimGlow,
            particles,
            angle,
            orbitSpeed: 0.1,
          };

          baseLayerRef.current?.addChild(glow);
          baseLayerRef.current?.addChild(sprite);
          baseLayerRef.current?.addChild(rimGlow);
          groupOrbit.planets.set(container.id, planet);
        }

        // Update planet properties
        planet.container = container;

        // Calculate size based on memory usage (sqrt for better visual scaling)
        const memoryPercent = container.memoryPercent || 0;
        const baseSize = theme.planet.minRadius;
        const maxSize = memoryPercent > 70 ? theme.planet.largeMaxRadius : theme.planet.maxRadius;
        const size = baseSize + Math.sqrt(memoryPercent / 100) * (maxSize - baseSize);

        // Update sprite size
        const isFocused = focusedPlanetIdRef.current === container.id;
        const targetSize = size * 2;
        
        if (isFocused) {
          // If focused, apply the focus scale
          planet.sprite.width = targetSize * theme.hover.focusScale;
          planet.sprite.height = targetSize * theme.hover.focusScale;
        } else {
          planet.sprite.width = targetSize;
          planet.sprite.height = targetSize;
        }

        // Calculate orbit speed based on CPU (0.05 - 0.5 rad/s)
        const cpuPercent = container.cpuPercent || 0;
        planet.orbitSpeed = 0.05 + (cpuPercent / 100) * 0.45;

        // Apply tint based on state
        let tint = 0xFFFFFF;
        let glowColor = parseInt(theme.colors.accent.replace('#', ''), 16);
        let glowAlpha = 0.3;
        
        switch (container.state) {
          case 'running':
            tint = 0xFFFFFF;
            glowColor = parseInt(theme.colors.running.replace('#', ''), 16);
            glowAlpha = 0.4;
            break;
          case 'paused':
            tint = parseInt(theme.colors.paused.replace('#', ''), 16);
            glowColor = parseInt(theme.colors.paused.replace('#', ''), 16);
            glowAlpha = 0.3;
            break;
          case 'restarting':
            tint = 0xFFFFFF;
            glowColor = parseInt(theme.colors.restarting.replace('#', ''), 16);
            glowAlpha = 0.4;
            break;
          case 'exited':
            tint = parseInt(theme.colors.exited.replace('#', ''), 16);
            glowColor = parseInt(theme.colors.exited.replace('#', ''), 16);
            glowAlpha = 0.2;
            break;
          default:
            tint = 0xCCCCCC;
            glowColor = 0x888888;
            glowAlpha = 0.2;
        }

        planet.sprite.tint = tint;

        // Redraw glow
        planet.glow.clear();
        planet.glow.beginFill(glowColor, glowAlpha);
        planet.glow.drawCircle(0, 0, size * theme.planet.glowMultiplier);
        planet.glow.endFill();

        // Redraw rim glow (green accent for running containers)
        planet.rimGlow.clear();
        if (container.state === 'running') {
          const rimColor = parseInt(theme.colors.accent.replace('#', ''), 16);
          planet.rimGlow.lineStyle(2, rimColor, 0.6);
          planet.rimGlow.drawCircle(0, 0, size);
        }

        // Add/update particles for high CPU or restarting state
        const shouldShowParticles = cpuPercent > 50 || container.state === 'restarting';
        
        if (shouldShowParticles && planet.particles.length === 0) {
          // Create particles
          for (let i = 0; i < 6; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(glowColor, 0.6);
            particle.drawCircle(0, 0, 3);
            particle.endFill();
            baseLayerRef.current?.addChild(particle);
            planet.particles.push(particle);
          }
        } else if (!shouldShowParticles && planet.particles.length > 0) {
          // Remove particles
          planet.particles.forEach(p => app.stage.removeChild(p));
          planet.particles = [];
        }
      });
    });
  }, [containers, calculateOrbitRadius, selectGroup]);

  // Background clicks no longer clear selection - selection is sticky
  // Selection only clears when another planet is clicked/hovered or Clear button is pressed
  useEffect(() => {
    // No-op: keeping this effect for future background interaction handling if needed
    // Currently, selection persists until explicitly cleared
  }, [selection, unfocusPlanet]);

  // Update visual effects when selection changes
  useEffect(() => {
    if (!appRef.current) return;
    
    // Redraw all orbit rings to reflect selection state
    groupOrbitsRef.current.forEach((groupOrbit) => {
      drawOrbitRing(groupOrbit);
      
      // Update planet alphas based on selection
      groupOrbit.planets.forEach((planet, planetId) => {
        let targetAlpha = 1.0;
        
        if (selection.kind === 'planet' && selection.persistent) {
          // Persistent planet selection: dim others to 0.6, keep selected at 1.0
          targetAlpha = selection.id === planetId ? 1.0 : 0.6;
        } else if (selection.kind === 'group') {
          // Group selection: dim planets not in group to 0.6
          targetAlpha = selection.key === groupOrbit.group.key ? 1.0 : 0.6;
        } else if (focusedPlanetIdRef.current) {
          // Hover (non-persistent): dim others to 0.4
          targetAlpha = focusedPlanetIdRef.current === planetId ? 1.0 : 0.4;
        }
        
        // Apply alpha to sprite, glow, and rimGlow
        planet.sprite.alpha = targetAlpha;
        planet.glow.alpha = targetAlpha;
        planet.rimGlow.alpha = targetAlpha;
        planet.particles.forEach(p => p.alpha = targetAlpha);
      });
    });
  }, [selection, drawOrbitRing]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Get all planet IDs in order
      const allPlanetIds: string[] = [];
      groupOrbitsRef.current.forEach((groupOrbit) => {
        groupOrbit.planets.forEach((planet) => {
          allPlanetIds.push(planet.container.id);
        });
      });
      
      if (allPlanetIds.length === 0) return;
      
      if (e.key === 'Escape') {
        // Clear selection
        if (selection.kind !== 'none') {
          unfocusPlanet();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        // Cycle to next planet
        e.preventDefault();
        const currentIndex = selection.kind === 'planet' 
          ? allPlanetIds.indexOf(selection.id)
          : -1;
        const nextIndex = (currentIndex + 1) % allPlanetIds.length;
        const nextPlanetId = allPlanetIds[nextIndex];
        
        // Find the container
        let nextContainer: ContainerStats | undefined;
        groupOrbitsRef.current.forEach((groupOrbit) => {
          const planet = groupOrbit.planets.get(nextPlanetId);
          if (planet) nextContainer = planet.container;
        });
        
        if (nextContainer) {
          handleClick(nextPlanetId, nextContainer);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        // Cycle to previous planet
        e.preventDefault();
        const currentIndex = selection.kind === 'planet'
          ? allPlanetIds.indexOf(selection.id)
          : 0;
        const prevIndex = currentIndex <= 0 ? allPlanetIds.length - 1 : currentIndex - 1;
        const prevPlanetId = allPlanetIds[prevIndex];
        
        // Find the container
        let prevContainer: ContainerStats | undefined;
        groupOrbitsRef.current.forEach((groupOrbit) => {
          const planet = groupOrbit.planets.get(prevPlanetId);
          if (planet) prevContainer = planet.container;
        });
        
        if (prevContainer) {
          handleClick(prevPlanetId, prevContainer);
        }
      } else if (e.key === 'Enter') {
        // If hovering, make it persistent
        if (selection.kind === 'planet' && !selection.persistent && focusedPlanetIdRef.current) {
          selectPlanet(selection.id, selection.container, true);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, unfocusPlanet, handleClick, selectPlanet]);

  return <div ref={canvasRef} className="solar-system" />;
};

export default SolarSystem;
