export interface ContainerEvent {
  id: string;
  timestamp: string;
  eventCode: string;
  title: string;
  location: string;
  details?: string;
}

export interface DemDetTierBreakdown {
  tierName: string;
  fromDay: number;
  toDay: number;
  ratePerDay: number;
  daysCount: number;
  subTotal: number;
}

export interface DemDetCalculation {
  containerNumber: string;
  calculationDate: string;
  dischargedDate: string;
  gateOutDate?: string;
  totalDays: number;
  freeDays: number;
  chargeableDays: number;
  currency: string;
  totalAmount: number;
  tiers: DemDetTierBreakdown[];
}

export interface ContainerLookupData {
  containerNumber: string;
  containerType: string;
  status: string;
  currentLocation: string;
  sealNumber: string;
  vesselVoyage: string;
  vesselName?: string;
  weightKg?: number;
  bookingOrBLNumber: string;
  events: ContainerEvent[];
  demDet: DemDetCalculation;
}

