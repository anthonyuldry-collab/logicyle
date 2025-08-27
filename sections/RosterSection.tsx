import React, { useState } from 'react';
import { Rider, RaceEvent, RiderEventSelection, RiderEventStatus, Sex } from '../types';
import SectionWrapper from '../components/SectionWrapper';
import ActionButton from '../components/ActionButton';
import { RiderDetailModal } from '../components/RiderDetailModal';
import PlusCircleIcon from '../components/icons/PlusCircleIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import EyeIcon from '../components/icons/EyeIcon';
import SearchIcon from '../components/icons/SearchIcon';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import ConfirmationModal from '../components/ConfirmationModal';
import { useTranslations } from '../hooks/useTranslations';

import { getAgeCategory } from '../utils/ageUtils';

interface RosterSectionProps {
  raceEvents: RaceEvent[];
  riders: Rider[];
  riderEventSelections: RiderEventSelection[];
  setRiderEventSelections: (selections: RiderEventSelection[]) => void;
  setRaceEvents: (events: RaceEvent[]) => void;
  appState: any;
}

export default function RosterSection({
  raceEvents,
  riders,
  riderEventSelections,
  setRiderEventSelections,
  setRaceEvents,
  appState
}: RosterSectionProps) {
  const { t } = useTranslations();

  const [activeTab, setActiveTab] = useState<'roster' | 'seasonPlanning'>('roster');
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | Sex>('all');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [riderToDelete, setRiderToDelete] = useState<Rider | null>(null);

  const openViewModal = (rider: Rider) => {
    setSelectedRider(rider);
    setIsViewModalOpen(true);
  };

  const handleDeleteRider = (rider: Rider) => {
    setRiderToDelete(rider);
    setIsDeleteModalOpen(true);
  };

  const filteredRiders = riders.filter(rider => {
    if (searchTerm) {
      const fullName = `${rider.firstName} ${rider.lastName}`.toLowerCase();
      if (!fullName.includes(searchTerm.toLowerCase())) return false;
    }
    if (genderFilter !== 'all' && rider.sex !== genderFilter) return false;
    return true;
  });

  const renderRosterTab = () => (
    <div className="bg-white p-3 rounded-lg shadow-md">
      <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="rosterSearch" className="block text-xs font-medium text-gray-700 mb-0.5">Rechercher</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <SearchIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              id="rosterSearch"
              placeholder="Rechercher un coureur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`
                block w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md 
                leading-5 bg-white text-gray-900 placeholder-gray-500 
                focus:outline-none focus:placeholder-gray-400 focus:ring-1 
                focus:ring-blue-500 focus:border-blue-500 text-xs
              `}
            />
          </div>
        </div>
        <div>
          <label htmlFor="rosterGenderFilter" className="block text-xs font-medium text-gray-700 mb-0.5">Sexe</label>
          <select
            id="rosterGenderFilter"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'all' | Sex)}
            className="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
          >
            <option value="all">Tous</option>
            <option value={Sex.MALE}>Homme</option>
            <option value={Sex.FEMALE}>Femme</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredRiders.map(rider => (
          <div key={rider.id} className="bg-gray-50 rounded-lg shadow-md overflow-hidden flex flex-col border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="p-3">
              <div className="flex items-center space-x-3">
                {rider.photoUrl ? <img src={rider.photoUrl} alt={rider.firstName} className="w-12 h-12 rounded-full object-cover"/> : <UserCircleIcon className="w-12 h-12 text-gray-400"/>}
                <div>
                  <h3 className="text-md font-semibold text-gray-800">{rider.firstName} {rider.lastName}</h3>
                  <p className="text-xs text-gray-500">{(rider as any).qualitativeProfile || 'Profil N/A'}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                <p><strong>Forme:</strong> {(rider as any).forme || '?'}</p>
                <p><strong>Moral:</strong> {(rider as any).moral || '?'}</p>
                <p><strong>Sante:</strong> {(rider as any).healthCondition || '-'}</p>
                
                {(() => {
                  const { category, age } = getAgeCategory(rider.birthDate);
                  return (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                                             <p><strong>Age:</strong> {age !== null ? `${age} ans` : '?'} <span className="text-blue-600 font-medium">({category})</span></p>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mt-auto p-2 border-t border-gray-200 flex justify-end space-x-1 bg-gray-50">
              <ActionButton onClick={() => openViewModal(rider)} variant="info" size="sm" icon={<EyeIcon className="w-4 h-4"/>} title="Voir">
                <span className="sr-only">Voir</span>
              </ActionButton>
              <ActionButton onClick={() => handleDeleteRider(rider)} variant="danger" size="sm" icon={<TrashIcon className="w-4 h-4"/>} title="Supprimer">
                <span className="sr-only">Supprimer</span>
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSeasonPlanningTab = () => (
    <div className="bg-white p-3 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Planning Previsionnel de la Saison</h3>
      <p className="text-gray-600">Fonctionnalite en cours de developpement...</p>
    </div>
  );

  return (
    <SectionWrapper 
      title="Annuaire de l'Equipe"
      actionButton={<ActionButton onClick={() => {}} icon={<PlusCircleIcon className="w-5 h-5"/>}>Ajouter Coureur</ActionButton>}
    >
      <div className="mb-2 border-b border-gray-200">
        <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Tabs">
          <button 
            onClick={() => setActiveTab('roster')} 
            className={
              activeTab === 'roster' 
                ? 'border-blue-500 text-blue-600 border-b-2 py-2 px-3 text-sm font-medium' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-3 text-sm font-medium'
            }
          >
            Effectif
          </button>
          <button 
            onClick={() => setActiveTab('seasonPlanning')} 
            className={
              activeTab === 'seasonPlanning' 
                ? 'border-blue-500 text-blue-600 border-b-2 py-2 px-3 text-sm font-medium' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-3 text-sm font-medium'
            }
          >
            Planning Saison
          </button>
        </nav>
      </div>
      
      {activeTab === 'roster' ? renderRosterTab() : renderSeasonPlanningTab()}

      {selectedRider && (
        <RiderDetailModal
          rider={selectedRider}
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          onEdit={() => setIsViewModalOpen(false)}
          onDelete={() => {
            setIsViewModalOpen(false);
            handleDeleteRider(selectedRider);
          }}
          isAdmin={true}
        />
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          setRiderToDelete(null);
        }}
        title="Confirmer la suppression"
        message="Etes-vous sur de vouloir supprimer ce coureur ? Cette action est irreversible et supprimera toutes les donnees associees."
      />
    </SectionWrapper>
  );
}
