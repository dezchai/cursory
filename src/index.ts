import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

export type Point = [number, number];

type Trajectory = {
  start: Point;
  end: Point;
  points: Point[];
  dx: number | Point;
  dy: number | Point;
  length: number;
  timing: number[];
};

export type GenerateTrajectoryOptions = {
  frequency?: number;
  frequencyRandomizer?: number;
  random?: RandomSource;
};

export type RandomSource = {
  next(): number;
};

class DefaultRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

const DEFAULT_RANDOM = new DefaultRandomSource();
const TRAJECTORY_PATH = new URL("../data/trajectories.json.gz", import.meta.url);
const LOADED_TRAJECTORIES = loadTrajectories();
const TRAJECTORIES_DX = LOADED_TRAJECTORIES.map((trajectory) => magnitudeOrScalar(trajectory.dx));
const TRAJECTORIES_DY = LOADED_TRAJECTORIES.map((trajectory) => magnitudeOrScalar(trajectory.dy));
const TRAJECTORIES_LENGTHS = LOADED_TRAJECTORIES.map((trajectory) => trajectory.length);

function loadTrajectories(): Trajectory[] {
  const compressed = readFileSync(TRAJECTORY_PATH);
  const json = gunzipSync(compressed).toString("utf8");
  return JSON.parse(json) as Trajectory[];
}

function magnitudeOrScalar(value: number | Point): number {
  if (Array.isArray(value)) {
    return Math.hypot(value[0], value[1]);
  }

  return value;
}

function randomUniform(random: RandomSource, min: number, max: number): number {
  return min + (max - min) * random.next();
}

function randomGaussian(random: RandomSource, mean = 0, standardDeviation = 1): number {
  let u = 0;
  let v = 0;

  while (u === 0) {
    u = random.next();
  }

  while (v === 0) {
    v = random.next();
  }

  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * standardDeviation;
}

function findNearestTrajectory(
  targetStart: Point,
  targetEnd: Point,
  directionWeight = 0.8,
  lengthWeight = 0.2,
  topN = 5,
): Trajectory[] {
  const dxTar = targetEnd[0] - targetStart[0];
  const dyTar = targetEnd[1] - targetStart[1];
  const lenTar = Math.hypot(dxTar, dyTar);

  if (lenTar === 0) {
    return [...LOADED_TRAJECTORIES]
      .sort((left, right) => left.length - right.length)
      .slice(0, topN);
  }

  const normDxTar = dxTar / lenTar;
  const normDyTar = dyTar / lenTar;

  const scores = LOADED_TRAJECTORIES.map((trajectory, index) => {
    const length = TRAJECTORIES_LENGTHS[index];
    const normDx = length !== 0 ? TRAJECTORIES_DX[index] / length : 0;
    const normDy = length !== 0 ? TRAJECTORIES_DY[index] / length : 0;
    const directionSimilarity = (normDx * normDxTar) + (normDy * normDyTar);
    const directionDistance = 1 - directionSimilarity;
    const lengthDiffRatio = Math.abs(length - lenTar) / Math.max(lenTar, 1);
    const combinedScore = (directionWeight * directionDistance) + (lengthWeight * lengthDiffRatio);

    return {
      trajectory,
      score: combinedScore,
    };
  });

  scores.sort((left, right) => left.score - right.score);
  return scores.slice(0, topN).map((entry) => entry.trajectory);
}

function sampleWeightedIndex(weights: number[], random: RandomSource): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = random.next() * total;

  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return index;
    }
  }

  return Math.max(0, weights.length - 1);
}

function findClosestTrajectory(
  targetStart: Point,
  targetEnd: Point,
  random: RandomSource,
  numNearestToSample = 5,
  randomSampleIterations = 20,
  lengthPreferencePower = 2,
): [Trajectory, number, number, number] {
  const dxTar = targetEnd[0] - targetStart[0];
  const dyTar = targetEnd[1] - targetStart[1];
  const lenTar = Math.hypot(dxTar, dyTar);

  const topTrajectories = findNearestTrajectory(targetStart, targetEnd, 0.8, 0.2, numNearestToSample);

  for (let iteration = 0; iteration < randomSampleIterations; iteration += 1) {
    const perturbedTargetEnd: Point = [
      targetEnd[0] + randomUniform(random, -lenTar * 0.1, lenTar * 0.1),
      targetEnd[1] + randomUniform(random, -lenTar * 0.1, lenTar * 0.1),
    ];
    topTrajectories.push(...findNearestTrajectory(targetStart, perturbedTargetEnd, 0.8, 0.2, numNearestToSample));
  }

  const epsilon = 1e-10;
  const weights = topTrajectories.map((trajectory) => 1 / ((trajectory.length + epsilon) ** lengthPreferencePower));
  const selectedTrajectoryIndex = sampleWeightedIndex(weights, random);

  return [topTrajectories[selectedTrajectoryIndex], dxTar, dyTar, lenTar];
}

function morphTrajectory(
  points: Point[],
  targetStart: Point,
  targetEnd: Point,
  dxTar: number,
  dyTar: number,
  lenTar: number,
): Point[] {
  if (points.length === 0) {
    return [];
  }

  const start = points[0];
  const end = points[points.length - 1];
  const dxOrig = end[0] - start[0];
  const dyOrig = end[1] - start[1];
  const lenOrig = Math.hypot(dxOrig, dyOrig);
  const scaleFactor = lenOrig !== 0 ? lenTar / lenOrig : 1;
  const angleOrig = Math.atan2(dyOrig, dxOrig);
  const angleTar = Math.atan2(dyTar, dxTar);
  const rotationAngle = angleTar - angleOrig;
  const cosA = Math.cos(rotationAngle);
  const sinA = Math.sin(rotationAngle);

  const morphed = points.map((point) => {
    const translatedX = (point[0] - start[0]) * scaleFactor;
    const translatedY = (point[1] - start[1]) * scaleFactor;

    return [
      (translatedX * cosA) - (translatedY * sinA) + targetStart[0],
      (translatedX * sinA) + (translatedY * cosA) + targetStart[1],
    ] as Point;
  });

  morphed[0] = [...targetStart];
  morphed[morphed.length - 1] = [...targetEnd];
  return morphed;
}

function jitterTrajectory(
  points: Point[],
  trajectoryLength: number,
  random: RandomSource,
  scale = 0.01,
): Point[] {
  if (points.length === 0) {
    return [];
  }

  const lengthScale = Math.min(1, trajectoryLength / 400);
  const distancesPrev = new Array<number>(points.length).fill(0);
  const distancesNext = new Array<number>(points.length).fill(0);

  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = Math.hypot(
      points[index + 1][0] - points[index][0],
      points[index + 1][1] - points[index][1],
    );
    distancesPrev[index + 1] = distance;
    distancesNext[index] = distance;
  }

  return points.map((point, index) => {
    const avgDistance = (distancesPrev[index] + distancesNext[index]) / 2;
    const adaptiveScale = scale * (avgDistance / Math.max(avgDistance, 1)) * lengthScale;
    const direction = index % 2 === 0 ? 1 : -1;
    const jitterX = randomUniform(random, 0.5, 1) * adaptiveScale * direction;
    const jitterY = randomUniform(random, 0.5, 1) * adaptiveScale * direction;

    return [point[0] + jitterX, point[1] + jitterY];
  });
}

function generateMiddleBiasedPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  random: RandomSource,
  biasFactor = 2,
): Point {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const width = maxX - minX;
  const height = maxY - minY;
  const offsetX = randomGaussian(random, 0, width / (2 * biasFactor));
  const offsetY = randomGaussian(random, 0, height / (2 * biasFactor));

  return [
    Math.max(minX, Math.min(maxX, centerX + offsetX)),
    Math.max(minY, Math.min(maxY, centerY + offsetY)),
  ];
}

function signedSquareRoot(value: number): number {
  return Math.sign(value) * Math.sqrt(Math.abs(value));
}

function knotTrajectory(
  trajectoryPoints: Point[],
  targetStart: Point,
  targetEnd: Point,
  random: RandomSource,
  numKnots = 5,
  knotStrength = 0.15,
): Point[] {
  if (trajectoryPoints.length === 0) {
    return [];
  }

  const knotOffsets = trajectoryPoints.map(() => [0, 0] as Point);

  for (let knotIndex = 0; knotIndex < numKnots; knotIndex += 1) {
    const knot = generateMiddleBiasedPoint(
      targetStart[0],
      targetStart[1],
      targetEnd[0],
      targetEnd[1],
      random,
    );
    const distances = trajectoryPoints.map((point) => Math.hypot(knot[0] - point[0], knot[1] - point[1]));
    const maxDistance = Math.max(...distances);

    if (maxDistance < 1e-6) {
      continue;
    }

    for (let index = 0; index < trajectoryPoints.length; index += 1) {
      const proximity = 1 - (distances[index] / maxDistance);
      const scalingFactor = proximity * knotStrength;
      knotOffsets[index][0] += (knot[0] - trajectoryPoints[index][0]) * scalingFactor;
      knotOffsets[index][1] += (knot[1] - trajectoryPoints[index][1]) * scalingFactor;
    }
  }

  return trajectoryPoints.map((point, index) => [
    point[0] + signedSquareRoot(knotOffsets[index][0]),
    point[1] + signedSquareRoot(knotOffsets[index][1]),
  ]);
}

function findTrajectory(targetStart: Point, targetEnd: Point, random: RandomSource): [Point[], number[]] {
  const [selectedTrajectory, dxTar, dyTar, lenTar] = findClosestTrajectory(targetStart, targetEnd, random);
  const jitteredPoints = jitterTrajectory(selectedTrajectory.points, lenTar, random);
  const knottedPoints = knotTrajectory(jitteredPoints, targetStart, targetEnd, random);
  const morphedPoints = morphTrajectory(knottedPoints, targetStart, targetEnd, dxTar, dyTar, lenTar);

  return [morphedPoints, selectedTrajectory.timing];
}

export function generateTrajectory(
  targetStart: Point,
  targetEnd: Point,
  options: GenerateTrajectoryOptions = {},
): { points: Point[]; timings: number[] } {
  const frequency = options.frequency ?? 60;
  const frequencyRandomizer = options.frequencyRandomizer ?? 1;
  const random = options.random ?? DEFAULT_RANDOM;

  if (frequency <= 0) {
    throw new Error("frequency must be greater than 0");
  }

  const [trajectoryPoints, originalTimings] = findTrajectory(targetStart, targetEnd, random);
  const timings = originalTimings.map((timing) => timing - originalTimings[0]);
  const totalTime = timings[timings.length - 1] ?? 0;
  const baseStep = Math.max(1, Math.floor(1000 / frequency));
  const sampledPoints: Point[] = [];
  const sampledTimings: number[] = [];
  let lastSampleTime = 0;

  for (let currentTime = 0; currentTime <= totalTime; currentTime += baseStep) {
    const jitterScale = Math.max(1.5, frequencyRandomizer);
    let jitter = Math.trunc(randomGaussian(random, 0, frequencyRandomizer / jitterScale));
    jitter = Math.max(-frequencyRandomizer, Math.min(frequencyRandomizer, jitter));
    const sampleTime = Math.max(lastSampleTime, Math.min(totalTime, Math.max(0, currentTime + jitter)));

    let prevIndex = 0;
    for (let index = 0; index < timings.length; index += 1) {
      if (timings[index] <= sampleTime) {
        prevIndex = index;
      } else {
        break;
      }
    }

    const nextIndex = Math.min(prevIndex + 1, timings.length - 1);
    const prevPoint = trajectoryPoints[prevIndex];
    const nextPoint = trajectoryPoints[nextIndex];
    const prevTime = timings[prevIndex];
    const nextTime = timings[nextIndex];
    const alpha = nextTime !== prevTime ? (sampleTime - prevTime) / (nextTime - prevTime) : 0;
    sampledPoints.push([
      prevPoint[0] + (alpha * (nextPoint[0] - prevPoint[0])),
      prevPoint[1] + (alpha * (nextPoint[1] - prevPoint[1])),
    ]);
    sampledTimings.push(sampleTime);
    lastSampleTime = sampleTime;
  }

  const trajectoryLength = Math.hypot(targetEnd[0] - targetStart[0], targetEnd[1] - targetStart[1]);
  const sampledKnottedPoints = knotTrajectory(sampledPoints, targetStart, targetEnd, random);
  const sampledJitteredPoints = jitterTrajectory(sampledKnottedPoints, trajectoryLength, random);
  const dxTar = targetEnd[0] - targetStart[0];
  const dyTar = targetEnd[1] - targetStart[1];
  const lenTar = Math.hypot(dxTar, dyTar);
  const sampledMorphedPoints = morphTrajectory(
    sampledJitteredPoints,
    targetStart,
    targetEnd,
    dxTar,
    dyTar,
    lenTar,
  );

  return {
    points: sampledMorphedPoints,
    timings: sampledTimings,
  };
}

export function getTrajectoryCount(): number {
  return LOADED_TRAJECTORIES.length;
}
