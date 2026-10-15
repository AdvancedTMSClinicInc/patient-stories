import type { FacilityCode } from "./types";

export interface Brand {
  logo: string;
  logoAlt: string;
  accent: string; // decorative: stripes, icons, rings
  accentStrong: string; // text and lines on white (meets 4.5:1)
  accentOnNavy: string; // small text on navy
}

export const BRANDS: Record<FacilityCode, Brand> = {
  ATMS: {
    logo: "/brand/advanced-tms.png",
    logoAlt: "Advanced TMS Clinic, Inc.",
    accent: "#39C1C7",
    accentStrong: "#0E7C84",
    accentOnNavy: "#8EE0E4",
  },
  PHS: {
    logo: "/brand/pacific-health.png",
    logoAlt: "Pacific Health Systems",
    accent: "#1E72B9",
    accentStrong: "#1E72B9",
    accentOnNavy: "#9CC8F0",
  },
};

export const REPLY_PHONE_DISPLAY = "(855) ILUV-TMS";
export const REPLY_PHONE_TEL = "+18554588867";
