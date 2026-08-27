import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BharaTransit - Delhi pilot",
    short_name: "BharaTransit",
    description:
      "A trustworthy navigation layer for Indian public transport. Door-to-door bus + metro journeys with honest data provenance.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F3EF",
    theme_color: "#131A22",
    lang: "en-IN",
  };
}
