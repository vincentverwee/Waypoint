'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-muted" />,
});

export function MapWrapper({ className }: { className?: string }) {
  return (
    <div className={className}>
      <MapView />
    </div>
  );
}
