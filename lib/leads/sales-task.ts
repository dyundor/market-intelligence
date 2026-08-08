function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextBusinessDay(date: Date): Date {
  const result = new Date(date);
  do result.setUTCDate(result.getUTCDate() + 1);
  while (result.getUTCDay() === 0 || result.getUTCDay() === 6);
  return result;
}

export function scheduleReviewDate(index: number, startDate: string, perBusinessDay = 2): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("startDate must be YYYY-MM-DD");
  if (!Number.isInteger(index) || index < 0) throw new Error("index must be a non-negative integer");
  if (!Number.isInteger(perBusinessDay) || perBusinessDay < 1) throw new Error("perBusinessDay must be positive");
  let due = new Date(`${startDate}T00:00:00Z`);
  for (let day = 0; day <= Math.floor(index / perBusinessDay); day += 1) due = nextBusinessDay(due);
  return isoDate(due);
}
