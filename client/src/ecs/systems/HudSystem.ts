import * as THREE from 'three';
import type { World } from 'miniplex';
import type { Health, Input, MatchState, NetworkIdentity, PlayerController, PlayerPhysicsState, PlayerStats, WeaponState } from '../components';
import type { PlayerViewMode } from '../components';
import type { GroundProbeDebugState } from './PhysicsSystem';
import {
  resolveWeaponAnimationPoseKey,
  type WeaponTransformValues,
} from '../../config/weapons/types';

type LocalHudEntity = {
  object3d: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  health: Health;
  input: Input;
  networkIdentity: NetworkIdentity;
  playerController: PlayerController;
  playerPhysicsState: PlayerPhysicsState;
  weaponState: WeaponState;
  weaponVisualFpObject?: THREE.Object3D | null;
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
  crosshairElement: HTMLElement;
  getRoomCode: () => string | null;
  getLastNetworkError: () => string | null;
  getViewMode: () => PlayerViewMode;
  getJumpDebugState: () => {
    jumpPending: boolean;
    isGrounded: boolean;
    locomotion: string;
    movementMode: string;
    groundProbe: GroundProbeDebugState;
  } | null;
};

function cloneObjectTransform(source: THREE.Object3D): WeaponTransformValues {
  return {
    position: { x: source.position.x, y: source.position.y, z: source.position.z },
    rotation: { x: source.rotation.x, y: source.rotation.y, z: source.rotation.z },
    scale: { x: source.scale.x, y: source.scale.y, z: source.scale.z },
  };
}

function toFixed4(value: number): string {
  return value.toFixed(4);
}

function toUniformScaleValue(scale: WeaponTransformValues['scale']): number {
  return scale.x;
}

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
  const debugCameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
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
      options.crosshairElement.style.display = 'none';
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

    const showCrosshair =
      local.networkIdentity.role === 'player' &&
      !local.health.isDead &&
      options.getViewMode() === 'first';
    options.crosshairElement.style.display = showCrosshair ? 'block' : 'none';

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
    const fpPoseKey = resolveWeaponAnimationPoseKey(
      local.playerController.locomotion,
      local.weaponState.action,
    );
    debugCameraEuler.setFromQuaternion(local.camera.quaternion, 'YXZ');
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
    const isFiring = local.playerController.locomotion.includes('fire');
    const fpVisual = local.weaponVisualFpObject ?? null;
    const fpCurrentTransform = fpVisual ? cloneObjectTransform(fpVisual) : null;
    const uniformScale = fpCurrentTransform ? toUniformScaleValue(fpCurrentTransform.scale) : null;
    const fpCurrentLine = fpCurrentTransform
      ? `FP CURRENT: P(${toFixed4(fpCurrentTransform.position.x)}, ${toFixed4(fpCurrentTransform.position.y)}, ${toFixed4(fpCurrentTransform.position.z)}) R(${toFixed4(fpCurrentTransform.rotation.x)}, ${toFixed4(fpCurrentTransform.rotation.y)}, ${toFixed4(fpCurrentTransform.rotation.z)}) S(${toFixed4(uniformScale ?? 1)})`
      : 'FP CURRENT: -';

    options.debugHudContentElement.innerHTML = `
      <div>ROOM: ${roomCode ?? '…'}</div>
      <div>POSITION: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}</div>
      <div>ROTATION: ${((debugCameraEuler.y * 180) / Math.PI).toFixed(0)}°, ${((debugCameraEuler.x * 180) / Math.PI).toFixed(0)}°</div>
      <div>MOUSE LOCKED: ${local.input.mouse.isLocked ? 'YES' : 'NO'}</div>
      <div>ROLE: ${local.networkIdentity.role ?? 'spectator'}</div>
      <div>current weapon: ${local.weaponState.weaponId}</div>
      <div>FP pose key: ${fpPoseKey}</div>
      <div>${fpCurrentLine}</div>
      <div>fire: ${isFiring ? 'on' : 'off'}</div>
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
