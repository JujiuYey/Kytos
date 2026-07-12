export const catalog_5 = [
  {
    id: '5',
    name: '梁式桥上部结构构件',
    sequence: 5,
    parentId: null,
    children: [
      {
        id: '5-1',
        name: '混凝土梁式桥',
        sequence: 1,
        parentId: '5',
      },
      {
        id: '5-2',
        name: '钢梁桥',
        sequence: 2,
        parentId: '5',
      },
      {
        id: '5-3',
        name: '支座',
        sequence: 3,
        parentId: '5',
        children: [
          {
            id: '5-3-1',
            name: '橡胶支座',
            sequence: 1,
            parentId: '5-3',
          },
          {
            id: '5-3-2',
            name: '钢支座',
            sequence: 2,
            parentId: '5-3',
          },
          {
            id: '5-3-3',
            name: '混凝土摆式支座',
            sequence: 3,
            parentId: '5-3',
          },
          {
            id: '5-3-4',
            name: '特殊支座',
            sequence: 4,
            parentId: '5-3',
          },
        ],
      },
    ],
  },
];
