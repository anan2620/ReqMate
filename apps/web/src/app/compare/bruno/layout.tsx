import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReqMate vs Bruno — Native Speed, More Protocols",
  description:
    "Compare ReqMate and Bruno. Tauri native speed vs Electron, gRPC + SSE + MQTT support, mock servers, monitoring, and plugin system.",
  openGraph: {
    title: "ReqMate vs Bruno",
    description: "Same local-first philosophy. Tauri native performance. More protocols and features.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
