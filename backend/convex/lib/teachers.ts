/** Parses the comma-separated ALLOWED_EMAILS env var into normalized emails. */
export function teacherEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0);
}

export function isTeacherEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return teacherEmails().includes(email.trim().toLowerCase());
}
