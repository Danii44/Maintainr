export type ReminderErrorKey = "database" | "notFound" | "unauthorized" | "invalidDueAt" | "invalidTitle";

export function reminderError(key: ReminderErrorKey) {
  const messages: Record<ReminderErrorKey, string> = {
    database: "Database unavailable / قاعدة البيانات غير متاحة",
    notFound: "Reminder not found in your organization / التذكير غير موجود في مؤسستك",
    unauthorized: "Reminder action is not authorized / ليس لديك صلاحية لهذا التذكير",
    invalidDueAt: "Reminder date is invalid / تاريخ التذكير غير صالح",
    invalidTitle: "Reminder title and description are required / عنوان ووصف التذكير مطلوبان",
  };
  return messages[key];
}
