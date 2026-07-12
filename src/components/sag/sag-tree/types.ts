export interface TreeNode {
  id: string;
  name: string;
  sequence: number;
  parentId: string | null;
  children?: TreeNode[];
}
