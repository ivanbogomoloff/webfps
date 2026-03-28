export interface NetworkTransform {
  x: number
  y: number
  z: number
  rotY: number
  updatedAtMs: number
}

export function createNetworkTransform(): NetworkTransform {
  return {
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    updatedAtMs: 0,
  }
}
