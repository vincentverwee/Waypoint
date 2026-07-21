'use client';

import { Globe, Building2, Route, Navigation } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { DashboardStats } from '@/types';

interface StatsGridProps {
  stats: DashboardStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const cards = [
    {
      label: 'Countries',
      value: stats.countries_visited,
      icon: Globe,
      description: 'Unique countries visited',
    },
    {
      label: 'Cities',
      value: stats.cities_visited,
      icon: Building2,
      description: 'Cities explored',
    },
    {
      label: 'Trips',
      value: stats.trips_count,
      icon: Route,
      description: 'Road trips completed',
    },
    {
      label: 'Km Driven',
      value: stats.total_km.toLocaleString(),
      icon: Navigation,
      description: 'Total kilometers on the road',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card, i) => (
        <StatsCard key={card.label} {...card} index={i} />
      ))}
    </div>
  );
}
