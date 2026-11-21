/** Minimal test-runner types without pulling Bun's incompatible DOM fetch globals. */
declare module "bun:test" {
  export function describe(name: string, run: () => void): void;
  export function test(name: string, run: () => void | Promise<void>): void;
  interface ExpectMatchers {
    toBe(expected: unknown): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toBeUndefined(): void;
  }
  export function expect(actual: unknown): ExpectMatchers;
}
