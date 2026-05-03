export type LocalShotImpactEvent = {
  seq: number
  weaponId: string
  origin: { x: number; y: number; z: number }
  direction: { x: number; y: number; z: number }
}

const MAX_PENDING_EVENTS = 32
const pendingLocalShotEvents: LocalShotImpactEvent[] = []

export function publishLocalShotImpactEvent(event: LocalShotImpactEvent): void {
  pendingLocalShotEvents.push(event)
  while (pendingLocalShotEvents.length > MAX_PENDING_EVENTS) {
    pendingLocalShotEvents.shift()
  }
}

export function consumeLocalShotImpactEvents(): LocalShotImpactEvent[] {
  if (pendingLocalShotEvents.length === 0) return []
  return pendingLocalShotEvents.splice(0, pendingLocalShotEvents.length)
}
