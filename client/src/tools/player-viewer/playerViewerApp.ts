import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  DEFAULT_WEAPON_ID,
  SUPPORTED_WEAPON_IDS,
  resolveWeaponId,
  weaponModelGltfPath,
} from '../../config/weaponCatalog'
import { preparePlayerVisualFromGltf } from '../../game/playerModelPrep'
import {
  DEFAULT_PLAYER_MODEL_ID,
  SUPPORTED_PLAYER_MODEL_IDS,
  playerModelGltfPath,
  resolvePlayerModelId,
} from '../../game/supportedPlayerModels'
import {
  applyWeaponTransformValues,
  findWeaponMount,
  getWeaponMountType,
  replaceWeaponVisual,
  type WeaponMountType,
  type WeaponTransformValues,
} from '../../game/weaponVisualAttach'
import { loadSupportedWeaponModelTemplates } from '../../game/weaponModelTemplates'
import { PlayerViewerUi } from './playerViewerUi'
import {
  cloneWeaponTransformValues,
  formatWeaponTransformForCatalog,
  readWeaponTransformValuesFromObject,
} from './weaponTransformState'

class PlayerViewerApp {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300)
  private readonly orbit: OrbitControls
  private readonly clock = new THREE.Clock()
  private readonly loader = new GLTFLoader()
  private readonly root = document.createElement('div')
  private readonly hintElement = document.createElement('div')
  private readonly ui: PlayerViewerUi
  private readonly weaponTemplatesPromise = loadSupportedWeaponModelTemplates()

  private playerRoot: THREE.Object3D | null = null
  private weaponObject: THREE.Object3D | null = null
  private mixer: THREE.AnimationMixer | null = null
  private activeAction: THREE.AnimationAction | null = null
  private animationClips: THREE.AnimationClip[] = []
  private currentMountType: WeaponMountType = 'fallback'
  private currentWeaponId = DEFAULT_WEAPON_ID
  private currentTransform: WeaponTransformValues = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
  private initialTransform: WeaponTransformValues = cloneWeaponTransformValues(this.currentTransform)
  private modelLoadVersion = 0

  private readonly state = {
    modelId: DEFAULT_PLAYER_MODEL_ID as string,
    weaponId: DEFAULT_WEAPON_ID as string,
    animationName: '',
    animationSpeed: 1,
    animationPlaying: true,
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
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.target.set(0, 1.0, 0)
    this.orbit.enableDamping = true
    this.orbit.dampingFactor = 0.08
    this.orbit.update()

    this.scene.background = new THREE.Color(0x0a0f17)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55))

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(3, 4, 2)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 1024
    keyLight.shadow.mapSize.height = 1024
    this.scene.add(keyLight)

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
        this.playAnimation(animationName)
      },
      onAnimationPlayToggle: (isPlaying) => {
        this.state.animationPlaying = isPlaying
        if (this.activeAction) {
          this.activeAction.paused = !isPlaying
        }
      },
      onAnimationSpeedChange: (speed) => {
        this.state.animationSpeed = speed
        if (this.activeAction) {
          this.activeAction.setEffectiveTimeScale(speed)
        }
      },
      onWeaponTransformChange: (values) => {
        this.currentTransform = cloneWeaponTransformValues(values)
        if (this.weaponObject) {
          applyWeaponTransformValues(this.weaponObject, this.currentTransform)
        }
        this.refreshHint()
      },
      onResetWeaponTransform: () => {
        this.currentTransform = cloneWeaponTransformValues(this.initialTransform)
        if (this.weaponObject) {
          applyWeaponTransformValues(this.weaponObject, this.currentTransform)
        }
        this.ui.setTransformValues(this.currentTransform)
        this.refreshHint()
      },
      onCopyWeaponTransform: () => {
        void this.copyCurrentTransform()
      },
    })
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

      const prepared = preparePlayerVisualFromGltf(gltf)
      this.playerRoot = prepared.visualModel
      this.playerRoot.position.set(0, 0, 0)
      this.scene.add(this.playerRoot)

      this.mixer = new THREE.AnimationMixer(this.playerRoot)
      this.animationClips = gltf.animations
      const animationNames = this.animationClips.map((clip) => clip.name)
      const defaultAnimation = this.pickDefaultAnimation(animationNames)
      this.state.animationName = defaultAnimation
      this.ui.setAnimationOptions(animationNames, defaultAnimation)
      this.ui.setAnimationState(this.state.animationPlaying, this.state.animationSpeed)
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

      const mount = findWeaponMount(this.playerRoot)
      this.currentMountType = getWeaponMountType(this.playerRoot, mount)
      this.ui.setMountType(this.currentMountType)

      this.currentTransform = readWeaponTransformValuesFromObject(this.weaponObject)
      this.initialTransform = cloneWeaponTransformValues(this.currentTransform)
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
    if (!this.mixer || !animationName) return
    const clip = this.animationClips.find((candidate) => candidate.name === animationName)
    if (!clip) return
    const nextAction = this.mixer.clipAction(clip)
    nextAction.reset()
    nextAction.enabled = true
    nextAction.setEffectiveTimeScale(this.state.animationSpeed)
    nextAction.setEffectiveWeight(1)
    nextAction.paused = !this.state.animationPlaying
    nextAction.play()
    if (this.activeAction && this.activeAction !== nextAction) {
      this.activeAction.fadeOut(0.12)
      nextAction.fadeIn(0.12)
    }
    this.activeAction = nextAction
  }

  private refreshHint(): void {
    const snippet = formatWeaponTransformForCatalog(
      this.currentWeaponId,
      this.currentMountType,
      this.currentTransform,
    )
    this.hintElement.textContent = `Mount: ${this.currentMountType}\n\n${snippet}`
  }

  private async copyCurrentTransform(): Promise<void> {
    const snippet = formatWeaponTransformForCatalog(
      this.currentWeaponId,
      this.currentMountType,
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

  private readonly dispose = (): void => {
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('beforeunload', this.dispose)
    this.ui.dispose()
    this.orbit.dispose()
    this.renderer.dispose()
  }
}

export async function startPlayerViewer(): Promise<void> {
  const app = new PlayerViewerApp()
  await app.start()
}
