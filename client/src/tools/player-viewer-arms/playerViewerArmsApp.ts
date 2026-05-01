import * as THREE from 'three'
import GUI from 'three/addons/libs/lil-gui.module.min.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  DEFAULT_WEAPON_ID,
  SUPPORTED_WEAPON_IDS,
  getWeaponFpPoseByAnimation,
  resolveWeaponId,
  weaponModelGltfPath,
} from '../../config/weaponCatalog'
import {
  WEAPON_ANIMATION_POSE_KEYS,
  cloneWeaponFpPoseByAnimation,
  cloneWeaponTransformValues,
  type WeaponAnimationPoseKey,
  type WeaponFpPoseByAnimation,
  type WeaponTransformValues,
} from '../../config/weapons/types'
import { loadSupportedWeaponModelTemplates } from '../../game/weapon/weaponModelTemplates'
import { applyWeaponTransformValues, replaceWeaponVisual } from '../../game/weapon/weaponVisualAttach'

type UiState = {
  weaponId: string
  poseKey: WeaponAnimationPoseKey
  animationName: string
  animationPlaying: boolean
  animationSpeed: number
  animationStatus: string
  brightness: number
  weaponPosX: number
  weaponPosY: number
  weaponPosZ: number
  weaponRotX: number
  weaponRotY: number
  weaponRotZ: number
  weaponScale: number
}

function toFixed4(value: number): string {
  return value.toFixed(4)
}

function toUniformScaleValue(scale: WeaponTransformValues['scale']): number {
  return (scale.x + scale.y + scale.z) / 3
}

const WEAPON_ANIMATION_CLIP_WHITELIST = ['idle', 'walk', 'run', 'fire', 'reload'] as const

class PlayerViewerArmsApp {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, 0.01, 100)
  private readonly fpRoot = new THREE.Group()
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.72)
  private readonly hemiLight = new THREE.HemisphereLight(0xaed2ff, 0x1a2030, 0.82)
  private readonly keyLight = new THREE.DirectionalLight(0xffffff, 1.3)
  private readonly fillLight = new THREE.DirectionalLight(0x9cc3ff, 0.65)
  private readonly clock = new THREE.Clock()
  private readonly loader = new GLTFLoader()
  private readonly root = document.createElement('div')
  private readonly hintElement = document.createElement('div')
  private readonly weaponTemplatesPromise = loadSupportedWeaponModelTemplates()
  private readonly gui = new GUI({ title: 'Player Viewer FP Arms', width: 430 })
  private readonly animationFolder: GUI
  private animationController: GUIController
  private readonly animationPlayingController: GUIController
  private readonly animationSpeedController: GUIController
  private readonly animationStatusController: GUIController
  private readonly transformControllers: GUIController[] = []
  private animationSelectElement: HTMLSelectElement | null = null
  private suppressTransformEvents = false

  private weaponObject: THREE.Object3D | null = null
  private mixer: THREE.AnimationMixer | null = null
  private activeAction: THREE.AnimationAction | null = null
  private animationClips: THREE.AnimationClip[] = []
  private animationActionByName = new Map<string, THREE.AnimationAction>()
  private readonly clipCacheByWeaponId = new Map<string, readonly THREE.AnimationClip[]>()
  private currentWeaponId = DEFAULT_WEAPON_ID
  private currentPoseKey: WeaponAnimationPoseKey = 'idle'
  private currentFpPlacementByAnimation: WeaponFpPoseByAnimation = cloneWeaponFpPoseByAnimation(
    getWeaponFpPoseByAnimation(DEFAULT_WEAPON_ID),
  )
  private currentTransform: WeaponTransformValues = cloneWeaponTransformValues(
    this.currentFpPlacementByAnimation[this.currentPoseKey],
  )
  private initialTransform: WeaponTransformValues = cloneWeaponTransformValues(this.currentTransform)

  private readonly state: UiState = {
    weaponId: DEFAULT_WEAPON_ID,
    poseKey: 'idle',
    animationName: '',
    animationPlaying: true,
    animationSpeed: 1,
    animationStatus: 'none',
    brightness: 3,
    weaponPosX: this.currentTransform.position.x,
    weaponPosY: this.currentTransform.position.y,
    weaponPosZ: this.currentTransform.position.z,
    weaponRotX: this.currentTransform.rotation.x,
    weaponRotY: this.currentTransform.rotation.y,
    weaponRotZ: this.currentTransform.rotation.z,
    weaponScale: toUniformScaleValue(this.currentTransform.scale),
  }

  constructor() {
    this.root.id = 'player-viewer-arms-root'
    document.body.appendChild(this.root)
    this.hintElement.id = 'player-viewer-arms-hint'
    document.body.appendChild(this.hintElement)

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.root.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x0a0f17)
    this.scene.fog = new THREE.Fog(0x0a0f17, 3.2, 11.5)
    this.scene.add(this.ambientLight)
    this.scene.add(this.hemiLight)
    this.scene.add(this.keyLight)
    this.scene.add(this.fillLight)
    this.scene.add(new THREE.AxesHelper(0.22))
    this.scene.add(this.createRoomReference())

    this.camera.position.set(0, 0, 0)
    this.scene.add(this.camera)
    this.fpRoot.name = 'FpViewerWeaponRoot'
    this.fpRoot.position.set(0.28, -0.26, -0.44)
    this.camera.add(this.fpRoot)

    this.keyLight.position.set(1.8, 2.4, 1.6)
    this.fillLight.position.set(-2.2, 1.6, -1.2)
    this.updateLightingBrightness()

    this.animationFolder = this.gui.addFolder('Animation')
    this.animationController = this.animationFolder.add(this.state, 'animationName', ['']).name('clip')
    this.bindAnimationControllerEvents()
    this.bindAnimationSelectDomChangeListener()
    this.animationPlayingController = this.animationFolder.add(this.state, 'animationPlaying').name('playing')
    this.animationPlayingController.onChange((next: unknown) => {
      const isPlaying = Boolean(next)
      this.state.animationPlaying = isPlaying
      if (this.activeAction) {
        this.activeAction.paused = !isPlaying
        if (isPlaying && !this.activeAction.isRunning()) {
          this.activeAction.reset().play()
        }
      } else if (isPlaying && this.state.animationName) {
        this.playAnimation(this.state.animationName)
      }
      this.updateAnimationRuntimeStatus()
    })
    this.animationSpeedController = this.animationFolder
      .add(this.state, 'animationSpeed', 0, 2, 0.01)
      .name('speed')
    this.animationSpeedController.onChange((next: unknown) => {
      this.state.animationSpeed = Number(next)
      if (this.activeAction) {
        this.activeAction.setEffectiveTimeScale(this.state.animationSpeed)
      }
    })
    this.animationStatusController = this.animationFolder.add(this.state, 'animationStatus').name('status')
    this.animationStatusController.disable()

    this.setupUi()
    this.refreshHint('Измени pose и скопируй fpPlacementByAnimation в config оружия.')
  }

  async start(): Promise<void> {
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('beforeunload', this.dispose)
    await this.loadWeapon(this.state.weaponId)
    this.animate()
  }

  private setupUi(): void {
    const weaponFolder = this.gui.addFolder('Weapon')
    weaponFolder
      .add(this.state, 'weaponId', [...SUPPORTED_WEAPON_IDS])
      .name('model')
      .onChange((next: unknown) => {
        this.state.weaponId = String(next)
        void this.loadWeapon(this.state.weaponId)
      })

    weaponFolder
      .add(this.state, 'poseKey', [...WEAPON_ANIMATION_POSE_KEYS])
      .name('pose key')
      .onChange((next: unknown) => {
        this.currentPoseKey = String(next) as WeaponAnimationPoseKey
        this.applyCurrentPoseToWeapon()
      })

    weaponFolder.add({ reset: () => this.handleResetTransform() }, 'reset')
    weaponFolder.add({ copyCurrent: () => void this.copyCurrentPoseSnippet() }, 'copyCurrent')
    weaponFolder.add({ copyAll: () => void this.copyAllPosesSnippet() }, 'copyAll')

    const lightFolder = this.gui.addFolder('Lighting')
    lightFolder
      .add(this.state, 'brightness', 0, 3, 0.01)
      .name('brightness')
      .onChange((next: unknown) => {
        this.state.brightness = Number(next)
        this.updateLightingBrightness()
      })

    const transformFolder = this.gui.addFolder('Weapon Transform')
    this.transformControllers.push(
      transformFolder.add(this.state, 'weaponPosX', -4, 4, 0.001).name('pos.x'),
      transformFolder.add(this.state, 'weaponPosY', -4, 4, 0.001).name('pos.y'),
      transformFolder.add(this.state, 'weaponPosZ', -4, 4, 0.001).name('pos.z'),
      transformFolder.add(this.state, 'weaponRotX', -Math.PI * 2, Math.PI * 2, 0.001).name('rot.x'),
      transformFolder.add(this.state, 'weaponRotY', -Math.PI * 2, Math.PI * 2, 0.001).name('rot.y'),
      transformFolder.add(this.state, 'weaponRotZ', -Math.PI * 2, Math.PI * 2, 0.001).name('rot.z'),
      transformFolder.add(this.state, 'weaponScale', 0.001, 200, 0.001).name('scale'),
    )
    this.transformControllers.forEach((controller) => {
      controller.onChange(() => {
        if (this.suppressTransformEvents) return
        this.onTransformChanged()
      })
    })
  }

  private onTransformChanged(): void {
    this.currentTransform = {
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
    this.currentFpPlacementByAnimation[this.currentPoseKey] = cloneWeaponTransformValues(this.currentTransform)
    if (this.weaponObject) {
      applyWeaponTransformValues(this.weaponObject, this.currentTransform)
    }
    this.refreshHint()
  }

  private handleResetTransform(): void {
    this.currentTransform = cloneWeaponTransformValues(this.initialTransform)
    this.currentFpPlacementByAnimation[this.currentPoseKey] = cloneWeaponTransformValues(this.currentTransform)
    if (this.weaponObject) {
      applyWeaponTransformValues(this.weaponObject, this.currentTransform)
    }
    this.syncTransformUi(this.currentTransform)
    this.refreshHint()
  }

  private applyCurrentPoseToWeapon(): void {
    this.state.poseKey = this.currentPoseKey
    this.currentTransform = cloneWeaponTransformValues(this.currentFpPlacementByAnimation[this.currentPoseKey])
    this.initialTransform = cloneWeaponTransformValues(this.currentTransform)
    if (this.weaponObject) {
      applyWeaponTransformValues(this.weaponObject, this.currentTransform)
    }
    this.syncTransformUi(this.currentTransform)
    this.refreshHint()
  }

  private syncTransformUi(values: WeaponTransformValues): void {
    this.suppressTransformEvents = true
    this.state.weaponPosX = values.position.x
    this.state.weaponPosY = values.position.y
    this.state.weaponPosZ = values.position.z
    this.state.weaponRotX = values.rotation.x
    this.state.weaponRotY = values.rotation.y
    this.state.weaponRotZ = values.rotation.z
    this.state.weaponScale = toUniformScaleValue(values.scale)
    this.transformControllers.forEach((controller) => controller.updateDisplay())
    this.suppressTransformEvents = false
  }

  private setAnimationOptions(names: readonly string[], selectedName: string): void {
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

  private bindAnimationControllerEvents(): void {
    const emitAnimationChange = (next: unknown) => {
      this.state.animationName = String(next)
      this.playAnimation(this.state.animationName)
    }
    this.animationController.onChange(emitAnimationChange)
    this.animationController.onFinishChange(emitAnimationChange)
  }

  private readonly handleAnimationSelectDomChange = (): void => {
    if (!this.animationSelectElement) return
    this.state.animationName = this.animationSelectElement.value
    this.playAnimation(this.state.animationName)
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

  private resolveAvailableAnimationNames(clips: readonly THREE.AnimationClip[]): string[] {
    const names = clips.map((clip) => clip.name).filter((name) => name.trim().length > 0)
    const normalizedToName = new Map<string, string>()
    names.forEach((name) => {
      const normalized = name.trim().toLowerCase()
      if (!normalizedToName.has(normalized)) {
        normalizedToName.set(normalized, name)
      }
    })

    const available: string[] = []
    for (const key of WEAPON_ANIMATION_CLIP_WHITELIST) {
      const direct = normalizedToName.get(key)
      if (direct) {
        available.push(direct)
        continue
      }
      const fuzzy = names.find((name) => name.trim().toLowerCase().includes(key))
      if (fuzzy) {
        available.push(fuzzy)
      }
    }

    return [...new Set(available)]
  }

  private pickDefaultAnimation(animationNames: readonly string[]): string {
    if (animationNames.length === 0) return ''
    const idle = animationNames.find((name) => name.toLowerCase().includes('idle'))
    return idle ?? animationNames[0]!
  }

  private setupWeaponAnimations(clips: readonly THREE.AnimationClip[]): void {
    this.animationClips = [...clips]
    this.animationActionByName.clear()
    this.activeAction = null

    if (!this.weaponObject) {
      this.mixer = null
      this.setAnimationOptions([], '')
      this.updateAnimationRuntimeStatus('none')
      return
    }

    this.mixer = new THREE.AnimationMixer(this.weaponObject)
    this.animationActionByName = new Map(
      this.animationClips.map((clip) => {
        const action = this.mixer!.clipAction(clip)
        action.enabled = true
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.clampWhenFinished = false
        action.setEffectiveWeight(1)
        action.setEffectiveTimeScale(1)
        return [clip.name, action]
      }),
    )

    const availableNames = this.resolveAvailableAnimationNames(this.animationClips)
    const defaultName = this.pickDefaultAnimation(availableNames)
    this.setAnimationOptions(availableNames, defaultName)
    if (!defaultName) {
      this.updateAnimationRuntimeStatus('none')
      return
    }
    this.playAnimation(defaultName)
  }

  private playAnimation(animationName: string): void {
    if (!this.mixer || !animationName) {
      this.updateAnimationRuntimeStatus('none')
      return
    }
    const nextAction = this.animationActionByName.get(animationName)
    if (!nextAction) {
      this.updateAnimationRuntimeStatus('none')
      return
    }

    this.animationActionByName.forEach((action) => {
      if (action === nextAction) return
      action.stop()
      action.enabled = false
      action.paused = true
      action.setEffectiveWeight(0)
      action.setEffectiveTimeScale(1)
    })

    nextAction.reset()
    nextAction.enabled = true
    nextAction.paused = false
    nextAction.setEffectiveTimeScale(this.state.animationSpeed)
    nextAction.setEffectiveWeight(1)
    if (!this.state.animationPlaying) {
      nextAction.paused = true
    }
    nextAction.play()
    this.activeAction = nextAction
    this.updateAnimationRuntimeStatus()
  }

  private updateAnimationRuntimeStatus(forced?: string): void {
    if (forced) {
      this.state.animationStatus = forced
      this.animationStatusController.updateDisplay()
      return
    }
    if (!this.activeAction) {
      this.state.animationStatus = 'none'
      this.animationStatusController.updateDisplay()
      return
    }
    this.state.animationStatus = this.activeAction.paused
      ? 'paused'
      : this.activeAction.isRunning()
        ? 'playing'
        : 'stopped'
    this.animationStatusController.updateDisplay()
  }

  private buildPoseSnippet(poseKey: WeaponAnimationPoseKey): string {
    const pose = this.currentFpPlacementByAnimation[poseKey]
    const uniformScale = toUniformScaleValue(pose.scale)
    return [
      `${poseKey}: {`,
      `  position: { x: ${toFixed4(pose.position.x)}, y: ${toFixed4(pose.position.y)}, z: ${toFixed4(pose.position.z)} },`,
      `  rotation: { x: ${toFixed4(pose.rotation.x)}, y: ${toFixed4(pose.rotation.y)}, z: ${toFixed4(pose.rotation.z)} },`,
      `  scale: { x: ${toFixed4(uniformScale)}, y: ${toFixed4(uniformScale)}, z: ${toFixed4(uniformScale)} },`,
      '},',
    ].join('\n')
  }

  private buildAllPosesSnippet(): string {
    const lines = WEAPON_ANIMATION_POSE_KEYS.map((poseKey) => `  ${this.buildPoseSnippet(poseKey)}`).join('\n')
    return `fpPlacementByAnimation: {\n${lines}\n},`
  }

  private async copyCurrentPoseSnippet(): Promise<void> {
    const text = this.buildPoseSnippet(this.currentPoseKey)
    try {
      await navigator.clipboard.writeText(text)
      this.refreshHint(`Скопирован key '${this.currentPoseKey}'.\n\n${text}`)
    } catch (error) {
      console.warn('[player-viewer-arms] clipboard write failed', error)
      this.refreshHint(`Clipboard недоступен. Скопируй вручную:\n\n${text}`)
    }
  }

  private async copyAllPosesSnippet(): Promise<void> {
    const text = this.buildAllPosesSnippet()
    try {
      await navigator.clipboard.writeText(text)
      this.refreshHint(`Скопирован полный блок fpPlacementByAnimation.\n\n${text}`)
    } catch (error) {
      console.warn('[player-viewer-arms] clipboard write failed', error)
      this.refreshHint(`Clipboard недоступен. Скопируй вручную:\n\n${text}`)
    }
  }

  private refreshHint(prefix?: string): void {
    const poseSnippet = this.buildPoseSnippet(this.currentPoseKey)
    const text = [
      `weapon: ${this.currentWeaponId}`,
      `pose key: ${this.currentPoseKey}`,
      '',
      poseSnippet,
      '',
      'CopyAll генерирует полный блок fpPlacementByAnimation.',
    ].join('\n')
    this.hintElement.textContent = prefix ? `${prefix}\n\n${text}` : text
  }

  private updateLightingBrightness(): void {
    const k = this.state.brightness
    this.ambientLight.intensity = 0.72 * k
    this.hemiLight.intensity = 0.82 * k
    this.keyLight.intensity = 1.3 * k
    this.fillLight.intensity = 0.65 * k
  }

  private createRoomReference(): THREE.Object3D {
    const room = new THREE.Group()
    room.name = 'FpViewerReferenceRoom'

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.95, metalness: 0.03 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.55
    room.add(floor)

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 8),
      new THREE.MeshStandardMaterial({ color: 0x232c3f, roughness: 0.92, metalness: 0.04 }),
    )
    backWall.position.set(0, 2.2, -7.4)
    room.add(backWall)

    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 6),
      new THREE.MeshStandardMaterial({ color: 0x1d2535, roughness: 0.92, metalness: 0.02 }),
    )
    rightWall.rotation.y = -Math.PI / 2
    rightWall.position.set(6.2, 1.5, -1.2)
    room.add(rightWall)

    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 6),
      new THREE.MeshStandardMaterial({ color: 0x1d2535, roughness: 0.92, metalness: 0.02 }),
    )
    leftWall.rotation.y = Math.PI / 2
    leftWall.position.set(-6.2, 1.5, -1.2)
    room.add(leftWall)

    const horizonGrid = new THREE.GridHelper(20, 20, 0x89a4d8, 0x38465f)
    horizonGrid.position.y = -1.54
    room.add(horizonGrid)

    const centerLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 8),
      new THREE.MeshStandardMaterial({ color: 0xb4c7f8, roughness: 0.55, metalness: 0.15 }),
    )
    centerLine.position.set(0, -1.53, -4)
    room.add(centerLine)

    return room
  }

  private async loadWeaponAnimationClips(weaponId: string): Promise<readonly THREE.AnimationClip[]> {
    const cached = this.clipCacheByWeaponId.get(weaponId)
    if (cached) return cached
    try {
      const gltf = await this.loader.loadAsync(weaponModelGltfPath(resolveWeaponId(weaponId)))
      const clips = gltf.animations ?? []
      this.clipCacheByWeaponId.set(weaponId, clips)
      return clips
    } catch (error) {
      console.warn(`[player-viewer-arms] failed to load clips for '${weaponId}'`, error)
      this.clipCacheByWeaponId.set(weaponId, [])
      return []
    }
  }

  private async loadWeapon(weaponId: string): Promise<void> {
    const resolvedWeaponId = resolveWeaponId(weaponId)
    this.currentWeaponId = resolvedWeaponId
    this.state.weaponId = resolvedWeaponId
    this.currentFpPlacementByAnimation = cloneWeaponFpPoseByAnimation(
      getWeaponFpPoseByAnimation(resolvedWeaponId),
    )
    this.currentPoseKey = this.state.poseKey
    this.currentTransform = cloneWeaponTransformValues(this.currentFpPlacementByAnimation[this.currentPoseKey])
    this.initialTransform = cloneWeaponTransformValues(this.currentTransform)

    try {
      const templates = await this.weaponTemplatesPromise
      const fallbackTemplate = templates.get(DEFAULT_WEAPON_ID) ?? null
      let template = templates.get(resolvedWeaponId) ?? fallbackTemplate
      let loadedClips: readonly THREE.AnimationClip[] = []
      if (!template) {
        const manual = await this.loader.loadAsync(weaponModelGltfPath(resolvedWeaponId))
        template = manual.scene
        loadedClips = manual.animations ?? []
      }
      this.weaponObject = replaceWeaponVisual(this.fpRoot, this.weaponObject, template)
      if (!this.weaponObject) return
      applyWeaponTransformValues(this.weaponObject, this.currentTransform)
      if (loadedClips.length === 0) {
        loadedClips = await this.loadWeaponAnimationClips(resolvedWeaponId)
      }
      this.setupWeaponAnimations(loadedClips)
      this.syncTransformUi(this.currentTransform)
      this.refreshHint()
    } catch (error) {
      console.error(`[player-viewer-arms] failed to load weapon '${weaponId}'`, error)
    }
  }

  private readonly handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private readonly animate = (): void => {
    requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()
    if (this.mixer && this.state.animationPlaying) {
      this.mixer.update(delta)
    }
    this.updateAnimationRuntimeStatus()
    this.renderer.render(this.scene, this.camera)
  }

  private readonly dispose = (): void => {
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('beforeunload', this.dispose)
    if (this.animationSelectElement) {
      this.animationSelectElement.removeEventListener('change', this.handleAnimationSelectDomChange)
      this.animationSelectElement = null
    }
    this.gui.destroy()
    this.renderer.dispose()
  }
}

export async function startPlayerViewerArms(): Promise<void> {
  const app = new PlayerViewerArmsApp()
  await app.start()
}

type GUIController = ReturnType<GUI['add']>
