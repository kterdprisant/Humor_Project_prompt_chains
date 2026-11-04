"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { getActionAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isId } from "@/lib/data/chains";
import { runChain, type RunResult } from "@/lib/run-chain";

// Convention: return { error } rather than throw. Next.js redacts thrown
// Server Action errors in production builds, so the admin would only ever
// see a generic message after deploying.
export type ActionState = { error: string | null };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BUCKET = "caption-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // matches the original app's upload limit

function text(form: FormData, name: string) {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function describe(error: PostgrestError, what: string) {
  if (error.code === "23505") return `Couldn't save ${what}: that value is already taken.`;
  if (error.code === "23503") return `Couldn't save ${what}: a referenced row doesn't exist (${error.details ?? error.message}).`;
  if (error.code === "42501") return `Couldn't save ${what}: database permission denied (check table GRANTs). ${error.message}`;
  return `Couldn't save ${what}: ${error.message}`;
}

// ─── Chains ──────────────────────────────────────────────────────────────

function parseChain(form: FormData) {
  const slug = text(form, "slug").toLowerCase();
  if (!SLUG.test(slug)) return { error: "Name must be lowercase words joined by hyphens, e.g. dad-jokes." } as const;
  return { error: null, values: { slug, description: text(form, "description") || null } } as const;
}

export async function createChain(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { error: authError } = await getActionAdmin();
  if (authError) return { error: authError };
  const parsed = parseChain(form);
  if (parsed.error !== null) return { error: parsed.error };

  const { data, error } = await createAdminClient()
    .from("humor_flavors")
    .insert(parsed.values)
    .select("id")
    .single();
  if (error) return { error: describe(error, "prompt chain") };

  revalidatePath("/");
  redirect(`/chains/${data.id}`);
}

export async function updateChain(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { error: authError } = await getActionAdmin();
  if (authError) return { error: authError };
  if (!isId(id)) return { error: "Invalid chain id." };
  const parsed = parseChain(form);
  if (parsed.error !== null) return { error: parsed.error };

  const { data, error } = await createAdminClient()
    .from("humor_flavors")
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: describe(error, "prompt chain") };
  if (!data?.length) return { error: "That prompt chain no longer exists." };

  revalidatePath("/");
  revalidatePath(`/chains/${id}`);
  return { error: null };
}

export async function deleteChain(id: string): Promise<ActionState> {
  const { error: authError } = await getActionAdmin();
  if (authError) return { error: authError };
  if (!isId(id)) return { error: "Invalid chain id." };

  // Steps and the mix entry cascade; past runs and responses are kept (their
  // chain/step references become null), so the logs stay intact.
  const { data, error } = await createAdminClient().from("humor_flavors").delete().eq("id", id).select("id");
  if (error) return { error: `Couldn't delete prompt chain: ${error.message}` };
  if (!data?.length) return { error: "That prompt chain no longer exists." };

  revalidatePath("/");
  redirect("/");
}

// ─── Steps ───────────────────────────────────────────────────────────────

async function parseStep(form: FormData) {
  const llm_model_id = text(form, "llm_model_id");
  const llm_user_prompt = text(form, "llm_user_prompt");
  const rawTemp = text(form, "llm_temperature");
  if (!isId(llm_model_id)) return { error: "Pick a model." } as const;
  if (!llm_user_prompt) return { error: "The user prompt is required." } as const;

  let llm_temperature: number | null = null;
  if (rawTemp) {
    llm_temperature = Number(rawTemp);
    if (!Number.isFinite(llm_temperature) || llm_temperature < 0 || llm_temperature > 2) {
      return { error: "Temperature must be a number from 0 to 2." } as const;
    }
  }

  const { data: model } = await createAdminClient().from("llm_models").select("id").eq("id", llm_model_id).maybeSingle();
  if (!model) return { error: "That model doesn't exist." } as const;

  return {
    error: null,
    values: {
      llm_model_id: Number(llm_model_id),
      llm_temperature,
      llm_user_prompt,
      llm_system_prompt: text(form, "llm_system_prompt") || null,
      description: text(form, "description") || null,
    },
  } as const;
}

export async function createStep(chainId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { error: authError } = await getActionAdmin();
  if (authError) return { error: authError };
  if (!isId(chainId)) return { error: "Invalid chain id." };
  const parsed = await parseStep(form);
  if (parsed.error !== null) return { error: parsed.error };

  const admin = createAdminClient();
  // New steps go last. (humor_flavor_id, order_by) is unique, so a racing
  // double-submit fails cleanly instead of creating two step 3s.
  const { data: last } = await admin
    .from("humor_flavor_steps")
    .select("order_by")
    .eq("humor_flavor_id", chainId)
    .order("order_by", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin
    .from("humor_flavor_steps")
    .insert({ ...parsed.values, humor_flavor_id: Number(chainId), order_by: (last?.order_by ?? 0) + 1 });
  if (error) return { error: describe(error, "step") };

  revalidatePath(`/chains/${chainId}`);
  redirect(`/chains/${chainId}`);
}

export async function updateStep(
  chainId: string,
  stepId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { error: authError } = await getActionAdmin();
  if (authError) return { error: authError };
  if (!isId(chainId) || !isId(stepId)) return { error: "Invalid id." };
  const parsed = await parseStep(form);
  if (parsed.error !== null) return { error: parsed.error };

  const { data, error } = await createAdminClient()
    .from("humor_flavor_steps")
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq("id", stepId)
    .eq("humor_flavor_id", chainId)
    .select("id");
  if (error) return { error: describe(error, "step") };
  if (!data?.length) return { error: "That step no longer exists." };

  revalidatePath(`/chains/${chainId}`);
  redirect(`/chains/${chainId}`);
}

/**
 * Renumbers a chain's steps to 1..n in their current order. Walking upward
 * never collides with the unique (humor_flavor_id, order_by) index: each
 * step only ever moves down into a number that's already been vacated.
 */
async function compactOrder(chainId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("humor_flavor_steps")
    .select("id, order_by")
    .eq("humor_flavor_id", chainId)
    .order("order_by");
  for (const [i, s] of (data ?? []).entries()) {
    if (s.order_by !== i + 1) await admin.from("humor_flavor_steps").update({ order_by: i + 1 }).eq("id", s.id);
  }
}

export async function deleteStep(chainId: string, stepId: string): Promise<ActionState> {
  const { error: authError } = await getActionAdmin();
  if (authError) return { error: authError };
  if (!isId(chainId) || !isId(stepId)) return { error: "Invalid id." };

  const { data, error } = await createAdminClient()
    .from("humor_flavor_steps")
    .delete()
    .eq("id", stepId)
    .eq("humor_flavor_id", chainId)
    .select("id");
  if (error) return { error: `Couldn't delete step: ${error.message}` };
  if (!data?.length) return { error: "That step no longer exists." };

  await compactOrder(chainId);
  revalidatePath(`/chains/${chainId}`);
  return { error: null };
}

/** Swaps a step with its neighbor above (-1) or below (+1). */
export async function moveStep(chainId: string, stepId: string, direction: -1 | 1): Promise<ActionState> {
  const { error: authError } = await getActionAdmin();
  if (authError) return { error: authError };
  if (!isId(chainId) || !isId(stepId) || (direction !== -1 && direction !== 1)) return { error: "Invalid move." };

  const admin = createAdminClient();
  const { data: steps, error } = await admin
    .from("humor_flavor_steps")
    .select("id, order_by")
    .eq("humor_flavor_id", chainId)
    .order("order_by");
  if (error) return { error: `Couldn't load steps: ${error.message}` };

  const i = (steps ?? []).findIndex((s) => String(s.id) === stepId);
  const j = i + direction;
  if (i === -1) return { error: "That step no longer exists." };
  if (j < 0 || j >= steps.length) return { error: null }; // already at the edge
  const [a, b] = [steps[i], steps[j]];

  // Three updates because (humor_flavor_id, order_by) is unique: park `a` on
  // a free negative slot, move `b` into a's place, then `a` into b's.
  const park = await admin.from("humor_flavor_steps").update({ order_by: -a.order_by }).eq("id", a.id);
  if (park.error) return { error: `Couldn't reorder: ${park.error.message}` };
  const moveB = await admin.from("humor_flavor_steps").update({ order_by: a.order_by }).eq("id", b.id);
  if (moveB.error) {
    await admin.from("humor_flavor_steps").update({ order_by: a.order_by }).eq("id", a.id);
    return { error: `Couldn't reorder: ${moveB.error.message}` };
  }
  const moveA = await admin.from("humor_flavor_steps").update({ order_by: b.order_by }).eq("id", a.id);
  if (moveA.error) return { error: `Couldn't reorder: ${moveA.error.message}` };

  revalidatePath(`/chains/${chainId}`);
  return { error: null };
}

// ─── Test run ────────────────────────────────────────────────────────────

export type RunState = { error: string | null; result?: RunResult; imageUrl?: string | null };

export async function runChainAction(chainId: string, _prev: RunState, form: FormData): Promise<RunState> {
  const { admin: me, error: authError } = await getActionAdmin();
  if (!me) return { error: authError };
  if (!isId(chainId)) return { error: "Invalid chain id." };

  const file = form.get("image");
  const inputText = text(form, "text");
  const hasImage = file instanceof File && file.size > 0;
  if (!hasImage && !inputText) return { error: "Upload an image or enter some text to run the chain on." };

  const admin = createAdminClient();
  let image: { mimeType: string; base64: string; imageId: string | null } | undefined;
  let imageUrl: string | null = null;

  if (hasImage) {
    if (!file.type.startsWith("image/")) return { error: "That file doesn't look like an image." };
    if (file.size > MAX_IMAGE_BYTES) return { error: "Image is too large (8MB max)." };

    // Stored like any other upload so the run shows up with its image on the
    // chain's media page and in the admin area's Images table. Not public:
    // test images never reach the main app's feed.
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `prompt-chains/${crypto.randomUUID()}.${ext}`;
    const storage = admin.storage.from(BUCKET);
    const { error: uploadError } = await storage.upload(path, file, { contentType: file.type });
    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };
    imageUrl = storage.getPublicUrl(path).data.publicUrl;

    const { data: row, error: imageError } = await admin
      .from("images")
      .insert({ url: imageUrl, profile_id: me.id, is_public: false })
      .select("id")
      .single();
    if (imageError) console.error("images insert failed:", imageError.message);

    image = {
      mimeType: file.type,
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      imageId: row?.id ?? null,
    };
  }

  const result = await runChain({ chainId: Number(chainId), adminId: me.id, image, text: inputText });

  // Save step 1's output as the image's description, as the original app
  // does on upload, so it reads naturally in the admin area.
  if (image?.imageId && result.steps[0]?.output) {
    await admin.from("images").update({ image_description: result.steps[0].output }).eq("id", image.imageId);
  }

  revalidatePath(`/chains/${chainId}/media`);
  return { error: result.error, result, imageUrl };
}
