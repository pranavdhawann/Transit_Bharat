import { Suspense } from "react";
import GoClient from "./go-client";

export default function GoPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-400">
          Preparing navigation…
        </div>
      }
    >
      <GoClient />
    </Suspense>
  );
}
