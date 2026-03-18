import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { convertMdx } from './mdx-to-markdown.js';

describe('convertMdx', () => {
  it('extracts frontmatter metadata', () => {
    const input = `---
title: "Test Post"
description: "A test"
publishDate: 2026-03-17
tags:
  - AI
  - design
---

Hello world`;

    const { metadata, content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.equal(metadata.title, 'Test Post');
    assert.equal(metadata.description, 'A test');
    assert.equal(metadata.publishDate, '2026-03-17');
    assert.deepEqual(metadata.tags, ['AI', 'design']);
    assert.ok(content.includes('Hello world'));
    assert.ok(!content.includes('title:'));
  });

  it('strips import statements', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

import Tweet from '../../components/Tweet.tsx';
import Divider from '../../components/Divider.astro';

Some content here`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(!content.includes('import'));
    assert.ok(content.includes('Some content here'));
  });

  it('converts Tweet component to bare URL', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

Some text before

<Tweet client:load url="https://x.com/allgarbled/status/2033698785529082144" />

Some text after`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('https://x.com/allgarbled/status/2033698785529082144'));
    assert.ok(!content.includes('<Tweet'));
    assert.ok(!content.includes('client:load'));
    assert.ok(content.includes('Some text before'));
    assert.ok(content.includes('Some text after'));
  });

  it('converts Divider to horizontal rule', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

Before

<Divider />

After`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('---'));
    assert.ok(!content.includes('<Divider'));
  });

  it('resolves image paths to absolute URLs', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

![Neo learning kung fu](/assets/blog/neo-matrix-kung-fu.webp)`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('![Neo learning kung fu](https://www.fcarysnyder.com/assets/blog/neo-matrix-kung-fu.webp)'));
  });

  it('strips unknown JSX components', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

<SomeComponent prop="value" />

Paragraph after`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(!content.includes('<SomeComponent'));
    assert.ok(content.includes('Paragraph after'));
  });

  it('strips Astro client directives', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

<SomeWidget client:visible prop="val" />

After`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(!content.includes('client:visible'));
    assert.ok(!content.includes('<SomeWidget'));
    assert.ok(content.includes('After'));
  });

  it('cleans up excessive blank lines', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

Line one



Line two`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(!content.includes('\n\n\n'));
    assert.ok(content.includes('Line one\n\nLine two'));
  });

  it('handles missing optional tags', () => {
    const input = `---
title: "No Tags"
description: "A post without tags"
publishDate: 2026-01-01
---

Content`;

    const { metadata } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.deepEqual(metadata.tags, []);
  });

  it('preserves standard markdown elements', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

## Heading

**bold** and *italic*

- list item 1
- list item 2

\`\`\`js
const x = 1;
\`\`\`

> blockquote

[link](https://example.com)`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('## Heading'));
    assert.ok(content.includes('**bold** and *italic*'));
    assert.ok(content.includes('- list item 1'));
    assert.ok(content.includes('```js'));
    assert.ok(content.includes('> blockquote'));
    assert.ok(content.includes('[link](https://example.com)'));
  });
});
