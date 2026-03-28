# cursory

TypeScript port of the original Python project [Vinyzu/cursory](https://github.com/Vinyzu/cursory).

This package generates human-like mouse trajectories by selecting from a dataset of recorded trajectories, morphing them to the requested start and end points, and re-sampling them with timing noise.

## Install

```bash
npm install @dezchai/cursory
```

```bash
bun add @dezchai/cursory
```

If you are using this repository directly:

```bash
npm install
```

```bash
bun install
```

## Basic Usage

```ts
import { generateTrajectory } from "@dezchai/cursory";

const { points, timings } = generateTrajectory([0, 0], [200, 100]);
```

## Example Trajectories

These visuals come from the original project and illustrate the style of generated paths:

| Random Points | Same Points | Points / Velocity |
|:--:|:--:|:--:|
| <img height="320" alt="Random Points" src="https://github.com/user-attachments/assets/07eaebb0-6798-45d1-9182-2ffd5f1e42d7" /> | <img height="320" alt="Same Points" src="https://github.com/user-attachments/assets/81eb79df-e274-4200-b74c-5f57f4899a3f" /> | <img height="320" alt="Points / Velocity" src="https://github.com/user-attachments/assets/e7fad0e3-1b56-4c85-a139-42601288701c" /> |

## API

### `generateTrajectory(start, end, options?)`

Generates a trajectory between two points.

```ts
import { generateTrajectory, type Point, type RandomSource } from "@dezchai/cursory";

const start: Point = [25, 40];
const end: Point = [640, 360];

const result = generateTrajectory(start, end, {
  frequency: 60,
  frequencyRandomizer: 1,
});

console.log(result.points);
console.log(result.timings);
```

#### Parameters

- `start: [number, number]` - starting point.
- `end: [number, number]` - ending point.
- `options.frequency?: number` - target sample rate in Hz. Defaults to `60`.
- `options.frequencyRandomizer?: number` - maximum per-sample timing jitter in milliseconds. Defaults to `1`.
- `options.random?: { next(): number }` - optional deterministic random source for repeatable outputs.

#### Returns

- `points: [number, number][]` - sampled trajectory points.
- `timings: number[]` - timestamps in milliseconds, aligned with `points`.

### `getTrajectoryCount()`

Returns the number of bundled source trajectories in the dataset.

## Deterministic Usage

You can pass a custom random source if you want reproducible output for tests or debugging.

```ts
import { generateTrajectory, type RandomSource } from "@dezchai/cursory";

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

const result = generateTrajectory([0, 0], [300, 180], {
  random: new SeededRandom(12345),
});
```

## Compatibility

This package is built for modern ESM runtimes and can be installed with either npm or Bun.

- Package managers: npm, Bun
- Runtimes: Node.js, Bun
- Module format: ESM
- Published entrypoint: `dist/index.js`

## Copyright and License

This project is licensed under `GPL-3.0-or-later`.

The bundled trajectory dataset and original methodology come from [Vinyzu/cursory](https://github.com/Vinyzu/cursory) and remain subject to the same license terms.

Commercial usage is allowed under GPL terms, which means source, license, and copyright notices must remain available.

## Credits

- [Vinyzu](https://github.com/Vinyzu/) for the original `cursory` project, dataset, and implementation.
- [Pointergeist](https://github.com/Pointergeist) for helping the original author understand mouse trajectories better.
- [sameelarif](https://github.com/sameelarif/) for work on [Scribe](https://github.com/sameelarif/scribe).
- [Margit Antal, Norbert Fejer, Krisztian Buza](https://github.com/margitantal68) for their work on SapiMouse.
- [MIMIC-LOGICS](https://github.com/MIMIC-LOGICS/) for Mouse-Synthesizer.

## Disclaimer

This repository is provided for educational purposes only.

No warranties are provided regarding accuracy, completeness, or suitability for any purpose. Use at your own risk. The authors and maintainers assume no liability for damages, legal issues, or warranty breaches resulting from use, modification, or distribution of this code.
