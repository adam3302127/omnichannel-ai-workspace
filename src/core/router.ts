import type { IncomingMessage, OutgoingMessage } from "../channels/types";
import { getTenantBySlug, resolveSystemPrompt } from "../tenants/config";
import {
  findOrCreateUser,
  findOrCreateConversation,
  getRecentMessages,
  saveMessages,
  touchConversation,
} from "../memory/conversations";
import { getClientContentText } from "../memory/clientContent";
import { generateResponse } from "./ai";
import { parseActionBlock, triggerN8nWebhook } from "./actions";
import {
  getInventoryCategoriesOverviewText,
} from "../inventory/getInventoryMenuSummary";
import { getFreshBrosExactCategoryTableText } from "../inventory/exactFreshBrosCategoryTable";
import { getFreshBrosQuoteContext } from "../inventory/getFreshBrosQuoteContext";
import { config } from "../config";

export interface RouteResult {
  outgoing: OutgoingMessage;
  status: "ok" | "tenant_not_found" | "channel_not_allowed";
}

/**
 * Normalizes any channel message, loads tenant + memory, calls Claude, parses actions,
 * saves messages, returns response to send back.
 */
export async function routeIncomingMessage(input: IncomingMessage): Promise<RouteResult> {
  const tenant = await getTenantBySlug(input.tenantSlug);
  if (!tenant) {
    return {
      outgoing: {
        channel: input.channel,
        channelThreadId: input.channelThreadId,
        text: "This tenant is not configured.",
      },
      status: "tenant_not_found",
    };
  }

  if (!tenant.allowedChannels.includes(input.channel)) {
    return {
      outgoing: {
        channel: input.channel,
        channelThreadId: input.channelThreadId,
        text: "This channel is not enabled for this tenant.",
      },
      status: "channel_not_allowed",
    };
  }

  const meta = input.raw && typeof input.raw === "object" && "ip" in input.raw
    ? { last_ip: (input.raw as { ip: string }).ip }
    : undefined;
  const user = await findOrCreateUser(
    tenant.id,
    input.channel,
    input.userId,
    input.displayName || null,
    meta
  );

  const conversation = await findOrCreateConversation(
    tenant.id,
    user.id,
    input.channel,
    input.channelThreadId,
    input.isGroup
  );

  const history = await getRecentMessages(conversation.id, 10);
  let systemPrompt = resolveSystemPrompt(
    tenant.systemPrompt,
    input.channel,
    input.isGroup
  );

  // Lightweight intent detection for client_content-backed answers
  const lower = input.text.toLowerCase();
  let contentKey: string | null = null;
  const detectedInventoryCategory = detectInventoryCategory(lower);
  const isQuoteRequest =
    /quote|put together|build.*order|pricing on|how much|price for|order|wholesale|bulk order|estimate|ballpark|what would it cost|get a price|cost for|build me|dep order/i.test(
      lower
    ) ||
    /\$[\d.,]+k?|\d+\s*(lbs?|lb)|mix|add up to|split|evenly/i.test(lower);

  // Override system prompt for quote requests: BUILD the quote, never ask first
  if (isQuoteRequest) {
    systemPrompt +=
      "\n\nCRITICAL: The user wants a quote/order. BUILD IT NOW with dollar amounts. Do NOT ask 'what are you looking for', 'are you ordering products', or any clarifying questions. Use the sheet: pick strains, apply tiers, add shipping. Budget (e.g. $5k) → split across categories. 'Mix of all 3' → Bulk Flower + THCP + PreRolls. Only ask for details if they want to proceed. dep = value exotics/light dep.";
  }

  const isMediaRequest = /video|media|watch|link for|send me the (video|media)/i.test(lower);
  if (isMediaRequest) {
    systemPrompt +=
      "\n\nCRITICAL: You HAVE access to product video links in the inventory. When the user asks for a video/media link, you MUST send it. Do NOT say you don't have access. The REFERENCE_CONTENT will include the Media column with URLs.";
  }

  // Quote takes precedence: "build me $5k order" = quote, not menu
  if (
    !isQuoteRequest &&
    /(menu|services?|offer|offers|offerings|product(s)?|catalog|what do you offer|what can you offer|what do you have|what do we have|whats? available|what is available|strains?|strain list|what('s| is) in stock|what can I (get|order)|do you have|what kind of|what have you got|what('s| is) on the (menu|sheet)|live (menu|inventory|sheet)|current (menu|inventory)|available)/.test(
      lower
    )
  ) {
    contentKey = "menu";
  } else if (
    /hours?|open|availability|when.*available/.test(lower)
  ) {
    contentKey = "hours";
  } else if (
    /price|pricing|cost|how much/.test(lower)
  ) {
    contentKey = "pricing";
  } else if (
    /faq|questions|how does this work|help me understand/.test(lower)
  ) {
    contentKey = "faq";
  }
  // Option 3: if the user directly replies with a category name, treat it as a menu/table request (unless it's a quote request).
  if (!contentKey && detectedInventoryCategory && !isQuoteRequest) {
    contentKey = "menu";
  }

  let userText = input.text;

  // Quote/order requests OR video/media requests: inject live sheet (includes Media column URLs)
  if (isQuoteRequest || contentKey === "pricing" || isMediaRequest) {
    try {
      const { text: quoteText, sheetUrl } = await getFreshBrosQuoteContext();
      const rules = isMediaRequest
        ? `RULES: Send ONLY the video links. Find each strain in the REFERENCE (Media column has "Watch Video: https://..."). If "these three"/"all three", use the previous message for strain names. Output: one link per line, nothing else. Skip strains with no URL (Coming Soon).`
        : `RULES: BUILD THE ORDER NOW. Do NOT ask what they want. Use ALL tabs in the sheet. Pick products, apply tiers, add shipping. Be CONCISE. End with: Live sheet: ${sheetUrl}`;
      userText =
        `REFERENCE_CONTENT_START\n` +
        `REFERENCE_KEY: live_inventory_quote\n` +
        `${quoteText}\n` +
        `REFERENCE_CONTENT_END\n\n` +
        `User: ${input.text}\n\n` +
        rules;
      console.log(
        `[Router] Injected quote context (${isMediaRequest ? "media" : "pricing/order"} request)`
      );
    } catch (err) {
      console.error("[Router] Quote context failed:", err instanceof Error ? err.message : err);
    }
  }

  if (contentKey) {
    try {
      console.log(`[Router] client_content intent matched: ${contentKey}`);
      if (contentKey === "menu" && !isQuoteRequest && !isMediaRequest) {
        // Skip menu if user wants a quote or media links—let Claude handle those.
        const categoryToRender = detectedInventoryCategory;
        let assistantText: string;
        if (categoryToRender) {
          try {
            assistantText = (
              await getFreshBrosExactCategoryTableText(categoryToRender, {
                limitRows: 8,
              })
            ).text;
          } catch (err) {
            console.error(
              "[Router] exact inventory table failed, falling back to overview:",
              err instanceof Error ? err.message : err
            );
            assistantText = (
              await getInventoryCategoriesOverviewText(tenant.id, {
                maxCategories: 5,
                maxExampleNamesPerCategory: 2,
              })
            ).text;
          }
        } else {
          assistantText = (
            await getInventoryCategoriesOverviewText(tenant.id, {
              maxCategories: 5,
              maxExampleNamesPerCategory: 2,
            })
          ).text;
        }

        await saveMessages(
          conversation.id,
          input.text,
          assistantText,
          null
        );
        await touchConversation(conversation.id);

        return {
          outgoing: {
            channel: input.channel,
            channelThreadId: input.channelThreadId,
            text: assistantText,
          },
          status: "ok",
        };
      }

      // Use client_content for hours/faq (not pricing - we use quote context above)
      if (!isQuoteRequest && contentKey !== "pricing") {
        const content = await getClientContentText(tenant.id, contentKey);
        if (content) {
          console.log(
            `[Router] client_content loaded for key=${contentKey}, length=${content.length}`
          );
          userText =
            `REFERENCE_CONTENT_START\n` +
            `REFERENCE_KEY: ${contentKey}\n` +
            `${content}\n` +
            `REFERENCE_CONTENT_END\n\n` +
            `User question: ${input.text}\n\n` +
            `You MUST answer using the REFERENCE_CONTENT above for the requested topic.\n` +
            `Do NOT claim you don't have the menu/inventory/pricing.\n` +
            `If the user asks for details not present in the reference, ask 1-3 clarifying questions and/or escalate appropriately.`;
        } else {
          console.log(`[Router] client_content missing for key=${contentKey}`);
        }
      }
    } catch (err) {
      // If content lookup fails, fall back to original text
      console.error(
        `[Router] Failed to load client_content for key=${contentKey}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Fallback: if message is about products/inventory but didn't get menu/quote context, inject overview
  const isProductRelated =
    /(product|inventory|stock|strain|flower|wholesale|bulk|preroll|copacked|value exotic|dep|what do you have|what('s| is) available|do you have|offer|menu|price|order)/.test(
      lower
    );
  if (
    isProductRelated &&
    !userText.includes("REFERENCE_CONTENT_START") &&
    !contentKey
  ) {
    try {
      const overview = (
        await getInventoryCategoriesOverviewText(tenant.id, {
          maxCategories: 6,
          maxExampleNamesPerCategory: 4,
        })
      ).text;
      userText =
        `REFERENCE_CONTENT_START\n` +
        `REFERENCE_KEY: inventory_overview\n` +
        `${overview}\n` +
        `REFERENCE_CONTENT_END\n\n` +
        `User: ${input.text}\n\n` +
        `RULES: You HAVE access to the live inventory above. Use it to answer. Be CONCISE: 2-4 sentences, bullet points for lists. Do NOT say you don't have the menu. Share relevant categories briefly and include the live sheet link.`;
      console.log("[Router] Injected inventory overview for product-related fallback");
    } catch (err) {
      console.error("[Router] Fallback overview failed:", err instanceof Error ? err.message : err);
    }
  }

  const rawResponse = await generateResponse(
    systemPrompt,
    history,
    userText
  );

  const { cleanText, action } = parseActionBlock(rawResponse);
  let actionTriggered: Record<string, unknown> | null = null;

  if (action && tenant.allowedActions.includes(action.type)) {
    const result = await triggerN8nWebhook(action);
    actionTriggered = {
      type: action.type,
      payload: action.payload,
      webhook_ok: result.ok,
      webhook_error: result.error,
    };
  }

  await saveMessages(
    conversation.id,
    input.text,
    cleanText,
    actionTriggered
  );
  await touchConversation(conversation.id);

  // Always append sheet link for quote/inventory/order requests (most important for user)
  let finalText = cleanText;
  const sheetUrl = config.inventory.sheetUrl;
  const isInventoryRelated = /inventory|stock|quote|order|value exotic|dep|flower|lbs|wholesale|bulk|copacked|preroll|sheet|menu|pricing|price|video|media/.test(lower);
  if (sheetUrl && isInventoryRelated && !cleanText.includes(sheetUrl)) {
    finalText = cleanText + "\n\nLive sheet: " + sheetUrl;
  }

  return {
    outgoing: {
      channel: input.channel,
      channelThreadId: input.channelThreadId,
      text: finalText,
    },
    status: "ok",
  };
}

function detectInventoryCategory(lower: string): string | null {
  // Keep this mapping close to the Google Sheet category names.
  if (/(thcp)/.test(lower)) return "THCP Flower";
  if (/(bulk\s+preroll|bulk\s+pre-?roll|preroll|pre-?roll)/.test(lower)) {
    return "Bulk PreRolls";
  }
  if (/(bulk\s+copacked|copacked|copack)/.test(lower)) return "Bulk Copacked";
  if (/(bulk\s+flower|thc\s+flower|flower|exotic|value exotic|vex|dep)/.test(lower)) return "Bulk Flower";
  return null;
}
