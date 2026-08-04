import packageMetadata from "../package.json";
import { supabase } from "./supabaseClient";

const buildId = process.env.REACT_APP_BUILD_ID || process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA;
const { version } = packageMetadata;

export const APP_VERSION = buildId
  ? `${version}+${buildId.slice(0, 7)}`
  : `${version} (${process.env.NODE_ENV})`;

export async function submitFeedback({ category, message, email }) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("You must be signed in to send feedback.");

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    email: email.trim() || null,
    category,
    message: message.trim(),
    app_version: APP_VERSION,
  });

  if (error) throw error;
}
