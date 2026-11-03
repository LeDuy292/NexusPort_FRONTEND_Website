export type BLStatus =
  | 'PENDING_NOTICE'
  | 'PENDING_PAYMENT'
  | 'PENDING_DO'
  | 'DO_ISSUED'
  | 'RELEASED';

export interface ImportContainerItem {
  id: string;
  containerNumber: string;
  containerType: string;
  sealNumber: string;
  weightKg?: number;
  tareWeightKg?: number;
  cargoType?: string;
  status: 'ON_VESSEL' | 'DISCHARGED' | 'GATE_OUT';
  dischargedAt?: string;
  gateOutAt?: string;
}

export interface BLChargeItem {
  id: string;
  chargeName: string;
  amount: number;
  currency: string;
  isPaid: boolean;
  paidAt?: string;
}

export interface BillOfLading {
  id: string;
  blNumber: string;
  voyageNumber: string;
  vesselName: string;
  consignee: string;
  consigneeName?: string;
  shipper?: string;
  notifyParty?: string;
  pol?: string;
  pod?: string;
  cargoDescription?: string;
  hsCode?: string;
  packagesCount?: number;
  packageType?: string;
  grossWeightKg?: number;
  cbm?: number;
  freightTerms?: 'PREPAID' | 'COLLECT';
  blType?: 'ORIGINAL' | 'TELEX_RELEASE' | 'SEA_WAYBILL';
  containerCount: number;
  containersCount?: number;
  status: BLStatus;
  eta: string;
  containers?: ImportContainerItem[];
  charges?: BLChargeItem[];
}

export interface ImportVoyage {
  id: string;
  vesselName: string;
  voyageNumber: string;
  eta: string;
  ata?: string;
  berthCode?: string;
  totalBL: number;
  totalContainers: number;
  manifestUploaded: boolean;
}
