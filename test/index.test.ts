import { expect, test } from "bun:test";

import { generateTrajectory, getTrajectoryCount, type Point, type RandomSource } from "../src/index.ts";

class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

function isNonDecreasing(values: number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) {
      return false;
    }
  }

  return true;
}

test("loads the bundled trajectory dataset", () => {
  expect(getTrajectoryCount()).toBeGreaterThan(2000);
});

test("generateTrajectory returns aligned points and timings", () => {
  const random = new SeededRandom(12345);
  const start: Point = [0, 0];
  const end: Point = [250, 175];
  const result = generateTrajectory(start, end, {
    frequency: 60,
    frequencyRandomizer: 1,
    random,
  });

  expect(result.points.length).toBe(result.timings.length);
  expect(result.points.length).toBeGreaterThan(1);
  expect(result.points[0]).toEqual(start);
  expect(result.points[result.points.length - 1]).toEqual(end);
  expect(result.timings[0]).toBe(0);
  expect(isNonDecreasing(result.timings)).toBe(true);
});

test("zero-length inputs still pin start and end exactly", () => {
  const point: Point = [100, 100];
  const result = generateTrajectory(point, point, {
    random: new SeededRandom(99),
  });

  expect(result.points[0]).toEqual(point);
  expect(result.points[result.points.length - 1]).toEqual(point);
  expect(result.timings.length).toBe(result.points.length);
});

test("invalid frequency throws", () => {
  expect(() => generateTrajectory([0, 0], [1, 1], { frequency: 0 })).toThrow(
    "frequency must be greater than 0",
  );
});

test("high frequencies do not hang and still produce samples", () => {
  const result = generateTrajectory([0, 0], [50, 25], {
    frequency: 2_000,
    random: new SeededRandom(7),
  });

  expect(result.points.length).toBeGreaterThan(0);
  expect(result.points.length).toBe(result.timings.length);
  expect(isNonDecreasing(result.timings)).toBe(true);
});

test("timings stay non-decreasing under large jitter", () => {
  const result = generateTrajectory([0, 0], [10, 10], {
    frequency: 1_000,
    frequencyRandomizer: 10,
    random: new SeededRandom(1),
  });

  expect(isNonDecreasing(result.timings)).toBe(true);
});
