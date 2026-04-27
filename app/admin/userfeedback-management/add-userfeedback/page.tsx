"use client";

import { useSearchParams } from "next/navigation";
import CreateUserFeedback from "@/components/userfeedback-component/CreateUserFeedback";

export default function AddUserFeedbackPage() {
  const searchParams = useSearchParams();
  const feedbackId = searchParams.get("id") || undefined;

  return <CreateUserFeedback feedbackId={feedbackId} />;
}