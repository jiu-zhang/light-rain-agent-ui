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
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
