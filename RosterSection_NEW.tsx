import React, { useState, useMemo } from 'react';
import { Rider, RaceEvent, RiderEventSelection, RiderEventStatus, EventType, Sex } from '../types';
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
import { useAppStateSafe } from '../hooks/useAppState';
import CalendarIcon from '../components/icons/CalendarIcon';
import TableCellsIcon from '../components/icons/TableCellsIcon';
import { getAgeCategory } from '../utils/ageUtils';

interface RosterSectionProps {
  raceEvents: RaceEvent[];
  riders: Rider[];
  riderEventSelections: RiderEventSelection[];
  setRiderEventSelections: (selections: RiderEventSelection[]) => void;
  setRaceEvents: (events: RaceEvent[]) => void;
  appState: any;
}

const getEventDuration = (event: RaceEvent): number => {
  if (!event.date) return 1;
  
  const startDate = new Date(event.date + "T12:00:00Z");
  const endDate = event.endDate ? new Date(event.endDate + "T12:00:00Z") : startDate;
  
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
};

export default function RosterSection({
  raceEvents,
  riders,
  riderEventSelections,
  setRiderEventSelections,
  setRaceEvents,
  appState
}: RosterSectionProps) {
  const { t } = useTranslations();
  const { appState: safeAppState } = useAppStateSafe();

  // States for roster management
  const [activeTab, setActiveTab] = useState<'roster' | 'seasonPlanning'>('roster');
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | Sex>('all');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [minAgeFilter, setMinAgeFilter] = useState('');
  const [maxAgeFilter, setMaxAgeFilter] = useState('');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [riderToDelete, setRiderToDelete] = useState<Rider | null>(null);

  // States for season planning
  const [planningSortBy, setPlanningSortBy] = useState<'name' | 'raceDays'>('name');
  const [planningSortDirection, setPlanningSortDirection] = useState<'asc' | 'desc'>('asc');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');

  // States for roster sorting
  const [rosterSortBy, setRosterSortBy] = useState<'name' | 'age' | 'level' | 'raceDays'>('name');
  const [rosterSortDirection, setRosterSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sorting function for roster
  const sortedRidersForAdmin = useMemo(() => {
    let filtered = [...riders];

    // Apply filters
    if (searchTerm) {
      filtered = filtered.filter(rider => 
        `${rider.firstName} ${rider.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (genderFilter !== 'all') {
      filtered = filtered.filter(rider => rider.sex === genderFilter);
    }

    if (ageCategoryFilter !== 'all') {
      filtered = filtered.filter(rider => {
        const { category } = getAgeCategory(rider.birthDate);
        return category === ageCategoryFilter;
      });
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter(rider => {
        const level = (rider as any).level;
        return level === levelFilter;
      });
    }

    if (minAgeFilter || maxAgeFilter) {
      filtered = filtered.filter(rider => {
        const { age } = getAgeCategory(rider.birthDate);
        if (age === null) return false;
        const minAge = minAgeFilter ? parseInt(minAgeFilter) : 0;
        const maxAge = maxAgeFilter ? parseInt(maxAgeFilter) : 999;
        return age >= minAge && age <= maxAge;
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      if (rosterSortBy === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return rosterSortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else if (rosterSortBy === 'age') {
        const ageA = getAgeCategory(a.birthDate).age || 0;
        const ageB = getAgeCategory(b.birthDate).age || 0;
        return rosterSortDirection === 'asc' ? ageA - ageB : ageB - ageA;
      } else if (rosterSortBy === 'level') {
        const levelA = (a as any).level || '';
        const levelB = (b as any).level || '';
        return rosterSortDirection === 'asc' ? levelA.localeCompare(levelB) : levelB.localeCompare(levelA);
      } else {
        const raceDaysA = raceEvents.filter(event => {
          const selection = riderEventSelections.find(s => s.riderId === a.id && s.eventId === event.id);
          return selection && [RiderEventStatus.TITULAIRE, RiderEventStatus.REMPLACANT, RiderEventStatus.PRE_SELECTION].includes(selection.status);
        }).length;
        const raceDaysB = raceEvents.filter(event => {
          const selection = riderEventSelections.find(s => s.riderId === b.id && s.eventId === event.id);
          return selection && [RiderEventStatus.TITULAIRE, RiderEventStatus.REMPLACANT, RiderEventStatus.PRE_SELECTION].includes(selection.status);
        }).length;
        return rosterSortDirection === 'asc' ? raceDaysA - raceDaysB : raceDaysB - raceDaysA;
      }
    });
  }, [riders, raceEvents, riderEventSelections, searchTerm, genderFilter, ageCategoryFilter, levelFilter, minAgeFilter, maxAgeFilter, rosterSortBy, rosterSortDirection]);

  // Sorting function for season planning
  const sortedRidersForPlanning = useMemo(() => {
    const sorted = [...riders].sort((a, b) => {
      const raceDaysA = raceEvents.filter(event => {
        const selection = riderEventSelections.find(s => s.riderId === a.id && s.eventId === event.id);
        return selection && [RiderEventStatus.TITULAIRE, RiderEventStatus.REMPLACANT, RiderEventStatus.PRE_SELECTION].includes(selection.status);
      }).length;
      
      const raceDaysB = raceEvents.filter(event => {
        const selection = riderEventSelections.find(s => s.riderId === b.id && s.eventId === event.id);
        return selection && [RiderEventStatus.TITULAIRE, RiderEventStatus.REMPLACANT, RiderEventStatus.PRE_SELECTION].includes(selection.status);
      }).length;

      if (planningSortBy === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return planningSortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else {
        return planningSortDirection === 'asc' ? raceDaysA - raceDaysB : raceDaysB - raceDaysA;
      }
    });
    return sorted;
  }, [riders, raceEvents, riderEventSelections, planningSortBy, planningSortDirection]);

  // Handle roster sort
  const handleRosterSort = (sortBy: 'name' | 'age' | 'level' | 'raceDays') => {
    if (rosterSortBy === sortBy) {
      setRosterSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setRosterSortBy(sortBy);
      setRosterSortDirection('asc');
    }
  };

  // Handle planning sort
  const handlePlanningSort = (sortBy: 'name' | 'raceDays') => {
    if (planningSortBy === sortBy) {
      setPlanningSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPlanningSortBy(sortBy);
      setPlanningSortDirection('asc');
    }
  };

  // Calculate race days for each rider
  const raceDaysByRider = useMemo(() => {
    const daysByRider: { [key: string]: number } = {};
    
    riders.forEach(rider => {
      const days = raceEvents.filter(event => {
        const selection = riderEventSelections.find(s => s.riderId === rider.id && s.eventId === event.id);
        return selection && [RiderEventStatus.TITULAIRE, RiderEventStatus.REMPLACANT, RiderEventStatus.PRE_SELECTION].includes(selection.status);
      }).length;
      
      daysByRider[rider.id] = days;
    });
    
    return daysByRider;
  }, [riders, raceEvents, riderEventSelections]);

  // Handle planning grid selection change
  const handlePlanningGridSelectionChange = (riderId: string, eventId: string, status: RiderEventStatus) => {
    const existingSelection = riderEventSelections.find(s => s.riderId === riderId && s.eventId === eventId);
    
    if (existingSelection) {
      setRiderEventSelections(prev => prev.map(s => 
        s.id === existingSelection.id ? { ...s, status } : s
      ));
    } else {
      const newSelection: RiderEventSelection = {
        id: `${riderId}-${eventId}`,
        riderId,
        eventId,
        status
      };
      setRiderEventSelections(prev => [...prev, newSelection]);
    }
  };

  // Modal handlers
  const openEditModal = (rider: Rider) => {
    setSelectedRider(rider);
    setIsEditModalOpen(true);
  };

  const openViewModal = (rider: Rider) => {
    setSelectedRider(rider);
    setIsViewModalOpen(true);
  };

  const handleDeleteRider = (rider: Rider) => {
    setRiderToDelete(rider);
    setIsDeleteModalOpen(true);
  };

  // Render roster tab
  const renderRosterTab = () => (
    <div className="bg-white p-3 rounded-lg shadow-md">
      <div className="mb-3 grid grid-cols-1 md:grid-cols-5 gap-3">
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
              className="block w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
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
        <div>
          <label htmlFor="rosterAgeCategoryFilter" className="block text-xs font-medium text-gray-700 mb-0.5">Catégorie d'âge</label>
          <select
            id="rosterAgeCategoryFilter"
            value={ageCategoryFilter}
            onChange={(e) => setAgeCategoryFilter(e.target.value)}
            className="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
          >
            <option value="all">Toutes</option>
            {['U15', 'U17', 'U19', 'U23', 'Senior'].map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rosterLevelFilter" className="block text-xs font-medium text-gray-700 mb-0.5">Niveau</label>
          <select
            id="rosterLevelFilter"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
          >
            <option value="all">Tous</option>
            <option value="Elite">Elite</option>
            <option value="Pro">Pro</option>
            <option value="Amateur">Amateur</option>
            <option value="Espoir">Espoir</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-0.5">Tranche d'âge</label>
          <div className="flex items-center space-x-1">
            <input
              type="number"
              placeholder="Min"
              value={minAgeFilter}
              onChange={(e) => setMinAgeFilter(e.target.value)}
              className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white text-gray-900 placeholder-gray-500"
              aria-label="Âge minimum"
            />
            <span className="text-xs">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxAgeFilter}
              onChange={(e) => setMaxAgeFilter(e.target.value)}
              className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white text-gray-900 placeholder-gray-500"
              aria-label="Âge maximum"
            />
          </div>
        </div>
      </div>

      {/* Contrôles de tri pour l'effectif */}
      <div className="mb-3 flex flex-wrap items-center gap-3 p-2 bg-gray-50 rounded-lg border">
        <span className="text-xs font-medium text-gray-700">Trier par:</span>
        <button
          onClick={() => handleRosterSort('name')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            rosterSortBy === 'name' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Nom {rosterSortBy === 'name' && (rosterSortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleRosterSort('age')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            rosterSortBy === 'age' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Âge {rosterSortBy === 'age' && (rosterSortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleRosterSort('level')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            rosterSortBy === 'level' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Niveau {rosterSortBy === 'level' && (rosterSortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleRosterSort('raceDays')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            rosterSortBy === 'raceDays' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Jours de Course {rosterSortBy === 'raceDays' && (rosterSortDirection === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedRidersForAdmin.map(rider => (
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
                <p><strong>Santé:</strong> {(rider as any).healthCondition || '-'}</p>
                
                {/* Âge et catégorie d'âge */}
                {(() => {
                  const { category, age } = getAgeCategory(rider.birthDate);
                  return (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p><strong>Âge:</strong> {age !== null ? `${age} ans` : '?'} <span className="text-blue-600 font-medium">({category})</span></p>
                    </div>
                  );
                })()}
                
                {/* Catégories de niveau */}
                {(rider as any).categories && (rider as any).categories.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p><strong>Niveaux:</strong></p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(rider as any).categories
                        .filter((cat: string) => !['U15', 'U17', 'U19', 'U23', 'Senior'].includes(cat))
                        .map((cat: string) => (
                          <span key={cat} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            {cat}
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-auto p-2 border-t border-gray-200 flex justify-end space-x-1 bg-gray-50">
              <ActionButton onClick={() => openEditModal(rider)} variant="secondary" size="sm" icon={<PencilIcon className="w-4 h-4"/>} title="Modifier">
                <span className="sr-only">Modifier</span>
              </ActionButton>
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

  // Render grid view for season planning
  const renderGridView = () => (
    <div>
      {/* Sorting controls for planning */}
      <div className="mb-3 flex flex-wrap items-center gap-3 p-2 bg-gray-50 rounded-lg border">
        <span className="text-xs font-medium text-gray-700">Trier par:</span>
        <button
          onClick={() => handlePlanningSort('name')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            planningSortBy === 'name' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Nom {planningSortBy === 'name' && (planningSortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handlePlanningSort('raceDays')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            planningSortBy === 'raceDays' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Jours de Course {planningSortBy === 'raceDays' && (planningSortDirection === 'asc' ? '↑' : '↓')}
        </button>
      </div>
      
      {/* Main table */}
      <div className="overflow-x-auto border rounded-lg" style={{ maxHeight: '60vh' }}>
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100 z-10" style={{ position: 'sticky', top: 0 }}>
            <tr>
              <th className="p-1.5 border text-xs font-semibold text-gray-600 w-40 z-20" style={{ position: 'sticky', left: 0, backgroundColor: 'inherit' }}>Coureur</th>
              <th className="p-1.5 border text-xs font-semibold text-gray-600 w-20 z-20" style={{ position: 'sticky', left: '10rem', backgroundColor: 'inherit' }}>Jours</th>
              {raceEvents && raceEvents.map(event => (
                <th key={event.id} className="p-1.5 border text-xs font-semibold text-gray-600 min-w-[120px]">
                  <div className="font-bold text-xs">{event.name}</div>
                  <div className="text-xs">{new Date(event.date + 'T12:00:00Z').toLocaleDateString('fr-CA')}</div>
                  <div className="text-xs text-gray-500">({getEventDuration(event)}j)</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRidersForPlanning && sortedRidersForPlanning.map(rider => (
              <tr key={rider.id} className="hover:bg-gray-50">
                <td className="p-1.5 border text-sm font-medium text-gray-800 w-40 z-10" style={{ position: 'sticky', left: 0, backgroundColor: 'inherit' }}>{rider.firstName} {rider.lastName}</td>
                <td className="p-1.5 border font-bold text-center text-base text-gray-800 w-20 z-10" style={{ position: 'sticky', left: '10rem', backgroundColor: 'inherit' }}>{raceDaysByRider[rider.id] || 0}</td>
                {raceEvents && raceEvents.map(event => {
                  const selection = riderEventSelections.find(s => s.riderId === rider.id && s.eventId === event.id);
                  const status = selection?.status || RiderEventStatus.NON_RETENU;
                  return (
                    <td key={event.id} className="p-0.5 border text-center align-middle">
                      <select
                        value={status}
                        onChange={(e) => handlePlanningGridSelectionChange(rider.id, event.id, e.target.value as RiderEventStatus)}
                        className="w-full h-full text-center text-xs p-0.5 border-0 rounded appearance-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent"
                      >
                        {Object.values(RiderEventStatus).map(s => (
                          <option key={s} value={s} style={{ backgroundColor: '#fff', color: '#000' }}>{s}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render calendar view for season planning
  const renderCalendarView = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const eventsForMonth = raceEvents.filter(event => {
      const start = new Date(event.date + "T12:00:00Z");
      const end = new Date((event.endDate || event.date) + "T12:00:00Z");
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month, daysInMonth, 23, 59, 59);
      return start <= monthEnd && end >= monthStart;
    });

    return (
      <div className="mt-2">
        <div className="flex justify-between items-center mb-2">
          <ActionButton onClick={() => setCalendarDate(new Date(year, month - 1, 1))} size="sm">&lt; {new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {month: 'long'})}</ActionButton>
          <h4 className="text-base font-semibold">{monthName}</h4>
          <ActionButton onClick={() => setCalendarDate(new Date(year, month + 1, 1))} size="sm">{new Date(year, month + 1, 1).toLocaleDateString('fr-FR', {month: 'long'})} &gt;</ActionButton>
        </div>
        <div className="overflow-x-auto border rounded-lg bg-gray-50" style={{ maxHeight: '60vh' }}>
          <div className="grid min-w-max" style={{ gridTemplateColumns: `120px 60px repeat(${daysInMonth}, minmax(30px, 1fr))` }}>
            {/* Header */}
            <div className="sticky left-0 bg-gray-100 z-30 p-1.5 border-b border-r font-semibold text-xs text-gray-700">Coureur</div>
            <div className="sticky left-[120px] bg-gray-100 z-20 p-1.5 border-b border-r font-semibold text-xs text-gray-700">Jours</div>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <div key={day} className="text-center p-1 border-b border-r text-xs font-medium text-gray-500">{day}</div>
            ))}
            {/* Rider Rows */}
            {riders.map(rider => (
              <React.Fragment key={rider.id}>
                <div className="sticky left-0 bg-white z-20 p-1.5 border-b border-r text-xs font-medium whitespace-nowrap">{rider.firstName} {rider.lastName}</div>
                <div className="sticky left-[120px] bg-white z-20 p-1.5 border-b border-r text-xs font-bold text-center">{raceDaysByRider[rider.id] || 0}</div>
                <div className="col-start-3 relative border-b" style={{ gridColumnEnd: daysInMonth + 3, display: 'grid', gridTemplateColumns: `repeat(${daysInMonth}, 1fr)`}}>
                  {Array.from({ length: daysInMonth }).map((_, i) => <div key={i} className="border-r h-full"></div>)}
                  {eventsForMonth.map(event => {
                    const selection = riderEventSelections.find(s => s.riderId === rider.id && s.eventId === event.id);
                    if (!selection || ![RiderEventStatus.TITULAIRE, RiderEventStatus.REMPLACANT, RiderEventStatus.PRE_SELECTION].includes(selection.status)) return null;

                    const start = new Date(event.date + "T12:00:00Z");
                    const end = new Date((event.endDate || event.date) + "T12:00:00Z");
                    
                    const startDay = start.getMonth() < month ? 1 : start.getDate();
                    const endDay = end.getMonth() > month ? daysInMonth : end.getDate();
                    
                    const duration = endDay - startDay + 1;
                    if (duration <= 0) return null;
                    
                    const color = event.eventType === EventType.COMPETITION ? 'bg-blue-600' : 'bg-yellow-500';
                    const opacity = selection.status !== RiderEventStatus.TITULAIRE ? 'opacity-60' : '';

                    return (
                      <div
                        key={event.id}
                        className={`absolute h-5/6 my-auto inset-y-0 px-1 flex items-center text-xs text-white rounded overflow-hidden cursor-pointer ${color} ${opacity}`}
                        style={{
                          gridColumnStart: startDay,
                          gridColumnEnd: `span ${duration}`,
                        }}
                        title={`${event.name}\n${start.toLocaleDateString()} - ${end.toLocaleDateString()}\nStatut: ${selection.status}`}
                      >
                        <span className="truncate">{event.name}</span>
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex justify-end items-center mt-1 text-xs space-x-3">
          <div className="flex items-center"><span className="w-3 h-3 bg-blue-600 rounded-sm mr-1"></span>Competition</div>
          <div className="flex items-center"><span className="w-3 h-3 bg-yellow-500 rounded-sm mr-1"></span>Stage</div>
          <div className="flex items-center"><span className="w-3 h-3 bg-gray-400 rounded-sm mr-1 opacity-60"></span>Non-Titulaire</div>
        </div>
      </div>
    );
  };

  // Render season planning tab
  const renderSeasonPlanningTab = () => (
    <div className="bg-white p-3 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Planning Previsionnel de la Saison</h3>
        <div className="flex items-center p-1 bg-gray-200 rounded-lg">
          <ActionButton onClick={() => setViewMode('grid')} variant={viewMode === 'grid' ? 'primary' : 'secondary'} size="sm" className={viewMode === 'grid' ? 'shadow-md' : 'bg-transparent shadow-none'}>
            <TableCellsIcon className="w-4 h-4" />
            <span className="ml-1">Grille</span>
          </ActionButton>
          <ActionButton onClick={() => setViewMode('calendar')} variant={viewMode === 'calendar' ? 'primary' : 'secondary'} size="sm" className={viewMode === 'calendar' ? 'shadow-md' : 'bg-transparent shadow-none'}>
            <CalendarIcon className="w-4 h-4" />
            <span className="ml-1">Calendrier</span>
          </ActionButton>
        </div>
      </div>
      {viewMode === 'grid' ? renderGridView() : renderCalendarView()}
    </div>
  );

  return (
    <SectionWrapper 
      title="Annuaire de l'Equipe"
      actionButton={<ActionButton onClick={() => {}} icon={<PlusCircleIcon className="w-5 h-4"/>}>Ajouter Coureur</ActionButton>}
    >
      <div className="mb-2 border-b border-gray-200">
        <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Tabs">
          <button onClick={() => setActiveTab('roster')} className={activeTab === 'roster' ? 'border-blue-500 text-blue-600 border-b-2 py-2 px-3 text-sm font-medium' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-3 text-sm font-medium'}>Effectif</button>
          <button onClick={() => setActiveTab('seasonPlanning')} className={activeTab === 'seasonPlanning' ? 'border-blue-500 text-blue-600 border-b-2 py-2 py-2 px-3 text-sm font-medium' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-3 text-sm font-medium'}>Planning Saison</button>
        </nav>
      </div>
      
      {activeTab === 'roster' ? renderRosterTab() : renderSeasonPlanningTab()}

      {/* Modals */}
      {selectedRider && (
        <>
          <RiderDetailModal
            rider={selectedRider}
            isOpen={isViewModalOpen}
            onClose={() => setIsViewModalOpen(false)}
            onEdit={() => {
              setIsViewModalOpen(false);
              setIsEditModalOpen(true);
            }}
            onDelete={() => {
              setIsViewModalOpen(false);
              handleDeleteRider(selectedRider);
            }}
            isAdmin={true}
          />
          
          <RiderDetailModal
            rider={selectedRider}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={(updatedRider) => {
              setIsEditModalOpen(false);
            }}
            isAdmin={true}
            isEditing={true}
          />
        </>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          setRiderToDelete(null);
        }}
        title="Confirmer la suppression"
        message="Êtes-vous sûr de vouloir supprimer ce coureur ? Cette action est irréversible et supprimera toutes les données associées."
      />
    </SectionWrapper>
  );
}
