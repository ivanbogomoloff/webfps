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
  onLightingBrightnessChange: (brightness: number) => void
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
  animationStatus: string
  lightingBrightness: number
  weaponPosX: number
  weaponPosY: number
  weaponPosZ: number
  weaponRotX: number
  weaponRotY: number
  weaponRotZ: number
  weaponScale: number
}

export class PlayerViewerUi {
  private readonly gui: GUI
  private readonly state: UiState
  private readonly onAnimationChange: (animationName: string) => void
  private readonly animationFolder: GUI
  private animationController: GUIController
  private readonly animationPlayingController: GUIController
  private readonly animationSpeedController: GUIController
  private readonly animationStatusController: GUIController
  private readonly transformControllers: GUIController[] = []
  private readonly mountTypeController: GUIController
  private readonly mountTypeState = { mountType: 'fallback' as WeaponMountType }
  private animationSelectElement: HTMLSelectElement | null = null
  private suppressTransformEvents = false

  constructor(options: PlayerViewerUiOptions) {
    this.onAnimationChange = options.onAnimationChange
    this.state = {
      playerModelId: options.playerModelIds[0] ?? '',
      weaponId: options.weaponIds[0] ?? '',
      animationName: '',
      animationPlaying: true,
      animationSpeed: 1,
      animationStatus: 'none',
      lightingBrightness: 1,
      weaponPosX: 0,
      weaponPosY: 0,
      weaponPosZ: 0,
      weaponRotX: 0,
      weaponRotY: 0,
      weaponRotZ: 0,
      weaponScale: 1,
    }

    this.gui = new GUI({ title: 'Player Viewer', width: 420 })

    const playerFolder = this.gui.addFolder('Player')
    playerFolder
      .add(this.state, 'playerModelId', [...options.playerModelIds])
      .name('model')
      .onChange((next: unknown) => {
        options.onPlayerModelChange(String(next))
      })

    this.animationFolder = this.gui.addFolder('Animation')
    this.animationController = this.animationFolder.add(this.state, 'animationName', ['']).name('clip')
    this.bindAnimationControllerEvents()
    this.bindAnimationSelectDomChangeListener()
    this.animationPlayingController = this.animationFolder.add(this.state, 'animationPlaying').name('playing')
    this.animationPlayingController.onChange((next: unknown) => {
      options.onAnimationPlayToggle(Boolean(next))
    })
    this.animationSpeedController = this.animationFolder
      .add(this.state, 'animationSpeed', 0, 2, 0.01)
      .name('speed')
    this.animationSpeedController.onChange((next: unknown) => options.onAnimationSpeedChange(Number(next)))
    this.animationStatusController = this.animationFolder.add(this.state, 'animationStatus').name('status')
    this.animationStatusController.disable()

    const lightingFolder = this.gui.addFolder('Lighting')
    lightingFolder
      .add(this.state, 'lightingBrightness', 0, 3, 0.01)
      .name('brightness')
      .onChange((next: unknown) => options.onLightingBrightnessChange(Number(next)))

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
      transformFolder.add(this.state, 'weaponScale', 0.001, 200, 0.001).name('scale'),
    )
    this.transformControllers.forEach((controller) => {
      controller.onChange(() => {
        if (this.suppressTransformEvents) return
        options.onWeaponTransformChange(this.getTransformValues())
      })
    })
  }

  setAnimationOptions(names: readonly string[], selectedName: string): void {
    const optionValues = names.length > 0 ? [...names] : ['']
    const optionsMap = Object.fromEntries(optionValues.map((value) => [value, value]))
    const fallback = optionValues[0] ?? ''
    this.state.animationName = optionValues.includes(selectedName) ? selectedName : fallback
    this.animationController.destroy()
    this.animationController = this.animationFolder.add(this.state, 'animationName', optionsMap).name('clip')
    this.bindAnimationControllerEvents()
    this.animationController.updateDisplay()
    this.bindAnimationSelectDomChangeListener()
  }

  setAnimationState(isPlaying: boolean, speed: number): void {
    this.state.animationPlaying = isPlaying
    this.state.animationSpeed = speed
    this.animationPlayingController.updateDisplay()
    this.animationSpeedController.updateDisplay()
  }

  setAnimationRuntimeStatus(status: string): void {
    this.state.animationStatus = status
    this.animationStatusController.updateDisplay()
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
    this.state.weaponScale = (next.scale.x + next.scale.y + next.scale.z) / 3
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
        x: this.state.weaponScale,
        y: this.state.weaponScale,
        z: this.state.weaponScale,
      },
    }
  }

  dispose(): void {
    if (this.animationSelectElement) {
      this.animationSelectElement.removeEventListener('change', this.handleAnimationSelectDomChange)
      this.animationSelectElement = null
    }
    this.gui.destroy()
  }

  private readonly handleAnimationSelectDomChange = (): void => {
    if (!this.animationSelectElement) return
    this.state.animationName = this.animationSelectElement.value
    console.log(`[player-viewer][anim] DOM select changed clip='${this.state.animationName}'`)
    this.onAnimationChange(this.state.animationName)
  }

  private bindAnimationSelectDomChangeListener(): void {
    const select = this.animationController.domElement.querySelector('select')
    if (!(select instanceof HTMLSelectElement)) return
    if (this.animationSelectElement === select) return
    if (this.animationSelectElement) {
      this.animationSelectElement.removeEventListener('change', this.handleAnimationSelectDomChange)
    }
    this.animationSelectElement = select
    this.animationSelectElement.addEventListener('change', this.handleAnimationSelectDomChange)
  }

  private bindAnimationControllerEvents(): void {
    const emitAnimationChange = (next: unknown) => {
      this.state.animationName = String(next)
      this.onAnimationChange(this.state.animationName)
    }
    this.animationController.onChange(emitAnimationChange)
    this.animationController.onFinishChange(emitAnimationChange)
  }
}

type GUIController = ReturnType<GUI['add']>
