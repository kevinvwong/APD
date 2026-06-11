// src/app/ask/page.tsx — Library-wide Ask page (no FM scope)
import { Suspense } from "react";
import { AskPageClient } from "@/components/AskPageClient";

export const metadata = {
  title: "Ask the Doctrine Library",
  description:
    "Grounded answers drawn from 51 Field Manuals — every claim cites its source.",
};

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskPageClient fmId={null} />
    </Suspense>
  );
}
