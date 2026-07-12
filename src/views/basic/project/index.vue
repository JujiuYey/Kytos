<script setup lang="ts">
import { Plus, Search } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { SagDataTable } from '@/components/sag/sag-data-table';
import { SagFormModal } from '@/components/sag/sag-form-modal';
import { columns } from './meta/table-schema';
import { formFields } from './meta/form-schema';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';

import type { Project } from '@/api/project';
import { projectService } from '@/api/project';
import type { TableColumn } from '@/components/sag/sag-data-table';
import ProjectMember from './components/project-member.vue';

const tableData = ref<Project[]>([]);
const searchName = ref<string>();
const loading = ref(false);

onMounted(async () => {
  await fetchTableData();
});

async function fetchTableData() {
  try {
    const res = await projectService.list();
    tableData.value = res;
  } catch (error) {
    toast(`${error}`);
  }
}

/**
 * 搜索
 */
function handleSearch() {
  if (searchName.value) {
    console.log(searchName.value);
  }
}

/**
 * 新增/编辑
 */

const formMode = ref<'create' | 'edit'>('create');
const showFormModal = ref(false);
const currentRow = ref<Recordable | null>(null);

function toggleFormModal(mode: 'create' | 'edit' = 'create') {
  formMode.value = mode;
  currentRow.value = null;
  showFormModal.value = true;
}

async function handleCreate(project: Project) {
  await projectService.create(project as Omit<Project, 'id' | 'created_at' | 'updated_at'>);
  toast.success('创建成功');
  await fetchTableData();
  showFormModal.value = false;
}

async function handleUpdate(project: Project) {
  await projectService.update(project.id, project);
  toast.success('更新成功');
  await fetchTableData();
  showFormModal.value = false;
}

/**
 * 删除
 */
const showDeleteDialog = ref(false);
function handleDelete() {
  showDeleteDialog.value = true;
}

async function confirmDeleteUser() {
  if (!currentRow.value) {
    return;
  }

  loading.value = true;
  try {
    await projectService.delete(currentRow.value.id);
    toast.success('删除成功');
    await fetchTableData();
    showDeleteDialog.value = false;
    currentRow.value = null;
  } catch (error) {
    toast.error(`删除失败${error}`);
  } finally {
    loading.value = false;
  }
}

function cancelDelete() {
  currentRow.value = null;
  showDeleteDialog.value = false;
}

function handleFormSuccess() {
  fetchTableData();
}

/**
 * 成员设置
 */
const showMemberModal = ref(false);

/**
 * 表格列
 */
const tableColumns = [
  ...columns,
  {
    key: 'actions',
    label: '操作',
    align: 'center',
    width: '200px',
    type: 'actions',
    actions: [
      {
        label: '编辑',
        onClick: (row: Recordable) => {
          toggleFormModal('edit');
          currentRow.value = row;
        },
      },
      {
        label: '成员',
        variant: 'outline',
        onClick: (row: Recordable) => {
          currentRow.value = row;
          showMemberModal.value = true;
        },
      },
      {
        label: '删除',
        variant: 'destructive',
        onClick: (row: Recordable) => {
          currentRow.value = row;
          handleDelete();
        },
      },
    ],
  } as TableColumn,
];
</script>

<template>
  <div>
    <div class="hidden h-full flex-1 flex-col space-y-4 p-8 md:flex">
      <!-- 工具栏 -->
      <div class="flex items-center justify-between">
        <div class="flex flex-1 items-center space-x-2">
          <Input
            v-model="searchName"
            placeholder="请输入姓名"
            class="h-8 w-[150px] lg:w-[250px]"
          />

          <Button
            variant="default"
            class="h-8 px-2 lg:px-3"
            @click="handleSearch"
          >
            搜索
            <Search class="ml-1 h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="default"
          class="h-8 px-2 lg:px-3"
          @click="toggleFormModal('create')"
        >
          新增
          <Plus class="ml-1 h-4 w-4" />
        </Button>
      </div>

      <SagDataTable
        v-if="tableData.length > 0"
        :data="tableData"
        :columns="tableColumns"
      />
      <div v-else class="flex items-center justify-center h-full">
        <p class="text-gray-500">
          暂无数据
        </p>
      </div>
    </div>

    <SagFormModal
      v-model:open="showFormModal"
      title="项目"
      :fields="formFields"
      :mode="formMode"
      :form-data="currentRow"
      :create-function="handleCreate"
      :update-function="handleUpdate"
      @success="handleFormSuccess"
    />

    <ProjectMember v-model:open="showMemberModal" :project-id="currentRow?.id" />

    <!-- 删除确认对话框 -->
    <SagConfirmDialog
      v-model:open="showDeleteDialog"
      :title="`确认删除${currentRow?.name}`"
      :description="`此操作不可恢复，确定要删除${currentRow?.name}吗？`"
      @confirm="confirmDeleteUser"
      @cancel="cancelDelete"
    />
  </div>
</template>
