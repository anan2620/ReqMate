import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — ReqMate | Getting Started & Reference",
  description:
    "Learn how to use ReqMate. Collections, environments, YAML request format, scripting, authentication, protocols, CLI, and import/export guides.",
  openGraph: {
    title: "ReqMate Documentation",
    description:
      "Getting started guide, YAML format reference, scripting API, CLI tool, and more.",
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
