export function assertValid<T>(x: T|undefined|null): T {
  if (x === undefined || x === null) {
    throw new Error('invalid value');
  }
  return x;
}
