import { supabase } from "./supabaseClient";

export class CloudConflictError extends Error {
  constructor(message = "Cloud data changed on another device.") {
    super(message);
    this.name = "CloudConflictError";
  }
}

async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("You must be signed in.");
  return user;
}

export async function loadCloudData() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("tracker_data")
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    trades: data.data.trades,
    target: data.data.target,
    updatedAt: data.updated_at,
  };
}

export async function saveCloudData(
  trades,
  target,
  { expectedUpdatedAt = null, force = false } = {}
) {
  const user = await getCurrentUser();
  const trackerData = { trades, target };

  if (force) {
    const { data, error } = await supabase
      .from("tracker_data")
      .upsert(
        { user_id: user.id, data: trackerData },
        { onConflict: "user_id" }
      )
      .select("updated_at")
      .single();

    if (error) throw error;
    return { updatedAt: data.updated_at };
  }

  if (expectedUpdatedAt == null) {
    const { data, error } = await supabase
      .from("tracker_data")
      .insert({ user_id: user.id, data: trackerData })
      .select("updated_at")
      .single();

    if (error?.code === "23505") throw new CloudConflictError();
    if (error) throw error;
    return { updatedAt: data.updated_at };
  }

  const { data, error } = await supabase
    .from("tracker_data")
    .update({ data: trackerData })
    .eq("user_id", user.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new CloudConflictError();
  return { updatedAt: data.updated_at };
}
