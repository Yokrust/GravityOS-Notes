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
  UserRound
} from "lucide-react";

import type {
  CustomSatelliteColor,
  CustomSatelliteIcon
} from "@gravity/domain";

const iconComponents = {
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
} satisfies Record<CustomSatelliteIcon, typeof Sparkles>;

export const customSatelliteColors: Record<
  CustomSatelliteColor,
  { accent: string; soft: string }
> = {
  slate: { accent: "#aeb4be", soft: "rgba(174, 180, 190, 0.12)" },
  amber: { accent: "#ffb800", soft: "rgba(255, 184, 0, 0.12)" },
  rose: { accent: "#ff6b78", soft: "rgba(255, 107, 120, 0.12)" },
  sky: { accent: "#64b5f6", soft: "rgba(100, 181, 246, 0.12)" },
  emerald: { accent: "#00e676", soft: "rgba(0, 230, 118, 0.12)" },
  violet: { accent: "#a78bfa", soft: "rgba(167, 139, 250, 0.12)" }
};

export function CustomSatelliteIconView({
  icon,
  size = 15
}: {
  icon: CustomSatelliteIcon;
  size?: number;
}) {
  const Icon = iconComponents[icon];
  return <Icon size={size} strokeWidth={1.7} />;
}
