<script setup>
import { ref } from 'vue'
import { login } from '../session'
import Icon from '../components/Icon.vue'

const msg = ref('')
const busy = ref(false)

async function go() {
  busy.value = true
  msg.value = ''
  try {
    await login()
  } catch (e) {
    if (e.code === 'auth/popup-blocked') msg.value = 'Le navigateur a bloqué la fenêtre de connexion. Autorisez les pop-ups pour ce site puis réessayez.'
    else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') msg.value = e.message
  }
  busy.value = false
}

const features = [
  { icon: 'package', title: 'Catalogue de produits', text: 'Un catalogue par vente, avec prix et photos.' },
  { icon: 'clipboard', title: 'Bons de commande', text: 'Qui commande combien de chaque produit : saisie rapide sur téléphone, en volume sur ordinateur.' },
  { icon: 'wallet', title: 'Suivi des paiements', text: 'Espèces, chèques, virements : acomptes, soldes et écarts visibles en un coup d\'œil.' },
  { icon: 'file', title: 'Totaux et PDF', text: 'Les quantités à commander et le reste à encaisser, exportables en PDF.' },
  { icon: 'users', title: 'Plusieurs gestionnaires', text: 'Invitez les membres de votre équipe, chacun avec son rôle.' },
  { icon: 'shield', title: 'Données séparées', text: 'Chaque association ne voit que ses propres ventes.' }
]
</script>

<template>
  <div class="landing">
    <header class="landing-top">
      <div class="brand"><span class="brand-mark">B</span> Boutik</div>
      <button class="btn sm" :disabled="busy" @click="go">Se connecter</button>
    </header>

    <section class="hero">
      <h1>Les ventes de votre association, sans tableur.</h1>
      <p class="lead">
        Boutik vous aide à suivre une vente du début à la fin : le catalogue, les bons de commande,
        les paiements et les totaux à commander.
      </p>
      <button class="btn primary big google-btn" :disabled="busy" @click="go">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#fff" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Se connecter avec Google
      </button>
      <p class="muted small">Accès sur invitation : demandez à l'administrateur de votre association de vous inviter avec votre adresse Google.</p>
      <p v-if="msg" class="error">{{ msg }}</p>
    </section>

    <section class="features">
      <div v-for="f in features" :key="f.title" class="feature">
        <div class="ico"><Icon :name="f.icon" :size="22" /></div>
        <h3>{{ f.title }}</h3>
        <p class="muted">{{ f.text }}</p>
      </div>
    </section>

    <section class="how">
      <h2>Comment ça marche</h2>
      <ol class="steps">
        <li><span class="n">1</span><div><div class="t">Créez un événement</div><div class="d">Par exemple « Chocolats de Noël », puis ajoutez ses produits et leurs prix.</div></div></li>
        <li><span class="n">2</span><div><div class="t">Saisissez les bons de commande</div><div class="d">Un nom, des quantités, et le total se calcule tout seul.</div></div></li>
        <li><span class="n">3</span><div><div class="t">Suivez les paiements</div><div class="d">Solder une commande se fait en un clic.</div></div></li>
        <li><span class="n">4</span><div><div class="t">Exportez les totaux</div><div class="d">Un récapitulatif PDF prêt à envoyer au fournisseur.</div></div></li>
      </ol>
    </section>

    <footer class="muted small center">Boutik · gestion de ventes pour associations</footer>
  </div>
</template>
