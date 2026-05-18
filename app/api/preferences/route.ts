import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── Types 

type PurposeType =
  | "CATCH_LIVE_ACTION"
  | "WATCH_HIGHLIGHTS"
  | "FOLLOW_PLAYERS_TEAMS"
  | "EXPLORE_EVERYTHING";

type ContentStyleType =
  | "SHORT_AND_FAST"
  | "DEEP_DIVES"
  | "VIDEO_FIRST"
  | "LIVE_SCORES";

interface NotificationPreferences {
  liveMatchAlerts: boolean;
  finalScores: boolean;
  breakingNews: boolean;
  highlightDrops: boolean;
}

interface UserPreferences {
  userId: string;

  // Step 1 — What brings you here?
  purpose: PurposeType;

  // Step 2 — Pick what you love (sports)
  sports: string[]; // e.g. ["Cricket", "Football", "Tennis"]

  // Step 3 — How do you like your sports?
  contentStyle: ContentStyleType;

  // Step 4 — Notifications
  notifications: NotificationPreferences;

  createdAt: number;
  updatedAt: number;
}

//  Constants 

const VALID_PURPOSES: PurposeType[] = [
  "CATCH_LIVE_ACTION",
  "WATCH_HIGHLIGHTS",
  "FOLLOW_PLAYERS_TEAMS",
  "EXPLORE_EVERYTHING",
];

const VALID_CONTENT_STYLES: ContentStyleType[] = [
  "SHORT_AND_FAST",
  "DEEP_DIVES",
  "VIDEO_FIRST",
  "LIVE_SCORES",
];

const COLLECTION = "userPreferences";

//  GET: Fetch preferences for a user 

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      const snapshot = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
      const preferences = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return NextResponse.json({ success: true, preferences });
    }

    const docRef = db.collection(COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Preferences not found for this user" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: { id: doc.id, ...doc.data() },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching user preferences:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

//  POST: Create preferences for a user (onboarding submit) 

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      userId,
      purpose,
      sports,
      contentStyle,
      notifications,
    } = body;

    // ── Required field validation ──
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!purpose || !VALID_PURPOSES.includes(purpose)) {
      return NextResponse.json(
        {
          error: `purpose is required and must be one of: ${VALID_PURPOSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(sports) || sports.length === 0) {
      return NextResponse.json(
        { error: "sports must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!contentStyle || !VALID_CONTENT_STYLES.includes(contentStyle)) {
      return NextResponse.json(
        {
          error: `contentStyle is required and must be one of: ${VALID_CONTENT_STYLES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // ── Notification defaults (all true if not provided) ──
    const resolvedNotifications: NotificationPreferences = {
      liveMatchAlerts: notifications?.liveMatchAlerts ?? true,
      finalScores: notifications?.finalScores ?? true,
      breakingNews: notifications?.breakingNews ?? true,
      highlightDrops: notifications?.highlightDrops ?? true,
    };

    // ── Check for existing preferences ──
    const docRef = db.collection(COLLECTION).doc(userId);
    const existing = await docRef.get();

    if (existing.exists) {
      return NextResponse.json(
        {
          error:
            "Preferences already exist for this user. Use PUT to update them.",
        },
        { status: 409 }
      );
    }

    const newPreferences: UserPreferences = {
      userId,
      purpose,
      sports: sports.map((s: string) => s.trim()),
      contentStyle,
      notifications: resolvedNotifications,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await docRef.set(newPreferences);

    return NextResponse.json(
      {
        success: true,
        preferences: { id: userId, ...newPreferences },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error creating user preferences:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

//  PUT: Update preferences (full or partial) 

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      userId,
      purpose,
      sports,
      contentStyle,
      notifications,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const docRef = db.collection(COLLECTION).doc(userId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json(
        { error: "Preferences not found. Use POST to create them first." },
        { status: 404 }
      );
    }

    // ── Validate only fields that are provided ──
    const updates: Partial<UserPreferences> & { updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (purpose !== undefined) {
      if (!VALID_PURPOSES.includes(purpose)) {
        return NextResponse.json(
          {
            error: `purpose must be one of: ${VALID_PURPOSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updates.purpose = purpose;
    }

    if (sports !== undefined) {
      if (!Array.isArray(sports) || sports.length === 0) {
        return NextResponse.json(
          { error: "sports must be a non-empty array" },
          { status: 400 }
        );
      }
      updates.sports = sports.map((s: string) => s.trim());
    }

    if (contentStyle !== undefined) {
      if (!VALID_CONTENT_STYLES.includes(contentStyle)) {
        return NextResponse.json(
          {
            error: `contentStyle must be one of: ${VALID_CONTENT_STYLES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updates.contentStyle = contentStyle;
    }

    if (notifications !== undefined) {
      const existingData = existing.data() as UserPreferences;
      // Merge with existing notification settings so partial updates work
      updates.notifications = {
        ...existingData.notifications,
        ...notifications,
      };
    }

    await docRef.update(updates);

    const updated = await docRef.get();

    return NextResponse.json({
      success: true,
      preferences: { id: updated.id, ...updated.data() },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error updating user preferences:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

//  DELETE: Remove preferences for a user 

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const docRef = db.collection(COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Preferences not found for this user" },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: "User preferences deleted successfully",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error deleting user preferences:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}