export interface Input {
  keys: Map<string, boolean>;
  mouse: {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    isLocked: boolean;
    primaryDown: boolean;
  };
}

export function createInput(): Input {
  return {
    keys: new Map(),
    mouse: {
      x: 0,
      y: 0,
      deltaX: 0,
      deltaY: 0,
      isLocked: false,
      primaryDown: false,
    },
  };
}
