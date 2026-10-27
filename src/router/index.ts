import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import WorkspaceLayout from '@/layouts/WorkspaceLayout.vue'
import DashboardView from '@/views/DashboardView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: WorkspaceLayout,
    children: [
      { path: '', name: 'dashboard', component: DashboardView, meta: { title: '仪表盘' } },
      { path: 'tasks', name: 'tasks', component: () => import('@/views/TasksView.vue'), meta: { title: '任务待办' } },
      { path: 'notes', name: 'notes', component: () => import('@/views/NotesView.vue'), meta: { title: '笔记知识库' } },
      { path: 'tools', name: 'tools', component: () => import('@/views/ToolsView.vue'), meta: { title: '工具导航' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => {
  const base = 'Kiln · 个人工作台'
  const t = (to.meta?.title as string) || ''
  document.title = t ? `${t} · Kiln` : base
})
