import GUI from 'three/addons/libs/lil-gui.module.min.js'
import type { WeaponMountType, WeaponTransformValues } from '../../game/weaponVisualAttach'
import { cloneWeaponTransformValues } from './weaponTransformState'

type PlayerViewerUiOptions = {
  playerModelIds: readonly string[]
  weaponIds: readonly string[]
  onPlayerModelChange: (modelId: string) => void
  onWeaponChange: (weaponId: string) => void
  onAnimationChange: (animationName: string) => void
  onAnimationPlayToggle: (isPlaying: boolean) => void
  onAnimationSpeedChange: (speed: number) => void
  onWeaponTransformChange: (values: WeaponTransformValues) => void
  onResetWeaponTransform: () => void
  onCopyWeaponTransform: () => void
}

type UiState = {
  playerModelId: string
  weaponId: string
  animationName: string
  animationPlaying: boolean
  animationSpeed: number
  weaponPosX: number
  weaponPosY: number
  weaponPosZ: number
  weaponRotX: number
  weaponRotY: number
  weaponRotZ: number
  weaponScaleX: number
  weaponScaleY: number
  weaponScaleZ: number
}

export class PlayerViewerUi {
  private readonly gui: GUI
  private readonly state: UiState
  private readonly animationController: GUIController
  private readonly animationPlayingController: GUIController
  private readonly animationSpeedController: GUIController
  private readonly transformControllers: GUIController[] = []
  private readonly mountTypeController: GUIController
  private readonly mountTypeState = { mountType: 'fallback' as WeaponMountType }
  private suppressTransformEvents = false

  constructor(options: PlayerViewerUiOptions) {
    this.state = {
      playerModelId: options.playerModelIds[0] ?? '',
      weaponId: options.weaponIds[0] ?? '',
      animationName: '',
      animationPlaying: true,
      animationSpeed: 1,
      weaponPosX: 0,
      weaponPosY: 0,
      weaponPosZ: 0,
      weaponRotX: 0,
      weaponRotY: 0,
      weaponRotZ: 0,
      weaponScaleX: 1,
      weaponScaleY: 1,
      weaponScaleZ: 1,
    }

    this.gui = new GUI({ title: 'Player Viewer' })

    const playerFolder = this.gui.addFolder('Player')
    playerFolder
      .add(this.state, 'playerModelId', [...options.playerModelIds])
      .name('model')
      .onChange((next: unknown) => {
      options.onPlayerModelChange(String(next))
      })

    const animationFolder = this.gui.addFolder('Animation')
    this.animationController = animationFolder.add(this.state, 'animationName', ['']).name('clip')
    this.animationController.onChange((next: unknown) => {
      options.onAnimationChange(String(next))
    })
    this.animationPlayingController = animationFolder.add(this.state, 'animationPlaying').name('playing')
    this.animationPlayingController.onChange((next: unknown) => {
      options.onAnimationPlayToggle(Boolean(next))
    })
    this.animationSpeedController = animationFolder
      .add(this.state, 'animationSpeed', 0, 2, 0.01)
      .name('speed')
    this.animationSpeedController.onChange((next: unknown) => options.onAnimationSpeedChange(Number(next)))

    const weaponFolder = this.gui.addFolder('Weapon')
    weaponFolder.add(this.state, 'weaponId', [...options.weaponIds]).name('model').onChange((next: unknown) => {
      options.onWeaponChange(String(next))
    })
    this.mountTypeController = weaponFolder.add(this.mountTypeState, 'mountType', ['fallback', 'socket']).name('mount')
    this.mountTypeController.disable()
    weaponFolder.add({ reset: options.onResetWeaponTransform }, 'reset')
    weaponFolder.add({ copy: options.onCopyWeaponTransform }, 'copy')

    const transformFolder = this.gui.addFolder('Weapon Transform')
    this.transformControllers.push(
      transformFolder.add(this.state, 'weaponPosX', -5, 5, 0.001).name('pos.x'),
      transformFolder.add(this.state, 'weaponPosY', -5, 5, 0.001).name('pos.y'),
      transformFolder.add(this.state, 'weaponPosZ', -5, 5, 0.001).name('pos.z'),
      transformFolder.add(this.state, 'weaponRotX', -Math.PI * 2, Math.PI * 2, 0.001).name('rot.x'),
      transformFolder.add(this.state, 'weaponRotY', -Math.PI * 2, Math.PI * 2, 0.001).name('rot.y'),
      transformFolder.add(this.state, 'weaponRotZ', -Math.PI * 2, Math.PI * 2, 0.001).name('rot.z'),
      transformFolder.add(this.state, 'weaponScaleX', 0.001, 200, 0.001).name('scale.x'),
      transformFolder.add(this.state, 'weaponScaleY', 0.001, 200, 0.001).name('scale.y'),
      transformFolder.add(this.state, 'weaponScaleZ', 0.001, 200, 0.001).name('scale.z'),
    )
    this.transformControllers.forEach((controller) => {
      controller.onChange(() => {
        if (this.suppressTransformEvents) return
        options.onWeaponTransformChange(this.getTransformValues())
      })
    })
  }

  setAnimationOptions(names: readonly string[], selectedName: string): void {
    const options = names.length > 0 ? [...names] : ['']
    this.animationController.options(options)
    const fallback = options[0] ?? ''
    this.state.animationName = options.includes(selectedName) ? selectedName : fallback
    this.animationController.updateDisplay()
  }

  setAnimationState(isPlaying: boolean, speed: number): void {
    this.state.animationPlaying = isPlaying
    this.state.animationSpeed = speed
    this.animationPlayingController.updateDisplay()
    this.animationSpeedController.updateDisplay()
  }

  setMountType(mountType: WeaponMountType): void {
    this.mountTypeState.mountType = mountType
    this.mountTypeController.updateDisplay()
  }

  setTransformValues(values: WeaponTransformValues): void {
    const next = cloneWeaponTransformValues(values)
    this.suppressTransformEvents = true
    this.state.weaponPosX = next.position.x
    this.state.weaponPosY = next.position.y
    this.state.weaponPosZ = next.position.z
    this.state.weaponRotX = next.rotation.x
    this.state.weaponRotY = next.rotation.y
    this.state.weaponRotZ = next.rotation.z
    this.state.weaponScaleX = next.scale.x
    this.state.weaponScaleY = next.scale.y
    this.state.weaponScaleZ = next.scale.z
    this.transformControllers.forEach((controller) => controller.updateDisplay())
    this.suppressTransformEvents = false
  }

  getTransformValues(): WeaponTransformValues {
    return {
      position: {
        x: this.state.weaponPosX,
        y: this.state.weaponPosY,
        z: this.state.weaponPosZ,
      },
      rotation: {
        x: this.state.weaponRotX,
        y: this.state.weaponRotY,
        z: this.state.weaponRotZ,
      },
      scale: {
        x: this.state.weaponScaleX,
        y: this.state.weaponScaleY,
        z: this.state.weaponScaleZ,
      },
    }
  }

  dispose(): void {
    this.gui.destroy()
  }
}

type GUIController = ReturnType<GUI['add']>
