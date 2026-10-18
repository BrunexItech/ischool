import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Milai Group of Schools",
    short_name: "Milai Group of Schools",
    description: "Milai Group of Schools — school management, from the gate to the ledger.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F5F7FA",
    theme_color: "#0B1B3F",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
