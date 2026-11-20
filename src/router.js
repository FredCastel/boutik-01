import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import MembersView from './views/MembersView.vue'
import SuperAdminView from './views/SuperAdminView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/clients', component: HomeView }, // à venir
    { path: '/membres', component: MembersView },
    { path: '/admin', component: SuperAdminView }
  ]
})
