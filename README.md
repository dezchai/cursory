# cursory

TypeScript/Bun port of the original Python project [Vinyzu/cursory](https://github.com/Vinyzu/cursory).

This package generates human-like mouse trajectories by selecting from a dataset of recorded trajectories, morphing them to the requested start and end points, and re-sampling them with timing noise.

## Attribution

This project is based on the original `cursory` implementation by [Vinyzu](https://github.com/Vinyzu/).

- Original repository: [Vinyzu/cursory](https://github.com/Vinyzu/cursory)
- Original concept, implementation, dataset, and methodology: Vinyzu
- This repository: Bun/TypeScript port and packaging work

## Install

```bash
bun add cursory-bun
```

If you are using this repository directly:

```bash
bun install
```

## Basic Usage

```ts
import { generateTrajectory } from "cursory-bun";

const { points, timings } = generateTrajectory([0, 0], [200, 100]);
```

## API

### `generateTrajectory(start, end, options?)`

Generates a trajectory between two points.

```ts
import { generateTrajectory, type Point, type RandomSource } from "cursory-bun";

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
import { generateTrajectory, type RandomSource } from "cursory-bun";

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

## Example Trajectories

These visuals come from the original project and illustrate the style of generated paths:

| Random Points | Same Points | Points / Velocity |
|:--:|:--:|:--:|
| <img height="320" alt="Random Points" src="https://github.com/user-attachments/assets/07eaebb0-6798-45d1-9182-2ffd5f1e42d7" /> | <img height="320" alt="Same Points" src="https://github.com/user-attachments/assets/81eb79df-e274-4200-b74c-5f57f4899a3f" /> | <img height="320" alt="Points / Velocity" src="https://github.com/user-attachments/assets/e7fad0e3-1b56-4c85-a139-42601288701c" /> |

## Methodology

Like the original Python implementation, this port generates trajectories in several stages:

1. Find a close matching human trajectory from the bundled dataset.
2. Morph that trajectory so it exactly fits the requested start and end points.
3. Add spatial noise through jittering and knotting.
4. Re-sample the path at the requested frequency and apply small timing perturbations.
5. Apply another round of jittering and knotting to reduce repeated signatures.
6. Morph the final sampled path so the first and last points still match exactly.

## Port Notes

- The bundled trajectory dataset in `data/trajectories.json.gz` is carried over from the original project.
- The Bun port keeps the same overall generation pipeline while adapting the API to idiomatic TypeScript.
- The port includes a deterministic `random` hook that makes tests and reproducible runs easier.
- Resampling is guarded against very high frequencies and keeps output timings non-decreasing.

## Compatibility

This repository is built for Bun and TypeScript-first usage.

- Runtime: Bun
- Module format: ESM
- Source entrypoint: `src/index.ts`

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
