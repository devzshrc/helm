export type IntegrationErrorCode =
  | "encrypted_data_invalid"
  | "oauth_missing"
  | "unknown";

export type IntegrationRepairAction = "reconnect";

export type IntegrationHealth = {
  connected: boolean;
  healthy: boolean;
  externalAccountId: string | null;
  status: string;
  webhookStatus: string;
  expiresAt: Date | null;
  errorCode?: IntegrationErrorCode;
  repairAction?: IntegrationRepairAction;
};

export function isReconnectRequiredError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /invalid encrypted data format|decrypt|decryption|bad decrypt|invalid encrypted/i.test(
    message,
  );
}

export function reconnectMessage(plugin: "gmail" | "googlecalendar") {
  return `${
    plugin === "gmail" ? "Gmail" : "Google Calendar"
  } needs to be reconnected. Your saved connection can no longer be decrypted.`;
}
