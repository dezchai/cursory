# cursory-bun

Bun/TypeScript port of the original `cursory` Python package.

## License

This project is licensed under `GPL-3.0-or-later`.

The bundled trajectory dataset in `data/trajectories.json.gz` is carried over from the original project and remains covered by the same license.

Original project: `https://github.com/Vinyzu/cursory`

## Usage

```ts
import { generateTrajectory } from "cursory-bun";

const { points, timings } = generateTrajectory([0, 0], [200, 100]);
```
