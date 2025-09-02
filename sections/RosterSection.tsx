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
import { saveData, deleteData } from '../services/firebaseService';
import { Rider, RaceEvent, RiderEventSelection, FormeStatus, Sex, RiderQualitativeProfile, MoralStatus, HealthCondition, RiderEventStatus } from '../types';
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
  
  // Vérifications de sécurité pour éviter les erreurs undefined
  if (!riders || !Array.isArray(riders)) {
    return <div>Erreur: Données des athlètes non disponibles</div>;
  }
  
  if (!raceEvents || !Array.isArray(raceEvents)) {
    return <div>Erreur: Données des événements non disponibles</div>;
  }
  
  if (!riderEventSelections || !Array.isArray(riderEventSelections)) {
    return <div>Erreur: Données des sélections non disponibles</div>;
  }
  
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

  // Fonction pour ajouter un nouveau coureur
  const openAddRiderModal = () => {
    const newRider: Rider = {
      id: `rider_${Date.now()}`,
      firstName: '',
      lastName: '',
      email: '',
      birthDate: new Date().toISOString().split('T')[0],
      sex: Sex.MALE,
      photoUrl: '',
      weightKg: 70,
      heightCm: 170,
      powerProfileFresh: {},
      forme: FormeStatus.INCONNU,
      moral: MoralStatus.INCONNU,
      healthCondition: HealthCondition.INCONNU,
      qualitativeProfile: RiderQualitativeProfile.AUTRE,
      disciplines: [],
      categories: [],
      favoriteRaces: [],
      resultsHistory: [],
      allergies: [],
      performanceNutrition: {
        carbsPerHourTarget: 0,
        hydrationNotes: '',
        selectedGels: [],
        selectedBars: [],
        selectedDrinks: [],
        customProducts: []
      },
      roadBikeSetup: {
        specifics: {
          tailleCadre: '',
          cintre: '',
          potence: '',
          plateau: '',
          manivelle: '',
          capteurPuissance: ''
        },
        cotes: {
          hauteurSelle: '',
          reculSelle: '',
          longueurBecSelleAxeCintre: '',
          hauteurGuidonAxeRoueCentreCintre: ''
        }
      },
      ttBikeSetup: {
        specifics: {
          tailleCadre: '',
          cintre: '',
          potence: '',
          plateau: '',
          manivelle: '',
          capteurPuissance: ''
        },
        cotes: {
          hauteurSelle: '',
          reculSelle: '',
          longueurBecSelleAxeCintre: '',
          hauteurGuidonAxeRoueCentreCintre: ''
        }
      },
      clothing: [],
      performanceGoals: '',
      physiquePerformanceProject: {
        forces: '',
        aOptimiser: '',
        aDevelopper: '',
        besoinsActions: ''
      },
      techniquePerformanceProject: {
        forces: '',
        aOptimiser: '',
        aDevelopper: '',
        besoinsActions: ''
      },
      mentalPerformanceProject: {
        forces: '',
        aOptimiser: '',
        aDevelopper: '',
        besoinsActions: ''
      },
      environnementPerformanceProject: {
        forces: '',
        aOptimiser: '',
        aDevelopper: '',
        besoinsActions: ''
      },
      tactiquePerformanceProject: {
        forces: '',
        aOptimiser: '',
        aDevelopper: '',
        besoinsActions: ''
      },
      charSprint: 0,
      charAnaerobic: 0,
      charPuncher: 0,
      charClimbing: 0,
      charRouleur: 0,
      generalPerformanceScore: 0,
      fatigueResistanceScore: 0
    };
    setSelectedRider(newRider);
    setIsEditModalOpen(true);
  };

  // Fonction pour gérer la sauvegarde d'un coureur
  const handleSaveRider = (rider: Rider) => {
    try {
      onSaveRider(rider);
      setIsEditModalOpen(false);
      setSelectedRider(null);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du coureur');
    }
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
    // Debug: Afficher tous les coureurs et leurs données
    console.log('=== DEBUG EFFECTIF ===');
    console.log('Total coureurs:', riders.length);
    console.log('Filtres actifs:', { searchTerm, genderFilter, ageCategoryFilter, minAgeFilter, maxAgeFilter });
    
    riders.forEach((rider, index) => {
      const { age, category } = getAgeCategory(rider.birthDate);
      console.log(`Coureur ${index + 1}:`, {
        id: rider.id,
        nom: `${rider.firstName} ${rider.lastName}`,
        email: rider.email,
        sex: rider.sex,
        age,
        category,
        matchesSearch: rider.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      rider.lastName.toLowerCase().includes(searchTerm.toLowerCase()),
        matchesGender: genderFilter === 'all' || rider.sex === genderFilter,
        matchesAge: age !== null && age >= minAgeFilter && age <= maxAgeFilter,
        matchesCategory: ageCategoryFilter === 'all' || (age !== null && category === ageCategoryFilter)
      });
    });
    
    let filtered = riders.filter(rider => {
      const matchesSearch = rider.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           rider.lastName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGender = genderFilter === 'all' || rider.sex === genderFilter;
      
      const { age } = getAgeCategory(rider.birthDate);
      const matchesAge = age !== null && age >= minAgeFilter && age <= maxAgeFilter;
      
      const matchesCategory = ageCategoryFilter === 'all' || 
                             (age !== null && getAgeCategory(rider.birthDate).category === ageCategoryFilter);
      
      return matchesSearch && matchesGender && matchesAge && matchesCategory;
    });
    
    console.log('Coureurs filtrés:', filtered.length);
    console.log('=== FIN DEBUG ===');

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

  // Fonction pour obtenir les coureurs triés selon la qualité
  const getSortedRidersForQuality = () => {
    return [...riders].sort((a, b) => {
      const profileA = calculateCogganProfileScore(a);
      const profileB = calculateCogganProfileScore(b);
      
      let valueA: number;
      let valueB: number;
      
      switch (qualitySortField) {
        case 'generalScore':
          valueA = profileA.generalScore;
          valueB = profileB.generalScore;
          break;
        case 'sprintScore':
          valueA = profileA.sprintScore;
          valueB = profileB.sprintScore;
          break;
        case 'montagneScore':
          valueA = profileA.montagneScore;
          valueB = profileB.montagneScore;
          break;
        case 'puncheurScore':
          valueA = profileA.puncheurScore;
          valueB = profileB.puncheurScore;
          break;
        case 'rouleurScore':
          valueA = profileA.rouleurScore;
          valueB = profileB.rouleurScore;
          break;
        case 'resistanceScore':
          valueA = profileA.resistanceScore;
          valueB = profileB.resistanceScore;
          break;
        default:
          valueA = profileA.generalScore;
          valueB = profileB.generalScore;
      }
      
      if (qualitySortDirection === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
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
          
          {/* Bouton de diagnostic pour l'onglet Effectif */}
          <button
            onClick={() => {
              console.log('=== DIAGNOSTIC ONGLET EFFECTIF ===');
              console.log('Total coureurs:', riders.length);
              console.log('Filtres actifs:', {
                searchTerm,
                genderFilter,
                ageCategoryFilter,
                minAgeFilter,
                maxAgeFilter
              });
              
              // Recherche spécifique du coureur mmisyurina@gmail.com
              const coureurRecherche = riders.find(rider => rider.email === 'mmisyurina@gmail.com');
              if (coureurRecherche) {
                console.log('🎯 COUREUR TROUVÉ:', coureurRecherche);
                const { age, category } = getAgeCategory(coureurRecherche.birthDate);
                console.log('📊 ANALYSE DU COUREUR:', {
                  id: coureurRecherche.id,
                  nom: `${coureurRecherche.firstName} ${coureurRecherche.lastName}`,
                  email: coureurRecherche.email,
                  sex: coureurRecherche.sex,
                  birthDate: coureurRecherche.birthDate,
                  age,
                  category
                });
                
                // Vérification de la visibilité dans l'onglet Effectif
                const isVisibleInRoster = sortedRidersForAdmin.some(rider => rider.id === coureurRecherche.id);
                console.log('🎯 VISIBILITÉ DANS EFFECTIF:', isVisibleInRoster ? '✅ VISIBLE' : '❌ MASQUÉ');
                
                if (!isVisibleInRoster) {
                  console.log('🚨 RAISONS DU MASQUAGE:');
                  console.log('- Filtre recherche:', searchTerm);
                  console.log('- Filtre genre:', genderFilter);
                  console.log('- Filtre âge:', `${minAgeFilter}-${maxAgeFilter}`);
                  console.log('- Filtre catégorie:', ageCategoryFilter);
                }
              } else {
                console.log('❌ COUREUR mmisyurina@gmail.com NON TROUVÉ dans riders');
              }
              
              // Affichage des coureurs filtrés
              console.log('Coureurs filtrés:', sortedRidersForAdmin.length);
              console.log('Coureurs visibles:', sortedRidersForAdmin.map(r => `${r.firstName} ${r.lastName}`));
              
              console.log('=== FIN DIAGNOSTIC EFFECTIF ===');
            }}
            className="px-3 py-1 text-sm rounded-md bg-yellow-100 text-yellow-700 border border-yellow-300 hover:bg-yellow-200"
          >
            🔍 Diagnostic Effectif
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

  // Calcul des données de monitoring de groupe (au niveau du composant)
  const groupMonitoringData = useMemo(() => {
    const eventSelections = raceEvents.map(event => ({
      event,
      selectedRiders: riders.filter(rider => event.selectedRiderIds?.includes(rider.id)),
      selectedStaff: appState.staff.filter(staffMember => event.selectedStaffIds?.includes(staffMember.id))
    }));

    // Calcul des blocs de course (événements consécutifs)
    const courseBlocks = [];
    const sortedEvents = [...raceEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentBlock = [];
    for (let i = 0; i < sortedEvents.length; i++) {
      const currentEvent = sortedEvents[i];
      const nextEvent = sortedEvents[i + 1];
      
      currentBlock.push(currentEvent);
      
      // Si c'est le dernier événement ou s'il y a plus de 7 jours entre les événements
      if (!nextEvent || 
          (new Date(nextEvent.date).getTime() - new Date(currentEvent.endDate || currentEvent.date).getTime()) > 7 * 24 * 60 * 60 * 1000) {
        if (currentBlock.length > 0) {
          courseBlocks.push([...currentBlock]);
          currentBlock = [];
        }
      }
    }

    return { eventSelections, courseBlocks };
  }, [raceEvents, riders, appState.staff]);

  // Rendu de l'onglet Planning de Saison - Version avec monitoring de groupe
  const renderSeasonPlanningTab = () => {
    // Filtrer les événements futurs uniquement
    const futureEvents = raceEvents.filter(event => {
      const eventDate = new Date(event.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today;
    });

    // Fonction pour ajouter automatiquement un athlète à un événement avec un statut
    const addRiderToEvent = async (eventId: string, riderId: string, status: RiderEventStatus = RiderEventStatus.TITULAIRE) => {
      try {
        const newSelection: RiderEventSelection = {
          id: `${eventId}_${riderId}_${Date.now()}`,
          eventId: eventId,
          riderId: riderId,
          status: status,
          riderPreference: undefined,
          riderObjectives: undefined,
          notes: undefined
        };

        // Sauvegarder dans Firebase si on a un teamId
        if (appState.activeTeamId) {
          const savedId = await saveData(
            appState.activeTeamId,
            "riderEventSelections",
            newSelection
          );
          newSelection.id = savedId;
          console.log('✅ Sélection d\'athlète sauvegardée dans Firebase avec l\'ID:', savedId);
        } else {
          console.warn('⚠️ Aucun teamId actif, sauvegarde locale uniquement');
        }

        // Mettre à jour l'état local
        const updatedSelections = [...appState.riderEventSelections, newSelection];
        appState.setRiderEventSelections?.(updatedSelections);

        // Mettre à jour l'événement avec le nouvel athlète sélectionné
        const event = raceEvents.find(e => e.id === eventId);
        if (event) {
          const updatedEvent = {
            ...event,
            selectedRiderIds: [...(event.selectedRiderIds || []), riderId]
          };
          appState.setRaceEvents?.(updatedEvent);
        }

        console.log(`✅ Athlète ${riderId} ajouté à l'événement ${eventId} avec le statut ${status}`);
      } catch (error) {
        console.error('❌ Erreur lors de l\'ajout de l\'athlète:', error);
        alert('Erreur lors de l\'ajout de l\'athlète. Veuillez réessayer.');
      }
    };

    // Fonction pour changer le statut d'un athlète pour un événement
    const updateRiderEventStatus = async (eventId: string, riderId: string, newStatus: RiderEventStatus) => {
      try {
        const existingSelection = appState.riderEventSelections.find(
          sel => sel.eventId === eventId && sel.riderId === riderId
        );

        if (existingSelection) {
          const updatedSelection = { ...existingSelection, status: newStatus };

          // Sauvegarder dans Firebase si on a un teamId
          if (appState.activeTeamId) {
            await saveData(
              appState.activeTeamId,
              "riderEventSelections",
              updatedSelection
            );
            console.log('✅ Statut de sélection mis à jour dans Firebase');
          } else {
            console.warn('⚠️ Aucun teamId actif, sauvegarde locale uniquement');
          }

          // Mettre à jour l'état local
          const updatedSelections = appState.riderEventSelections.map(sel =>
            sel.id === existingSelection.id ? updatedSelection : sel
          );
          appState.setRiderEventSelections?.(updatedSelections);

          console.log(`✅ Statut de l'athlète ${riderId} mis à jour vers ${newStatus}`);
        }
      } catch (error) {
        console.error('❌ Erreur lors de la mise à jour du statut:', error);
        alert('Erreur lors de la mise à jour du statut. Veuillez réessayer.');
      }
    };

    // Fonction pour retirer un athlète d'un événement
    const removeRiderFromEvent = async (eventId: string, riderId: string) => {
      try {
        const existingSelection = appState.riderEventSelections.find(
          sel => sel.eventId === eventId && sel.riderId === riderId
        );

        if (existingSelection) {
          // Supprimer de Firebase si on a un teamId
          if (appState.activeTeamId) {
            await deleteData(
              appState.activeTeamId,
              "riderEventSelections",
              existingSelection.id
            );
            console.log('✅ Sélection d\'athlète supprimée de Firebase');
          } else {
            console.warn('⚠️ Aucun teamId actif, suppression locale uniquement');
          }

          // Mettre à jour l'état local
          const updatedSelections = appState.riderEventSelections.filter(
            sel => sel.id !== existingSelection.id
          );
          appState.setRiderEventSelections?.(updatedSelections);

          // Mettre à jour l'événement en retirant l'athlète
          const event = raceEvents.find(e => e.id === eventId);
          if (event) {
            const updatedEvent = {
              ...event,
              selectedRiderIds: (event.selectedRiderIds || []).filter(id => id !== riderId)
            };
            appState.setRaceEvents?.(updatedEvent);
          }

          console.log(`✅ Athlète ${riderId} retiré de l'événement ${eventId}`);
        }
      } catch (error) {
        console.error('❌ Erreur lors du retrait de l\'athlète:', error);
        alert('Erreur lors du retrait de l\'athlète. Veuillez réessayer.');
      }
    };

    // Fonction pour obtenir le statut d'un athlète pour un événement
    const getRiderEventStatus = (eventId: string, riderId: string): RiderEventStatus | null => {
      const selection = riderEventSelections.find(
        sel => sel.eventId === eventId && sel.riderId === riderId
      );
      return selection ? selection.status : null;
    };

    return (
      <div className="space-y-6">
        {/* En-tête avec contrôles */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800">Planning Saison - Gestion des Athlètes</h3>
            <div className="flex gap-2">
        <button
          onClick={() => handlePlanningSort('name')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            planningSortBy === 'name' 
                    ? 'bg-blue-500 text-white shadow-md' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Nom {planningSortBy === 'name' && (planningSortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handlePlanningSort('raceDays')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            planningSortBy === 'raceDays' 
                    ? 'bg-blue-500 text-white shadow-md' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
                Charge {planningSortBy === 'raceDays' && (planningSortDirection === 'asc' ? '↑' : '↓')}
        </button>
            </div>
      </div>

          {/* Nombre total d'événements */}
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
              <div className="text-4xl font-bold text-purple-600 text-center">{futureEvents.length}</div>
              <p className="text-lg text-purple-700 font-medium text-center">Événements planifiés</p>
            </div>
          </div>
        </div>

        {/* Planning de saison simplifié */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Planning de Saison - Sélections d'Athlètes</h4>
          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-2">
            {futureEvents.length > 0 ? (
              futureEvents.map(event => {
                const selectedRiders = riders.filter(rider => 
                  event.selectedRiderIds?.includes(rider.id)
                );
                const titulaires = selectedRiders.filter(rider => 
                  getRiderEventStatus(event.id, rider.id) === RiderEventStatus.TITULAIRE
                );
                const remplacants = selectedRiders.filter(rider => 
                  getRiderEventStatus(event.id, rider.id) === RiderEventStatus.REMPLACANT
                );

                return (
                  <div key={event.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-bold text-gray-900">{event.name}</h5>
                        <p className="text-sm text-gray-500">
                          {new Date(event.date).toLocaleDateString('fr-FR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })} - {event.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-700">
                          {selectedRiders.length} sélectionné{selectedRiders.length > 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          {titulaires.length} titulaire{titulaires.length > 1 ? 's' : ''} • {remplacants.length} remplaçant{remplacants.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Titulaires */}
                      <div>
                        <h6 className="text-sm font-medium text-green-700 mb-2">Titulaires</h6>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {riders.map(rider => {
                            const isSelected = event.selectedRiderIds?.includes(rider.id);
                            const isTitulaire = getRiderEventStatus(event.id, rider.id) === RiderEventStatus.TITULAIRE;
                            
                            return (
                              <label key={rider.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isTitulaire}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      if (!isSelected) {
                                        addRiderToEvent(event.id, rider.id, RiderEventStatus.TITULAIRE);
                                      } else {
                                        updateRiderEventStatus(event.id, rider.id, RiderEventStatus.TITULAIRE);
                                      }
                                    } else {
                                      if (isSelected) {
                                        removeRiderFromEvent(event.id, rider.id);
                                      }
                                    }
                                  }}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className={`${isTitulaire ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                                  {rider.firstName} {rider.lastName}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Remplaçants */}
                      <div>
                        <h6 className="text-sm font-medium text-yellow-700 mb-2">Remplaçants</h6>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {riders.map(rider => {
                            const isSelected = event.selectedRiderIds?.includes(rider.id);
                            const isRemplacant = getRiderEventStatus(event.id, rider.id) === RiderEventStatus.REMPLACANT;
                            
                            return (
                              <label key={rider.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isRemplacant}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      if (!isSelected) {
                                        addRiderToEvent(event.id, rider.id, RiderEventStatus.REMPLACANT);
                                      } else {
                                        updateRiderEventStatus(event.id, rider.id, RiderEventStatus.REMPLACANT);
                                      }
                                    } else {
                                      if (isSelected) {
                                        removeRiderFromEvent(event.id, rider.id);
                                      }
                                    }
                                  }}
                                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                />
                                <span className={`${isRemplacant ? 'text-yellow-700 font-medium' : 'text-gray-600'}`}>
                                  {rider.firstName} {rider.lastName}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 italic py-8">Aucun événement à venir.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Algorithme de profilage Coggan Expert - Note générale = moyenne simple de toutes les données
  const calculateCogganProfileScore = (rider: Rider) => {
    const powerProfile = (rider as any).powerProfileFresh || {};
    const weight = (rider as any).weightKg || 70; // Poids par défaut si non défini
    
    // Récupération des notes du profil de performance (PPR) si disponibles
    const pprNotes = {
      sprint: (rider as any).charSprint || 0,
      anaerobic: (rider as any).charAnaerobic || 0,
      puncher: (rider as any).charPuncher || 0,
      climbing: (rider as any).charClimbing || 0,
      rouleur: (rider as any).charRouleur || 0,
      general: (rider as any).generalPerformanceScore || 0,
      fatigue: (rider as any).fatigueResistanceScore || 0
    };
    
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
    
    // Références Coggan pour un athlète "ultime" (100/100) - Calibrées sur l'échelle Elite/Hero
    const cogganUltimate = {
      power1s: 19.42,   // 19.42 W/kg - Sprint ultime (Elite/Hero)
      power5s: 19.42,   // 19.42 W/kg - Anaérobie ultime (Elite/Hero)
      power30s: 13.69,  // 13.69 W/kg - Puissance critique ultime (Pro)
      power1min: 8.92,  // 8.92 W/kg - Endurance anaérobie ultime (Elite/Hero)
      power3min: 7.0,   // 7.0 W/kg - Seuil anaérobie ultime
      power5min: 6.35,  // 6.35 W/kg - Seuil fonctionnel ultime (Elite/Hero)
      power12min: 5.88, // 5.88 W/kg - FTP ultime (Elite/Hero)
      power20min: 5.88, // 5.88 W/kg - Endurance critique ultime (Elite/Hero)
      criticalPower: 5.35 // 5.35 W/kg - CP ultime (Elite/Hero)
    };
    
    // Références de résistance basées sur les données physiologiques réelles
    const resistanceReferences = {
      // Niveaux de performance par durée (en % de déficit par rapport à l'élite)
      elite: {
        power20min: -3,      // -3% (97% de l'élite)
        criticalPower: -2    // -2% (98% de l'élite)
      },
      amateur: {
        power20min: -6,      // -6% (94% de l'élite)
        criticalPower: -5    // -5% (95% de l'élite)
      },
      beginner: {
        power20min: -12,     // -12% (88% de l'élite)
        criticalPower: -10   // -10% (90% de l'élite)
      }
    };
    
    // Références pour les watts bruts (sprint/rouleur) - Calibrées sur l'échelle Elite/Hero
    const cogganUltimateRaw = {
      power1s: 1359,    // 1359W - Sprint ultime (70kg × 19.42W/kg)
      power5s: 1359,    // 1359W - Anaérobie ultime
      power30s: 958,    // 958W - Puissance critique ultime
      power1min: 624,   // 624W - Endurance anaérobie ultime
      power3min: 490,   // 490W - Seuil anaérobie ultime
      power5min: 445,   // 445W - Seuil fonctionnel ultime
      power12min: 412,  // 412W - FTP ultime
      power20min: 412,  // 412W - Endurance critique ultime
      criticalPower: 375 // 375W - CP ultime
    };
    
    // Calcul des scores par durée (0-100) - Calibré pour correspondre à l'échelle Elite/Hero
    const getDurationScore = (actual: number, ultimate: number, isFatigueData: boolean = false) => {
      if (actual >= ultimate) return 100;
      
      // Données de fatigue (20min et CP) ont un bonus de 10%
      const fatigueBonus = isFatigueData ? 1.1 : 1.0;
      
      // Notation calibrée : 70% de la puissance ultime = 70 points (pour correspondre à l'échelle Elite/Hero)
      const score = Math.max(0, Math.round((actual / ultimate) * 70 * fatigueBonus));
      return Math.min(100, score); // Limiter à 100
    };
    
    // Calcul des scores automatiques basés sur les données de puissance
    const automaticScores = {
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
    
    // Fonction pour utiliser les notes PPR si disponibles, sinon les scores automatiques
    const getScore = (pprScore: number, automaticScore: number) => {
      // Si une note PPR existe, l'utiliser directement
      if (pprScore > 0) return pprScore;
      
      // Sinon utiliser le score automatique
      return automaticScore;
    };
    
    // Calcul des scores : PPR prioritaire, sinon automatique
    const sprintScore = getScore(pprNotes.sprint, 
      Math.round((automaticScores.power1s + automaticScores.power5s) / 2));
    
    const montagneScore = getScore(pprNotes.climbing, 
      Math.round((automaticScores.power5min + automaticScores.power12min + automaticScores.power20min) / 3));
    
    const puncheurScore = getScore(pprNotes.puncher, 
      Math.round((automaticScores.power30s + automaticScores.power1min + automaticScores.power3min) / 3));
    
    const rouleurScore = getScore(pprNotes.rouleur, 
      Math.round((automaticScores.power12min + automaticScores.power20min + automaticScores.criticalPower) / 3));
    
    // Calcul optimisé de la note de résistance basé sur les données physiologiques
    const calculateResistanceScore = () => {
      // Si note PPR fatigue disponible, l'utiliser directement
      if (pprNotes.fatigue > 0) {
        return pprNotes.fatigue;
      }
      
      // Calcul basé sur les données de puissance et références physiologiques
      const power20minWkg = power20min;
      const criticalPowerWkg = criticalPower;
      
      if (!power20minWkg && !criticalPowerWkg) {
        return 0; // Pas de données de résistance
      }
      
      // Calcul du score de résistance basé sur la performance relative
      let resistanceScore = 0;
      let dataPoints = 0;
      
      if (power20minWkg) {
        // Score basé sur 20min (FTP) - 60% du score total
        const power20minRatio = power20minWkg / cogganUltimate.power20min;
        const power20minScore = Math.round(power20minRatio * 100);
        resistanceScore += power20minScore * 0.6;
        dataPoints++;
      }
      
      if (criticalPowerWkg) {
        // Score basé sur CP - 40% du score total
        const criticalPowerRatio = criticalPowerWkg / cogganUltimate.criticalPower;
        const criticalPowerScore = Math.round(criticalPowerRatio * 100);
        resistanceScore += criticalPowerScore * 0.4;
        dataPoints++;
      }
      
      // Normalisation si une seule donnée disponible
      if (dataPoints === 1) {
        resistanceScore = Math.round(resistanceScore / (dataPoints === 1 ? 0.6 : 0.4));
      }
      
      // Bonus de résistance basé sur la cohérence des données
      if (dataPoints === 2) {
        const consistencyBonus = Math.abs(power20minWkg - criticalPowerWkg) < 0.5 ? 5 : 0;
        resistanceScore += consistencyBonus;
      }
      
      // Bonus pour les athlètes avec une excellente résistance (données cohérentes et élevées)
      if (resistanceScore >= 80 && dataPoints === 2) {
        resistanceScore += 3; // Bonus élite
      }
      
      return Math.min(100, Math.max(0, resistanceScore));
    };
    
    const resistanceScore = calculateResistanceScore();
    
    // Note générale : PPR si disponible, sinon moyenne automatique
    const automaticGeneralScore = Math.round(
      Object.values(automaticScores).reduce((sum, score) => sum + score, 0) / Object.values(automaticScores).length
    );
    
    const generalScore = getScore(pprNotes.general, automaticGeneralScore);
    
    return {
      generalScore,
      sprintScore,
      montagneScore,
      puncheurScore,
      rouleurScore,
      resistanceScore,
      automaticScores, // Scores calculés automatiquement
      pprNotes,        // Notes du profil de performance
      powerProfile: {
        power1s, power5s, power30s, power1min, power3min, 
        power5min, power12min, power20min, criticalPower
      },
      isHybrid: pprNotes.general > 0 // Indicateur si le profil utilise des notes PPR
    };
  };

  // Rendu de l'onglet Qualité d'Effectif
  const renderQualityTab = () => {

    return (
      <div className="space-y-6">
        {/* Métriques globales simplifiées */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg shadow-lg text-white">
            <div className="text-center">
              <h4 className="text-sm font-medium opacity-90">Total Effectif</h4>
              <p className="text-3xl font-bold">{riders.length}</p>
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
                Qualité d'Effectif
              </h3>
              <p className="text-sm text-gray-300 mt-1">Note générale = moyenne simple de toutes les données de puissance</p>
            </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Coureur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Âge</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <button 
                      onClick={() => handleQualitySort('generalScore')}
                      className="flex items-center justify-center w-full hover:text-white transition-colors"
                    >
                      MOY
                      {qualitySortField === 'generalScore' && (
                        <span className="ml-1 text-blue-400">
                          {qualitySortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <button 
                      onClick={() => handleQualitySort('sprintScore')}
                      className="flex items-center justify-center w-full hover:text-white transition-colors"
                    >
                      SPR
                      {qualitySortField === 'sprintScore' && (
                        <span className="ml-1 text-blue-400">
                          {qualitySortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <button 
                      onClick={() => handleQualitySort('montagneScore')}
                      className="flex items-center justify-center w-full hover:text-white transition-colors"
                    >
                      MON
                      {qualitySortField === 'montagneScore' && (
                        <span className="ml-1 text-blue-400">
                          {qualitySortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <button 
                      onClick={() => handleQualitySort('puncheurScore')}
                      className="flex items-center justify-center w-full hover:text-white transition-colors"
                    >
                      PUN
                      {qualitySortField === 'puncheurScore' && (
                        <span className="ml-1 text-blue-400">
                          {qualitySortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <button 
                      onClick={() => handleQualitySort('rouleurScore')}
                      className="flex items-center justify-center w-full hover:text-white transition-colors"
                    >
                      ROU
                      {qualitySortField === 'rouleurScore' && (
                        <span className="ml-1 text-blue-400">
                          {qualitySortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <button 
                      onClick={() => handleQualitySort('resistanceScore')}
                      className="flex items-center justify-center w-full hover:text-white transition-colors"
                    >
                      RES
                      {qualitySortField === 'resistanceScore' && (
                        <span className="ml-1 text-blue-400">
                          {qualitySortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {getSortedRidersForQuality().map((rider) => {
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
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${
                            cogganProfile.generalScore >= 70 ? 'text-green-400' :
                            cogganProfile.generalScore >= 50 ? 'text-blue-400' :
                            cogganProfile.generalScore >= 30 ? 'text-yellow-400' :
                            cogganProfile.generalScore >= 20 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {cogganProfile.generalScore}
                          </div>
                          {cogganProfile.pprNotes.general > 0 && (
                            <div className="text-xs text-purple-400 flex items-center justify-center">
                              <span className="w-2 h-2 bg-purple-400 rounded-full mr-1"></span>
                              PPR
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${
                            cogganProfile.sprintScore >= 70 ? 'text-green-400' :
                            cogganProfile.sprintScore >= 50 ? 'text-blue-400' :
                            cogganProfile.sprintScore >= 30 ? 'text-yellow-400' :
                            cogganProfile.sprintScore >= 20 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {cogganProfile.sprintScore}
                          </div>
                          {cogganProfile.pprNotes.sprint > 0 && (
                            <div className="text-xs text-purple-400">
                              PPR: {cogganProfile.pprNotes.sprint}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${
                            cogganProfile.montagneScore >= 70 ? 'text-green-400' :
                            cogganProfile.montagneScore >= 50 ? 'text-blue-400' :
                            cogganProfile.montagneScore >= 30 ? 'text-yellow-400' :
                            cogganProfile.montagneScore >= 20 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {cogganProfile.montagneScore}
                          </div>
                          {cogganProfile.pprNotes.climbing > 0 && (
                            <div className="text-xs text-purple-400">
                              PPR: {cogganProfile.pprNotes.climbing}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${
                            cogganProfile.puncheurScore >= 70 ? 'text-green-400' :
                            cogganProfile.puncheurScore >= 50 ? 'text-blue-400' :
                            cogganProfile.puncheurScore >= 30 ? 'text-yellow-400' :
                            cogganProfile.puncheurScore >= 20 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {cogganProfile.puncheurScore}
                          </div>
                          {cogganProfile.pprNotes.puncher > 0 && (
                            <div className="text-xs text-purple-400">
                              PPR: {cogganProfile.pprNotes.puncher}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${
                            cogganProfile.rouleurScore >= 70 ? 'text-green-400' :
                            cogganProfile.rouleurScore >= 50 ? 'text-blue-400' :
                            cogganProfile.rouleurScore >= 30 ? 'text-yellow-400' :
                            cogganProfile.rouleurScore >= 20 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {cogganProfile.rouleurScore}
                          </div>
                          {cogganProfile.pprNotes.rouleur > 0 && (
                            <div className="text-xs text-purple-400">
                              PPR: {cogganProfile.pprNotes.rouleur}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${
                            cogganProfile.resistanceScore >= 70 ? 'text-green-400' :
                            cogganProfile.resistanceScore >= 50 ? 'text-blue-400' :
                            cogganProfile.resistanceScore >= 30 ? 'text-yellow-400' :
                            cogganProfile.resistanceScore >= 20 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {cogganProfile.resistanceScore}
                          </div>
                          {cogganProfile.pprNotes.fatigue > 0 && (
                            <div className="text-xs text-purple-400">
                              PPR: {cogganProfile.pprNotes.fatigue}
                            </div>
                          )}
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
          <ActionButton onClick={openAddRiderModal} icon={<PlusCircleIcon className="w-5 h-5"/>}>
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
          onSaveRider={handleSaveRider}
          isAdmin={true}
          raceEvents={raceEvents}
          riderEventSelections={riderEventSelections}
          performanceEntries={[]}
          powerDurationsConfig={[
            { key: 'power1s', label: '1s', unit: 'W', sortable: true },
            { key: 'power5s', label: '5s', unit: 'W', sortable: true },
            { key: 'power30s', label: '30s', unit: 'W', sortable: true },
            { key: 'power1min', label: '1min', unit: 'W', sortable: true },
            { key: 'power3min', label: '3min', unit: 'W', sortable: true },
            { key: 'power5min', label: '5min', unit: 'W', sortable: true },
            { key: 'power12min', label: '12min', unit: 'W', sortable: true },
            { key: 'power20min', label: '20min', unit: 'W', sortable: true },
            { key: 'criticalPower', label: 'CP', unit: 'W', sortable: true }
          ]}
          calculateWkg={(power?: number, weight?: number) => {
            if (!power || !weight) return '-';
            return (power / weight).toFixed(1);
          }}
          appState={appState}
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
