export interface PublicMarketDataClient {
  getServerTime(): Promise<unknown>;
  getExchangeInfo(): Promise<unknown>;
  getPremiumIndex(input: { symbol: string }): Promise<unknown>;
  getKlines(input: { symbol: string; interval: string; limit: number }): Promise<unknown>;
}
