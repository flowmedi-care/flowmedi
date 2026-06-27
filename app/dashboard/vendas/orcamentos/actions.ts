"use server";

import type { QuoteInput, QuoteStatus } from "@/lib/quotes/types";
import {
  createQuote as createQuoteImpl,
  deleteQuote as deleteQuoteImpl,
  getQuotePdfHtml as getQuotePdfHtmlImpl,
  getServiceDefaultPrice as getServiceDefaultPriceImpl,
  updateQuote as updateQuoteImpl,
  updateQuoteStatus as updateQuoteStatusImpl,
} from "./quote-service";

export async function createQuote(input: QuoteInput) {
  return createQuoteImpl(input);
}

export async function updateQuote(id: string, input: QuoteInput) {
  return updateQuoteImpl(id, input);
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  return updateQuoteStatusImpl(id, status);
}

export async function deleteQuote(id: string) {
  return deleteQuoteImpl(id);
}

export async function getQuotePdfHtml(id: string) {
  return getQuotePdfHtmlImpl(id);
}

export async function getServiceDefaultPrice(
  serviceId: string,
  professionalId?: string | null
) {
  return getServiceDefaultPriceImpl(serviceId, professionalId);
}
