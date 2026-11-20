<script setup>
import Icon from '../components/Icon.vue'
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Comment ça marche</h1>
      <p class="muted" style="margin: 2px 0 0">Boutik sert à suivre une vente : qui commande quoi, qui a payé, et combien commander.</p>
    </div>
  </div>

  <div class="card">
    <h3>En 4 étapes</h3>
    <ol class="steps">
      <li><span class="n">1</span><div><div class="t">Créez un événement</div><div class="d">Une vente, par exemple « Chocolats de Noël 2026 ». Choisissez son mode de paiement habituel.</div></div></li>
      <li><span class="n">2</span><div><div class="t">Ajoutez le catalogue</div><div class="d">Onglet « Catalogue » de l'événement : chaque produit avec son prix. Ils apparaîtront sur les bons dans cet ordre.</div></div></li>
      <li><span class="n">3</span><div><div class="t">Saisissez les bons de commande</div><div class="d">Un bon = une personne + les quantités de chaque produit. Une personne peut avoir plusieurs bons, ils se cumulent.</div></div></li>
      <li><span class="n">4</span><div><div class="t">Suivez les paiements</div><div class="d">Depuis la fiche d'une personne, ajoutez ses paiements (espèces, chèque, virement). « Solder » règle le reste d'un clic.</div></div></li>
    </ol>
  </div>

  <div class="card">
    <h3>Les mots à connaître</h3>
    <p><strong>Événement</strong> : une vente, avec son catalogue, ses bons et ses paiements.</p>
    <p><strong>Catalogue</strong> : la liste des produits à vendre pour cet événement, avec leurs prix.</p>
    <p><strong>Bon de commande</strong> : ce qu'une personne commande. On indique uniquement les quantités, le prix se calcule.</p>
    <p><strong>Solder</strong> : enregistrer le paiement qui manque pour que la personne n'ait plus rien à payer.</p>
    <p><strong>Trop-perçu</strong> : la personne a payé plus que son total. Vous pouvez la rembourser (« Régulariser ») ou laisser tel quel : ce n'est jamais obligatoire.</p>
  </div>

  <div class="card">
    <h3>Astuces</h3>
    <p><strong>Bons papier à recopier ?</strong> Sur ordinateur, ouvrez un événement puis « Saisie en volume » : un tableau où l'on enchaîne les bons avec Tab et Entrée.</p>
    <p><strong>Où est l'argent ?</strong> L'onglet « Caisse » d'un événement détaille ce qui a été encaissé : espèces, nombre et noms des chèques, virements, et le solde de la caisse. Le menu « Caisse » fait la même chose pour toute l'association, événement par événement.</p>
    <p><strong>Suivre la livraison ?</strong> Chaque bon a un statut « Livré / À livrer » (case « Produits remis » sur le bon, ou bouton sur la fiche de la personne). Dans l'onglet « Bons », le filtre « À livrer » liste ce qu'il reste à remettre.</p>
    <p><strong>Une précision à noter ?</strong> Vous pouvez ajouter une note sur un bon, sur un produit (catalogue) ou sur un client : elle s'affiche à l'endroit utile.</p>
    <p><strong>Un bon déjà payé ?</strong> Dans « Nouveau bon », la case « Paiement déjà reçu » enregistre le paiement en même temps. Le montant peut être différent du total.</p>
    <p><strong>Les totaux pour le fournisseur ?</strong> Onglet « Totaux » : quantités à commander, reste à encaisser, puis « Exporter en PDF ».</p>
    <p><strong>Utiliser sur téléphone ?</strong> Sur Android (Chrome) : menu ⋮ puis « Installer l'application ». Sur iPhone (Safari) : bouton Partager puis « Sur l'écran d'accueil ».</p>
  </div>

  <div class="card">
    <h3>Qui peut faire quoi ?</h3>
    <p><strong>Administrateur</strong> : tout, y compris inviter ou retirer des membres.</p>
    <p><strong>Gestionnaire</strong> : crée les événements, saisit les bons et les paiements.</p>
    <p><strong>Lecture seule</strong> : consulte les données sans pouvoir les modifier.</p>
    <p class="muted small" style="margin: 0">Chaque association ne voit que ses propres données.</p>
  </div>

  <router-link to="/" class="btn primary"><Icon name="calendar" :size="18" /> Aller aux événements</router-link>
</template>
