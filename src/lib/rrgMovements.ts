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
  console.log('[detectQuadrantJumps] Called with', items.length, 'items');
  if (items.length === 0) {
    console.log('[detectQuadrantJumps] No items provided');
    return [];
  }

  const jumps: QuadrantJump[] = [];

  items.forEach((item) => {
    const { head, tail = [] } = item;
    console.log(`[detectQuadrantJumps] Processing ${item.name}: head=${!!head}, tail.length=${tail.length}`);
    
    if (!head || tail.length < 1) {
      console.log(`[detectQuadrantJumps] ${item.name}: Missing head or tail (head=${!!head}, tailLength=${tail.length})`);
      return;
    }

    // Compare last trading day (tail[-1]) with today (head)
    // This shows which stocks/sectors jumped quadrants since the last trading day to today
    const previousDay = tail[tail.length - 1];
    const currentDay = head;
    
    if (!previousDay || !currentDay) {
      console.log(`[detectQuadrantJumps] ${item.name}: Missing previousDay or currentDay`);
      return;
    }

    const from = getQuadrant(previousDay);
    const to = getQuadrant(currentDay);

    console.log(`[detectQuadrantJumps] ${item.name}: tail[-1]={x:${previousDay.x?.toFixed(2)}, y:${previousDay.y?.toFixed(2)}} (${from}) -> head={x:${currentDay.x?.toFixed(2)}, y:${currentDay.y?.toFixed(2)}} (${to})`);

    if (from === to) {
      console.log(`[detectQuadrantJumps] ${item.name}: No jump (same quadrant)`);
      return;
    }

    const deltaX = currentDay.x - previousDay.x;
    const deltaY = currentDay.y - previousDay.y;
    const magnitude = Math.hypot(deltaX, deltaY);

    console.log(`[detectQuadrantJumps] ${item.name}: JUMP DETECTED! ${from} -> ${to}`);

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

  console.log('[detectQuadrantJumps] Total jumps found:', jumps.length);
  // Sort strongest moves first so the most notable jumps appear on top
  return jumps.sort((a, b) => b.magnitude - a.magnitude);
};
