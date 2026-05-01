import type { World } from 'miniplex'
import * as THREE from 'three'
import type { PlayerController, WeaponState } from '../components'
import type { PlayerAnimation } from '../components/PlayerAnimation'
import { hasAnimationActionForLocomotion } from '../components/PlayerAnimation'
import { toBaseLocomotionFromFire } from '../../game/player/playerLocomotionLogic'
import {
  WEAPON_ANIMATION_POSE_KEYS,
  resolveWeaponAnimationPoseKey,
  type WeaponAnimationPoseKey,
} from '../../config/weapons/types'
import {
  getWeaponFpPoseForAnimation,
  getWeaponPoseForLocomotion,
  resolveWeaponId,
} from '../../game/weapon/supportedWeaponModels'
import { applyWeaponTransformValues } from '../../game/weapon/weaponVisualAttach'
import { getWeaponVisualAnimations } from '../../game/weapon/weaponModelTemplates'

const WEAPON_ANIMATION_CLIP_WHITELIST = WEAPON_ANIMATION_POSE_KEYS

type WeaponFpAnimationRuntime = {
  visual: THREE.Object3D
  mixer: THREE.AnimationMixer | null
  actionByKey: Partial<Record<WeaponAnimationPoseKey, THREE.AnimationAction>>
  currentAnimationKey: WeaponAnimationPoseKey | null
}

function createFpAnimationRuntime(weaponVisual: THREE.Object3D): WeaponFpAnimationRuntime {
  const clips = getWeaponVisualAnimations(weaponVisual)
  if (clips.length === 0) {
    return {
      visual: weaponVisual,
      mixer: null,
      actionByKey: {},
      currentAnimationKey: null,
    }
  }
  const mixer = new THREE.AnimationMixer(weaponVisual)
  const actionByKey: Partial<Record<WeaponAnimationPoseKey, THREE.AnimationAction>> = {}
  const clipByNormalized = new Map<string, THREE.AnimationClip>()
  clips.forEach((clip) => {
    const normalized = clip.name.trim().toLowerCase()
    if (!normalized) return
    if (!clipByNormalized.has(normalized)) {
      clipByNormalized.set(normalized, clip)
    }
  })
  for (const key of WEAPON_ANIMATION_CLIP_WHITELIST) {
    const direct = clipByNormalized.get(key)
    const clip = direct ?? clips.find((candidate) => candidate.name.trim().toLowerCase().includes(key))
    if (!clip) continue
    const action = mixer.clipAction(clip)
    action.enabled = true
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.setEffectiveWeight(1)
    action.setEffectiveTimeScale(1)
    actionByKey[key] = action
  }
  return {
    visual: weaponVisual,
    mixer,
    actionByKey,
    currentAnimationKey: null,
  }
}

function playFpAnimationForKey(runtime: WeaponFpAnimationRuntime, key: WeaponAnimationPoseKey): boolean {
  const nextAction = runtime.actionByKey[key]
  if (!nextAction) {
    runtime.currentAnimationKey = null
    return false
  }
  if (runtime.currentAnimationKey === key && nextAction.isRunning()) {
    return true
  }
  for (const candidateKey of WEAPON_ANIMATION_CLIP_WHITELIST) {
    const action = runtime.actionByKey[candidateKey]
    if (!action || action === nextAction) continue
    action.stop()
    action.enabled = false
    action.paused = true
    action.setEffectiveWeight(0)
    action.setEffectiveTimeScale(1)
  }
  nextAction.reset()
  nextAction.enabled = true
  nextAction.paused = false
  nextAction.setEffectiveWeight(1)
  nextAction.setEffectiveTimeScale(1)
  nextAction.play()
  runtime.currentAnimationKey = key
  return true
}

export function createWeaponPoseByLocomotionSystem(world: World) {
  const appliedKeyByEntity = new WeakMap<object, string>()
  const appliedVisualByEntity = new WeakMap<object, object>()
  const appliedFpKeyByEntity = new WeakMap<object, string>()
  const appliedFpVisualByEntity = new WeakMap<object, object>()
  const fpAnimationRuntimeByEntity = new WeakMap<object, WeaponFpAnimationRuntime>()

  return (deltaTime: number) => {
    for (const entity of world.with('playerController', 'weaponState')) {
      const debugWeaponAnimation = entity as {
        weaponFpAnimationSource?: 'clip' | 'fallback' | '-'
        weaponFpAnimationKey?: WeaponAnimationPoseKey | '-'
      }
      const weaponVisualObject = (entity as { weaponVisualObject?: THREE.Object3D | null }).weaponVisualObject
      const weaponVisualFpObject = (entity as { weaponVisualFpObject?: THREE.Object3D | null }).weaponVisualFpObject
      const playerController = entity.playerController as PlayerController
      const playerAnimation = (entity as { playerAnimation?: PlayerAnimation }).playerAnimation
      const weaponState = entity.weaponState as WeaponState
      const weaponId = resolveWeaponId(weaponState.weaponId)
      const locomotion = playerController.locomotion

      if (weaponVisualFpObject) {
        const previousFpVisual = appliedFpVisualByEntity.get(entity)
        if (previousFpVisual !== weaponVisualFpObject) {
          appliedFpKeyByEntity.delete(entity)
          appliedFpVisualByEntity.set(entity, weaponVisualFpObject)
          fpAnimationRuntimeByEntity.set(entity, createFpAnimationRuntime(weaponVisualFpObject))
        }
        const fpAnimationRuntime = fpAnimationRuntimeByEntity.get(entity)
        if (fpAnimationRuntime?.mixer) {
          fpAnimationRuntime.mixer.update(deltaTime)
        }
        const fpPoseKey = resolveWeaponAnimationPoseKey(locomotion, weaponState.action)
        const hasAnimationForKey = fpAnimationRuntime
          ? playFpAnimationForKey(fpAnimationRuntime, fpPoseKey)
          : false
        debugWeaponAnimation.weaponFpAnimationKey = fpPoseKey
        debugWeaponAnimation.weaponFpAnimationSource = hasAnimationForKey ? 'clip' : 'fallback'
        const fpCacheKey = `${weaponId}:${fpPoseKey}:${hasAnimationForKey ? 'anim' : 'pose'}`
        if (!hasAnimationForKey && appliedFpKeyByEntity.get(entity) !== fpCacheKey) {
          const fpPose = getWeaponFpPoseForAnimation(weaponId, fpPoseKey)
          applyWeaponTransformValues(weaponVisualFpObject, fpPose)
          appliedFpKeyByEntity.set(entity, fpCacheKey)
        } else if (hasAnimationForKey) {
          appliedFpKeyByEntity.set(entity, fpCacheKey)
        }
      } else {
        debugWeaponAnimation.weaponFpAnimationKey = '-'
        debugWeaponAnimation.weaponFpAnimationSource = '-'
      }

      if (!weaponVisualObject || weaponVisualFpObject === weaponVisualObject) {
        continue
      }
      const previousVisual = appliedVisualByEntity.get(entity)
      if (previousVisual !== weaponVisualObject) {
        appliedKeyByEntity.delete(entity)
        appliedVisualByEntity.set(entity, weaponVisualObject)
      }
      const hasFireAnimation = !locomotion.includes('fire')
        || !!playerAnimation && hasAnimationActionForLocomotion(playerAnimation.actionByLocomotion, locomotion)
      const locomotionForPose = hasFireAnimation
        ? locomotion
        : toBaseLocomotionFromFire(locomotion)
      const cacheKey = `${weaponId}:${locomotionForPose}`
      if (appliedKeyByEntity.get(entity) === cacheKey) continue
      const pose = getWeaponPoseForLocomotion(weaponId, locomotionForPose)
      applyWeaponTransformValues(weaponVisualObject, pose)
      appliedKeyByEntity.set(entity, cacheKey)
    }
  }
}
