import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Chat',
      component: () => import('@renderer/views/ChatView.vue')
    },
    {
      path: '/chat',
      redirect: '/'
    },
    {
      path: '/sessions',
      name: 'Sessions',
      component: () => import('@renderer/views/SessionView.vue')
    },
    {
      path: '/models',
      name: 'Models',
      component: () => import('@renderer/views/ModelView.vue')
    },
    {
      path: '/cron',
      name: 'Cron',
      component: () => import('@renderer/views/CronView.vue')
    },
    {
      path: '/executions',
      name: 'Executions',
      component: () => import('@renderer/views/ExecutionView.vue')
    },
    {
      path: '/plans',
      name: 'Plans',
      component: () => import('@renderer/views/PlanTemplatesView.vue')
    },
    {
      path: '/mcp',
      name: 'Mcp',
      component: () => import('@renderer/views/McpView.vue')
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@renderer/views/SettingsView.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
