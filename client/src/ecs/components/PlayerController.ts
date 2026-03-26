/** Какую анимацию локомоции показывать (ввод в локальных осях камеры). */
export type PlayerLocomotion =
  | 'idle'
  | 'walk'
  | 'backwards'
  | 'left_st'
  | 'right_st';

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
