import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReqMate vs Postman — Why Developers Are Switching",
  description:
    "Compare ReqMate and Postman. 16x less RAM, instant startup, zero login, no cloud dependency, no data leaks. Free and open source.",
  openGraph: {
    title: "ReqMate vs Postman",
    description: "50MB RAM vs 800MB. <2s startup vs 10-30s. Zero login vs forced accounts.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
