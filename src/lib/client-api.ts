"use client";

import { auth } from "@/lib/firebase";

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in with Google to continue.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(path, { ...init, headers });
}

// API route payloads are incrementally typed at call sites while legacy callers migrate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiJson<T = any>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await authenticatedFetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "The request could not be completed.");
  }
  return data;
}
