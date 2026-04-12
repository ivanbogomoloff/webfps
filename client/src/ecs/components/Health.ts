export interface Health {
  current: number;
  max: number;
  isDead: boolean;
  respawnInSec: number;
  forcedLocomotion: 'death_back' | 'death_crouch' | null;
}

export function createHealth(max: number = 100): Health {
  return {
    current: max,
    max,
    isDead: false,
    respawnInSec: 0,
    forcedLocomotion: null,
  };
}
