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
  | 'run_forward'
  | 'run_backward'
  | 'run_left'
  | 'run_right'
  | 'run_left_d'
  | 'run_right_d'
  | 'run_backward_left_d'
  | 'run_backward_right_d'
  | 'fire'
  | 'walk_fire'
  | 'walk_left_d_fire'
  | 'walk_right_d_fire'
  | 'backwards_fire'
  | 'backwards_left_d_fire'
  | 'backwards_right_d_fire'
  | 'left_fire'
  | 'right_fire'
  | 'idle_crouch_fire'
  | 'walk_crouch_fire'
  | 'walk_crouch_left_d_fire'
  | 'walk_crouch_right_d_fire'
  | 'backwards_crouch_fire'
  | 'backwards_crouch_left_d_fire'
  | 'backwards_crouch_right_d_fire'
  | 'left_crouch_fire'
  | 'right_crouch_fire'
  | 'run_forward_fire'
  | 'run_backward_fire'
  | 'run_left_fire'
  | 'run_right_fire'
  | 'run_left_d_fire'
  | 'run_right_d_fire'
  | 'run_backward_left_d_fire'
  | 'run_backward_right_d_fire'
  | 'jump_up'
  | 'death_back'
  | 'death_crouch';

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
