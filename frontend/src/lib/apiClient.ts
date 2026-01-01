import { fetchAuthSession } from "aws-amplify/auth";

/**
 * fetch() の拡張版。
 * Amplifyのアクセストークンを自動的に Authorization ヘッダに付与する。
 */
export const authedFetch: typeof fetch = async (input, init) => {
  const { tokens } = await fetchAuthSession();
  const token = tokens?.accessToken?.toString();
  if (!token) throw new Error("No access token");

  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res;
};
