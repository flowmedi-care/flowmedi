import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateClinicalDocumentContent } from "./validate";

describe("validateClinicalDocumentContent", () => {
  it("rejects prescription without medications", () => {
    const err = validateClinicalDocumentContent("prescription", { medications: [] });
    assert.equal(err, "Adicione pelo menos um medicamento.");
  });

  it("accepts prescription with named medication", () => {
    const err = validateClinicalDocumentContent("prescription", {
      medications: [{ name: "Dipirona", dosage: "", quantity: "", instructions: "" }],
    });
    assert.equal(err, null);
  });

  it("rejects exam request without exam lines", () => {
    const err = validateClinicalDocumentContent("exam_request", { examLines: [], examNotes: "" });
    assert.equal(err, "Adicione pelo menos um exame.");
  });

  it("rejects certificate without body", () => {
    const err = validateClinicalDocumentContent("certificate", {
      certificateBody: "",
      certificateDays: 1,
      certificateCid: "",
    });
    assert.equal(err, "Informe o texto do atestado.");
  });

  it("rejects certificate with zero days", () => {
    const err = validateClinicalDocumentContent("certificate", {
      certificateBody: "Atesto...",
      certificateDays: 0,
      certificateCid: "",
    });
    assert.equal(err, "Informe pelo menos 1 dia de afastamento.");
  });
});
