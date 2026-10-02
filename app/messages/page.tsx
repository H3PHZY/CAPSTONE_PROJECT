import { Suspense } from "react";
import { MessagesPage } from "@/components/messages/MessagesPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page-shell page-shell--msgs">
          <h1 className="page-title page-title--mb">Messages</h1>
          <div className="page-sub">Loading conversations…</div>
        </div>
      }
    >
      <MessagesPage />
    </Suspense>
  );
}
