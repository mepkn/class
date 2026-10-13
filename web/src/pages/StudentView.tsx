import { StudentStage } from "@/components/StudentStage";

/** `/` — anonymous, full-screen, no navigation. */
export function StudentView() {
  return (
    <div className="h-dvh w-full">
      <StudentStage />
    </div>
  );
}
