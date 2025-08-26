# 🔧 Résolution du problème de dépendance frappe-charts

## ❌ Problème identifié
L'erreur de build indique que le package `frappe-charts` ne peut pas être résolu :
```
Cannot resolve 'frappe-charts' package
```

## ✅ Solutions implémentées

### 1. Ajout de la dépendance manquante
- ✅ Ajout de `"frappe-charts": "^1.6.2"` dans `package.json`
- ✅ Configuration Vite mise à jour pour inclure `frappe-charts` dans `optimizeDeps`

### 2. Configuration Vite améliorée
- ✅ `optimizeDeps.include` étendu pour inclure `frappe-charts`
- ✅ `rollupOptions.output.manualChunks` configuré pour séparer les graphiques
- ✅ Gestion des chunks optimisée pour le build

### 3. Script de build alternatif
- ✅ Création de `build.sh` pour gérer différents gestionnaires de paquets
- ✅ Support de npm, yarn, et pnpm
- ✅ Fallback manuel si aucun gestionnaire n'est disponible

### 4. Configuration Netlify mise à jour
- ✅ Commande de build changée de `npm run build` vers `./build.sh`
- ✅ Variables d'environnement ajoutées (`NPM_FLAGS = "--legacy-peer-deps"`)
- ✅ Script de build exécutable

### 5. Configuration TypeScript robuste
- ✅ `tsconfig.json` simplifié et optimisé
- ✅ `tsconfig.node.json` créé pour la configuration Vite
- ✅ `vite-env.d.ts` avec déclarations de types pour `frappe-charts`

## 🚀 Comment utiliser

### Option 1 : Build local avec npm/yarn
```bash
# Si npm est disponible
npm install
npm run build

# Si yarn est disponible
yarn install
yarn build

# Si pnpm est disponible
pnpm install
pnpm build
```

### Option 2 : Build avec le script alternatif
```bash
# Rendre le script exécutable
chmod +x build.sh

# Lancer le build
./build.sh
```

### Option 3 : Build sur Netlify
Le déploiement Netlify utilisera automatiquement `./build.sh` et installera `frappe-charts`.

## 🔍 Vérification

Après le build, vérifiez que :
1. ✅ Le dossier `dist/` est créé
2. ✅ Aucune erreur de dépendance dans les logs
3. ✅ L'application se charge correctement
4. ✅ Les graphiques fonctionnent (si utilisés)

## 🆘 En cas de problème persistant

1. **Vérifiez les logs de build** pour identifier l'erreur exacte
2. **Supprimez node_modules et package-lock.json** puis relancez l'installation
3. **Utilisez le script de build alternatif** : `./build.sh`
4. **Vérifiez la version de Node.js** (>= 20.0.0 requis)

## 📝 Notes importantes

- `frappe-charts` est maintenant une dépendance explicite
- La configuration Vite gère automatiquement ce package
- Le script de build est robuste et gère les cas d'erreur
- Netlify utilisera la nouvelle configuration automatiquement
