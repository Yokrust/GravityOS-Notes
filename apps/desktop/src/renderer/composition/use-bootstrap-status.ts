import { useEffect, useState } from "react";

interface BootstrapStatus {
  appName: string;
  packageCount: number;
}

export function useBootstrapStatus(): BootstrapStatus | null {
  const [status, setStatus] = useState<BootstrapStatus | null>(null);

  useEffect(() => {
    void window.gravity.getBootstrapStatus().then(setStatus);
  }, []);

  return status;
}
