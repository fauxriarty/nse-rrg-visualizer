export type Quadrant = 'LEADING' | 'WEAKENING' | 'LAGGING' | 'IMPROVING';

export interface RRGPoint {
  x: number;
  y: number;
  // Allow carrying extra metadata (e.g., dateIndex) without losing typing
  [key: string]: number | string | undefined;
}

export interface RRGEntity {
  name: string;
  head: RRGPoint;
  tail?: RRGPoint[];
}

export interface QuadrantJump {
  name: string;
  from: Quadrant;
  to: Quadrant;
  deltaX: number;
  deltaY: number;
  magnitude: number;
  previous: RRGPoint;
  current: RRGPoint;
}

export const getQuadrant = (point: RRGPoint): Quadrant => {
  const isRight = point.x >= 100;
  const isUp = point.y >= 100;

  if (isRight && isUp) return 'LEADING';
  if (isRight && !isUp) return 'WEAKENING';
  if (!isRight && isUp) return 'IMPROVING';
  return 'LAGGING';
};

export const detectQuadrantJumps = (items: RRGEntity[]): QuadrantJump[] => {
  const jumps: QuadrantJump[] = [];

  items.forEach((item) => {
    const { head, tail = [] } = item;
    if (!head || tail.length < 2) return;

    // Only compare the immediate previous day (tail[-2]) to today (tail[-1])
    // This ensures we only detect quadrant changes that happened between these two specific days
    const previousDay = tail[tail.length - 2];
    const currentDay = tail[tail.length - 1];
    
    if (!previousDay || !currentDay) return;

    const from = getQuadrant(previousDay);
    const to = getQuadrant(currentDay);

    if (from === to) return;

    const deltaX = currentDay.x - previousDay.x;
    const deltaY = currentDay.y - previousDay.y;
    const magnitude = Math.hypot(deltaX, deltaY);

    jumps.push({
      name: item.name,
      from,
      to,
      deltaX,
      deltaY,
      magnitude,
      previous: previousDay,
      current: currentDay,
    });
  });

  // Sort strongest moves first so the most notable jumps appear on top
  return jumps.sort((a, b) => b.magnitude - a.magnitude);
};
