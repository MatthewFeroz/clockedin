import type { ConnectionStatus } from "@clockedin/shared";

type StatusPillProps = {
  label: string;
  status: ConnectionStatus;
};

export const StatusPill = ({ label, status }: StatusPillProps) => (
  <div className={`status-pill status-pill--${status}`}>
    <span className="status-pill__dot" />
    <span>{label}</span>
    <strong>{status}</strong>
  </div>
);
