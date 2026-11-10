import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck, Stamp } from "lucide-react";

import Logo from "@/components/Logo";
import UploadCard from "@/components/signet/UploadCard";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const trust = [
  {
    icon: ShieldCheck,
    title: "Verifiable signature",
    body: "Every signature chains to the Omni Signing Root CA, so any verifier can confirm who signed.",
  },
  {
    icon: Stamp,
    title: "Trusted timestamp",
    body: "A trusted authority timestamps the sealed document, proving when it was signed.",
  },
  {
    icon: CheckCircle2,
    title: "Tamper-evident trail",
    body: "A hash-chained provenance record makes any later change to the document detectable.",
  },
];

function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <Logo className="mx-auto size-14 text-primary" />
        <h1 className="mt-5 text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
          Sign documents with proof.
        </h1>
        <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
          Upload a PDF, sign it or send it for signature, and get back a
          document with a verifiable signature, a trusted timestamp, and a
          tamper-evident trail. No account required.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-2xl">
        <UploadCard />
      </div>

      {/* Trust row */}
      <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-3">
        {trust.map(({ icon: Icon, title, body }) => (
          <div key={title} className="text-center sm:text-left">
            <Icon className="mx-auto size-6 text-primary sm:mx-0" />
            <h3 className="mt-3 font-medium text-sm">{title}</h3>
            <p className="mt-1 text-muted-foreground text-sm">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
