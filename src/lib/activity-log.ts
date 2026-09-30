import { FieldValue } from "firebase-admin/firestore";
import { admin } from "@/lib/server";

export type ActivityKind =
  | "friend_request_sent"
  | "friend_request_accepted"
  | "friend_request_declined"
  | "friend_request_cancelled"
  | "friend_removed"
  | "user_blocked"
  | "user_unblocked"
  | "global_message_sent"
  | "direct_message_sent";

export async function logUserActivity(args: {
  kind: ActivityKind;
  actorId: string;
  targetId?: string;
  resourceId?: string;
  summary: string;
}) {
  try {
    await admin().db.collection("activityLogs").add({
      ...args,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Audit telemetry must never make the user's completed action appear to fail.
    console.error("Failed to write activity log:", error instanceof Error ? error.name : "unknown");
  }
}
