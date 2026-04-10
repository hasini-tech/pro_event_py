"use client";

import { Suspense } from "react";
import CreateEventBuilderPage from "@/components/CreateEventBuilderPage";

export default function CreateEventPage() {
  return (
    <Suspense fallback={null}>
      <CreateEventBuilderPage />
    </Suspense>
  );
}
