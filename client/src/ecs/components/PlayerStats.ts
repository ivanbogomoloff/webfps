export interface PlayerStats {
  frags: number
  deaths: number
}

export function createPlayerStats(): PlayerStats {
  return {
    frags: 0,
    deaths: 0,
  }
}
