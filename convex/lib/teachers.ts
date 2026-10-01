/** Parses the comma-separated TEACHER_EMAILS env var into normalized emails. */
export function teacherEmails(): string[] {
  return (process.env.TEACHER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isTeacherEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return teacherEmails().includes(email.trim().toLowerCase());
}
