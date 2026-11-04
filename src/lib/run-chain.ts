import "server-only";

import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";

// Ported from the original app's src/lib/prompt-chain.ts, so a test run here
// behaves exactly like a real caption generation there: same {input}
// chaining, same terms/examples context on the last step, same logging into
// caption_requests → llm_prompt_chains → llm_model_responses. Differences: it
// runs one chosen chain (not a mix pick), uses the service-role client (the
// caller has passed the superadmin gate), and returns every step's output.

const MAX_TERMS = 20;
const MAX_EXAMPLES = 5;

export type StepResult = {
  order: number;
  description: string | null;
  model: string;
  userPrompt: string;
  output: string | null;
  error: string | null;
  seconds: number;
};

export type RunResult =
  | { error: string; steps: StepResult[] }
  | { error: null; steps: StepResult[]; output: string; requestId: number | null };

// The free Gemini tier is capped at 5 requests/minute, so no auto-retry:
// surface a clear message and let the admin retry manually.
function describeGeminiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/"code":\s*429|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Hit the Gemini rate limit (5 requests/minute on the free tier). Wait a bit and try again.";
  }
  if (/"code":\s*503|UNAVAILABLE/i.test(message)) {
    return "Gemini is temporarily overloaded. Try again in a moment.";
  }
  if (/"code":\s*404|NOT_FOUND/i.test(message)) {
    return `Model not found. Check the step's model id. (${message})`;
  }
  return message;
}

async function loadCaptionContext(admin: ReturnType<typeof createAdminClient>) {
  const [{ data: terms }, { data: examples }] = await Promise.all([
    admin.from("terms").select("term, definition, example").order("priority", { ascending: false }).limit(MAX_TERMS),
    admin
      .from("caption_examples")
      .select("image_description, caption, explanation")
      .order("priority", { ascending: false })
      .limit(MAX_EXAMPLES),
  ]);

  const parts: string[] = [];
  if (terms?.length) {
    parts.push(
      "Slang and terms you may use when they fit:\n" +
        terms.map((t) => `- ${t.term}: ${t.definition}${t.example ? ` (e.g. "${t.example}")` : ""}`).join("\n"),
    );
  }
  if (examples?.length) {
    parts.push(
      "Examples of great captions:\n" +
        examples
          .map(
            (e) =>
              `Image: ${e.image_description}\nCaption: ${e.caption}${e.explanation ? `\nWhy it works: ${e.explanation}` : ""}`,
          )
          .join("\n\n"),
    );
  }
  return parts.join("\n\n");
}

/**
 * Runs every step of chain `chainId` in order. Step 1 gets the image (when
 * given) plus its prompt; each later step's {input} is the previous output.
 * With no image, step 1's {input} is `text`.
 */
export async function runChain(opts: {
  chainId: number;
  adminId: string;
  image?: { mimeType: string; base64: string; imageId: string | null };
  text?: string;
}): Promise<RunResult> {
  const admin = createAdminClient();

  const [{ data: steps, error: stepsError }, context] = await Promise.all([
    admin
      .from("humor_flavor_steps")
      .select(
        "id, order_by, description, llm_model_id, llm_temperature, llm_system_prompt, llm_user_prompt, llm_models(provider_model_id, is_temperature_supported)",
      )
      .eq("humor_flavor_id", opts.chainId)
      .order("order_by"),
    loadCaptionContext(admin),
  ]);
  if (stepsError) return { error: `Couldn't load steps: ${stepsError.message}`, steps: [] };
  if (!steps?.length) return { error: "This chain has no steps yet. Add one first.", steps: [] };

  // Logging is best-effort, as in the original app: a failed insert is
  // reported to the server log but never blocks the run itself.
  const { data: request, error: requestError } = await admin
    .from("caption_requests")
    .insert({ profile_id: opts.adminId, image_id: opts.image?.imageId ?? null, kind: "test" })
    .select("id")
    .single();
  if (requestError) console.error("caption_requests insert failed:", requestError.message);
  const requestId: number | null = request?.id ?? null;

  let runId: number | null = null;
  if (requestId !== null) {
    const { data, error } = await admin
      .from("llm_prompt_chains")
      .insert({ caption_request_id: requestId, humor_flavor_id: opts.chainId, profile_id: opts.adminId })
      .select("id")
      .single();
    if (error) console.error("llm_prompt_chains insert failed:", error.message);
    runId = data?.id ?? null;
  }

  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const results: StepResult[] = [];
  let input = opts.text ?? "";

  for (const [i, step] of steps.entries()) {
    const model = Array.isArray(step.llm_models) ? step.llm_models[0] : step.llm_models;
    const providerModelId: string = model?.provider_model_id ?? "gemini-flash-latest";
    const temperature = model?.is_temperature_supported ? step.llm_temperature : null;
    const withImage = i === 0 && !!opts.image;
    const isLast = i === steps.length - 1;
    const userPrompt = step.llm_user_prompt.replaceAll("{input}", input);
    const systemPrompt = [step.llm_system_prompt, isLast ? context : ""].filter(Boolean).join("\n\n") || null;

    const started = performance.now();
    let output = "";
    let failure: string | null = null;
    try {
      const response = await gemini.models.generateContent({
        model: providerModelId,
        contents: [
          {
            role: "user",
            parts: [
              ...(withImage ? [{ inlineData: { mimeType: opts.image!.mimeType, data: opts.image!.base64 } }] : []),
              { text: userPrompt },
            ],
          },
        ],
        config: {
          ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
          ...(temperature !== null ? { temperature: Number(temperature) } : {}),
        },
      });
      output = (response.text ?? "").trim();
      if (!output) failure = "The model returned an empty response.";
    } catch (err) {
      failure = describeGeminiError(err);
    }
    const seconds = Number(((performance.now() - started) / 1000).toFixed(2));

    results.push({
      order: step.order_by,
      description: step.description,
      model: providerModelId,
      userPrompt,
      output: output || null,
      error: failure,
      seconds,
    });

    if (requestId !== null) {
      const { error } = await admin.from("llm_model_responses").insert({
        caption_request_id: requestId,
        llm_prompt_chain_id: runId,
        humor_flavor_step_id: step.id,
        llm_model_id: step.llm_model_id,
        profile_id: opts.adminId,
        llm_system_prompt: systemPrompt,
        llm_user_prompt: userPrompt,
        llm_temperature: temperature,
        llm_model_response: output || null,
        error: failure,
        processing_time_seconds: seconds,
      });
      if (error) console.error("llm_model_responses insert failed:", error.message);
    }

    if (failure) return { error: `Step ${step.order_by} failed: ${failure}`, steps: results };
    input = output;
  }

  return { error: null, steps: results, output: input, requestId };
}
