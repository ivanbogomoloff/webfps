export type BotIdentity = {
  playerId: string;
};

export function createBotIdentity(playerId: string): BotIdentity {
  return { playerId };
}
