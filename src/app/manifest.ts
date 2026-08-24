import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Transit Bharat - Delhi pilot",
    short_name: "Transit Bharat",
    description:
      "A trustworthy navigation layer for Indian public transport. Door-to-door bus + metro journeys with honest data provenance.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    lang: "en-IN",
  };
}
