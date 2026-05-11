"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

/**
 * После входа через Cloud Function `adminIssueToken` в ID-токене есть claim `talkroyAdmin`.
 */
export function useTalkRoyAdminClaim(
  firebaseUser: User | null,
  authReady: boolean,
) {
  const [adminOperator, setAdminOperator] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!firebaseUser) {
      setAdminOperator(false);
      setResolved(true);
      return;
    }
    let cancelled = false;
    firebaseUser.getIdTokenResult().then((r) => {
      if (cancelled) return;
      setAdminOperator(r.claims.talkroyAdmin === true);
      setResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, authReady]);

  return { adminOperator, adminClaimResolved: resolved };
}
