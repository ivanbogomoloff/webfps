export type Waypoint = { x: number; y: number; z: number };

export type NavEdge = { from: number; to: number; weight: number };

export type BotNavGraphData = {
  mapId: string;
  waypoints: Waypoint[];
  edges: NavEdge[];
  builtAtMs: number;
};

export type BotPosition = { x: number; y: number; z: number; rotY: number };

export type BotTarget = {
  playerId: string;
  x: number;
  y: number;
  z: number;
  distance: number;
};

export type BotCombatDecision = {
  targetId: string | null;
  rotY: number;
  shouldShoot: boolean;
  shouldReload: boolean;
  shouldSwitchWeapon: boolean;
  nextWeaponId: string | null;
  locomotion: string;
};

export type BotMovementDecision = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  locomotion: string;
  waypointIndex: number;
  path: number[];
};
