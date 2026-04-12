import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  DEFAULT_WEAPON_ID,
  SUPPORTED_WEAPON_IDS,
  getWeaponDefinition,
  getWeaponModelConfig,
  resolveWeaponId,
  weaponModelGltfPath,
} from '../../config/weaponCatalog'
import { cloneWeaponPoseByLocomotion, type WeaponPoseByLocomotion, type WeaponTransformValues } from '../../config/weapons/types'
import type { PlayerLocomotion } from '../../ecs/components/PlayerController'
import { preparePlayerVisualFromGltf } from '../../game/playerModelPrep'
import {
  DEFAULT_PLAYER_MODEL_ID,
  SUPPORTED_PLAYER_MODEL_IDS,
  playerModelGltfPath,
  resolvePlayerModelId,
} from '../../game/supportedPlayerModels'
import {
  applyWeaponTransformValues,
  replaceWeaponVisual,
} from '../../game/weaponVisualAttach'
import { loadSupportedWeaponModelTemplates } from '../../game/weaponModelTemplates'
import { PlayerViewerUi } from './playerViewerUi'
import {
  cloneWeaponTransformValues,
  formatWeaponTransformForCatalog,
} from './weaponTransformState'

type AudioPreviewId =
  | 'footstep_walk'
  | 'footstep_run'
  | 'jump'
  | 'land'
  | 'weapon_m16_shot'
  | 'weapon_ak47_shot'

const AUDIO_PREVIEW_CATALOG: Record<AudioPreviewId, { label: string; src: string }> = {
  footstep_walk: { label: 'footstep_walk', src: '/audio/player/footstep_walk.ogg' },
  footstep_run: { label: 'footstep_run', src: '/audio/player/footstep_run.ogg' },
  jump: { label: 'jump', src: '/audio/player/jump.ogg' },
  land: { label: 'land', src: '/audio/player/land.wav' },
  weapon_m16_shot: { label: 'weapon_m16_shot', src: '/audio/weapons/m16_shot.wav' },
  weapon_ak47_shot: { label: 'weapon_ak47_shot', src: '/audio/weapons/ak47_shot.wav' },
}

class PlayerViewerApp {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300)
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.55)
  private readonly keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
  private readonly orbit: OrbitControls
  private readonly clock = new THREE.Clock()
  private readonly loader = new GLTFLoader()
  private readonly audioLoader = new THREE.AudioLoader()
  private readonly root = document.createElement('div')
  private readonly hintElement = document.createElement('div')
  private readonly ui: PlayerViewerUi
  private readonly weaponTemplatesPromise = loadSupportedWeaponModelTemplates()
  private readonly audioListener = new THREE.AudioListener()
  private readonly audioPreview = new THREE.Audio(this.audioListener)
  private readonly audioBuffersBySrc = new Map<string, AudioBuffer>()
  private readonly audioLoadPromisesBySrc = new Map<string, Promise<AudioBuffer>>()

  private playerRoot: THREE.Object3D | null = null
  private weaponObject: THREE.Object3D | null = null
  private mixer: THREE.AnimationMixer | null = null
  private activeAction: THREE.AnimationAction | null = null
  private animationClips: THREE.AnimationClip[] = []
  private animationActionByName = new Map<string, THREE.AnimationAction>()
  private currentWeaponId = DEFAULT_WEAPON_ID
  private currentPoseLocomotion: PlayerLocomotion = 'idle'
  private currentPlacementByLocomotion: WeaponPoseByLocomotion = cloneWeaponPoseByLocomotion(
    getWeaponModelConfig(DEFAULT_WEAPON_ID).placementByLocomotion,
  )
  private currentTransform: WeaponTransformValues = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
  private initialTransform: WeaponTransformValues = cloneWeaponTransformValues(this.currentTransform)
  private modelLoadVersion = 0
  private selectedAudioPreviewId: AudioPreviewId = 'footstep_walk'
  private audioVolume = 0.8

  private readonly state = {
    modelId: DEFAULT_PLAYER_MODEL_ID as string,
    weaponId: DEFAULT_WEAPON_ID as string,
    animationName: '',
    animationSpeed: 1,
    animationPlaying: true,
    lightingBrightness: 1,
  }

  constructor() {
    this.root.id = 'player-viewer-root'
    document.body.appendChild(this.root)
    this.hintElement.id = 'player-viewer-hint'
    document.body.appendChild(this.hintElement)

    this.renderer.shadowMap.enabled = true
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.root.appendChild(this.renderer.domElement)

    this.camera.position.set(1.7, 1.5, 2.2)
    this.camera.add(this.audioListener)
    this.audioPreview.setLoop(false)
    this.audioPreview.setVolume(this.audioVolume)
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.target.set(0, 1.0, 0)
    this.orbit.enableDamping = true
    this.orbit.dampingFactor = 0.08
    this.orbit.update()

    this.scene.background = new THREE.Color(0x0a0f17)
    this.scene.add(this.ambientLight)

    this.keyLight.position.set(3, 4, 2)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.width = 1024
    this.keyLight.shadow.mapSize.height = 1024
    this.scene.add(this.keyLight)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshStandardMaterial({ color: 0x1a212c, roughness: 1, metalness: 0 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    this.scene.add(new THREE.GridHelper(18, 18, 0x3c4c66, 0x243347))
    this.scene.add(new THREE.AxesHelper(0.5))

    this.ui = new PlayerViewerUi({
      playerModelIds: SUPPORTED_PLAYER_MODEL_IDS,
      weaponIds: SUPPORTED_WEAPON_IDS,
      onPlayerModelChange: (modelId) => {
        this.state.modelId = modelId
        void this.loadPlayerModel(modelId)
      },
      onWeaponChange: (weaponId) => {
        this.state.weaponId = weaponId
        void this.loadWeapon(weaponId)
      },
      onAnimationChange: (animationName) => {
        this.state.animationName = animationName
        this.currentPoseLocomotion = this.inferLocomotionFromAnimationName(animationName)
        this.ui.setPoseLocomotion(this.currentPoseLocomotion)
        this.applyCurrentPoseToWeapon()
        console.log(`[player-viewer][anim] UI selected clip='${animationName}'`)
        this.playAnimation(animationName)
      },
      onAnimationPlayToggle: (isPlaying) => {
        this.state.animationPlaying = isPlaying
        if (this.activeAction) {
          this.activeAction.paused = !isPlaying
          if (isPlaying && !this.activeAction.isRunning()) {
            console.log(
              `[player-viewer][anim] resume '${this.state.animationName}' (was not running, reset+play)`,
            )
            this.activeAction.reset().play()
          }
          this.updateAnimationRuntimeStatus()
        } else if (isPlaying && this.state.animationName) {
          console.log(`[player-viewer][anim] play toggle requested for '${this.state.animationName}'`)
          this.playAnimation(this.state.animationName)
        }
      },
      onAnimationSpeedChange: (speed) => {
        this.state.animationSpeed = speed
        if (this.activeAction) {
          this.activeAction.setEffectiveTimeScale(speed)
        }
      },
      onLightingBrightnessChange: (brightness) => {
        this.state.lightingBrightness = brightness
        this.updateLightingBrightness()
      },
      onPoseLocomotionChange: (locomotion) => {
        this.currentPoseLocomotion = locomotion
        this.applyCurrentPoseToWeapon()
      },
      onWeaponTransformChange: (values) => {
        this.currentTransform = cloneWeaponTransformValues(values)
        this.currentPlacementByLocomotion[this.currentPoseLocomotion] =
          cloneWeaponTransformValues(this.currentTransform)
        if (this.weaponObject) {
          applyWeaponTransformValues(this.weaponObject, this.currentTransform)
        }
        this.refreshHint()
      },
      onResetWeaponTransform: () => {
        this.currentTransform = cloneWeaponTransformValues(this.initialTransform)
        this.currentPlacementByLocomotion[this.currentPoseLocomotion] =
          cloneWeaponTransformValues(this.currentTransform)
        if (this.weaponObject) {
          applyWeaponTransformValues(this.weaponObject, this.currentTransform)
        }
        this.ui.setTransformValues(this.currentTransform)
        this.refreshHint()
      },
      onCopyWeaponTransform: () => {
        void this.copyCurrentTransform()
      },
      audioPreviewIds: (Object.keys(AUDIO_PREVIEW_CATALOG) as AudioPreviewId[]).map(
        (id) => AUDIO_PREVIEW_CATALOG[id].label,
      ),
      onAudioPreviewChange: (audioId) => {
        this.selectedAudioPreviewId = (audioId in AUDIO_PREVIEW_CATALOG
          ? audioId
          : 'footstep_walk') as AudioPreviewId
      },
      onAudioVolumeChange: (volume) => {
        this.audioVolume = Math.max(0, Math.min(1, volume))
        this.audioPreview.setVolume(this.audioVolume)
      },
      onPlayAudioPreview: () => {
        void this.playSelectedAudioPreview()
      },
      onPlayCurrentWeaponShot: () => {
        void this.playCurrentWeaponShot()
      },
      onStopAudioPreview: () => {
        if (this.audioPreview.isPlaying) {
          this.audioPreview.stop()
        }
      },
    })

    this.updateLightingBrightness()
  }

  async start(): Promise<void> {
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('beforeunload', this.dispose)
    await this.loadPlayerModel(this.state.modelId)
    this.animate()
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
    this.orbit.update()
    this.renderer.render(this.scene, this.camera)
  }

  private async loadPlayerModel(modelId: string): Promise<void> {
    const loadVersion = ++this.modelLoadVersion
    const resolvedModelId = resolvePlayerModelId(modelId)
    try {
      const gltf = await this.loader.loadAsync(playerModelGltfPath(resolvedModelId))
      if (loadVersion !== this.modelLoadVersion) return

      if (this.playerRoot) {
        this.scene.remove(this.playerRoot)
      }
      this.weaponObject = null
      this.activeAction = null
      this.mixer = null
      this.animationActionByName.clear()

      const prepared = preparePlayerVisualFromGltf(gltf)
      this.playerRoot = prepared.visualModel
      this.playerRoot.position.set(0, 0, 0)
      this.scene.add(this.playerRoot)

      this.mixer = new THREE.AnimationMixer(this.playerRoot)
      this.animationClips = gltf.animations
      console.log(
        `[player-viewer][anim] loaded ${this.animationClips.length} clips: ${this.animationClips.map((c) => c.name).join(', ')}`,
      )
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
      const animationNames = this.animationClips.map((clip) => clip.name)
      const defaultAnimation = this.pickDefaultAnimation(animationNames)
      this.state.animationName = defaultAnimation
      this.currentPoseLocomotion = this.inferLocomotionFromAnimationName(defaultAnimation)
      this.ui.setAnimationOptions(animationNames, defaultAnimation)
      this.ui.setAnimationState(this.state.animationPlaying, this.state.animationSpeed)
      this.ui.setPoseLocomotion(this.currentPoseLocomotion)
      this.ui.setAnimationRuntimeStatus('loading')
      this.playAnimation(defaultAnimation)

      await this.loadWeapon(this.state.weaponId)
    } catch (error) {
      console.error(`[player-viewer] failed to load player model '${modelId}'`, error)
    }
  }

  private async loadWeapon(weaponId: string): Promise<void> {
    if (!this.playerRoot) return
    const resolvedWeaponId = resolveWeaponId(weaponId)
    this.currentWeaponId = resolvedWeaponId
    this.currentPlacementByLocomotion = cloneWeaponPoseByLocomotion(
      getWeaponModelConfig(resolvedWeaponId).placementByLocomotion,
    )

    try {
      const templates = await this.weaponTemplatesPromise
      const fallbackTemplate = templates.get(DEFAULT_WEAPON_ID) ?? null
      let template = templates.get(resolvedWeaponId) ?? fallbackTemplate
      if (!template) {
        const manual = await this.loader.loadAsync(weaponModelGltfPath(resolvedWeaponId))
        template = manual.scene
      }

      this.weaponObject = replaceWeaponVisual(this.playerRoot, this.weaponObject, template)
      if (!this.weaponObject) return

      this.currentTransform = cloneWeaponTransformValues(
        this.currentPlacementByLocomotion[this.currentPoseLocomotion],
      )
      this.initialTransform = cloneWeaponTransformValues(this.currentTransform)
      applyWeaponTransformValues(this.weaponObject, this.currentTransform)
      this.ui.setTransformValues(this.currentTransform)
      this.refreshHint()
    } catch (error) {
      console.error(`[player-viewer] failed to load weapon '${weaponId}'`, error)
    }
  }

  private pickDefaultAnimation(animationNames: readonly string[]): string {
    if (animationNames.length === 0) return ''
    const idle = animationNames.find((name) => name.toLowerCase().includes('idle'))
    return idle ?? animationNames[0]!
  }

  private playAnimation(animationName: string): void {
    if (!this.mixer || !animationName) {
      console.log('[player-viewer][anim] skipped play: mixer or animationName missing', {
        hasMixer: Boolean(this.mixer),
        animationName,
      })
      this.updateAnimationRuntimeStatus()
      return
    }
    const nextAction = this.animationActionByName.get(animationName)
    if (!nextAction) {
      console.log(
        `[player-viewer][anim] action not found for '${animationName}'. available: ${[
          ...this.animationActionByName.keys(),
        ].join(', ')}`,
      )
      this.updateAnimationRuntimeStatus()
      return
    }
    const clip = nextAction.getClip()
    console.log(
      `[player-viewer][anim] starting '${animationName}' duration=${clip.duration.toFixed(3)} tracks=${clip.tracks.length}`,
    )
    // Нормализуем состояние: все action полностью выключены, затем включаем только выбранный.
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
    if (this.state.animationPlaying && !nextAction.isRunning()) {
      console.log(`[player-viewer][anim] warning: action '${animationName}' still not running after play()`)
    }
    this.activeAction = nextAction
    this.updateAnimationRuntimeStatus()
  }

  private applyCurrentPoseToWeapon(): void {
    this.currentTransform = cloneWeaponTransformValues(
      this.currentPlacementByLocomotion[this.currentPoseLocomotion],
    )
    this.initialTransform = cloneWeaponTransformValues(this.currentTransform)
    if (this.weaponObject) {
      applyWeaponTransformValues(this.weaponObject, this.currentTransform)
    }
    this.ui.setTransformValues(this.currentTransform)
    this.refreshHint()
  }

  private inferLocomotionFromAnimationName(animationName: string): PlayerLocomotion {
    const normalized = animationName.trim().toLowerCase()
    if (!normalized) return 'idle'
    const direct = normalized as PlayerLocomotion
    if (direct in this.currentPlacementByLocomotion) {
      return direct
    }
    if (normalized.includes('idle')) return normalized.includes('crouch') ? 'idle_crouch' : 'idle'
    if (normalized.includes('jump')) return 'jump_up'
    if (normalized.includes('run')) return 'run_forward'
    if (normalized.includes('back')) return 'backwards'
    if (normalized.includes('left')) return 'left'
    if (normalized.includes('right')) return 'right'
    if (normalized.includes('walk')) return 'walk'
    return 'idle'
  }

  private refreshHint(): void {
    const snippet = formatWeaponTransformForCatalog(
      this.currentWeaponId,
      this.currentPoseLocomotion,
      this.currentTransform,
    )
    this.hintElement.textContent = `Pose key: ${this.currentPoseLocomotion}\n\n${snippet}`
  }

  private updateLightingBrightness(): void {
    const k = this.state.lightingBrightness
    this.ambientLight.intensity = 0.55 * k
    this.keyLight.intensity = 1.2 * k
  }

  private updateAnimationRuntimeStatus(): void {
    if (!this.activeAction) {
      this.ui.setAnimationRuntimeStatus('none')
      return
    }
    const status = this.activeAction.paused
      ? 'paused'
      : this.activeAction.isRunning()
        ? 'playing'
        : 'stopped'
    this.ui.setAnimationRuntimeStatus(status)
  }

  private async copyCurrentTransform(): Promise<void> {
    const snippet = formatWeaponTransformForCatalog(
      this.currentWeaponId,
      this.currentPoseLocomotion,
      this.currentTransform,
    )
    try {
      await navigator.clipboard.writeText(snippet)
      this.hintElement.textContent = `Copied to clipboard.\n\n${snippet}`
    } catch (error) {
      console.warn('[player-viewer] clipboard write failed', error)
      this.hintElement.textContent = `Clipboard unavailable. Copy manually:\n\n${snippet}`
    }
  }

  private async playSelectedAudioPreview(): Promise<void> {
    const entry = AUDIO_PREVIEW_CATALOG[this.selectedAudioPreviewId]
    if (!entry) return
    await this.playAudioBySrc(entry.src)
  }

  private async playCurrentWeaponShot(): Promise<void> {
    const shotSrc = getWeaponDefinition(this.currentWeaponId).audio.shot.src
    await this.playAudioBySrc(shotSrc)
  }

  private async playAudioBySrc(src: string): Promise<void> {
    if (this.audioListener.context.state === 'suspended') {
      await this.audioListener.context.resume()
    }
    if (this.audioPreview.isPlaying) {
      this.audioPreview.stop()
    }
    this.audioPreview.setVolume(this.audioVolume)
    const buffer = await this.loadAudioBuffer(src)
    if (!buffer) return
    this.audioPreview.setBuffer(buffer)
    this.audioPreview.play()
  }

  private async loadAudioBuffer(src: string): Promise<AudioBuffer | null> {
    const cached = this.audioBuffersBySrc.get(src)
    if (cached) return cached
    const pending = this.audioLoadPromisesBySrc.get(src)
    if (pending) return pending
    const promise = this.audioLoader.loadAsync(src)
    this.audioLoadPromisesBySrc.set(src, promise)
    try {
      const loaded = await promise
      this.audioBuffersBySrc.set(src, loaded)
      return loaded
    } catch (error) {
      console.error(`[player-viewer][audio] failed to load '${src}'`, error)
      return null
    } finally {
      this.audioLoadPromisesBySrc.delete(src)
    }
  }

  private readonly dispose = (): void => {
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('beforeunload', this.dispose)
    this.ui.dispose()
    if (this.audioPreview.isPlaying) {
      this.audioPreview.stop()
    }
    this.orbit.dispose()
    this.renderer.dispose()
  }
}

export async function startPlayerViewer(): Promise<void> {
  const app = new PlayerViewerApp()
  await app.start()
}
