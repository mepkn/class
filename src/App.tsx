import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2, ShieldX } from "lucide-react";
import { api } from "../convex/_generated/api";
import { StudentView } from "@/pages/StudentView";

// The editor is heavy; students never download it.
const TeacherDashboard = lazy(() =>
  import("@/pages/TeacherDashboard").then((m) => ({ default: m.TeacherDashboard })),
);
import { TeacherLogin } from "@/pages/TeacherLogin";
import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StudentView />} />
      <Route path="/teacher" element={<TeacherRoute />} />
      {/* Students are pinned to "/": unknown routes redirect without a history entry. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function TeacherRoute() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.auth.me, isAuthenticated ? {} : "skip");

  if (isLoading) return <FullScreenSpinner />;
  if (!isAuthenticated) return <TeacherLogin />;
  if (me === undefined) return <FullScreenSpinner />;
  if (me === null || !me.isTeacher) return <AccessDenied email={me?.email ?? null} />;
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <TeacherDashboard email={me.email} />
    </Suspense>
  );
}

function AccessDenied({ email }: { email: string | null }) {
  const { signOut } = useAuthActions();
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldX className="size-12 text-destructive" />
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="max-w-sm text-muted-foreground">
        {email ? <>The account <strong>{email}</strong> is not</> : "This account is not"} on the
        teacher allowlist.
      </p>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
