// src/app/ask/page.tsx — Library-wide Ask page (no FM scope)
import { AskPageClient } from "@/components/AskPageClient";

export const metadata = {
  title: "Ask the Doctrine Library",
  description:
    "Grounded answers drawn from 51 Field Manuals — every claim cites its source.",
};

export default function AskPage() {
  return <AskPageClient fmId={null} />;
}
