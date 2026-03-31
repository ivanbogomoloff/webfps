/** Какую анимацию локомоции показывать (ввод в локальных осях камеры). */
export type PlayerLocomotion =
  | 'idle'
  | 'walk'
  | 'walk_left_d'
  | 'walk_right_d'
  | 'backwards'
  | 'backwards_left_d'
  | 'backwards_right_d'
  | 'left'
  | 'right'
  | 'idle_crouch'
  | 'walk_crouch'
  | 'walk_crouch_left_d'
  | 'walk_crouch_right_d'
  | 'backwards_crouch'
  | 'backwards_crouch_left_d'
  | 'backwards_crouch_right_d'
  | 'left_crouch'
  | 'right_crouch'
  | 'jump_up';

export type PlayerMovementMode = 'walk' | 'crouch' | 'run';

export interface PlayerController {
  speed: number;
  sensitivity: number;
  locomotion: PlayerLocomotion;
  movementMode: PlayerMovementMode;
}

export function createPlayerController(
  speed: number = 5,
  sensitivity: number = 0.003
): PlayerController {
  return {
    speed,
    sensitivity,
    locomotion: 'idle',
    movementMode: 'walk',
  };
}
