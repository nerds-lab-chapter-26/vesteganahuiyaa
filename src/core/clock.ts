/**
 * Thin clock abstraction so timer logic can be unit-tested without real
 * delays. Production code uses `systemClock`; tests inject a fake one.
 */
export interface Clock {
  now(): number; // epoch ms, monotonic-ish for elapsed-time math
}

export const systemClock: Clock = {
  now: () => Date.now(),
};
