import { Construction, Landmark, Layers } from 'lucide-vue-next';

export interface StructSection {
  title: string;
  key: string;
  icon: any;
}

export const structSections: StructSection[] = [
  { title: '上部结构', key: 'upper', icon: Construction },
  { title: '下部结构', key: 'lower', icon: Landmark },
  { title: '桥面系', key: 'deck', icon: Layers },
];
