// lib/roarNotifyHelpers.ts

import { db } from "@/lib/firebaseAdmin";

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getPostMeta(postId: string): Promise<{
  authorUserId: string;
  authorEmail: string | null;
  text: string;
} | null> {
  try {
    const snap = await db.collection("roarPosts").doc(postId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      authorUserId: data.authorUid ?? data.userId ?? data.authorUserId ?? "",
      authorEmail: data.authorEmail ?? data.email ?? null,
      text: (data.text ?? data.quizQuestion ?? "").slice(0, 120),
    };
  } catch {
    return null;
  }
}

async function resolveRecipientEmail(authorUserId: string): Promise<string | null> {
  try {
    const snap = await db.collection("roarProfiles").doc(authorUserId).get();
    if (snap.exists) {
      const d = snap.data()!;
      return d.email ?? d.authorEmail ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

async function resolveActorName(userId: string): Promise<string> {
  try {
    const snap = await db.collection("roarProfiles").doc(userId).get();
    if (snap.exists) {
      const d = snap.data()!;
      if (d.username) return d.username as string;
      if (d.name) return d.name as string;
    }
  } catch { /* ignore */ }
  return "A fan";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param postId      The reacted-to post
 * @param actorUserId Your app's userId (from getUser().userId)
 * @param reaction    Reaction type string
 */
export async function notifyPostReaction(
  postId: string,
  actorUserId: string,
  reaction: string
): Promise<void> {
  try {
    const post = await getPostMeta(postId);
    if (!post || !post.authorUserId) return;

    // Self-reaction guard
    if (post.authorUserId === actorUserId) return;

    const recipientEmail =
      post.authorEmail ?? (await resolveRecipientEmail(post.authorUserId));
    if (!recipientEmail) return;

    // Resolve actor display name from their ROAR profile
    const actorName = await resolveActorName(actorUserId);

    const notifCollection = db.collection("notifications");

    // Roll-up: update existing notification for this post if one already exists
    const existing = await notifCollection
      .where("type", "==", "roar_post_like")
      .where("postId", "==", postId)
      .where("recipientEmail", "==", recipientEmail)
      .limit(1)
      .get();

    const now = Date.now();

    if (!existing.empty) {
      const docRef = existing.docs[0].ref;
      const prev = existing.docs[0].data();
      const prevNames: string[] = prev.likerNames ?? [];

      const updatedNames = [
        actorName,
        ...prevNames.filter((n) => n !== actorName),
      ].slice(0, 3);

      const likerCount = (prev.likerCount ?? 1) + 1;

      await docRef.update({
        likerNames: updatedNames,
        likerCount,
        message: buildLikeMessage(updatedNames, likerCount),
        isRead: false,
        updatedAt: now,
      });
    } else {
      await notifCollection.add({
        type: "roar_post_like",
        recipientEmail,
        recipientUid: post.authorUserId,
        postId,
        postPreview: post.text || "your ROAR post",
        likerNames: [actorName],
        likerCount: 1,
        message: buildLikeMessage([actorName], 1),
        isRead: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error("[roarNotify] notifyPostReaction error:", err);
  }
}

/**
 * @param postId              The commented-on post
 * @param actorUserId         Your app's userId (from getUser().userId)
 * @param actorEmail          Commenter's email (from getUser().email)
 * @param commenterUsername   Display name
 * @param commentPreview      First ~80 chars of comment text
 */
export async function notifyPostComment(
  postId: string,
  actorUserId: string,
  actorEmail: string,
  commenterUsername: string,
  commentPreview?: string
): Promise<void> {
  try {
    const post = await getPostMeta(postId);
    if (!post || !post.authorUserId) return;

    // Self-comment guard
    if (post.authorUserId === actorUserId) return;
    if (post.authorEmail && post.authorEmail === actorEmail) return;

    const recipientEmail =
      post.authorEmail ?? (await resolveRecipientEmail(post.authorUserId));
    if (!recipientEmail) return;

    const now = Date.now();
    const message = commentPreview
      ? `${commenterUsername} commented on your post: "${commentPreview.slice(0, 60)}"`
      : `${commenterUsername} commented on your ROAR post`;

    await db.collection("notifications").add({
      type: "roar_post_comment",
      recipientEmail,
      recipientUid: post.authorUserId,
      postId,
      postPreview: post.text || "your ROAR post",
      commenterUsername,
      message,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error("[roarNotify] notifyPostComment error:", err);
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function buildLikeMessage(names: string[], total: number): string {
  if (total === 1) return `${names[0]} reacted to your ROAR post`;
  if (total === 2) return `${names[0]} and ${names[1] ?? "1 other"} reacted to your ROAR post`;
  const others = total - 1;
  return `${names[0]} and ${others} other${others === 1 ? "" : "s"} reacted to your ROAR post`;
}