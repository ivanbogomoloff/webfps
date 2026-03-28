/**
 * Список моделей, которые клиент умеет загружать и показывать (локальный игрок, соперники, бот).
 * Файлы лежат в `public/models/players/<id>.glb`.
 */
export const SUPPORTED_PLAYER_MODEL_IDS = ['player1'] as const

export type SupportedPlayerModelId = (typeof SUPPORTED_PLAYER_MODEL_IDS)[number]

export const DEFAULT_PLAYER_MODEL_ID: SupportedPlayerModelId = 'player1'

export function playerModelGltfPath(modelId: SupportedPlayerModelId): string {
  return `/models/players/${modelId}.glb`
}

/** Неизвестный id с сервера заменяется на дефолтную модель. */
export function resolvePlayerModelId(raw: string): SupportedPlayerModelId {
  const id = raw.trim()
  return (SUPPORTED_PLAYER_MODEL_IDS as readonly string[]).includes(id)
    ? (id as SupportedPlayerModelId)
    : DEFAULT_PLAYER_MODEL_ID
}

/** Для бота — случайная модель из поддерживаемых (при одном элементе всегда он). */
export function pickRandomBotModelId(): SupportedPlayerModelId {
  const list = SUPPORTED_PLAYER_MODEL_IDS as readonly SupportedPlayerModelId[]
  return list[Math.floor(Math.random() * list.length)]!
}
