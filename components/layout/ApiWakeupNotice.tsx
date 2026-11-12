"use client";

import { useEffect, useState } from "react";
import { API_WAKEUP_EVENT } from "@/lib/django-auth";

export function ApiWakeupNotice() {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    const handleWakeup = (event: Event) => {
      setWaking(
        (event as CustomEvent<{ active: boolean }>).detail?.active === true
      );
    };
    window.addEventListener(API_WAKEUP_EVENT, handleWakeup);
    return () => window.removeEventListener(API_WAKEUP_EVENT, handleWakeup);
  }, []);

  if (!waking) return null;
  return (
    <div className="api-wakeup-notice" role="status" aria-live="polite">
      Connecting to EcoLoop… the service may be starting up.
    </div>
  );
}
