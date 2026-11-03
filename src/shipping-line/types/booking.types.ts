export type BookingStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'BL_ISSUED'
  | 'CANCELLED';

export interface BookingContainer {
  id: string;
  containerNumber: string;
  containerType: string;
  sealNumber?: string;
  vgmWeight?: number;
  status: 'CHO_DONG' | 'DA_HA_BAI' | 'DA_XEP_TAU';
}

export interface CutOffMilestone {
  code: 'CY_CUTOFF' | 'VGM_CUTOFF' | 'SI_CUTOFF';
  label: string;
  deadline: string;
  isPassed: boolean;
}

export interface BookingHistoryEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  description: string;
}

export interface ExportBooking {
  id: string;
  bookingNumber: string;
  shipperName: string;
  vesselName: string;
  voyageNumber: string;
  destinationPort: string;
  containerType: string;
  containerQuantity: number;
  etd: string;
  status: BookingStatus;
  depotPickUp?: string;
  freeDemDays?: number;
  freeDetDays?: number;
  rejectionReason?: string;
  blNumber?: string;
  cutOffs?: CutOffMilestone[];
  containers?: BookingContainer[];
  history?: BookingHistoryEvent[];
}

export interface BookingFilterParams {
  search?: string;
  status?: string;
  voyage?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ApproveBookingDto {
  voyageNumber: string;
  depotPickUp: string;
  freeDemDays: number;
  freeDetDays: number;
}

export interface RejectBookingDto {
  reason: string;
}

