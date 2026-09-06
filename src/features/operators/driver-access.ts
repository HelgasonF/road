function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function getDriverAuthEmail(operatorId: string) {
  return `driver-${operatorId}@access.vegstod.invalid`;
}

export type DriverAccessTokenType = "signup" | "magiclink";

export function buildDriverAccessPath(tokenHash: string, type: DriverAccessTokenType) {
  const query = new URLSearchParams({ token_hash: tokenHash, type });
  return `/driver/access?${query.toString()}`;
}

export function buildDriverAccessWhatsAppMessage(driverName: string, accessUrl: string) {
  return [
    `Hæ ${oneLine(driverName)}.`,
    "",
    "Hér er öruggur aðgangstengill þinn að ökumannsskjá Vegstoðar:",
    accessUrl.trim(),
    "",
    "Opnaðu tengilinn og ýttu á „Opna ökumannsskjá“. Tengillinn rennur út. Ekki framsenda tengilinn.",
  ].join("\n");
}
