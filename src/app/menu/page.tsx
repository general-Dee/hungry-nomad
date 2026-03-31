import { Suspense } from 'react';
import MenuContent from './MenuContent';

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-12 text-center">Loading menu...</div>}>
      <MenuContent />
    </Suspense>
  );
}