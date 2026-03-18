import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

export const collections = {
	work: defineCollection({
		// Load Markdown files in the `src/content/work` directory.
		loader: glob({ base: 'src/content/work', pattern: '**/*.md' }),
		schema: z.object({
			title: z.string(),
			description: z.string(),
			publishDate: z.coerce.date(),
			tags: z.array(z.string()),
			img: z.string(),
			img_alt: z.string().optional(),
			color: z.string().optional(),
			url: z.string().optional(),
			cta: z.string().optional(),
		}),
	}),
	blog: defineCollection({
		// Load MDX files in the `src/content/blog` directory.
		loader: glob({ base: 'src/content/blog', pattern: '**/*.mdx' }),
		schema: z.object({
			title: z.string(),
			description: z.string(),
			publishDate: z.coerce.date(),
			tags: z.array(z.string()).optional(),
		}),
	}),
};

