import { IncomingHttpHeaders } from 'http';

export interface RequestData {
  method: string | undefined;
  url: string;
  headers: IncomingHttpHeaders;
  body: string | null;
}

export interface ResponseData {
  statusCode: number | undefined;
  statusMessage: string | undefined;
  headers: IncomingHttpHeaders;
  body: string;
}

export interface RequestRecord {
  id: string;
  timestamp: string;
  duration: number;
  provider: string;
  protocol: 'openai' | 'anthropic';
  threadId: string;
  request: RequestData;
  response?: ResponseData;
  error?: string;
  transformedUrl?: string;
  transformedHeaders?: IncomingHttpHeaders;
}

export type ProtocolType = 'openai' | 'anthropic';

export interface SseClient {
  write: (data: string) => boolean;
}

export interface ApiErrorResponse {
  success: boolean;
  error: string;
  data: unknown;
}

export interface TransformedRequest {
  targetUrl: string;
  headers: IncomingHttpHeaders;
  transformedToken: string;
  originalToken: string;
}

export interface ParsedUserUrl {
  isGatewayRequest: boolean;
  path: string;
  userToken: string | null;
}
