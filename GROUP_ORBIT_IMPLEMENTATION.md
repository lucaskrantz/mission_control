# Group-by-Orbit System Implementation

## Overview
Successfully implemented a group-by-orbit layout system for Mission Control that organizes containers into shared orbit rings based on their project/service grouping.

## ✅ Completed Features

### 1. Backend Grouping Logic (`api/src/services/docker.ts`)
- Added `deriveGroupFromContainer()` method with priority-based grouping:
  1. **Priority 1**: Custom `mission.group` label
  2. **Priority 2**: Docker Compose project (`com.docker.compose.project`)
  3. **Priority 3**: Container name prefix (before first `-` or `_`)
  4. **Fallback**: Full container name
- Extended `ContainerStats` interface to include `group` and `labels` fields
- All containers now include their group assignment in API responses

### 2. Type Definitions (`web/src/types.ts`)
- Added `Group` interface:
  - `key`: Unique group identifier
  - `title`: Human-readable group name
  - `containers`: Array of containers in this group
  - `dominantState`: Overall state of the group (running/paused/exited/restarting)
- Extended `ContainerStats` with `group` and `labels` fields

### 3. Client-Side Grouping (`web/src/utils/grouping.ts`)
- `groupContainers()`: Aggregates containers into groups
- `getDominantState()`: Determines group state (priority: running > restarting > paused > exited)
- `formatGroupTitle()`: Formats group keys into readable titles

### 4. Refactored SolarSystem Component (`web/src/components/SolarSystem.tsx`)
Complete rewrite to use group-based orbit system:

#### Data Structure
- Changed from `Map<containerId, Planet>` to `Map<groupKey, GroupOrbit>`
- Each `GroupOrbit` contains:
  - Group metadata
  - Orbit radius
  - Orbit line graphics
  - Orbit glow graphics
  - Label text
  - Map of planets in this group

#### Orbit Ring Rendering
- **Base orbit line**: Light blue (40% opacity)
- **Position ticks**: Subtle marks showing each container's position on the ring
- **State-based glow**: Green pulsing glow for groups with running containers
- **Dimming**: Exited groups show at 30% opacity
- **Group labels**: Small text labels positioned along each orbit ring

#### Orbit Radius Calculation
```javascript
const BASE = viewportSize * 0.12;
const STEP = viewportSize * 0.075;
const MAX_ORBIT = viewportSize * 0.46;
// Compress if > 6 groups: STEP *= 0.85
```

#### Planet Rendering
- **Size**: Based on √(memory usage) for better visual scaling (16-40px)
- **Position**: Evenly distributed along group's orbit ring
- **Orbit speed**: Proportional to CPU usage (0.05-0.5 rad/s)
- **Color/tint by state**:
  - Running → light-blue gradient + green rim
  - Paused → darker blue tint
  - Restarting → pulsing alpha animation
  - Exited → desaturated gray-blue

#### Animation
- 60 FPS smooth animation loop
- Sun glow pulsing
- Orbit glow pulsing for running groups
- Planet rotation along orbit rings
- Particle effects for high CPU (>50%) or restarting containers

### 5. Updated HUD (`web/src/components/HUD.tsx`)
- Added **GROUPS** counter showing total number of groups
- Maintained existing container state counters (RUN/PAUSE/EXIT)
- Shows total containers, CPU average, memory usage, and uptime

## 🎨 Visual Design
- Maintains existing light-blue base with green accents theme
- Orbit rings are subtle and don't clutter the interface
- State-based glows make container relationships obvious
- Smooth animations at 60 FPS
- Responsive layout that scales with viewport size

## 📐 Layout Behavior
- Orbit rings evenly spaced from center (sun)
- Automatic compression when > 6 groups
- All elements stay within viewport bounds (max 46% of viewport)
- Works smoothly on small displays (Fire 7 tablet tested)

## 🔄 Dynamic Updates
- Groups automatically created/removed as containers change
- Planets smoothly added/removed from orbit rings
- Orbit rings redrawn when group membership changes
- Real-time stats updates at 1-2 Hz

## 🎯 Acceptance Criteria Status
✅ Each group appears as a single orbit ring around the sun
✅ Containers orbit smoothly along their group's ring with circular gradients
✅ Colors and glows reflect current container states
✅ Interface remains minimal, readable, and uncluttered
✅ Works smoothly with proper scaling on all screen sizes
✅ No planets or rings drift off-screen

## 🚧 Future Enhancements (Optional)
The following interaction features are designed but not yet implemented:

### Hover/Tooltip Interaction
- Show container details on planet hover
- Display: name, CPU %, memory usage, state

### Ring Focus Mode
- Tap orbit ring to enter focus mode
- Zoom 1.2× on selected ring
- Thicken focused ring
- Show container labels
- Fade other rings to 30% opacity
- Tap background or "Back" to exit

### Implementation Approach
Add to `SolarSystem.tsx`:
```typescript
// Make orbit rings interactive
orbitLine.interactive = true;
orbitLine.cursor = 'pointer';
orbitLine.on('pointerdown', () => handleRingClick(group.key));

// Add tooltip on planet hover
sprite.on('pointerover', () => showTooltip(container));
sprite.on('pointerout', () => hideTooltip());
```

## 🏗️ Build Status
✅ Backend built successfully
✅ Frontend built successfully
✅ No TypeScript errors
✅ Ready for deployment

## 🚀 Deployment
The application is ready to run:
```bash
docker-compose up --build
```

Access at: `http://localhost` (via Caddy reverse proxy)
