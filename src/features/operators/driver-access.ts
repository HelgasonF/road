function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export {
  buildDriverAccessPath,
  getDriverAuthEmail,
  type DriverAccessTokenType,
} from "../../../supabase/functions/_shared/driver-access";

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
