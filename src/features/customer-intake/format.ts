const englishMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function formatCustomerLinkExpiry(value: string, language: "en" | "is") {
  const date = new Date(value);
  const day = twoDigits(date.getUTCDate());
  const month = twoDigits(date.getUTCMonth() + 1);
  const year = date.getUTCFullYear();
  const time = `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`;

  if (language === "is") return `${day}.${month}.${year} kl. ${time}`;
  return `${day} ${englishMonths[date.getUTCMonth()]} ${year}, ${time}`;
}
