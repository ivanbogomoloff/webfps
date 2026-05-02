import type { PlayerLocomotion } from './PlayerController'

export interface AudioEmitterState {
  footstepTimerSec: number
  fireCooldownSec: number
  emptyShotCooldownSec: number
  lastEmptyShotCounter: number
  wasGrounded: boolean
  wasReloading: boolean
  wasFireActive: boolean
  lastLocomotion: PlayerLocomotion
}

export function createAudioEmitterState(): AudioEmitterState {
  return {
    footstepTimerSec: 0,
    fireCooldownSec: 0,
    emptyShotCooldownSec: 0,
    lastEmptyShotCounter: 0,
    wasGrounded: true,
    wasReloading: false,
    wasFireActive: false,
    lastLocomotion: 'idle',
  }
}
