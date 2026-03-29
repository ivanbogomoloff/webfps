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
  | 'jump_up';

export interface PlayerController {
  speed: number;
  sensitivity: number;
  locomotion: PlayerLocomotion;
}

export function createPlayerController(
  speed: number = 5,
  sensitivity: number = 0.003
): PlayerController {
  return {
    speed,
    sensitivity,
    locomotion: 'idle',
  };
}
