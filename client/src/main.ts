import './main.css'
import * as THREE from 'three'
import { Game } from './game/Game'
import { loadSupportedPlayerModelTemplates } from './game/playerModelTemplates'
import { clonePlayerVisualSetup, DEFAULT_PLAYER_RADIUS } from './game/playerModelPrep'
import { DEFAULT_PLAYER_MODEL_ID, resolvePlayerModelId } from './game/supportedPlayerModels'
import { OfflineLoopbackTransport } from './net/OfflineLoopbackTransport'
import type { GameTransport, TransportConnectParams } from './net/GameTransport'
import { WsTransport } from './net/WsTransport'

const DEFAULT_WS_URL = 'ws://localhost:8080/ws'

type Mode = 'offline' | 'online'
type StartOptions = {
  mode: Mode
  wsUrl: string
  roomCode: string
  nickname: string
  modelId: string
  mapId: string
  timeLimitSec: number
  fragLimit: number
  startAsPlayer: boolean
}

let game: Game | null = null
let lastLoggedRoomCode: string | null = null

async function startGame(options: StartOptions): Promise<void> {
  const templates = await loadSupportedPlayerModelTemplates()
  const resolvedModelId = resolvePlayerModelId(options.modelId.trim() || DEFAULT_PLAYER_MODEL_ID)
  const transport: GameTransport =
    options.mode === 'online'
      ? new WsTransport(options.wsUrl)
      : new OfflineLoopbackTransport()
  const connectParams: TransportConnectParams = {
    roomCode: options.roomCode.trim(),
    nickname: options.nickname.trim() || 'Player',
    modelId: resolvedModelId,
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
    playerModelTemplates: templates,
  })
  game.createPlayer(localVisual, DEFAULT_PLAYER_RADIUS)

  try {
    await game.loadMap(
      '/models/maps/test2/map_test2.glb',
      '/models/maps/test2/map_test2.hdr',
    )
  } catch (error) {
    console.error('Failed to load game:', error)
  } finally {
    game.start()
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
          <option value="offline" selected>offline (loopback + bot)</option>
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
  const mapId = getEl<HTMLInputElement>('mapId')
  const timeLimit = getEl<HTMLInputElement>('timeLimit')
  const fragLimit = getEl<HTMLInputElement>('fragLimit')
  const error = getEl<HTMLDivElement>('lobbyError')
  const joinSpec = getEl<HTMLButtonElement>('joinSpec')
  const joinPlayer = getEl<HTMLButtonElement>('joinPlayer')

  const submit = async (startAsPlayer: boolean) => {
    try {
      error.textContent = ''
      const selectedMode = mode.value === 'online' ? 'online' : 'offline'
      if (selectedMode === 'online' && roomCode.value.trim() !== '' && !/^\d{4}$/.test(roomCode.value.trim())) {
        throw new Error('Room code must be exactly 4 digits')
      }
      const options: StartOptions = {
        mode: selectedMode,
        wsUrl: wsUrl.value.trim() || DEFAULT_WS_URL,
        roomCode: roomCode.value.trim(),
        nickname: nickname.value.trim(),
        modelId: modelId.value.trim(),
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

// Создаём HUD для отладки
const hudElement = document.createElement('div')
hudElement.id = 'hud'
hudElement.style.cssText = `
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
`
document.body.appendChild(hudElement)

const matchControls = document.createElement('div')
matchControls.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  z-index: 1000;
`
matchControls.innerHTML = `
  <button id="btnSpectator">Spectator</button>
  <button id="btnEnterMatch">Enter Match</button>
`
document.body.appendChild(matchControls)

;(matchControls.querySelector('#btnSpectator') as HTMLButtonElement).addEventListener('click', () => {
  game?.setLocalRole('spectator')
})
;(matchControls.querySelector('#btnEnterMatch') as HTMLButtonElement).addEventListener('click', () => {
  game?.setLocalRole('player')
  game?.requestSpawn()
})

// Обновляем HUD каждый кадр
const updateHUD = () => {
  if (!game) {
    requestAnimationFrame(updateHUD)
    return
  }
  const world = game.getWorld()
  const player = Array.from(world.entities).find((e: any) => e.playerController && e.networkIdentity?.isLocal)
  const matchState = game.getMatchState()
  const scoreboard = game.getScoreboard()
  const networkError = game.getLastNetworkError()

  if (player) {
    const pos = player.object3d.position
    const camera = player.camera
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    const jumpDebug = game.getJumpDebugState()
    const scoreboardLines = scoreboard
      .slice(0, 5)
      .map((entry, index) => `${index + 1}. ${entry.nickname} — ${entry.frags}/${entry.deaths}`)
      .join('<br/>')
    const winner =
      matchState?.phase === 'ended' && matchState.winnerPlayerId
        ? scoreboard.find((entry) => entry.playerId === matchState.winnerPlayerId)?.nickname ?? matchState.winnerPlayerId
        : '-'

    const roomCode = game.getRoomCode()
    if (roomCode && roomCode !== lastLoggedRoomCode) {
      lastLoggedRoomCode = roomCode
      console.log(`[main] room code: ${roomCode}`)
    }

    const jumpStateLine = jumpDebug
      ? `LOCOMOTION: ${jumpDebug.locomotion} | GROUNDED: ${jumpDebug.isGrounded ? 'YES' : 'NO'} | JUMP_PENDING: ${jumpDebug.jumpPending ? 'YES' : 'NO'}`
      : 'LOCOMOTION: - | GROUNDED: - | JUMP_PENDING: -'
    const groundProbeLine = jumpDebug
      ? `GROUND PROBE: hit=${jumpDebug.groundProbe.hit ? 'YES' : 'NO'} fromY=${jumpDebug.groundProbe.fromY.toFixed(2)} toY=${jumpDebug.groundProbe.toY.toFixed(2)} at=(${jumpDebug.groundProbe.x.toFixed(2)}, ${jumpDebug.groundProbe.y.toFixed(2)}, ${jumpDebug.groundProbe.z.toFixed(2)})`
      : 'GROUND PROBE: -'

    hudElement.innerHTML = `
      <div>ROOM: ${roomCode ?? '…'}</div>
      <div>POSITION: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}</div>
      <div>ROTATION: ${((euler.y * 180) / Math.PI).toFixed(0)}°, ${((euler.x * 180) / Math.PI).toFixed(0)}°</div>
      <div>MOUSE LOCKED: ${player.input.mouse.isLocked ? 'YES' : 'NO'}</div>
      <div>ROLE: ${player.networkIdentity?.role ?? 'spectator'}</div>
      <div>JUMP: ${jumpStateLine}</div>
      <div>${groundProbeLine}</div>
      <div>PHASE: ${matchState?.phase ?? 'waiting'} | TIME: ${matchState?.timeLeftSec ?? 0}s | FRAG LIMIT: ${matchState?.fragLimit ?? 0}</div>
      <div>MAX PLAYERS: ${matchState?.maxPlayers ?? '-'}</div>
      <div>WINNER: ${winner}</div>
      <div style="margin-top: 6px; color: #9df;">SCOREBOARD</div>
      <div>${scoreboardLines || '-'}</div>
      ${networkError ? `<div style="margin-top: 6px; color: #f88;">NET: ${networkError}</div>` : ''}
      <div style="margin-top: 5px; color: #0f8;">WASD - Move, Mouse - Look, UI buttons - role switch</div>
    `
  }

  requestAnimationFrame(updateHUD)
}
updateHUD()

// Очищаем ресурсы при закрытии вкладки
window.addEventListener('beforeunload', () => {
  game?.stop()
})
