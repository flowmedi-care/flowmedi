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

    assert.equal(result.status, "resolved");
    if (result.status !== "resolved") return;
    assert.equal(result.clinic.clinicId, "clinic-1");
    assert.equal(result.clinic.integrationType, "whatsapp_simple");
    assert.equal(result.clinic.accessToken, "token-simple");
  });

  it("discards when phone_number_id is missing even with a single connected clinic", async () => {
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

    assert.deepEqual(result, {
      status: "discarded",
      reason: "missing_phone_number_id",
    });
  });

  it("discards when phone_number_id does not match any connected clinic", async () => {
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

    assert.deepEqual(result, { status: "discarded", reason: "no_owner" });
  });

  it("discards when the same phone_number_id is connected to multiple clinics", async () => {
    const result = await resolveWhatsappWebhookClinic(
      mockSupabase([
        {
          clinic_id: "clinic-a",
          integration_type: "whatsapp_simple",
          metadata: { phone_number_id: "shared" },
          credentials: { access_token: "a" },
        },
        {
          clinic_id: "clinic-b",
          integration_type: "whatsapp_meta",
          metadata: { phone_number_id: "shared" },
          credentials: { access_token: "b" },
        },
      ]) as never,
      "shared"
    );

    assert.deepEqual(result, { status: "discarded", reason: "ambiguous_owner" });
  });

  it("discards unmatched webhook when only one clinic is connected (no fallback)", async () => {
    const result = await resolveWhatsappWebhookClinic(
      mockSupabase([
        {
          clinic_id: "clinic-only",
          integration_type: "whatsapp_meta",
          metadata: { phone_number_id: "mine" },
          credentials: { access_token: "token" },
        },
      ]) as never,
      "someone-else"
    );

    assert.deepEqual(result, { status: "discarded", reason: "no_owner" });
  });
});
