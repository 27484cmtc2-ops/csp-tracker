import { supabase } from "./supabaseClient";

export async function saveCloudData(trades, target) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const payload = {
    user_id: user.id,
    data: {
      trades,
      target,
    },
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("tracker_data")
    .upsert(payload, {
      onConflict: "user_id",
    });

  if (error) {
    throw error;
  }
}

export async function loadCloudData() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await supabase
    .from("tracker_data")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data.data;
}