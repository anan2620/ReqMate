import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — ReqMate | 100% Free, Forever",
  description:
    "ReqMate is completely free — every feature, every protocol, no limits, no account required. Open source and community-driven.",
  openGraph: {
    title: "ReqMate Pricing — 100% Free, Forever",
    description:
      "Every feature free forever. No account, no limits, no catches. Open source (MIT).",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
