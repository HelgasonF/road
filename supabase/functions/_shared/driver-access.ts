export function getDriverAuthEmail(operatorId: string) {
  return `driver-${operatorId}@access.vegstod.invalid`;
}

export type DriverAccessTokenType = "signup" | "magiclink";

export function buildDriverAccessPath(tokenHash: string, type: DriverAccessTokenType) {
  const query = new URLSearchParams({ token_hash: tokenHash, type });
  return `/driver/access?${query.toString()}`;
}

