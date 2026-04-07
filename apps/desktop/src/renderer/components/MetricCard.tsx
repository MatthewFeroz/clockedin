type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

export const MetricCard = ({ label, value, hint }: MetricCardProps) => (
  <article className="metric-card">
    <span className="metric-card__label">{label}</span>
    <strong className="metric-card__value">{value}</strong>
    <span className="metric-card__hint">{hint}</span>
  </article>
);
