import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  renderAppointmentList,
  renderStructuredToolResult,
} from "../render-structured";

const FIXTURE = [
  {
    id: "b2225551-a368-41ab-ae8b-c39db5c91366",
    scheduled_at: "2026-07-16T13:00:00+00:00",
    status: "agendada",
    doctor_name: "daniel medico",
    procedure_name: "Endoscopia",
  },
  {
    id: "a6494eb6-6108-450b-a254-b63c6e4bb2d7",
    scheduled_at: "2026-07-17T15:00:00+00:00",
    status: "agendada",
    doctor_name: "daniel medico",
    procedure_name: "Endoscopia",
  },
  {
    id: "7c41f468-aac0-4aa7-ae2e-3e11a58fb1f2",
    scheduled_at: "2026-07-17T16:00:00+00:00",
    status: "agendada",
    doctor_name: "daniel medico",
    procedure_name: "Endoscopia",
  },
] as const;

describe("renderAppointmentList projection", () => {
  it("0 appointments → not-found message", () => {
    const { text } = renderAppointmentList({ appointments: [] });
    assert.match(text, /Não encontrei consultas/i);
    assert.doesNotMatch(text, /^1\./m);
  });

  it("1 appointment browse → exactly that row as option 1", () => {
    const { text } = renderAppointmentList({
      appointments: [FIXTURE[0]],
      locale: "pt-BR",
      timezone: "UTC",
      mode: "browse",
    });
    assert.match(text, /Você tem 1 consulta/);
    assert.match(text, /^1\./m);
    assert.match(text, /Endoscopia/);
    assert.doesNotMatch(text, /Qual delas/);
  });

  it("3 appointments browse → enumerate without selection prompt", () => {
    const { text } = renderAppointmentList({
      appointments: [...FIXTURE],
      locale: "pt-BR",
      timezone: "UTC",
      mode: "browse",
    });
    assert.match(text, /Você tem 3 consultas/);
    assert.doesNotMatch(text, /Qual delas/);
  });

  it("3 appointments select → Qual delas", () => {
    const { text } = renderAppointmentList({
      appointments: [...FIXTURE],
      locale: "pt-BR",
      timezone: "UTC",
      mode: "select",
    });
    assert.match(text, /Você tem 3 consultas/);
    assert.match(text, /Qual delas/);
    const i1 = text.indexOf("1.");
    const i2 = text.indexOf("2.");
    const i3 = text.indexOf("3.");
    assert.ok(i1 >= 0 && i2 > i1 && i3 > i2);
  });

  it("3 appointments summary → Restam without Qual delas", () => {
    const { text } = renderAppointmentList({
      appointments: [...FIXTURE],
      locale: "pt-BR",
      timezone: "UTC",
      mode: "summary",
    });
    assert.match(text, /Restam 3 consultas/);
    assert.doesNotMatch(text, /Qual delas/);
  });

  it("renderStructuredToolResult uses renderMode from extras", () => {
    const rendered = renderStructuredToolResult({
      renderStrategy: "appointment_list",
      renderMode: "select",
      data: { appointments: [...FIXTURE] },
    });
    assert.ok(rendered);
    assert.match(rendered!.text, /Qual delas/);
  });

  it("unknown strategy returns null", () => {
    assert.equal(
      renderStructuredToolResult({
        renderStrategy: "not_a_real_strategy",
        data: {},
      }),
      null
    );
  });

  it("mutation_success reschedule uses whenLabel without ISO", () => {
    const rendered = renderStructuredToolResult({
      renderStrategy: "mutation_success",
      data: {
        action: "reschedule",
        whenLabel: "sexta-feira, 17 de julho às 10:00",
      },
    });
    assert.ok(rendered);
    assert.match(rendered!.text, /remarcada com sucesso/i);
    assert.match(rendered!.text, /sexta-feira, 17 de julho às 10:00/);
    assert.doesNotMatch(rendered!.text, /T\d{2}:\d{2}:\d{2}/);
  });

  it("slot_list uses only display labels", () => {
    const rendered = renderStructuredToolResult({
      renderStrategy: "slot_list",
      data: {
        slots: [
          { display: "12:00", scheduled_at: "2026-07-17T15:00:00.000Z" },
          { display: "13:00", scheduled_at: "2026-07-17T16:00:00.000Z" },
        ],
      },
    });
    assert.ok(rendered);
    assert.match(rendered!.text, /Horários disponíveis/);
    assert.match(rendered!.text, /^1\. 12:00/m);
    assert.match(rendered!.text, /^2\. 13:00/m);
    assert.doesNotMatch(rendered!.text, /T15:00|2026-07-17T/);
  });

  it("slot_list notFoundHour prefix", () => {
    const rendered = renderStructuredToolResult({
      renderStrategy: "slot_list",
      data: {
        notFoundHour: "16:00",
        slots: [{ display: "13:00", scheduled_at: "2026-07-17T16:00:00.000Z" }],
      },
    });
    assert.ok(rendered);
    assert.match(rendered!.text, /Não encontrei o horário 16:00/);
    assert.match(rendered!.text, /13:00/);
  });
});
