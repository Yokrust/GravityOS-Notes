"use client";

import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Heart,
  Image,
  ListChecks,
  Shirt,
  Sparkles,
  Star,
  UserRound,
  type LucideIcon
} from "lucide-react";

export const CUSTOM_SATELLITE_ICONS: Record<
  CustomSatelliteIconRecord,
  LucideIcon
> = {
  sparkles: Sparkles,
  "list-checks": ListChecks,
  "user-round": UserRound,
  briefcase: Briefcase,
  "book-open": BookOpen,
  shirt: Shirt,
  heart: Heart,
  star: Star,
  "calendar-days": CalendarDays,
  image: Image
};

export const CUSTOM_SATELLITE_COLOR_LIST: CustomSatelliteColorRecord[] = [
  "slate",
  "amber",
  "rose",
  "sky",
  "emerald",
  "violet"
];

export const CUSTOM_SATELLITE_COLORS: Record<
  CustomSatelliteColorRecord,
  { accent: string; soft: string }
> = {
  slate: { accent: "#aeb4be", soft: "rgba(174, 180, 190, 0.14)" },
  amber: { accent: "#f5b85f", soft: "rgba(245, 184, 95, 0.14)" },
  rose: { accent: "#f08791", soft: "rgba(240, 135, 145, 0.14)" },
  sky: { accent: "#6aa6ff", soft: "rgba(106, 166, 255, 0.14)" },
  emerald: { accent: "#46c894", soft: "rgba(70, 200, 148, 0.14)" },
  violet: { accent: "#a78bfa", soft: "rgba(167, 139, 250, 0.14)" }
};

export function CustomSatelliteIcon({
  icon,
  size = 15
}: {
  icon: CustomSatelliteIconRecord;
  size?: number;
}) {
  const Icon = CUSTOM_SATELLITE_ICONS[icon] ?? Sparkles;
  return <Icon size={size} strokeWidth={1.7} />;
}
