import { BOT_NAV_CONFIG } from '../../config/botConfig';
import { GAME_WEAPON_IDS, getWeaponDefinition } from '../../config/weaponCatalog';
import { fireLocomotionFromVelocity, yawTowardTarget } from './botLocomotion';
import { distance3 } from './collisionQueries';
import type { BotCombatDecision, BotTarget } from './types';

export type BotCombatState = {
  ammoInMag: number;
  isReloading: boolean;
  reloadUntilMs: number;
  lastShotAtMs: number;
  lastShotSeq: number;
  weaponSwitchAtMs: number;
  weaponId: string;
};

export function createBotCombatState(weaponId: string): BotCombatState {
  const def = getWeaponDefinition(weaponId);
  return {
    ammoInMag: def.magazineSize,
    isReloading: false,
    reloadUntilMs: 0,
    lastShotAtMs: 0,
    lastShotSeq: 0,
    weaponSwitchAtMs: 0,
    weaponId,
  };
}

export function findBestTarget(options: {
  botId: string;
  x: number;
  z: number;
  rotY: number;
  candidates: BotTarget[];
}): BotTarget | null {
  const { botId, candidates } = options;
  let best: BotTarget | null = null;
  for (const candidate of candidates) {
    if (candidate.playerId === botId) continue;
    if (candidate.distance > BOT_NAV_CONFIG.combatRange) continue;
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
}

export function stepBotCombat(options: {
  botId: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  state: BotCombatState;
  candidates: BotTarget[];
  nowMs: number;
  random?: () => number;
}): BotCombatDecision {
  const { botId, x, z, rotY, state, candidates, nowMs } = options;
  const random = options.random ?? Math.random;
  const weaponDef = getWeaponDefinition(state.weaponId);

  if (state.isReloading) {
    if (nowMs >= state.reloadUntilMs) {
      state.isReloading = false;
      state.ammoInMag = weaponDef.magazineSize;
    } else {
      return {
        targetId: null,
        rotY,
        shouldShoot: false,
        shouldReload: true,
        shouldSwitchWeapon: false,
        nextWeaponId: null,
        locomotion: 'idle',
      };
    }
  }

  if (
    nowMs - state.weaponSwitchAtMs >= BOT_NAV_CONFIG.weaponSwitchCooldownSec * 1000 &&
    random() < 0.02
  ) {
    const others = GAME_WEAPON_IDS.filter((id) => id !== state.weaponId);
    const next = others[Math.floor(random() * others.length)] ?? state.weaponId;
    state.weaponSwitchAtMs = nowMs;
    state.weaponId = next;
    const nextDef = getWeaponDefinition(next);
    state.ammoInMag = nextDef.magazineSize;
    return {
      targetId: null,
      rotY,
      shouldShoot: false,
      shouldReload: false,
      shouldSwitchWeapon: true,
      nextWeaponId: next,
      locomotion: 'idle',
    };
  }

  const target = findBestTarget({ botId, x, z, rotY, candidates });
  if (!target) {
    return {
      targetId: null,
      rotY,
      shouldShoot: false,
      shouldReload: false,
      shouldSwitchWeapon: false,
      nextWeaponId: null,
      locomotion: 'idle',
    };
  }

  const nextRotY = yawTowardTarget(x, z, target.x, target.z);

  if (state.ammoInMag <= 0) {
    state.isReloading = true;
    state.reloadUntilMs = nowMs + weaponDef.reloadTimeSec * 1000;
    return {
      targetId: target.playerId,
      rotY: nextRotY,
      shouldShoot: false,
      shouldReload: true,
      shouldSwitchWeapon: false,
      nextWeaponId: null,
      locomotion: 'idle',
    };
  }

  const minShotIntervalMs = 1000 / Math.max(1, weaponDef.fireRate);
  const canShoot = nowMs - state.lastShotAtMs >= minShotIntervalMs;
  if (canShoot) {
    state.lastShotAtMs = nowMs;
    state.lastShotSeq += 1;
    state.ammoInMag -= 1;
  }

  return {
    targetId: target.playerId,
    rotY: nextRotY,
    shouldShoot: canShoot,
    shouldReload: false,
    shouldSwitchWeapon: false,
    nextWeaponId: null,
    locomotion: fireLocomotionFromVelocity(nextRotY, 0, 0),
  };
}

export function buildCandidatesFromPlayers(
  players: Array<{ playerId: string; x: number; y: number; z: number; isDead: boolean }>,
  botX: number,
  botY: number,
  botZ: number,
): BotTarget[] {
  const out: BotTarget[] = [];
  for (const player of players) {
    if (player.isDead) continue;
    out.push({
      playerId: player.playerId,
      x: player.x,
      y: player.y,
      z: player.z,
      distance: distance3(botX, botY, botZ, player.x, player.y, player.z),
    });
  }
  return out;
}
