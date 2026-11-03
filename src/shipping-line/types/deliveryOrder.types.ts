export type DOStatus = 'ACTIVE' | 'HOLD' | 'CANCELLED' | 'EXPIRED';

export interface DOContainerItem {
  containerNumber: string;
  containerType: string;
  sealNumber: string;
  weightKg?: number;
}

export interface DeliveryOrder {
  id: string;
  doNumber: string;
  blNumber: string;
  consignee: string;
  vesselName?: string;
  voyageNumber?: string;
  validUntil: string;
  status: DOStatus;
  containerCount: number;
  emptyReturnDepot?: string;
  freeDetDays?: number;
  containers?: DOContainerItem[];
  holdReason?: string;
  issuedAt: string;
  updatedAt?: string;
}

export interface DOFilterParams {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
