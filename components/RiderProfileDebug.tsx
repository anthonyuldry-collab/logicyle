import React, { useState } from 'react';
import { Rider } from '../types';
import ActionButton from './ActionButton';
import PlusCircleIcon from './icons/PlusCircleIcon';
import PencilIcon from './icons/PencilIcon';
import EyeIcon from './icons/EyeIcon';

interface RiderProfileDebugProps {
  rider: Rider;
  onSaveRider: (rider: Rider) => void;
  onEditRider: (rider: Rider) => void;
  onViewRider: (rider: Rider) => void;
}

const RiderProfileDebug: React.FC<RiderProfileDebugProps> = ({ 
  rider, 
  onSaveRider, 
  onEditRider,
  onViewRider
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [debugRider, setDebugRider] = useState<Rider>(rider);

  const handleSave = () => {
    console.log('🚴 Debug: Tentative de sauvegarde du profil:', debugRider);
    console.log('📝 onSaveRider disponible:', !!onSaveRider);
    console.log('📝 Type de onSaveRider:', typeof onSaveRider);
    
    try {
      onSaveRider(debugRider);
      console.log('✅ Debug: onSaveRider appelé avec succès');
    } catch (error) {
      console.error('❌ Debug: Erreur lors de l\'appel à onSaveRider:', error);
    }
    
    setIsModalOpen(false);
  };

  const handleEdit = () => {
    console.log('✏️ Debug: Tentative de modification du profil:', debugRider);
    console.log('📝 onEditRider disponible:', !!onEditRider);
    
    try {
      onEditRider(debugRider);
      console.log('✅ Debug: onEditRider appelé avec succès');
    } catch (error) {
      console.error('❌ Debug: Erreur lors de l\'appel à onEditRider:', error);
    }
  };

  const handleView = () => {
    console.log('👁️ Debug: Tentative de visualisation du profil:', debugRider);
    console.log('📝 onViewRider disponible:', !!onViewRider);
    
    try {
      onViewRider(debugRider);
      console.log('✅ Debug: onViewRider appelé avec succès');
    } catch (error) {
      console.error('❌ Debug: Erreur lors de l\'appel à onViewRider:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDebugRider(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryChange = (category: string, checked: boolean) => {
    setDebugRider(prev => {
      const currentCategories = prev.categories || [];
      if (checked) {
        return {
          ...prev,
          categories: [...currentCategories, category]
        };
      } else {
        return {
          ...prev,
          categories: currentCategories.filter(cat => cat !== category)
        };
      }
    });
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-purple-800 mb-2">
        🔧 Debug Profil Athlète - {rider.firstName} {rider.lastName}
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <p className="text-sm text-purple-700">
            <strong>ID:</strong> {rider.id}
          </p>
          <p className="text-sm text-purple-700">
            <strong>Catégories actuelles:</strong> {rider.categories?.join(', ') || 'Aucune'}
          </p>
          <p className="text-sm text-purple-700">
            <strong>onSaveRider:</strong> {onSaveRider ? '✅ Oui' : '❌ Non'}
          </p>
          <p className="text-sm text-purple-700">
            <strong>onEditRider:</strong> {onEditRider ? '✅ Oui' : '❌ Non'}
          </p>
          <p className="text-sm text-purple-700">
            <strong>onViewRider:</strong> {onViewRider ? '✅ Oui' : '❌ Non'}
          </p>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm text-purple-700">
            <strong>Forme:</strong> {rider.forme || 'Non définie'}
          </p>
          <p className="text-sm text-purple-700">
            <strong>Moral:</strong> {rider.moral || 'Non défini'}
          </p>
          <p className="text-sm text-purple-700">
            <strong>Santé:</strong> {rider.healthCondition || 'Non définie'}
          </p>
          <p className="text-sm text-purple-700">
            <strong>Profil:</strong> {rider.qualitativeProfile || 'Non défini'}
          </p>
        </div>
      </div>

      <div className="flex space-x-2 mb-4">
        <ActionButton 
          onClick={() => setIsModalOpen(true)}
          icon={<PlusCircleIcon className="w-4 h-4" />}
          size="sm"
        >
          Debug Profil
        </ActionButton>
        
        <ActionButton 
          onClick={handleEdit}
          icon={<PencilIcon className="w-4 h-4" />}
          size="sm"
          variant="secondary"
        >
          Test Modifier
        </ActionButton>
        
        <ActionButton 
          onClick={handleView}
          icon={<EyeIcon className="w-4 h-4" />}
          size="sm"
          variant="secondary"
        >
          Test Voir
        </ActionButton>
      </div>

      {/* Modal de debug */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-semibold mb-4">Debug Profil Athlète</h4>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Prénom</label>
                <input
                  type="text"
                  name="firstName"
                  value={debugRider.firstName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Nom</label>
                <input
                  type="text"
                  name="lastName"
                  value={debugRider.lastName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Forme</label>
                <select
                  name="forme"
                  value={debugRider.forme || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Sélectionner</option>
                  <option value="EXCELLENT">Excellent</option>
                  <option value="BON">Bon</option>
                  <option value="MOYEN">Moyen</option>
                  <option value="MAUVAIS">Mauvais</option>
                  <option value="INCONNU">Inconnu</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Moral</label>
                <select
                  name="moral"
                  value={debugRider.moral || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Sélectionner</option>
                  <option value="ELEVE">Élevé</option>
                  <option value="BON">Bon</option>
                  <option value="MOYEN">Moyen</option>
                  <option value="MAUVAIS">Mauvais</option>
                  <option value="INCONNU">Inconnu</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Santé</label>
                <select
                  name="healthCondition"
                  value={debugRider.healthCondition || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Sélectionner</option>
                  <option value="PRET_A_COURRIR">Prêt(e) à courir</option>
                  <option value="BLESSE">Blessé</option>
                  <option value="MALADIE">Maladie</option>
                  <option value="FATIGUE">Fatigue</option>
                  <option value="INCONNU">Inconnu</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Profil Qualitatif</label>
                <select
                  name="qualitativeProfile"
                  value={debugRider.qualitativeProfile || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Sélectionner</option>
                  <option value="PUNCHEUR">Puncheur</option>
                  <option value="ROULEUR">Rouleur</option>
                  <option value="COMPLET">Complet</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
            </div>

            {/* Catégories de niveau */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Catégories de Niveau</label>
              <div className="grid grid-cols-3 gap-2">
                {["Elite", "Pro", "Open 1", "Open 2", "Open 3", "Handisport"].map(level => (
                  <div key={level} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`debug-category-${level}`}
                      checked={debugRider.categories?.includes(level) || false}
                      onChange={(e) => handleCategoryChange(level, e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor={`debug-category-${level}`} className="text-sm text-gray-700">
                      {level}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-purple-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-purple-700"
              >
                Tester Sauvegarde
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderProfileDebug;
