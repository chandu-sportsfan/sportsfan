// api/post-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export type ReportReason =
    | "illegal_content"
    | "indecent_content"
    | "irrelevant_content"
    | "misleading_information"
    | "offensive_content";

interface ReportPayload {
    postId: string;
    reporterId: string;
    reporterName?: string;
    reason: ReportReason;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_REPORTS_PER_DAY           = 10;    // max reports a single user can file per 24h
const SAME_AUTHOR_WINDOW_DAYS       = 7;     // rolling window for same-author check
const SAME_AUTHOR_MAX_REPORTS       = 3;     // max reports against one author in that window
const COORDINATED_WINDOW_MS         = 30 * 60 * 1000; // 30 min window for coordination check
const COORDINATED_THRESHOLD         = 5;     // reports in that window = coordinated flag
const LOW_TRUST_DISMISSAL_RATIO     = 0.70;  // 70%+ dismissals → low trust
const LOW_TRUST_MIN_REPORTS         = 10;    // need at least this many reports to judge ratio
const ABUSE_DISABLE_DISMISSAL_RATIO = 0.80;  // 80%+ dismissals → disable reporting ability
const ABUSE_DISABLE_MIN_REPORTS     = 15;

const VALID_REASONS: ReportReason[] = [
    "illegal_content",
    "indecent_content",
    "irrelevant_content",
    "misleading_information",
    "offensive_content",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Load or create the reporter's reputation doc */
async function getReporterReputation(reporterId: string) {
    const ref = db.collection("reporterReputation").doc(reporterId);
    const snap = await ref.get();
    if (snap.exists) return { ref, data: snap.data()! };

    const defaults = {
        reporterId,
        totalReports: 0,
        validatedReports: 0,
        dismissedReports: 0,
        trustScore: 1.0,          // 0.0 – 1.0
        reportingDisabled: false,
        disabledAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    await ref.set(defaults);
    return { ref, data: defaults };
}

/** Recompute and persist trust score after any update */
async function refreshTrustScore(
    repRef: FirebaseFirestore.DocumentReference,
    repData: Record<string, unknown>
) {
    const total     = (repData.totalReports     as number) || 0;
    const dismissed = (repData.dismissedReports as number) || 0;
    const validated = (repData.validatedReports as number) || 0;

    let trustScore      = repData.trustScore as number ?? 1.0;
    let reportingDisabled = repData.reportingDisabled as boolean ?? false;

    if (total >= LOW_TRUST_MIN_REPORTS) {
        const dismissalRatio = dismissed / total;
        const validationRatio = validated / total;

        // Simple weighted score: reward validations, penalise dismissals
        trustScore = Math.max(0, Math.min(1, 0.5 + validationRatio * 0.5 - dismissalRatio * 0.5));

        if (total >= ABUSE_DISABLE_MIN_REPORTS && dismissalRatio >= ABUSE_DISABLE_DISMISSAL_RATIO) {
            reportingDisabled = true;
        }
    }

    await repRef.update({ trustScore, reportingDisabled, updatedAt: Date.now() });
    return { trustScore, reportingDisabled };
}

// ── POST /api/post-report ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body: ReportPayload = await req.json();
        const { postId, reporterId, reporterName, reason } = body;

        // ── Basic validation ──────────────────────────────────────────────────
        if (!postId || !reporterId || !reason) {
            return NextResponse.json(
                { success: false, error: "postId, reporterId, and reason are required" },
                { status: 400 }
            );
        }
        if (!VALID_REASONS.includes(reason)) {
            return NextResponse.json(
                { success: false, error: "Invalid report reason" },
                { status: 400 }
            );
        }

        // ── Fetch post ────────────────────────────────────────────────────────
        const postRef  = db.collection("socialPosts").doc(postId);
        const postSnap = await postRef.get();
        if (!postSnap.exists) {
            return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
        }
        const postData = postSnap.data()!;
        const postAuthorId = postData.userId ?? null;

        // ── Reporter reputation check ─────────────────────────────────────────
        const { ref: repRef, data: repData } = await getReporterReputation(reporterId);

        if (repData.reportingDisabled) {
            // Return 200 so the UI looks normal — never tell abusers they're blocked
            return NextResponse.json({
                success: true,
                message: "Report submitted. Thank you for helping keep the community safe.",
                _silenced: true,  // internal marker; don't expose to client in production
            });
        }

        // ── Duplicate: same reporter + same post ──────────────────────────────
        const dupQuery = await db
            .collection("postReports")
            .where("postId",     "==", postId)
            .where("reporterId", "==", reporterId)
            .limit(1)
            .get();
        if (!dupQuery.empty) {
            return NextResponse.json(
                { success: false, error: "You have already reported this post" },
                { status: 409 }
            );
        }

        // ── Rate limit: max N reports per 24h per reporter ────────────────────
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const dailySnap = await db
            .collection("postReports")
            .where("reporterId", "==", reporterId)
            .where("createdAt",  ">",  oneDayAgo)
            .get();

        const isSilencedByRateLimit = dailySnap.size >= MAX_REPORTS_PER_DAY;

        // ── Same-author abuse: too many reports against one author ────────────
        const windowStart = Date.now() - SAME_AUTHOR_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        let isSuspiciousAuthorTarget = false;
        if (postAuthorId) {
            const sameAuthorSnap = await db
                .collection("postReports")
                .where("reporterId",   "==", reporterId)
                .where("postAuthorId", "==", postAuthorId)
                .where("createdAt",    ">",  windowStart)
                .get();
            isSuspiciousAuthorTarget = sameAuthorSnap.size >= SAME_AUTHOR_MAX_REPORTS;
        }

        // ── Coordinated reporting: many reporters on same post in short window ─
        const coordWindowStart = Date.now() - COORDINATED_WINDOW_MS;
        const coordSnap = await db
            .collection("postReports")
            .where("postId",    "==", postId)
            .where("createdAt", ">",  coordWindowStart)
            .get();
        const isCoordinated = coordSnap.size >= COORDINATED_THRESHOLD;

        // ── Trust score influence ─────────────────────────────────────────────
        const trustScore          = repData.trustScore ?? 1.0;
        const isLowTrust          =
            (repData.totalReports as number) >= LOW_TRUST_MIN_REPORTS &&
            trustScore < (1 - LOW_TRUST_DISMISSAL_RATIO);

        // ── Determine effective status ────────────────────────────────────────
        // Silenced reports are saved but never surface to admins as actionable
        let status: "pending" | "silenced" | "flagged_coordinated" | "low_trust_review";
        if (isSilencedByRateLimit) {
            status = "silenced";
        } else if (isCoordinated) {
            status = "flagged_coordinated";
        } else if (isSuspiciousAuthorTarget || isLowTrust) {
            status = "low_trust_review";
        } else {
            status = "pending";
        }

        const now = Date.now();
        const reportDoc = {
            postId,
            postAuthorId,
            reporterId,
            reporterName:    reporterName || "Anonymous",
            reason,
            status,
            trustScoreAtSubmission: trustScore,
            abuseFlags: {
                rateLimited:           isSilencedByRateLimit,
                suspiciousAuthorTarget: isSuspiciousAuthorTarget,
                coordinated:           isCoordinated,
                lowTrust:              isLowTrust,
            },
            createdAt: now,
            updatedAt: now,
        };

        const docRef = await db.collection("postReports").add(reportDoc);

        // ── Increment reporter's total count & refresh trust score ────────────
        await repRef.update({
            totalReports: FieldValue.increment(1),
            updatedAt:    now,
        });
        // Re-read updated data then refresh score
        const updatedRepSnap = await repRef.get();
        await refreshTrustScore(repRef, updatedRepSnap.data()!);

        // ── Increment reportCount on post only for actionable reports ─────────
        if (status === "pending" || status === "flagged_coordinated") {
            await postRef.update({
                reportCount: FieldValue.increment(1),
                updatedAt:   now,
            });
        }

        return NextResponse.json(
            {
                success: true,
                data:    { id: docRef.id, ...reportDoc },
                message: "Report submitted. Thank you for helping keep the community safe.",
            },
            { status: 201 }
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("POST /api/post-report error:", error);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

// ── PATCH /api/post-report  — Admin: resolve a report (validated | dismissed) ─
// Body: { reportId: string, resolution: "validated" | "dismissed", adminId: string }
export async function PATCH(req: NextRequest) {
    try {
        const { reportId, resolution, adminId } = await req.json();

        if (!reportId || !resolution || !adminId) {
            return NextResponse.json(
                { success: false, error: "reportId, resolution, and adminId are required" },
                { status: 400 }
            );
        }
        if (resolution !== "validated" && resolution !== "dismissed") {
            return NextResponse.json(
                { success: false, error: "resolution must be 'validated' or 'dismissed'" },
                { status: 400 }
            );
        }

        const reportRef  = db.collection("postReports").doc(reportId);
        const reportSnap = await reportRef.get();
        if (!reportSnap.exists) {
            return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
        }

        const reportData = reportSnap.data()!;
        const reporterId = reportData.reporterId as string;
        const now        = Date.now();

        // Update the report document
        await reportRef.update({
            status:     resolution === "validated" ? "actioned" : "dismissed",
            resolvedBy: adminId,
            resolvedAt: now,
            updatedAt:  now,
        });

        // Update reporter's reputation counters
        const { ref: repRef } = await getReporterReputation(reporterId);
        const field = resolution === "validated" ? "validatedReports" : "dismissedReports";
        await repRef.update({
            [field]:   FieldValue.increment(1),
            updatedAt: now,
        });

        // Recompute trust score
        const updatedRepSnap = await repRef.get();
        const { trustScore, reportingDisabled } = await refreshTrustScore(repRef, updatedRepSnap.data()!);

        return NextResponse.json({
            success: true,
            message: `Report marked as ${resolution}.`,
            reporterTrustScore:      trustScore,
            reporterReportingStatus: reportingDisabled ? "disabled" : "active",
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("PATCH /api/post-report error:", error);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

// ── GET /api/post-report  — Fetch reports (admin) ────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const postId     = searchParams.get("postId");
        const reporterId = searchParams.get("reporterId");
        const status     = searchParams.get("status");

        let query = db.collection("postReports").orderBy("createdAt", "desc") as
            FirebaseFirestore.Query;

        if (postId)     query = query.where("postId",     "==", postId);
        if (reporterId) query = query.where("reporterId", "==", reporterId);
        if (status)     query = query.where("status",     "==", status);

        const snapshot = await query.limit(100).get();
        const reports  = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({ success: true, reports, total: reports.length });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("GET /api/post-report error:", error);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}