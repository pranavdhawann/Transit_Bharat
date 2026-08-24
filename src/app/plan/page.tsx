import { Suspense } from "react";
import PlanClient from "./plan-client";

export default function PlanPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-400">
          Planning your journey…
        </div>
      }
    >
      <PlanClient />
    </Suspense>
  );
}
