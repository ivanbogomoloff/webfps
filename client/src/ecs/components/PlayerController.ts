export interface PlayerController {
  speed: number;
  sensitivity: number;
  isMoving: boolean;
}

export function createPlayerController(
  speed: number = 5,
  sensitivity: number = 0.003
): PlayerController {
  return {
    speed,
    sensitivity,
    isMoving: false,
  };
}
