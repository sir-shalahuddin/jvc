import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trendBadge?: {
    text: string;
    type: 'success' | 'warning' | 'info' | 'primary';
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trendBadge,
  onClick,
}) => {
  return (
    <div
      className="metric-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <div className="metric-icon-box">{icon}</div>
      </div>
      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        {trendBadge && (
          <span className={`badge badge-${trendBadge.type}`}>{trendBadge.text}</span>
        )}
      </div>
      {subtext && <span className="metric-subtext">{subtext}</span>}
    </div>
  );
};
