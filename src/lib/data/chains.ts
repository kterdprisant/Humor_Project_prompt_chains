import "server-only";

import { requireSuperadmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";

// Prompt chains are humor_flavors; their ordered steps are humor_flavor_steps.
// Schema: the admin repo's 20261027000000_prompt_chain_and_signup_tables.sql.

export type Chain = {
  id: number;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Step = {
  id: number;
  humor_flavor_id: number;
  order_by: number;
  llm_model_id: number;
  llm_temperature: number | null;
  llm_system_prompt: string | null;
  llm_user_prompt: string;
  description: string | null;
};

export type ModelOption = {
  id: number;
  name: string;
  provider_model_id: string;
  is_temperature_supported: boolean;
  provider: string | null;
};

export type ChainSummary = Chain & { stepCount: number; runCount: number; mixWeight: number | null };

const CHAIN_COLUMNS = "id, slug, description, created_at, updated_at";
export const STEP_COLUMNS =
  "id, humor_flavor_id, order_by, llm_model_id, llm_temperature, llm_system_prompt, llm_user_prompt, description";

export function isId(v: string | undefined): v is string {
  return !!v && /^\d{1,18}$/.test(v);
}

export async function listChains(): Promise<ChainSummary[]> {
  await requireSuperadmin();
  const admin = createAdminClient();
  const [chains, steps, runs, mix] = await Promise.all([
    admin.from("humor_flavors").select(CHAIN_COLUMNS).order("id"),
    admin.from("humor_flavor_steps").select("humor_flavor_id"),
    admin.from("llm_prompt_chains").select("humor_flavor_id"),
    admin.from("humor_flavor_mix").select("humor_flavor_id, caption_count"),
  ]);
  for (const r of [chains, steps, runs, mix]) if (r.error) throw new Error(r.error.message);

  const count = (rows: { humor_flavor_id: number | null }[]) => {
    const m = new Map<number, number>();
    for (const r of rows) if (r.humor_flavor_id != null) m.set(r.humor_flavor_id, (m.get(r.humor_flavor_id) ?? 0) + 1);
    return m;
  };
  const stepCounts = count(steps.data ?? []);
  const runCounts = count(runs.data ?? []);
  const weights = new Map((mix.data ?? []).map((m) => [m.humor_flavor_id as number, m.caption_count as number]));

  return (chains.data as Chain[]).map((c) => ({
    ...c,
    stepCount: stepCounts.get(c.id) ?? 0,
    runCount: runCounts.get(c.id) ?? 0,
    mixWeight: weights.get(c.id) ?? null,
  }));
}

export async function getChain(id: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const [chain, steps, mix] = await Promise.all([
    admin.from("humor_flavors").select(CHAIN_COLUMNS).eq("id", id).maybeSingle(),
    admin.from("humor_flavor_steps").select(STEP_COLUMNS).eq("humor_flavor_id", id).order("order_by"),
    admin.from("humor_flavor_mix").select("caption_count").eq("humor_flavor_id", id).maybeSingle(),
  ]);
  for (const r of [chain, steps, mix]) if (r.error) throw new Error(r.error.message);
  if (!chain.data) return null;
  return {
    chain: chain.data as Chain,
    steps: (steps.data ?? []) as Step[],
    mixWeight: (mix.data?.caption_count as number | undefined) ?? null,
  };
}

export async function getStep(chainId: string, stepId: string) {
  await requireSuperadmin();
  const { data, error } = await createAdminClient()
    .from("humor_flavor_steps")
    .select(STEP_COLUMNS)
    .eq("id", stepId)
    .eq("humor_flavor_id", chainId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Step | null;
}

export async function listModels(): Promise<ModelOption[]> {
  await requireSuperadmin();
  const { data, error } = await createAdminClient()
    .from("llm_models")
    .select("id, name, provider_model_id, is_temperature_supported, llm_providers(name)")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => {
    const provider = Array.isArray(m.llm_providers) ? m.llm_providers[0] : m.llm_providers;
    return {
      id: m.id,
      name: m.name,
      provider_model_id: m.provider_model_id,
      is_temperature_supported: m.is_temperature_supported,
      provider: (provider as { name: string } | null)?.name ?? null,
    };
  });
}

export type MediaRun = {
  id: number;
  created_at: string;
  kind: string | null;
  imageUrl: string | null;
  caption: string | null;
  /** The last step's output (or the error that stopped the run). */
  finalOutput: string | null;
  failed: boolean;
  responses: {
    id: string;
    stepLabel: string;
    llm_user_prompt: string;
    llm_model_response: string | null;
    error: string | null;
    processing_time_seconds: number;
  }[];
};

const MEDIA_PAGE = 20;

/**
 * Everything a chain produced, newest first: each run's input image, every
 * step's output, and the caption it became (main-app runs) if any.
 */
export async function listChainMedia(chainId: string, page = 1) {
  await requireSuperadmin();
  const admin = createAdminClient();

  const { data: runs, error, count } = await admin
    .from("llm_prompt_chains")
    .select("id, created_at, caption_request_id", { count: "exact" })
    .eq("humor_flavor_id", chainId)
    .order("created_at", { ascending: false })
    .range((page - 1) * MEDIA_PAGE, page * MEDIA_PAGE - 1);
  if (error) throw new Error(error.message);
  if (!runs?.length) return { runs: [] as MediaRun[], total: count ?? 0, page, pageSize: MEDIA_PAGE };

  const runIds = runs.map((r) => r.id);
  const requestIds = [...new Set(runs.map((r) => r.caption_request_id))];

  const [requests, responses, steps] = await Promise.all([
    admin.from("caption_requests").select("id, kind, image_id, caption_id").in("id", requestIds),
    admin
      .from("llm_model_responses")
      .select("id, llm_prompt_chain_id, humor_flavor_step_id, llm_user_prompt, llm_model_response, error, processing_time_seconds, created_at")
      .in("llm_prompt_chain_id", runIds)
      .order("created_at"),
    admin.from("humor_flavor_steps").select("id, order_by, description").eq("humor_flavor_id", chainId),
  ]);
  for (const r of [requests, responses, steps]) if (r.error) throw new Error(r.error.message);

  const reqById = new Map((requests.data ?? []).map((r) => [r.id, r]));
  const imageIds = [...new Set((requests.data ?? []).map((r) => r.image_id).filter(Boolean))];
  const captionIds = [...new Set((requests.data ?? []).map((r) => r.caption_id).filter(Boolean))];
  const [images, captions] = await Promise.all([
    imageIds.length ? admin.from("images").select("id, url").in("id", imageIds) : { data: [], error: null },
    captionIds.length
      ? admin.from("captions").select("id, caption_text, image_url").in("id", captionIds)
      : { data: [], error: null },
  ]);
  for (const r of [images, captions]) if (r.error) throw new Error(r.error.message);
  const imageUrl = new Map((images.data ?? []).map((i) => [i.id, i.url as string]));
  const captionById = new Map((captions.data ?? []).map((c) => [c.id, c]));
  const stepById = new Map((steps.data ?? []).map((s) => [s.id, s]));

  const out: MediaRun[] = runs.map((run) => {
    const req = reqById.get(run.caption_request_id);
    const caption = req?.caption_id ? captionById.get(req.caption_id) : undefined;
    const rs = (responses.data ?? [])
      .filter((r) => r.llm_prompt_chain_id === run.id)
      .map((r) => {
        const step = r.humor_flavor_step_id ? stepById.get(r.humor_flavor_step_id) : undefined;
        return {
          id: r.id,
          stepLabel: step
            ? `Step ${step.order_by}${step.description ? ` · ${step.description}` : ""}`
            : "Deleted step",
          llm_user_prompt: r.llm_user_prompt,
          llm_model_response: r.llm_model_response,
          error: r.error,
          processing_time_seconds: Number(r.processing_time_seconds),
        };
      });
    const last = rs[rs.length - 1];
    return {
      id: run.id,
      created_at: run.created_at,
      kind: req?.kind ?? null,
      imageUrl: (req?.image_id && imageUrl.get(req.image_id)) || caption?.image_url || null,
      caption: caption?.caption_text ?? null,
      finalOutput: last ? (last.error ?? last.llm_model_response) : null,
      failed: !!last?.error,
      responses: rs,
    };
  });

  return { runs: out, total: count ?? 0, page, pageSize: MEDIA_PAGE };
}
