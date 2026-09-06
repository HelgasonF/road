function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildCustomerIntakeWhatsAppMessage(customerName: string, customerUrl: string) {
  const name = oneLine(customerName);

  return [
    `Hello ${name},`,
    "",
    "Vegstoð has created a secure link for your roadside-assistance request.",
    "",
    "Please confirm your location, vehicle details and the problem. You can also upload photos.",
    "",
    customerUrl.trim(),
    "",
    "This private link expires in 24 hours. Do not forward it.",
  ].join("\n");
}
