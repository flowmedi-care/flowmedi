export function isIntegraIcpEnabled(): boolean {
  return Boolean(process.env.INTEGRA_ICP_CHANNEL_ID?.trim());
}
