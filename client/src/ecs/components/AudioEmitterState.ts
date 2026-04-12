import type { PlayerLocomotion } from './PlayerController'

export interface AudioEmitterState {
  footstepTimerSec: number
  fireCooldownSec: number
  wasGrounded: boolean
  wasFireActive: boolean
  lastLocomotion: PlayerLocomotion
}

export function createAudioEmitterState(): AudioEmitterState {
  return {
    footstepTimerSec: 0,
    fireCooldownSec: 0,
    wasGrounded: true,
    wasFireActive: false,
    lastLocomotion: 'idle',
  }
}
