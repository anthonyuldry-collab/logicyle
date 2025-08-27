import React, { useState, useMemo } from 'react';
import { 
  UserCircleIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import SectionWrapper from '../components/SectionWrapper';
import ActionButton from '../components/ActionButton';
import { RiderDetailModal } from '../components/RiderDetailModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { Rider, RaceEvent, RiderEventSelection } from '../types';
import { getAgeCategory } from '../utils/ageUtils';

interface RosterSectionProps {
  appState: any;
  onSaveRider: (rider: Rider) => void;
}

export default function RosterSection({ appState, onSaveRider }: RosterSectionProps) {
  if (!appState) {
    return <div>Chargement...</div>;
  }

  const { riders, raceEvents, riderEventSelections } = appState;
  
  // États pour la gestion des onglets
  const [activeTab, setActiveTab] = useState<'roster' | 'seasonPlanning' | 'quality'>('roster');
  
  // États pour la recherche et les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState<string>('all');
  const [minAgeFilter, setMinAgeFilter] = useState<number>(0);
  const [maxAgeFilter, setMaxAgeFilter] = useState<number>(100);
  
  // États pour le tri
  const [rosterSortBy, setRosterSortBy] = useState<'name' | 'age' | 'category'>('name');
  const [rosterSortDirection, setRosterSortDirection] = useState<'asc' | 'desc'>('asc');
  const [planningSortBy, setPlanningSortBy] = useState<'name' | 'raceDays'>('name');
  const [planningSortDirection, setPlanningSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // États pour la gestion des modales
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [riderToDelete, setRiderToDelete] = useState<Rider | null>(null);

  // Fonction pour ouvrir la modale d'édition
  const openEditModal = (rider: Rider) => {
    setSelectedRider(rider);
    setIsEditModalOpen(true);
  };

  // Fonction pour ouvrir la modale de visualisation
  const openViewModal = (rider: Rider) => {
    setSelectedRider(rider);
    setIsViewModalOpen(true);
  };

  // Fonction pour gérer la suppression
  const handleDeleteRider = (rider: Rider) => {
    setRiderToDelete(rider);
    setIsDeleteModalOpen(true);
  };

  // Fonction pour le tri de l'effectif
  const handleRosterSort = (field: 'name' | 'age' | 'category') => {
    if (rosterSortBy === field) {
      setRosterSortDirection(rosterSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setRosterSortBy(field);
      setRosterSortDirection('asc');
    }
  };

  // Fonction pour le tri du planning
  const handlePlanningSort = (field: 'name' | 'raceDays') => {
    if (planningSortBy === field) {
      setPlanningSortDirection(planningSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPlanningSortBy(field);
      setPlanningSortDirection('asc');
    }
  };

  // Calcul des coureurs triés et filtrés pour l'effectif
  const sortedRidersForAdmin = useMemo(() => {
    let filtered = riders.filter(rider => {
      const matchesSearch = rider.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           rider.lastName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGender = genderFilter === 'all' || rider.gender === genderFilter;
      
      const { age } = getAgeCategory(rider.birthDate);
      const matchesAge = age !== null && age >= minAgeFilter && age <= maxAgeFilter;
      
      const matchesCategory = ageCategoryFilter === 'all' || 
                             (age !== null && getAgeCategory(rider.birthDate).category === ageCategoryFilter);
      
      return matchesSearch && matchesGender && matchesAge && matchesCategory;
    });

    // Tri
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (rosterSortBy) {
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'age':
          aValue = getAgeCategory(a.birthDate).age || 0;
          bValue = getAgeCategory(b.birthDate).age || 0;
          break;
        case 'category':
          aValue = getAgeCategory(a.birthDate).category;
          bValue = getAgeCategory(b.birthDate).category;
          break;
        default:
          return 0;
      }
      
      if (rosterSortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [riders, searchTerm, genderFilter, ageCategoryFilter, minAgeFilter, maxAgeFilter, rosterSortBy, rosterSortDirection]);

  // Calcul des jours de course par coureur
  const raceDaysByRider = useMemo(() => {
    const riderRaceDays = new Map<string, { raceDays: number; events: RaceEvent[] }>();
    
    riders.forEach(rider => {
      const riderEvents = riderEventSelections
        .filter(selection => selection.riderId === rider.id)
        .map(selection => raceEvents.find(event => event.id === selection.eventId))
        .filter(Boolean) as RaceEvent[];
      
      const uniqueDays = new Set(riderEvents.map(event => event.date)).size;
      
      riderRaceDays.set(rider.id, {
        raceDays: uniqueDays,
        events: riderEvents
      });
    });
    
    return riderRaceDays;
  }, [riders, raceEvents, riderEventSelections]);

  // Calcul des coureurs triés pour le planning
  const sortedRidersForPlanning = useMemo(() => {
    const ridersWithRaceDays = riders.map(rider => {
      const { raceDays, events } = raceDaysByRider.get(rider.id) || { raceDays: 0, events: [] };
      return { rider, raceDays, events };
    });

    // Tri
    ridersWithRaceDays.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (planningSortBy) {
        case 'name':
          aValue = `${a.rider.firstName} ${a.rider.lastName}`.toLowerCase();
          bValue = `${b.rider.firstName} ${b.rider.lastName}`.toLowerCase();
          break;
        case 'raceDays':
          aValue = a.raceDays;
          bValue = b.raceDays;
          break;
        default:
          return 0;
      }
      
      if (planningSortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return ridersWithRaceDays;
  }, [riders, raceDaysByRider, planningSortBy, planningSortDirection]);

  // État pour le tri de l'onglet Qualité
  const [qualitySortField, setQualitySortField] = useState<string>('generalScore');
  const [qualitySortDirection, setQualitySortDirection] = useState<'asc' | 'desc'>('desc');

  // Fonction de tri pour l'onglet Qualité
  const handleQualitySort = (field: string) => {
    if (qualitySortField === field) {
      setQualitySortDirection(qualitySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setQualitySortField(field);
      setQualitySortDirection('desc');
    }
  };

  // Rendu de l'onglet Effectif
  const renderRosterTab = () => (
    <div className="space-y-4">
      {/* Contrôles de recherche et filtres */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Recherche */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un coureur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Filtre genre */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'all' | 'male' | 'female')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tous les genres</option>
            <option value="male">Hommes</option>
            <option value="female">Femmes</option>
          </select>
          
          {/* Filtre catégorie d'âge */}
          <select
            value={ageCategoryFilter}
            onChange={(e) => setAgeCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Toutes catégories</option>
            <option value="U17">U17</option>
            <option value="U19">U19</option>
            <option value="U23">U23</option>
            <option value="Elite">Elite</option>
          </select>
          
          {/* Filtre âge */}
          <div className="flex space-x-2">
            <input
              type="number"
              placeholder="Âge min"
              value={minAgeFilter}
              onChange={(e) => setMinAgeFilter(Number(e.target.value))}
              className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="Âge max"
              value={maxAgeFilter}
              onChange={(e) => setMaxAgeFilter(Number(e.target.value))}
              className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Contrôles de tri */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700 mr-2">Trier par:</span>
          <button
            onClick={() => handleRosterSort('name')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              rosterSortBy === 'name' 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Nom {rosterSortBy === 'name' && (rosterSortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleRosterSort('age')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              rosterSortBy === 'age' 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Âge {rosterSortBy === 'age' && (rosterSortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleRosterSort('category')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              rosterSortBy === 'category' 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Catégorie {rosterSortBy === 'category' && (rosterSortDirection === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Liste des coureurs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coureur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRidersForAdmin.map((rider) => {
                const { category, age } = getAgeCategory(rider.birthDate);
                
                return (
                  <tr key={rider.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {rider.photoUrl ? (
                          <img src={rider.photoUrl} alt={rider.firstName} className="w-10 h-10 rounded-full mr-4"/>
                        ) : (
                          <UserCircleIcon className="w-10 h-10 text-gray-400 mr-4"/>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rider.firstName} {rider.lastName}</div>
                          <div className="text-sm text-gray-500">{age !== null ? `${age} ans` : 'Âge inconnu'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <ActionButton 
                          onClick={() => openViewModal(rider)} 
                          variant="info" 
                          size="sm" 
                          icon={<EyeIcon className="w-4 h-4"/>} 
                          title="Voir"
                        >
                          <span className="sr-only">Voir</span>
                        </ActionButton>
                        <ActionButton 
                          onClick={() => openEditModal(rider)} 
                          variant="warning" 
                          size="sm" 
                          icon={<PencilIcon className="w-4 h-4"/>} 
                          title="Modifier"
                        >
                          <span className="sr-only">Modifier</span>
                        </ActionButton>
                        <ActionButton 
                          onClick={() => handleDeleteRider(rider)} 
                          variant="danger" 
                          size="sm" 
                          icon={<TrashIcon className="w-4 h-4"/>} 
                          title="Supprimer"
                        >
                          <span className="sr-only">Supprimer</span>
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Rendu de l'onglet Planning de Saison
  const renderSeasonPlanningTab = () => (
    <div className="bg-white p-3 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Planning Previsionnel de la Saison</h3>
      
      {/* Contrôles de tri pour le planning */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-xs font-medium text-gray-700 mr-2">Trier par:</span>
        <button
          onClick={() => handlePlanningSort('name')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            planningSortBy === 'name' 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Nom {planningSortBy === 'name' && (planningSortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handlePlanningSort('raceDays')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            planningSortBy === 'raceDays' 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Jours de Course {planningSortBy === 'raceDays' && (planningSortDirection === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Tableau du planning */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Coureur</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Categorie</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Jours de Course</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Evenements</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Forme</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedRidersForPlanning.map(({ rider, raceDays, events }) => {
              const { category, age } = getAgeCategory(rider.birthDate);
              const forme = (rider as any).forme || 'Non defini';
              
              return (
                <tr key={rider.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {rider.photoUrl ? (
                        <img src={rider.photoUrl} alt={rider.firstName} className="w-8 h-8 rounded-full mr-3"/>
                      ) : (
                        <UserCircleIcon className="w-8 h-8 text-gray-400 mr-3"/>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{rider.firstName} {rider.lastName}</div>
                        <div className="text-sm text-gray-500">{age !== null ? `${age} ans` : 'Age inconnu'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {category}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      raceDays === 0 ? 'bg-gray-100 text-gray-600' :
                      raceDays <= 2 ? 'bg-green-100 text-green-600' :
                      raceDays <= 5 ? 'bg-yellow-100 text-yellow-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {raceDays} jour(s)
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      {events.slice(0, 2).map(event => (
                        <div key={event.id} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {event.name}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <p className="text-xs text-blue-600">+{events.length - 2} autres</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      forme === 'Excellente' ? 'text-green-600 bg-green-100' :
                      forme === 'Bonne' ? 'text-green-700 bg-green-50' :
                      forme === 'Moyenne' ? 'text-yellow-600 bg-yellow-100' :
                      forme === 'Faible' ? 'text-red-600 bg-red-100' :
                      'text-gray-600 bg-gray-100'
                    }`}>
                      {forme}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-1">
                      <ActionButton 
                        onClick={() => openViewModal(rider)} 
                        variant="info" 
                        size="sm" 
                        icon={<EyeIcon className="w-4 h-4"/>} 
                        title="Voir"
                      >
                        <span className="sr-only">Voir</span>
                      </ActionButton>
                      <ActionButton 
                        onClick={() => openEditModal(rider)} 
                        variant="warning" 
                        size="sm" 
                        icon={<PencilIcon className="w-4 h-4"/>} 
                        title="Modifier"
                      >
                        <span className="sr-only">Modifier</span>
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Statistiques du planning */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">Repartition des Charges</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>0-2 courses:</span>
              <span className="font-medium">{sortedRidersForPlanning.filter(r => r.raceDays <= 2).length} coureurs</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>3-5 courses:</span>
              <span className="font-medium">{sortedRidersForPlanning.filter(r => r.raceDays >= 3 && r.raceDays <= 5).length} coureurs</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>6+ courses:</span>
              <span className="font-medium">{sortedRidersForPlanning.filter(r => r.raceDays >= 6).length} coureurs</span>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="text-sm font-semibold text-green-800 mb-2">Coureurs les Plus Actifs</h4>
          <div className="space-y-1">
            {sortedRidersForPlanning
              .filter(r => r.raceDays > 0)
              .slice(0, 3)
              .map(({ rider, raceDays }) => (
                <div key={rider.id} className="flex justify-between text-xs">
                  <span>{rider.firstName} {rider.lastName}</span>
                  <span className="font-medium text-green-600">{raceDays} courses</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h4 className="text-sm font-semibold text-purple-800 mb-2">Total des Evenements</h4>
          <div className="text-2xl font-bold text-purple-600">
            {sortedRidersForPlanning.reduce((total, r) => total + r.events.length, 0)}
          </div>
          <p className="text-xs text-purple-600 mt-1">evenements planifies</p>
        </div>
      </div>
    </div>
  );

  // Rendu de l'onglet Qualité d'Effectif
  const renderQualityTab = () => {
    // Algorithme de profilage Coggan Expert - Note générale = moyenne simple de toutes les données
    const calculateCogganProfileScore = (rider: Rider) => {
      const powerProfile = (rider as any).powerProfileFresh || {};
      const weight = (rider as any).weightKg || 70; // Poids par défaut si non défini
      
      // Calcul des puissances relatives (W/kg) pour chaque durée
      const power1s = (powerProfile.power1s || 0) / weight;
      const power5s = (powerProfile.power5s || 0) / weight;
      const power30s = (powerProfile.power30s || 0) / weight;
      const power1min = (powerProfile.power1min || 0) / weight;
      const power3min = (powerProfile.power3min || 0) / weight;
      const power5min = (powerProfile.power5min || 0) / weight;
      const power12min = (powerProfile.power12min || 0) / weight;
      const power20min = (powerProfile.power20min || 0) / weight;
      const criticalPower = (powerProfile.criticalPower || 0) / weight;
      
      // Références Coggan pour un athlète "ultime" (100/100)
      const cogganUltimate = {
        power1s: 25.0,    // 25 W/kg - Sprint ultime
        power5s: 18.0,    // 18 W/kg - Anaérobie ultime
        power30s: 12.0,   // 12 W/kg - Puissance critique ultime
        power1min: 8.5,   // 8.5 W/kg - Endurance anaérobie ultime
        power3min: 7.0,   // 7.0 W/kg - Seuil anaérobie ultime
        power5min: 6.5,   // 6.5 W/kg - Seuil fonctionnel ultime
        power12min: 5.8,  // 5.8 W/kg - FTP ultime
        power20min: 5.5,  // 5.5 W/kg - Endurance critique ultime
        criticalPower: 5.5 // 5.5 W/kg - CP ultime
      };
      
      // Calcul des scores par durée (0-100)
      const getDurationScore = (actual: number, ultimate: number) => {
        if (actual >= ultimate) return 100;
        return Math.max(0, Math.round((actual / ultimate) * 100));
      };
      
      const scores = {
        power1s: getDurationScore(power1s, cogganUltimate.power1s),
        power5s: getDurationScore(power5s, cogganUltimate.power5s),
        power30s: getDurationScore(power30s, cogganUltimate.power30s),
        power1min: getDurationScore(power1min, cogganUltimate.power1min),
        power3min: getDurationScore(power3min, cogganUltimate.power3min),
        power5min: getDurationScore(power5min, cogganUltimate.power5min),
        power12min: getDurationScore(power12min, cogganUltimate.power12min),
        power20min: getDurationScore(power20min, cogganUltimate.power20min),
        criticalPower: getDurationScore(criticalPower, cogganUltimate.criticalPower)
      };
      
      // Note générale = moyenne simple de toutes les données de puissance
      const generalScore = Math.round(
        Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length
      );
      
      // Calcul des catégories spécifiques
      const sprintScore = Math.round((scores.power1s + scores.power5s) / 2); // 1s + 5s
      const montagneScore = Math.round((scores.power5min + scores.power12min + scores.power20min) / 3); // 5min + 12min + 20min
      const puncheurScore = Math.round((scores.power30s + scores.power1min + scores.power3min) / 3); // 30s + 1min + 3min
      const rouleurScore = Math.round((scores.power12min + scores.power20min + scores.criticalPower) / 3); // 12min + 20min + CP
      const resistanceScore = Math.round((scores.power20min + scores.criticalPower) / 2); // Résistance à la fatigue
      
      return {
        generalScore,
        sprintScore,
        montagneScore,
        puncheurScore,
        rouleurScore,
        resistanceScore,
        scores,
        powerProfile: {
          power1s, power5s, power30s, power1min, power3min, 
          power5min, power12min, power20min, criticalPower
        }
      };
    };

    return (
      <div className="space-y-6">
        {/* Métriques globales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg shadow-lg text-white">
            <div className="text-center">
              <h4 className="text-sm font-medium opacity-90">Total Effectif</h4>
              <p className="text-3xl font-bold">{riders.length}</p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 rounded-lg shadow-lg text-white">
            <div className="text-center">
              <h4 className="text-sm font-medium opacity-90">Élite (90+ pts)</h4>
              <p className="text-3xl font-bold">
                {riders.filter(r => {
                  const profile = calculateCogganProfileScore(r);
                  return profile.generalScore >= 90;
                }).length}
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-4 rounded-lg shadow-lg text-white">
            <div className="text-center">
              <h4 className="text-sm font-medium opacity-90">Compétitif (70-89)</h4>
              <p className="text-3xl font-bold">
                {riders.filter(r => {
                  const profile = calculateCogganProfileScore(r);
                  return profile.generalScore >= 70 && profile.generalScore < 90;
                }).length}
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-lg shadow-lg text-white">
            <div className="text-center">
              <h4 className="text-sm font-medium opacity-90">Moyenne Score</h4>
              <p className="text-3xl font-bold">
                {Math.round(riders.reduce((sum, r) => {
                  const profile = calculateCogganProfileScore(r);
                  return sum + profile.generalScore;
                }, 0) / riders.length)}
              </p>
            </div>
          </div>
        </div>

        {/* Tableau de pilotage style Pro Cycling Manager */}
        <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
            <h3 className="text-xl font-bold text-white">
              Qualité d'Effectif - Profilage Coggan Expert
            </h3>
            <p className="text-sm text-gray-300 mt-1">Note générale = moyenne simple de toutes les données de puissance • 100/100 = Athlète ultime</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Coureur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Âge</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">MOY</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">SPR</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">MON</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">PUN</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">ROU</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">RES</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {riders.map((rider) => {
                  const { category, age } = getAgeCategory(rider.birthDate);
                  const cogganProfile = calculateCogganProfileScore(rider);
                  
                  return (
                    <tr key={rider.id} className="hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {rider.photoUrl ? (
                            <img src={rider.photoUrl} alt={rider.firstName} className="w-10 h-10 rounded-full mr-4"/>
                          ) : (
                            <UserCircleIcon className="w-10 h-10 text-gray-400 mr-4"/>
                          )}
                          <div>
                            <div className="text-sm font-medium text-white">{rider.firstName} {rider.lastName}</div>
                            <div className="text-sm text-gray-400">{category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {age !== null ? `${age} ans` : 'Âge inconnu'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${
                          cogganProfile.generalScore >= 90 ? 'text-green-400' :
                          cogganProfile.generalScore >= 80 ? 'text-blue-400' :
                          cogganProfile.generalScore >= 70 ? 'text-yellow-400' :
                          cogganProfile.generalScore >= 60 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {cogganProfile.generalScore}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${
                          cogganProfile.sprintScore >= 90 ? 'text-green-400' :
                          cogganProfile.sprintScore >= 80 ? 'text-blue-400' :
                          cogganProfile.sprintScore >= 70 ? 'text-yellow-400' :
                          cogganProfile.sprintScore >= 60 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {cogganProfile.sprintScore}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${
                          cogganProfile.montagneScore >= 90 ? 'text-green-400' :
                          cogganProfile.montagneScore >= 80 ? 'text-blue-400' :
                          cogganProfile.montagneScore >= 70 ? 'text-yellow-400' :
                          cogganProfile.montagneScore >= 60 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {cogganProfile.montagneScore}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${
                          cogganProfile.puncheurScore >= 90 ? 'text-green-400' :
                          cogganProfile.puncheurScore >= 80 ? 'text-blue-400' :
                          cogganProfile.puncheurScore >= 70 ? 'text-yellow-400' :
                          cogganProfile.puncheurScore >= 60 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {cogganProfile.puncheurScore}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${
                          cogganProfile.rouleurScore >= 90 ? 'text-green-400' :
                          cogganProfile.rouleurScore >= 80 ? 'text-blue-400' :
                          cogganProfile.rouleurScore >= 70 ? 'text-yellow-400' :
                          cogganProfile.rouleurScore >= 60 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {cogganProfile.rouleurScore}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${
                          cogganProfile.resistanceScore >= 90 ? 'text-green-400' :
                          cogganProfile.resistanceScore >= 80 ? 'text-blue-400' :
                          cogganProfile.resistanceScore >= 70 ? 'text-yellow-400' :
                          cogganProfile.resistanceScore >= 60 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {cogganProfile.resistanceScore}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <ActionButton 
                            onClick={() => openViewModal(rider)} 
                            variant="info" 
                            size="sm" 
                            icon={<EyeIcon className="w-4 h-4"/>} 
                            title="Voir"
                          >
                            <span className="sr-only">Voir</span>
                          </ActionButton>
                          <ActionButton 
                            onClick={() => openEditModal(rider)} 
                            variant="warning" 
                            size="sm" 
                            icon={<PencilIcon className="w-4 h-4"/>} 
                            title="Modifier"
                          >
                            <span className="sr-only">Modifier</span>
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Légende des catégories */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
          <h4 className="text-sm font-semibold text-white mb-3">Légende des Catégories</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-300">
            <div>
              <p><strong className="text-green-400">MOY :</strong> Note générale (moyenne de toutes les puissances)</p>
              <p><strong className="text-green-400">SPR :</strong> Sprint (1s + 5s) - Puissance anaérobie</p>
              <p><strong className="text-green-400">MON :</strong> Montagne (5min + 12min + 20min) - Endurance</p>
            </div>
            <div>
              <p><strong className="text-green-400">PUN :</strong> Puncheur (30s + 1min + 3min) - Puissance critique</p>
              <p><strong className="text-green-400">ROU :</strong> Rouleur (12min + 20min + CP) - FTP</p>
              <p><strong className="text-green-400">RES :</strong> Résistance (20min + CP) - Fatigue</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Fonction de fusion des profils par email
  const mergeDuplicateProfiles = () => {
    const emailGroups = new Map<string, Rider[]>();
    
    // Grouper les coureurs par email
    riders.forEach(rider => {
      if (rider.email) {
        if (!emailGroups.has(rider.email)) {
          emailGroups.set(rider.email, []);
        }
        emailGroups.get(rider.email)!.push(rider);
      }
    });
    
    // Trouver les groupes avec plusieurs profils
    const duplicates = Array.from(emailGroups.entries())
      .filter(([email, profiles]) => profiles.length > 1)
      .map(([email, profiles]) => ({ email, profiles }));
    
    if (duplicates.length === 0) {
      alert("Aucun profil en double trouvé !");
      return;
    }
    
    console.log("Profils en double trouvés:", duplicates);
    
    // Pour chaque groupe de doublons, garder le profil le plus complet
    duplicates.forEach(({ email, profiles }) => {
      // Trier par "complétude" (nombre de propriétés non vides)
      const sortedProfiles = profiles.sort((a, b) => {
        const aCompleteness = Object.values(a).filter(v => v !== undefined && v !== null && v !== '').length;
        const bCompleteness = Object.values(b).filter(v => v !== undefined && v !== null && v !== '').length;
        return bCompleteness - aCompleteness; // Plus complet en premier
      });
      
      const primaryProfile = sortedProfiles[0];
      const duplicateProfiles = sortedProfiles.slice(1);
      
      console.log(`Fusion du profil principal ${primaryProfile.firstName} ${primaryProfile.lastName} avec:`, duplicateProfiles.map(p => `${p.firstName} ${p.lastName}`));
      
      // Ici vous pourriez implémenter la logique de fusion dans Firebase
      // Pour l'instant, on affiche juste les informations
    });
    
    alert(`${duplicates.length} groupe(s) de profils en double trouvé(s). Vérifiez la console pour les détails.`);
  };

  return (
    <SectionWrapper 
      title="Annuaire de l'Equipe"
      actionButton={
        <div className="flex space-x-2">
          <ActionButton onClick={mergeDuplicateProfiles} variant="secondary" icon={<UserGroupIcon className="w-5 h-5"/>}>
            Fusionner Doublons
          </ActionButton>
          <ActionButton onClick={() => {}} icon={<PlusCircleIcon className="w-5 h-5"/>}>
            Ajouter Coureur
          </ActionButton>
        </div>
      }
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
          <button 
            onClick={() => setActiveTab('quality')} 
            className={
              activeTab === 'quality' 
                ? 'border-blue-500 text-blue-600 border-b-2 py-2 px-3 text-sm font-medium' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-3 text-sm font-medium'
            }
          >
            Qualite d'Effectif
          </button>
        </nav>
      </div>
      
      {activeTab === 'roster' ? renderRosterTab() : 
       activeTab === 'seasonPlanning' ? renderSeasonPlanningTab() : 
       activeTab === 'quality' ? renderQualityTab() : 
       renderRosterTab()}

      {/* Modal unique pour vue et édition */}
      {selectedRider && (
        <RiderDetailModal
          rider={selectedRider}
          isOpen={isViewModalOpen || isEditModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setIsEditModalOpen(false);
          }}
          onEdit={() => {
            setIsViewModalOpen(false);
            setIsEditModalOpen(true);
          }}
          onDelete={() => {
            setIsViewModalOpen(false);
            setIsEditModalOpen(false);
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
