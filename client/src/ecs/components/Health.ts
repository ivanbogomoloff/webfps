export interface Health {
  current: number;
  max: number;
  isDead: boolean;
}

export function createHealth(max: number = 100): Health {
  return {
    current: max,
    max,
    isDead: false,
  };
}
