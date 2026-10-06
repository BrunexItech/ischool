"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Picks black or white text so it stays readable against any brand color
 * a school might choose, including pale ones — standard relative-luminance
 * contrast check, not just "always white". */
function readableForeground(hex: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return "#ffffff";
  const [r, g, b] = [match[1], match[2], match[3]].map((h) => parseInt(h, 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111111" : "#ffffff";
}

/** Applies a school's own brand color to the dashboard chrome (buttons,
 * active nav state, focus rings) — without this, "white-labeling" only
 * ever showed up on the login page and report cards. */
export function BrandTheme() {
  const { user, token } = useAuth();
  const [vars, setVars] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api
      .getSchoolBranding(token, user.school_id)
      .then((school) => {
        const foreground = readableForeground(school.primary_color);
        setVars({
          "--primary": school.primary_color,
          "--primary-foreground": foreground,
          "--sidebar-primary": school.primary_color,
          "--sidebar-primary-foreground": foreground,
          "--sidebar-ring": school.primary_color,
          "--ring": school.primary_color,
          "--accent-foreground": school.primary_color,
        });
      })
      .catch(() => setVars(null));
  }, [token, user?.school_id]);

  if (!vars) return null;
  return <style>{`:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`}</style>;
}
