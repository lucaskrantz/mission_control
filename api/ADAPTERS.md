# Service Adapters

Service adapters enrich container stats with service-specific information. This allows Mission Control to display specialized data for different types of applications.

## Minecraft Adapter

The Minecraft adapter queries Minecraft servers to display player counts, MOTD, and player lists in the Mission Control UI.

### Configuration

Add Docker labels to your Minecraft container to enable the adapter:

#### Required Label

```yaml
labels:
  mission.type: minecraft
```

#### Optional Labels (Override Defaults)

```yaml
labels:
  mission.type: minecraft
  mission.mc.host: minecraft-server  # Override host (default: container IP or name)
  mission.mc.queryPort: "25565"      # Override query port (default: 25565)
```

### Example Docker Compose

```yaml
services:
  minecraft:
    image: itzg/minecraft-server:latest
    labels:
      mission.type: minecraft
      mission.mc.queryPort: "25565"
    ports:
      - "25565:25565"
    environment:
      EULA: "TRUE"
      ENABLE_QUERY: "true"  # Important: Enable query protocol
    volumes:
      - ./minecraft-data:/data
```

### What Gets Displayed

When a Minecraft container is selected, the left panel shows:

- **Players**: Current player count / max players (with green indicator when players are online)
- **MOTD**: Server message of the day
- **Player List**: Names of currently connected players (collapsible)

### Technical Details

- Uses Minecraft Server List Ping protocol (read-only, no RCON needed)
- Rate-limited to 1 query per second per container (cached)
- Timeout: 800ms
- Only queries running containers
- Fails gracefully if server is unreachable

### Troubleshooting

**No service data showing up?**

1. Ensure the container has the `mission.type: minecraft` label
2. Verify the Minecraft server has query enabled (`enable-query=true` in server.properties or `ENABLE_QUERY=true` env var)
3. Check API logs for adapter errors
4. Ensure the API container can reach the Minecraft container (same Docker network)

**Connection issues?**

- The adapter tries to connect using the container's IP address or service name
- If using a custom network setup, specify `mission.mc.host` label explicitly
- Default port is 25565; override with `mission.mc.queryPort` if needed

## Adding New Adapters

To add support for other services:

1. Create a new adapter file in `api/src/adapters/` (e.g., `postgres.ts`)
2. Implement the `ServiceAdapter` interface:
   ```typescript
   export const myAdapter: ServiceAdapter = {
     id: 'my-service',
     match: (containerInfo) => {
       // Return true if this adapter should handle this container
     },
     enrich: async (containerInfo) => {
       // Query the service and return enrichment data
       return { service: 'my-service', ... };
     }
   };
   ```
3. Add the adapter to `api/src/adapters/index.ts`
4. Update frontend types in `web/src/types.ts`
5. Add UI rendering in `web/src/components/PlanetDetails.tsx`

### Adapter Best Practices

- **Rate limiting**: Cache results for 1-2 seconds to avoid overwhelming services
- **Timeouts**: Keep connection timeouts short (800-1200ms)
- **Fail gracefully**: Never throw errors that block base stats
- **Security**: Never expose credentials; use Docker labels or env vars
- **LAN-safe**: Only connect within Docker networks, never expose services publicly
