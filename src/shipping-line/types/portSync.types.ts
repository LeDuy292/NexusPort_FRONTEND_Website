export type SyncMessageStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'SENT';

export interface PortSyncMessage {
  id: string;
  messageType: 'COPRAR' | 'COARRI' | 'CODECO_IN' | 'CODECO_OUT' | 'BAPLIE' | 'VERMAS' | string;
  direction: 'OUTBOUND' | 'INBOUND';
  timestamp?: string;
  createdAt?: string;
  status: SyncMessageStatus;
  referenceNumber: string;
  errorMessage?: string;
  retryCount?: number;
  payloadSummary?: string;
}

