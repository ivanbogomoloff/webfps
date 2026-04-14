import './main.css'
import { Game } from './game/Game'
import { loadSupportedPlayerModelTemplates } from './game/playerModelTemplates'
import { loadSupportedWeaponModelTemplates } from './game/weaponModelTemplates'
import { clonePlayerVisualSetup, DEFAULT_PLAYER_RADIUS } from './game/playerModelPrep'
import { DEFAULT_PLAYER_MODEL_ID, resolvePlayerModelId } from './game/supportedPlayerModels'
import { DEFAULT_WEAPON_ID, resolveWeaponId, SUPPORTED_WEAPON_IDS } from './game/supportedWeaponModels'
import type { GameTransport, TransportConnectParams } from './net/GameTransport'
import { WsTransport } from './net/WsTransport'

const DEFAULT_WS_URL = 'ws://localhost:8080/ws'
const DEBUG_HUD =
  typeof import.meta !== 'undefined' &&
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_DEBUG_HUD === 'true'

type Mode = 'loopback_bot' | 'online'
type StartOptions = {
  mode: Mode
  wsUrl: string
  roomCode: string
  nickname: string
  modelId: string
  weaponId: string
  mapId: string
  timeLimitSec: number
  fragLimit: number
  startAsPlayer: boolean
}

let game: Game | null = null

function resolveMapAssets(mapId: string): { mapPath: string; hdrPath: string } {
  const normalizedMapId = mapId.trim() || 'test2'
  return {
    mapPath: `/models/maps/${normalizedMapId}/map_${normalizedMapId}.glb`,
    hdrPath: `/models/maps/${normalizedMapId}/map_${normalizedMapId}.hdr`,
  }
}

async function startGame(options: StartOptions): Promise<void> {
  const templates = await loadSupportedPlayerModelTemplates()
  const weaponTemplates = await loadSupportedWeaponModelTemplates()
  const resolvedModelId = resolvePlayerModelId(options.modelId.trim() || DEFAULT_PLAYER_MODEL_ID)
  const resolvedWeaponId = resolveWeaponId(options.weaponId.trim() || DEFAULT_WEAPON_ID)
  const transport: GameTransport = new WsTransport(options.wsUrl)
  const connectParams: TransportConnectParams = {
    roomCode: options.roomCode.trim(),
    nickname: options.nickname.trim() || 'Player',
    modelId: resolvedModelId,
    weaponId: resolvedWeaponId,
    mapId: options.mapId.trim() || 'test2',
    timeLimitSec: options.timeLimitSec,
    fragLimit: options.fragLimit,
  }
  await transport.connect(connectParams)

  const template =
    templates.get(resolvedModelId) ?? templates.get(DEFAULT_PLAYER_MODEL_ID)!
  const localVisual = clonePlayerVisualSetup(template)

  game = new Game({
    transport,
    localNickname: connectParams.nickname,
    localModelId: connectParams.modelId,
    localWeaponId: connectParams.weaponId,
    playerModelTemplates: templates,
    weaponModelTemplates: weaponTemplates,
  })
  game.enableHud(
    {
      debugHudRootElement: debugHudElement,
      debugHudContentElement,
      gameHudElement,
      scoreboardHudElement,
      crosshairElement,
    },
    10,
    DEBUG_HUD,
  )
  game.createPlayer(localVisual, DEFAULT_PLAYER_RADIUS)

  try {
    const { mapPath, hdrPath } = resolveMapAssets(connectParams.mapId)
    await game.loadMap(
      mapPath,
      hdrPath,
    )
  } catch (error) {
    console.error('Failed to load game:', error)
  } finally {
    game.start()
    matchControls.style.display = DEBUG_HUD ? 'flex' : 'none'
    game.setLocalRole(options.startAsPlayer ? 'player' : 'spectator')
    if (options.startAsPlayer) {
      game.requestSpawn()
    }
  }
}

function createLobbyUI(onStart: (options: StartOptions) => void): void {
  const root = document.createElement('div')
  root.id = 'multiplayer-lobby'
  root.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5, 8, 15, 0.85);
    color: #fff;
    z-index: 3000;
    font-family: system-ui, sans-serif;
  `
  root.innerHTML = `
    <div style="width: min(520px, calc(100vw - 24px)); background: #111825; border: 1px solid #263146; border-radius: 12px; padding: 16px;">
      <h2 style="margin: 0 0 14px;">FFA Multiplayer</h2>
      <label style="display:block; margin-bottom:8px;">Mode
        <select id="mode" style="width:100%; margin-top:4px;">
          <option value="loopback_bot" selected>loopback + bot (server)</option>
          <option value="online">online (websocket)</option>
        </select>
      </label>
      <label style="display:block; margin-bottom:8px;">WebSocket URL
        <input id="wsUrl" value="${DEFAULT_WS_URL}" style="width:100%; margin-top:4px;" />
      </label>
      <label style="display:block; margin-bottom:8px;">Room code (4 digits, empty=create)
        <input id="roomCode" maxlength="4" placeholder="e.g. 1234" style="width:100%; margin-top:4px;" />
      </label>
      <label style="display:block; margin-bottom:8px;">Nickname
        <input id="nickname" value="Player" maxlength="24" style="width:100%; margin-top:4px;" />
      </label>
      <label style="display:block; margin-bottom:8px;">Model ID
        <input id="modelId" value="player1" style="width:100%; margin-top:4px;" />
      </label>
      <label style="display:block; margin-bottom:8px;">Weapon ID
        <input id="weaponId" value="${DEFAULT_WEAPON_ID}" style="width:100%; margin-top:4px;" />
      </label>
      <label style="display:block; margin-bottom:8px;">Map ID
        <input id="mapId" value="test2" style="width:100%; margin-top:4px;" />
      </label>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <label style="display:block; flex:1;">Time limit (sec)
          <input id="timeLimit" type="number" min="30" value="600" style="width:100%; margin-top:4px;" />
        </label>
        <label style="display:block; flex:1;">Frag limit
          <input id="fragLimit" type="number" min="1" value="25" style="width:100%; margin-top:4px;" />
        </label>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button id="joinSpec" style="flex:1;">Join as spectator</button>
        <button id="joinPlayer" style="flex:1;">Enter match as player</button>
      </div>
      <div id="lobbyError" style="margin-top:10px; min-height:1.2em; color:#ff8888;"></div>
    </div>
  `
  document.body.appendChild(root)

  const getEl = <T extends HTMLElement>(id: string) => root.querySelector(`#${id}`) as T
  const mode = getEl<HTMLSelectElement>('mode')
  const wsUrl = getEl<HTMLInputElement>('wsUrl')
  const roomCode = getEl<HTMLInputElement>('roomCode')
  const nickname = getEl<HTMLInputElement>('nickname')
  const modelId = getEl<HTMLInputElement>('modelId')
  const weaponId = getEl<HTMLInputElement>('weaponId')
  const mapId = getEl<HTMLInputElement>('mapId')
  const timeLimit = getEl<HTMLInputElement>('timeLimit')
  const fragLimit = getEl<HTMLInputElement>('fragLimit')
  const error = getEl<HTMLDivElement>('lobbyError')
  const joinSpec = getEl<HTMLButtonElement>('joinSpec')
  const joinPlayer = getEl<HTMLButtonElement>('joinPlayer')

  const submit = async (startAsPlayer: boolean) => {
    try {
      error.textContent = ''
      const selectedMode = mode.value === 'online' ? 'online' : 'loopback_bot'
      if (roomCode.value.trim() !== '' && !/^\d{4}$/.test(roomCode.value.trim())) {
        throw new Error('Room code must be exactly 4 digits')
      }
      const options: StartOptions = {
        mode: selectedMode,
        wsUrl: wsUrl.value.trim() || DEFAULT_WS_URL,
        roomCode: roomCode.value.trim(),
        nickname: nickname.value.trim(),
        modelId: modelId.value.trim(),
        weaponId: weaponId.value.trim(),
        mapId: mapId.value.trim(),
        timeLimitSec: Number(timeLimit.value) || 600,
        fragLimit: Number(fragLimit.value) || 25,
        startAsPlayer,
      }
      joinSpec.disabled = true
      joinPlayer.disabled = true
      await onStart(options)
      root.remove()
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : 'Failed to start game'
      joinSpec.disabled = false
      joinPlayer.disabled = false
    }
  }

  joinSpec.addEventListener('click', () => {
    void submit(false)
  })
  joinPlayer.addEventListener('click', () => {
    void submit(true)
  })
}

createLobbyUI((options) => startGame(options))

// Отладочный HUD (показывается только при VITE_DEBUG_HUD=true)
const debugHudElement = document.createElement('div')
debugHudElement.id = 'hud-debug'
debugHudElement.style.cssText = `
  position: fixed;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #0f0;
  font-family: monospace;
  padding: 10px;
  border: 1px solid #0f0;
  z-index: 1000;
  font-size: 12px;
  line-height: 1.5;
  display: none;
`
document.body.appendChild(debugHudElement)
const debugHudContentElement = document.createElement('div')
debugHudElement.appendChild(debugHudContentElement)

// Игровой HUD (всегда включён): здоровье внизу экрана
const gameHudElement = document.createElement('div')
gameHudElement.id = 'hud-game'
gameHudElement.style.cssText = `
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-family: system-ui, sans-serif;
  font-size: 22px;
  line-height: 1;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  z-index: 1000;
  pointer-events: none;
  display: none;
`
gameHudElement.textContent = '❤ 100/100'
document.body.appendChild(gameHudElement)

// Scoreboard HUD (на зажатие Tab)
const scoreboardHudElement = document.createElement('div')
scoreboardHudElement.id = 'hud-scoreboard'
scoreboardHudElement.style.cssText = `
  position: fixed;
  left: 50%;
  top: 80px;
  transform: translateX(-50%);
  min-width: 320px;
  max-width: min(560px, calc(100vw - 24px));
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  line-height: 1.35;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(157, 221, 255, 0.5);
  z-index: 1200;
  pointer-events: none;
  display: none;
  white-space: pre-wrap;
`
document.body.appendChild(scoreboardHudElement)

const crosshairElement = document.createElement('div')
crosshairElement.id = 'hud-crosshair'
crosshairElement.style.display = 'none'
crosshairElement.textContent = '+'
document.body.appendChild(crosshairElement)

const matchControls = document.createElement('div')
matchControls.style.cssText = `
  margin-top: 8px;
  display: none;
  gap: 8px;
`
matchControls.innerHTML = `
  <button id="btnSpectator">Spectator</button>
  <button id="btnEnterMatch">Enter Match</button>
  <button id="btnToggleView">Toggle View</button>
  <button id="btnAddBot">Add Bot</button>
  <button id="btnHitSelf">Hit Self</button>
`
debugHudElement.appendChild(matchControls)

;(matchControls.querySelector('#btnSpectator') as HTMLButtonElement).addEventListener('click', () => {
  game?.setLocalRole('spectator')
})
;(matchControls.querySelector('#btnEnterMatch') as HTMLButtonElement).addEventListener('click', () => {
  game?.setLocalRole('player')
  game?.requestSpawn()
})
;(matchControls.querySelector('#btnToggleView') as HTMLButtonElement).addEventListener('click', () => {
  game?.toggleViewMode()
})
;(matchControls.querySelector('#btnAddBot') as HTMLButtonElement).addEventListener('click', () => {
  if (!game?.canAddBot()) return
  game.addBot()
})
;(matchControls.querySelector('#btnHitSelf') as HTMLButtonElement).addEventListener('click', () => {
  game?.debugHitSelf()
})

const addBotButton = matchControls.querySelector('#btnAddBot') as HTMLButtonElement
const toggleViewButton = matchControls.querySelector('#btnToggleView') as HTMLButtonElement
window.setInterval(() => {
  addBotButton.disabled = !(game?.canAddBot() ?? false)
  const viewMode = game?.getViewMode() ?? 'first'
  toggleViewButton.textContent = viewMode === 'first' ? 'Switch to Third' : 'Switch to First'
}, 250)

const weaponHotkeysHint = document.createElement('div')
weaponHotkeysHint.style.cssText = `
  margin-top: 6px;
  color: #9df;
  font-size: 11px;
`
weaponHotkeysHint.textContent = `Weapon hotkeys: ${SUPPORTED_WEAPON_IDS.map((id, i) => `${i + 1}:${id}`).join(' | ')}`
debugHudElement.appendChild(weaponHotkeysHint)

// Очищаем ресурсы при закрытии вкладки
window.addEventListener('beforeunload', () => {
  game?.stop()
})
