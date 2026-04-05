import * as THREE from 'three';
import type { World } from 'miniplex';
import type { Health, Input, MatchState, NetworkIdentity, PlayerController, PlayerPhysicsState, PlayerStats, WeaponState } from '../components';
import type { GroundProbeDebugState } from './PhysicsSystem';

type LocalHudEntity = {
  object3d: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  health: Health;
  input: Input;
  networkIdentity: NetworkIdentity;
  playerController: PlayerController;
  playerPhysicsState: PlayerPhysicsState;
  weaponState: WeaponState;
};

type HudScoreEntry = {
  playerId: string;
  nickname: string;
  frags: number;
  deaths: number;
};

type HudSystemOptions = {
  updateHz?: number;
  debugEnabled?: boolean;
  debugHudRootElement: HTMLElement;
  debugHudContentElement: HTMLElement;
  gameHudElement: HTMLElement;
  scoreboardHudElement: HTMLElement;
  getRoomCode: () => string | null;
  getLastNetworkError: () => string | null;
  getJumpDebugState: () => {
    jumpPending: boolean;
    isGrounded: boolean;
    locomotion: string;
    movementMode: string;
    groundProbe: GroundProbeDebugState;
  } | null;
};

function findLocalHudEntity(world: World): LocalHudEntity | null {
  for (const entity of world.with('playerController', 'playerPhysicsState', 'object3d', 'input', 'camera', 'networkIdentity', 'health', 'weaponState')) {
    const local = entity as unknown as LocalHudEntity;
    if (local.networkIdentity.isLocal) return local;
  }
  return null;
}

function readMatchState(world: World): MatchState | null {
  for (const entity of world.with('matchState')) {
    return (entity as { matchState: MatchState }).matchState;
  }
  return null;
}

function readScoreboard(world: World): HudScoreEntry[] {
  const items: HudScoreEntry[] = [];
  for (const entity of world.with('networkIdentity', 'playerStats')) {
    const e = entity as { networkIdentity: NetworkIdentity; playerStats: PlayerStats };
    items.push({
      playerId: e.networkIdentity.playerId,
      nickname: e.networkIdentity.nickname,
      frags: e.playerStats.frags,
      deaths: e.playerStats.deaths,
    });
  }
  items.sort((a, b) => (b.frags - a.frags) || (a.deaths - b.deaths) || a.nickname.localeCompare(b.nickname));
  return items;
}

export function createHudSystem(world: World, options: HudSystemOptions) {
  const interval = 1 / Math.max(1, options.updateHz ?? 10);
  const debugEnabled = options.debugEnabled ?? false;
  let accumulator = 0;
  let lastLoggedRoomCode: string | null = null;

  return (deltaTime: number) => {
    accumulator += deltaTime;
    if (accumulator < interval) return;
    accumulator = 0;

    const local = findLocalHudEntity(world);
    if (!local) {
      options.gameHudElement.style.display = 'none';
      options.scoreboardHudElement.style.display = 'none';
      if (!debugEnabled) {
        options.debugHudRootElement.style.display = 'none';
      }
      return;
    }

    const matchState = readMatchState(world);
    const scoreboard = readScoreboard(world);
    const networkError = options.getLastNetworkError();
    const roomCode = options.getRoomCode();
    const jumpDebug = options.getJumpDebugState();

    if (roomCode && roomCode !== lastLoggedRoomCode) {
      lastLoggedRoomCode = roomCode;
      console.log(`[main] room code: ${roomCode}`);
    }

    if (local.networkIdentity.role === 'player') {
      const healthCurrent = Math.max(0, Math.round(local.health.current));
      const healthMax = Math.max(1, Math.round(local.health.max));
      options.gameHudElement.style.display = 'block';
      options.gameHudElement.innerHTML = `❤ ${healthCurrent}/${healthMax}`;
    } else {
      options.gameHudElement.style.display = 'none';
    }

    const showScoreboard = !!local.input.keys.get('tab');
    if (showScoreboard) {
      const rows = scoreboard
        .slice(0, 12)
        .map((entry, index) => {
          const place = String(index + 1).padStart(2, ' ');
          return `${place}. ${entry.nickname} - ${entry.frags}/${entry.deaths}`;
        })
        .join('<br/>');
      options.scoreboardHudElement.style.display = 'block';
      options.scoreboardHudElement.innerHTML = `
        <div style="font-size: 13px; color: #9df; margin-bottom: 6px;">SCOREBOARD</div>
        <div style="margin-bottom: 4px;">PHASE: ${matchState?.phase ?? 'waiting'} | TIME: ${matchState?.timeLeftSec ?? 0}s</div>
        <div>FRAG LIMIT: ${matchState?.fragLimit ?? 0}</div>
        <div style="margin-top: 8px;">${rows || '-'}</div>
      `;
    } else {
      options.scoreboardHudElement.style.display = 'none';
    }

    if (!debugEnabled) {
      options.debugHudRootElement.style.display = 'none';
      return;
    }

    options.debugHudRootElement.style.display = 'block';
    const pos = local.object3d.position;
    const euler = new THREE.Euler().setFromQuaternion(local.camera.quaternion, 'YXZ');
    const scoreboardLines = scoreboard
      .slice(0, 5)
      .map((entry, index) => `${index + 1}. ${entry.nickname} — ${entry.frags}/${entry.deaths}`)
      .join('<br/>');
    const winner =
      matchState?.phase === 'ended' && matchState.winnerPlayerId
        ? scoreboard.find((entry) => entry.playerId === matchState.winnerPlayerId)?.nickname ?? matchState.winnerPlayerId
        : '-';

    const jumpStateLine = jumpDebug
      ? `MODE: ${jumpDebug.movementMode} | LOCOMOTION: ${jumpDebug.locomotion} | GROUNDED: ${jumpDebug.isGrounded ? 'YES' : 'NO'} | JUMP_PENDING: ${jumpDebug.jumpPending ? 'YES' : 'NO'}`
      : 'MODE: - | LOCOMOTION: - | GROUNDED: - | JUMP_PENDING: -';
    const groundProbeLine = jumpDebug
      ? `GROUND PROBE: hit=${jumpDebug.groundProbe.hit ? 'YES' : 'NO'} fromY=${jumpDebug.groundProbe.fromY.toFixed(2)} toY=${jumpDebug.groundProbe.toY.toFixed(2)} at=(${jumpDebug.groundProbe.x.toFixed(2)}, ${jumpDebug.groundProbe.y.toFixed(2)}, ${jumpDebug.groundProbe.z.toFixed(2)})`
      : 'GROUND PROBE: -';

    options.debugHudContentElement.innerHTML = `
      <div>ROOM: ${roomCode ?? '…'}</div>
      <div>POSITION: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}</div>
      <div>ROTATION: ${((euler.y * 180) / Math.PI).toFixed(0)}°, ${((euler.x * 180) / Math.PI).toFixed(0)}°</div>
      <div>MOUSE LOCKED: ${local.input.mouse.isLocked ? 'YES' : 'NO'}</div>
      <div>ROLE: ${local.networkIdentity.role ?? 'spectator'}</div>
      <div>current weapon: ${local.weaponState.weaponId}</div>
      <div>JUMP: ${jumpStateLine}</div>
      <div>${groundProbeLine}</div>
      <div>PHASE: ${matchState?.phase ?? 'waiting'} | TIME: ${matchState?.timeLeftSec ?? 0}s | FRAG LIMIT: ${matchState?.fragLimit ?? 0}</div>
      <div>MAX PLAYERS: ${matchState?.maxPlayers ?? '-'}</div>
      <div>WINNER: ${winner}</div>
      <div style="margin-top: 6px; color: #9df;">SCOREBOARD</div>
      <div>${scoreboardLines || '-'}</div>
      ${networkError ? `<div style="margin-top: 6px; color: #f88;">NET: ${networkError}</div>` : ''}
      <div style="margin-top: 5px; color: #0f8;">WASD - Move, Ctrl - Crouch, Shift - Run mode, Mouse - Look</div>
    `;
  };
}
