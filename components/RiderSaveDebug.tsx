import React, { useState } from 'react';
import { Rider } from '../types';
import ActionButton from './ActionButton';
import PlusCircleIcon from './icons/PlusCircleIcon';

interface RiderSaveDebugProps {
  onSaveRider: (rider: Rider) => void;
  riders: Rider[];
}

const RiderSaveDebug: React.FC<RiderSaveDebugProps> = ({ 
  onSaveRider, 
  riders 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRider, setNewRider] = useState<Omit<Rider, 'id'>>({
    firstName: 'Test',
    lastName: 'Athlète',
    birthDate: '2000-01-01',
    sex: 'Homme',
    email: 'test@example.com',
    phone: '0123456789',
    address: {
      street: '123 Rue Test',
      city: 'Ville Test',
      postalCode: '12345',
      country: 'France'
    },
    emergencyContact: {
      name: 'Contact Urgence',
      phone: '0987654321',
      relationship: 'Parent'
    },
    categories: ['U23'],
    photoUrl: undefined,
    licenseImageUrl: undefined,
    licenseImageBase64: undefined,
    licenseImageMimeType: undefined,
    powerProfile: undefined,
    scoutingProfile: undefined,
    performanceEntries: [],
    favoriteRaces: [],
    notes: 'Athlète de test pour debug',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const handleSave = () => {
    const rider: Rider = {
      ...newRider,
      id: `debug_${Date.now()}`,
    };
    
    console.log('🚴 Tentative de sauvegarde de l\'athlète:', rider);
    console.log('📝 onSaveRider disponible:', !!onSaveRider);
    console.log('📝 Type de onSaveRider:', typeof onSaveRider);
    
    try {
      onSaveRider(rider);
      console.log('✅ onSaveRider appelé avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de l\'appel à onSaveRider:', error);
    }
    
    setIsModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewRider(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-green-800 mb-2">
        🚴 Debug Sauvegarde Athlètes
      </h3>
      
      <div className="space-y-2 mb-4">
        <p className="text-sm text-green-700">
          <strong>Athlètes existants:</strong> {riders.length}
        </p>
        <p className="text-sm text-green-700">
          <strong>onSaveRider disponible:</strong> {onSaveRider ? '✅ Oui' : '❌ Non'}
        </p>
        <p className="text-sm text-green-700">
          <strong>Type de onSaveRider:</strong> {typeof onSaveRider}
        </p>
        <p className="text-sm text-green-700">
          <strong>Fonction onSaveRider:</strong> {onSaveRider?.toString().substring(0, 100)}...
        </p>
      </div>

      <ActionButton 
        onClick={() => setIsModalOpen(true)}
        icon={<PlusCircleIcon className="w-4 h-4" />}
        size="sm"
      >
        Tester Sauvegarde Athlète
      </ActionButton>

      {/* Modal de test */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold mb-4">Test Sauvegarde Athlète</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Prénom</label>
                <input
                  type="text"
                  name="firstName"
                  value={newRider.firstName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Prénom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Nom</label>
                <input
                  type="text"
                  name="lastName"
                  value={newRider.lastName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Nom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date de naissance</label>
                <input
                  type="date"
                  name="birthDate"
                  value={newRider.birthDate}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={newRider.email}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700"
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

export default RiderSaveDebug;
