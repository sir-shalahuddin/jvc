import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  /** Colours the value for state only (ok / danger). */
  tone?: 'ok' | 'danger';
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtext, tone }) => (
  <div className="metric-card">
    <span className="metric-label">{label}</span>
    <span className="metric-value" style={tone ? { color: `var(--${tone === 'ok' ? 'ok' : 'danger'})` } : undefined}>
      {value}
    </span>
    {subtext && <span className="metric-subtext">{subtext}</span>}
  </div>
);
