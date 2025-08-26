#!/bin/bash

# Script de build optimisé pour Netlify
echo "🚀 Démarrage du build..."

# Vérification de la version Node.js
echo "📋 Version Node.js: $(node --version)"
echo "📋 Version npm: $(npm --version)"

# Nettoyage des caches
echo "🧹 Nettoyage des caches..."
npm cache clean --force

# Suppression des modules existants
echo "🗑️ Suppression des node_modules..."
rm -rf node_modules

# Suppression du package-lock.json pour une installation propre
echo "🗑️ Suppression du package-lock.json..."
rm -f package-lock.json

# Installation des dépendances avec gestion d'erreurs
echo "📦 Installation des dépendances..."
if npm install --legacy-peer-deps --no-optional --production=false; then
    echo "✅ Dépendances installées avec succès"
else
    echo "❌ Erreur lors de l'installation des dépendances"
    echo "🔧 Tentative d'installation avec --force..."
    if npm install --legacy-peer-deps --force; then
        echo "✅ Dépendances installées avec --force"
    else
        echo "❌ Échec de l'installation des dépendances"
        exit 1
    fi
fi

# Vérification des dépendances
echo "🔍 Vérification des dépendances..."
npm ls --depth=0 || echo "⚠️ Certaines dépendances peuvent avoir des avertissements"

# Vérification des dépendances critiques
echo "🔍 Vérification des dépendances critiques..."
CRITICAL_DEPS=("react" "react-dom" "vite")
for dep in "${CRITICAL_DEPS[@]}"; do
    if npm ls "$dep" >/dev/null 2>&1; then
        echo "✅ $dep installé"
    else
        echo "❌ $dep manquant - tentative d'installation..."
        npm install "$dep" --legacy-peer-deps
    fi
done

# Build du projet
echo "🔨 Build du projet..."
if npm run build; then
    echo "✅ Build réussi !"
else
    echo "❌ Build échoué - tentative de build avec Vite directement..."
    if npx vite build; then
        echo "✅ Build Vite direct réussi !"
    else
        echo "❌ Échec du build Vite direct"
        exit 1
    fi
fi

# Vérification du build
if [ -d "dist" ]; then
    echo "✅ Build réussi !"
    echo "📁 Contenu du dossier dist:"
    ls -la dist/
    
    # Vérification des fichiers critiques
    if [ -f "dist/index.html" ]; then
        echo "✅ index.html généré"
    else
        echo "❌ index.html manquant"
        exit 1
    fi
    
    if [ -d "dist/assets" ]; then
        echo "✅ Dossier assets généré"
        echo "📁 Contenu des assets:"
        ls -la dist/assets/
    else
        echo "❌ Dossier assets manquant"
        exit 1
    fi
else
    echo "❌ Build échoué !"
    exit 1
fi

echo "🎉 Build terminé avec succès !"
echo "📊 Résumé du build:"
echo "   - Node.js: $(node --version)"
echo "   - npm: $(npm --version)"
echo "   - Dossier dist: $(du -sh dist 2>/dev/null || echo 'N/A')"
echo "   - Fichiers générés: $(find dist -type f | wc -l)"
