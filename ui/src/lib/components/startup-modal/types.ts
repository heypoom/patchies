export interface ExamplePatch {
	id: string;
	name: string;
	description: string;
	author?: string;
	imageUrl?: string;
	category: string;
}

export interface ExampleCategory {
	name: string;
	patches: ExamplePatch[];
}

export type Tab = 'about' | 'examples';
