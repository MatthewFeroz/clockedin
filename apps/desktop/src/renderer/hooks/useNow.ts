import { useEffect, useState } from "react";

export const useNow = (tickMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, tickMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [tickMs]);

  return now;
};
