import { defineCollection, z } from 'astro:content';

const work = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		publishDate: z.date(),
		img: z.string().optional(),
		description: z.string(),
		link: z.string().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

const travel = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		publishDate: z.date(),
		image: z.string().optional(),
		description: z.string(),
		link: z.string().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

export const collections = {
	work,
	travel,
}; 