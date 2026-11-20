import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import EventView from './views/EventView.vue'
import BonView from './views/BonView.vue'
import PersonView from './views/PersonView.vue'
import SaisieView from './views/SaisieView.vue'
import ClientsView from './views/ClientsView.vue'
import MembersView from './views/MembersView.vue'
import SuperAdminView from './views/SuperAdminView.vue'
import AideView from './views/AideView.vue'
import CaisseView from './views/CaisseView.vue'

export default createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: HomeView },
    { path: '/e/:id', component: EventView },
    { path: '/e/:eid/bon/:oid', component: BonView },
    { path: '/e/:eid/p/:cid', component: PersonView },
    { path: '/e/:eid/saisie', component: SaisieView },
    { path: '/clients', component: ClientsView },
    { path: '/caisse', component: CaisseView },
    { path: '/membres', component: MembersView },
    { path: '/admin', component: SuperAdminView },
    { path: '/aide', component: AideView }
  ]
})
