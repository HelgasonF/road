import type { StyleSpecification } from "maplibre-gl";

export const ICELAND_CENTER: [number, number] = [-18.7, 64.95];
export const ICELAND_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-27.8, 62.1],
  [-10.1, 68.1],
];

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export function createIcelandMapStyle(): StyleSpecification {
  const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL;
  const attribution = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || DEFAULT_ATTRIBUTION;

  return {
    version: 8,
    sources: {
      icelandBasemap: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution,
      },
    },
    layers: [
      {
        id: "iceland-basemap",
        type: "raster",
        source: "icelandBasemap",
      },
    ],
  };
}
