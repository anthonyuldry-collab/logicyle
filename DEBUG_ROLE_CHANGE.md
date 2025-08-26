# 🐛 Débogage - Changement de Rôle Utilisateur

## 🚨 Problème signalé
L'utilisateur "quvalognes Utilisateur" a le rôle "Coureur" et le statut "Membre", mais le changement de titre ne se fait pas.

## 🔍 Analyse du code

### 1. **Interface utilisateur** (UserManagementSection.tsx)
```typescript
<select
    value={membership.userRole}
    onChange={async (e) => {
        console.log('🔄 DEBUG: Changement de rôle détecté:', e.target.value);
        console.log('🔄 DEBUG: User ID:', user.id);
        console.log('🔄 DEBUG: Team ID:', currentTeamId);
        try {
            console.log('🔄 DEBUG: Appel de onUpdateRole...');
            await onUpdateRole(user.id, currentTeamId, e.target.value as UserRole);
            console.log('✅ DEBUG: onUpdateRole terminé avec succès');
        } catch (error) {
            console.error('❌ DEBUG: Erreur lors de la mise à jour du rôle:', error);
            alert('Erreur lors de la mise à jour du rôle');
        }
    }}
>
    {Object.values(UserRole).map(role => (
        <option key={role} value={role}>{role}</option>
    ))}
</select>
```

### 2. **Fonction onUpdateRole** (App.tsx)
```typescript
onUpdateRole={async (userId, teamId, newUserRole) => {
    try {
        console.log('🔍 DEBUG: onUpdateRole appelé avec:', { userId, teamId, newUserRole });
        
        const user = appState.users.find(u => u.id === userId);
        console.log('🔍 DEBUG: Utilisateur trouvé:', user);
        
        if (!user) {
            console.error('❌ DEBUG: Utilisateur non trouvé pour ID:', userId);
            alert('Utilisateur non trouvé');
            return;
        }

        // Mise à jour Firebase
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            userRole: newUserRole,
            updatedAt: new Date().toISOString()
        });

        // Mise à jour état local
        setAppState((prev: AppState) => ({
            ...prev,
            users: prev.users.map(u => 
                u.id === userId 
                    ? { ...u, userRole: newUserRole }
                    : u
            )
        }));

        // Création profil selon le rôle
        if (newUserRole === UserRole.COUREUR) {
            // Créer profil coureur
        } else if (newUserRole === UserRole.STAFF) {
            // Créer profil staff
        }

        alert(`Rôle utilisateur mis à jour avec succès. ${user.firstName} ${user.lastName} a été ajouté aux ${newUserRole === UserRole.COUREUR ? 'coureurs' : 'staff'}.`);
    } catch (error) {
        console.error('❌ DEBUG: Erreur détaillée lors de la mise à jour du rôle:', error);
        // Gestion d'erreur
    }
}}
```

## 🔍 Points de vérification

### 1. **Vérifier la console du navigateur**
- Ouvrir les outils de développement (F12)
- Aller dans l'onglet Console
- Tenter de changer le rôle d'un utilisateur
- Vérifier les messages de débogage

### 2. **Vérifier les valeurs d'enum**
```typescript
// UserRole dans types.ts
export enum UserRole {
    MANAGER = "Manager",
    STAFF = "Staff",        // ← Vérifier cette valeur
    COUREUR = "Coureur",    // ← Vérifier cette valeur
    INVITE = "Invité",
}
```

### 3. **Vérifier la structure des données**
- L'utilisateur a-t-il un `userRole` défini ?
- Le `membership.userRole` correspond-il au `user.userRole` ?
- Y a-t-il une différence entre l'état local et Firebase ?

## 🧪 Tests à effectuer

### Test 1 : Changement vers Staff
1. Sélectionner "Staff" dans le dropdown
2. Vérifier les logs de console
3. Vérifier si l'utilisateur apparaît dans l'onglet Staff

### Test 2 : Changement vers Coureur
1. Sélectionner "Coureur" dans le dropdown
2. Vérifier les logs de console
3. Vérifier si l'utilisateur apparaît dans l'onglet Coureurs

### Test 3 : Vérification des données
1. Vérifier la collection `users` dans Firebase
2. Vérifier la collection `teams/{teamId}/staff` ou `teams/{teamId}/riders`
3. Comparer avec l'état local de l'application

## 🚨 Problèmes potentiels identifiés

### 1. **Erreur silencieuse**
- L'erreur pourrait être attrapée par le try/catch mais pas affichée
- Vérifier si `onUpdateRole` est bien appelée

### 2. **Problème de comparaison d'enum**
- Les valeurs d'enum pourraient ne pas correspondre
- Vérifier si `UserRole.STAFF === "Staff"`

### 3. **Problème de mise à jour d'état**
- L'état local pourrait ne pas être mis à jour
- Vérifier si `setAppState` fonctionne

### 4. **Problème Firebase**
- Les permissions Firebase pourraient bloquer la mise à jour
- Vérifier les règles de sécurité

## 🛠️ Solutions à tester

### Solution 1 : Ajouter plus de logs
```typescript
console.log('🔍 DEBUG: Valeur sélectionnée:', e.target.value);
console.log('🔍 DEBUG: Type de valeur:', typeof e.target.value);
console.log('🔍 DEBUG: UserRole.STAFF:', UserRole.STAFF);
console.log('🔍 DEBUG: Comparaison:', e.target.value === UserRole.STAFF);
```

### Solution 2 : Vérifier la structure des données
```typescript
console.log('🔍 DEBUG: Structure membership:', membership);
console.log('🔍 DEBUG: Structure user:', user);
console.log('🔍 DEBUG: Différence userRole:', user.userRole !== membership.userRole);
```

### Solution 3 : Forcer la mise à jour
```typescript
// Forcer la mise à jour même si les valeurs sont identiques
if (user.userRole !== newUserRole || true) {
    // Procéder à la mise à jour
}
```

## 📋 Checklist de débogage

- [ ] Vérifier la console du navigateur
- [ ] Tester le changement vers Staff
- [ ] Tester le changement vers Coureur
- [ ] Vérifier les données Firebase
- [ ] Vérifier l'état local
- [ ] Identifier le point de défaillance
- [ ] Appliquer la correction appropriée

---

**Prochaine étape : Tester le changement de rôle et analyser les logs de console pour identifier le problème exact.**
