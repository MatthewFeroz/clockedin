import { useEffect, useState } from "react";

import type { DesktopSnapshot } from "@clockedin/shared";

export const useSnapshot = () => {
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    if (!window.clockedin) {
      setError("Desktop bridge did not load. Restart the app to retry.");
      return;
    }

    window.clockedin
      .getSnapshot()
      .then((nextSnapshot) => {
        if (!disposed) {
          setSnapshot(nextSnapshot);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (!disposed) {
          setError(nextError instanceof Error ? nextError.message : "Could not load the desktop snapshot.");
        }
      });

    const unsubscribe = window.clockedin.onSnapshotUpdated((nextSnapshot) => {
      if (!disposed) {
        setSnapshot(nextSnapshot);
        setError(null);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return {
    snapshot,
    error
  };
};
