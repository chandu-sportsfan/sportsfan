// models/RoarOnboardingConfig.ts

export type ConfigType = "sports" | "engagement" | "followEntities";

export interface SportOption {
  id: string;
  label: string;
  tagline: string;
  image: string;
  order: number;
  active: boolean;
}

export interface EngagementOption {
  id: string;
  label: string;
  subtitle: string;
  icon: string; // emoji or icon key
  order: number;
  active: boolean;
}

export interface FollowEntityOption {
  id: string;
  label: string;
  icon: string;         // "IN", "MI", emoji, etc — short badge text
  category: string;      // "CRICKET — INDIA & IPL", "FOOTBALL — INDIA & ISL", etc.
  sportId: string;        // ties it to a SportOption.id so it only shows if that sport is picked
  order: number;
  active: boolean;
}

export type ConfigItem = SportOption | EngagementOption | FollowEntityOption;