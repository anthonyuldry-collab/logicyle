import React, { useState, useMemo, useCallback } from 'react';
import { Rider, RaceEvent, RiderEventSelection, RiderEventStatus, EventType, Sex, RIDER_LEVEL_CATEGORIES, RIDER_EVENT_STATUS_COLORS } from '../types';
import { SectionWrapper } from '../components/SectionWrapper';
import ActionButton from '../components/ActionButton';
import Modal from '../components/Modal';
import { RiderDetailModal } from '../components/RiderDetailModal';
import PlusCircleIcon from '../components/icons/PlusCircleIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import UploadIcon from '../components/icons/UploadIcon';
import DocumentDuplicateIcon from '../components/icons/DocumentDuplicateIcon';
import ReplaceIcon from '../components/icons/ReplaceIcon';
import EyeIcon from '../components/icons/EyeIcon';
import BeakerIcon from '../components/icons/BeakerIcon';
import ExclamationCircleIcon from '../components/icons/ExclamationCircleIcon';
import InformationCircleIcon from '../components/icons/InformationCircleIcon';
import SearchIcon from '../components/icons/SearchIcon';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import MailIcon from '../components/icons/MailIcon';
import PhoneIcon from '../components/icons/PhoneIcon';
import ConfirmationModal from '../components/ConfirmationModal';
import { useTranslations } from '../hooks/useTranslations';
import { useAppStateSafe } from '../hooks/useAppState';
import CalendarIcon from '../components/icons/CalendarIcon';
import TableCellsIcon from '../components/icons/TableCellsIcon';
import { getAgeCategory } from '../utils/ageUtils';
import { getRiderCharacteristicSafe } from '../utils/riderUtils';

interface RosterSectionProps {
  raceEvents: RaceEvent[];
  riders: Rider[];
  riderEventSelections: RiderEventSelection[];
  setRiderEventSelections: (selections: RiderEventSelection[]) => void;
  setRaceEvents: (events: RaceEvent[]) => void;
  appState: any;
}

const calculateWkg = (power: number, weight: number): string => {
  if (!weight || weight <= 0) return '0.0';
  return (power / weight).toFixed(1);
};

const powerProfileConfig = {
  powerProfile15KJ: "15 kJ/kg",
  powerProfile30KJ: "30 kJ/kg"
};

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

  // States for season planning
  const [planningSortBy, setPlanningSortBy] = useState<'name' | 'raceDays'>('name');
  const [planningSortDirection, setPlanningSortDirection] = useState<'asc' | 'desc'>('asc');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');

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
                    <td key={event.id} className={`p-0.5 border text-center align-middle ${RIDER_EVENT_STATUS_COLORS[status].split(' ')[0]}`}>
                      <select
                        value={status}
                        onChange={(e) => handlePlanningGridSelectionChange(rider.id, event.id, e.target.value as RiderEventStatus)}
                        className={`w-full h-full text-center text-xs p-0.5 border-0 rounded appearance-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent ${RIDER_EVENT_STATUS_COLORS[status].split(' ')[1]}`}
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
            <div className="sticky left-[120px] bg-gray-100 z-30 p-1.5 border-b border-r font-semibold text-xs text-gray-700">Jours</div>
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

  return (
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
}
