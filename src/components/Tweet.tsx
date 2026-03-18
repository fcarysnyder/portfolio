import { useEffect, useState } from 'react';
import { EmbeddedTweet, TweetNotFound, TweetSkeleton } from 'react-tweet';
import type { Tweet as TweetData } from 'react-tweet/api';

function extractTweetId(url: string): string {
  const match = url.match(/status\/(\d+)/);
  return match?.[1] ?? '';
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('theme-dark')
      ? 'dark'
      : 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.classList.contains('theme-dark')
          ? 'dark'
          : 'light'
      );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

const TWEET_API = 'https://react-tweet.vercel.app';

export default function Tweet({ url }: { url: string }) {
  const id = extractTweetId(url);
  const theme = useTheme();
  const [tweet, setTweet] = useState<TweetData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${TWEET_API}/api/tweet/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setTweet(json.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id || error) return <TweetNotFound />;
  if (loading || !tweet) return <TweetSkeleton />;

  return (
    <div data-theme={theme}>
      <EmbeddedTweet tweet={tweet} />
    </div>
  );
}
