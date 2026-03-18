const API_BASE = 'https://api.medium.com/v1';

/**
 * Publishes a post to Medium as a draft.
 * @param {{ title: string, content: string, canonicalUrl: string, tags: string[] }} post
 * @returns {Promise<{ id: string, url: string }>}
 */
export async function publish({ title, content, canonicalUrl, tags }) {
  const token = process.env.MEDIUM_API_TOKEN;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Get user ID
  const meRes = await fetch(`${API_BASE}/me`, { headers });
  if (!meRes.ok) {
    throw new Error(`Medium API error: ${meRes.status} — ${await meRes.text()}`);
  }
  const { data: user } = await meRes.json();

  // Create post
  const postRes = await fetch(`${API_BASE}/users/${user.id}/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title,
      contentFormat: 'markdown',
      content,
      canonicalUrl,
      tags: tags.slice(0, 5),
      publishStatus: 'draft',
    }),
  });

  if (!postRes.ok) {
    throw new Error(`Medium API error: ${postRes.status} — ${await postRes.text()}`);
  }

  const { data: post } = await postRes.json();
  return { id: post.id, url: post.url };
}
