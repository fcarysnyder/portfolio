export type AspectRatio = '3:2' | '4:5';

export interface Photo {
  src: string;
  title: string;
  year: number;
  aspectRatio: AspectRatio;
  tags?: string[];
}

export const photos: Photo[] = [
  { src: '/assets/photography/sampleYear/DSC01377_edit - 01.jpg', title: 'DSC01377',  year: 2025, aspectRatio: '4:5',  tags: ['portrait'] },
  { src: '/assets/photography/sampleYear/DSC01724 - 01.jpg',      title: 'DSC01724',  year: 2025, aspectRatio: '3:2',  tags: ['landscape'] },
  { src: '/assets/photography/sampleYear/DSC01844-2 - 01.jpg',    title: 'DSC01844',  year: 2025, aspectRatio: '3:2',  tags: ['landscape'] },
  { src: '/assets/photography/sampleYear/DSC02284 - 01.jpg',      title: 'DSC02284',  year: 2025, aspectRatio: '4:5',  tags: ['portrait'] },
  { src: '/assets/photography/sampleYear/DSC02291-HDR - 01.jpg',  title: 'DSC02291',  year: 2025, aspectRatio: '3:2',  tags: ['landscape'] },
  { src: '/assets/photography/sampleYear/DSC06393 - 01.jpg',      title: 'DSC06393',  year: 2025, aspectRatio: '3:2',  tags: ['landscape'] },
];
