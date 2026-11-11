'use client';

import React from 'react';
import { FinanceDeliveries } from '@/components/Finance/FinanceDeliveries';

/** Parcels sent on Pathao: what went out each day and what was actually delivered and collected. */
export const DeliveriesView = () => (
  <section className="view" id="deliveries-view">
    <FinanceDeliveries />
  </section>
);
