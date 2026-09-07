function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildCustomerIntakeWhatsAppMessage(customerName: string, customerUrl: string) {
  const name = oneLine(customerName);
  const greeting = name ? `Hello ${name},` : "Hello,";
  const instructions = name
    ? "Please confirm your name, location, vehicle details, the assistance you need and a short description. You can also upload photos."
    : "Please add your name, confirm your location, vehicle details, the assistance you need and a short description. You can also upload photos.";

  return [
    greeting,
    "",
    "Vegstoð has created a secure link for your roadside-assistance request.",
    "",
    instructions,
    "",
    customerUrl.trim(),
    "",
    "This private link expires in 24 hours. Do not forward it.",
  ].join("\n");
}
