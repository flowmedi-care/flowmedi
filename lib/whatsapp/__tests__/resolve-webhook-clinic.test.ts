import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveWhatsappWebhookClinic } from "../resolve-webhook-clinic";

function mockSupabase(rows: Array<Record<string, unknown>>) {
  return {
    from: () => ({
      select: () => ({
        in: () => ({
          eq: async () => ({ data: rows }),
        }),
      }),
    }),
  };
}

describe("resolveWhatsappWebhookClinic", () => {
  it("matches whatsapp_simple by phone_number_id", async () => {
    const result = await resolveWhatsappWebhookClinic(
      mockSupabase([
        {
          clinic_id: "clinic-1",
          integration_type: "whatsapp_simple",
          metadata: { phone_number_id: "12345" },
          credentials: { access_token: "token-simple" },
        },
      ]) as never,
      "12345"
    );

    assert.equal(result?.clinicId, "clinic-1");
    assert.equal(result?.integrationType, "whatsapp_simple");
    assert.equal(result?.accessToken, "token-simple");
  });

  it("falls back to single connected integration without phone id", async () => {
    const result = await resolveWhatsappWebhookClinic(
      mockSupabase([
        {
          clinic_id: "clinic-2",
          integration_type: "whatsapp_meta",
          metadata: { phone_number_id: "99999" },
          credentials: { access_token: "token-meta" },
        },
      ]) as never,
      null
    );

    assert.equal(result?.clinicId, "clinic-2");
    assert.equal(result?.integrationType, "whatsapp_meta");
  });

  it("returns null when multiple integrations and phone id does not match", async () => {
    const result = await resolveWhatsappWebhookClinic(
      mockSupabase([
        {
          clinic_id: "clinic-a",
          integration_type: "whatsapp_simple",
          metadata: { phone_number_id: "111" },
          credentials: { access_token: "a" },
        },
        {
          clinic_id: "clinic-b",
          integration_type: "whatsapp_meta",
          metadata: { phone_number_id: "222" },
          credentials: { access_token: "b" },
        },
      ]) as never,
      "333"
    );

    assert.equal(result, null);
  });
});
