export interface ServiceAdapter {
  id: string;
  match: (containerInfo: any) => boolean;
  enrich: (containerInfo: any) => Promise<Record<string, unknown> | null>;
}

export interface MinecraftServiceData extends Record<string, unknown> {
  service: 'minecraft';
  mc: {
    motd?: string;
    playersOnline: number;
    playersMax: number;
    playerList?: string[];
  };
}
