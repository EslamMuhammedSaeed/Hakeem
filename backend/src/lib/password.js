import bcrypt from 'bcryptjs';

const COST = 12;

let dummyHashPromise;

function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash('not-a-real-password', COST);
  return dummyHashPromise;
}

export function hashPassword(password) {
  return bcrypt.hash(password, COST);
}

/** Resolve the dummy hash at boot so the first unknown-email login is not an outlier. */
export function warmPasswordCheck() {
  return dummyHash();
}

/**
 * Missing users are compared against a dummy hash so the response does not reveal
 * whether the email exists. Both failures return false.
 */
export async function verifyPassword(password, passwordHash) {
  const hash = passwordHash || (await dummyHash());
  const matches = await bcrypt.compare(password, hash);
  return Boolean(passwordHash) && matches;
}
