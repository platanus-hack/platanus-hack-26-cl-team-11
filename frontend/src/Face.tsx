const ATLAS_SIDE = 8;
const ATLAS_FACES = ATLAS_SIDE * ATLAS_SIDE;
const HASH_FACTOR = 31;

const faceIndexOf = (name: string) => [...name].reduce((hash, letter) => (hash * HASH_FACTOR + (letter.codePointAt(0) ?? 0)) % ATLAS_FACES, 0);

const percentOf = (cell: number) => `${(cell / (ATLAS_SIDE - 1)) * 100}%`;

export function Face({ name }: { name: string }) {
  const index = faceIndexOf(name);
  const backgroundPosition = `${percentOf(index % ATLAS_SIDE)} ${percentOf(Math.floor(index / ATLAS_SIDE))}`;
  return <span className="rd-face rd-face--tiny app-face" style={{ backgroundPosition }} aria-hidden="true" />;
}
