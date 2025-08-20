

import React, { useState, useMemo, useEffect } from 'react';
import { StaffMember, RaceEvent, EventStaffAvailability, StaffRoleKey, EventBudgetItem, StaffRole, StaffStatus, AvailabilityStatus, EventType, ContractType, BudgetItemCategory, User, TeamRole, WorkExperience, Team, PerformanceEntry, Mission, MissionStatus, MissionCompensationType, Address, EducationOrCertification, AppSection, PermissionLevel, Vehicle } from '../types'; 
import { STAFF_ROLE_COLORS, STAFF_STATUS_COLORS, EVENT_TYPE_COLORS, STAFF_ROLES_CONFIG } from '../constants'; 
import SectionWrapper from '../components/SectionWrapper';
import ActionButton from '../components/ActionButton';
import StaffDetailModal from '../components/StaffDetailModal';
import PlusCircleIcon from '../components/icons/PlusCircleIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import SearchIcon from '../components/icons/SearchIcon';
import MailIcon from '../components/icons/MailIcon'; 
import PhoneIcon from '../components/icons/PhoneIcon';
import LocationMarkerIcon from '../components/icons/LocationMarkerIcon';
import Modal from '../components/Modal';
import XCircleIcon from '../components/icons/XCircleIcon';
import ConfirmationModal from '../components/ConfirmationModal';
import StaffSearchTab from '../components/StaffSearchTab';
import MissionSearchSection from './MissionSearchSection';
import StarIcon from '../components/icons/StarIcon';
import CalendarDaysIcon from '../components/icons/CalendarDaysIcon';
import BanknotesIcon from '../components/icons/BanknotesIcon';
import { useTranslations } from '../hooks/useTranslations';

interface StaffSectionProps {
  staff: StaffMember[];
  onSave: (staffMember: StaffMember) => void;
  onDelete: (staffMember: StaffMember) => void;
  effectivePermissions: Partial<Record<AppSection, PermissionLevel[]>>;
  currentUser: User;
  raceEvents?: RaceEvent[];
  eventStaffAvailabilities?: EventStaffAvailability[];
  eventBudgetItems?: EventBudgetItem[];
  team?: Team;
  performanceEntries?: PerformanceEntry[];
  missions?: Mission[];
  teams?: Team[];
  users?: User[];
  permissionRoles?: any[];
  vehicles?: Vehicle[];
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

const initialMissionFormState: Omit<Mission, 'id' | 'teamId' | 'status' | 'applicants'> = {
    title: '',
    role: StaffRole.ASSISTANT,
    startDate: '',
    endDate: '',
    location: '',
    description: '',
    requirements: [],
    compensationType: MissionCompensationType.FREELANCE,
    dailyRate: undefined,
    compensation: '',
};

const getEventDuration = (event: RaceEvent): number => {
    if (!event.date) return 0;
    const startDate = new Date(event.date + "T00:00:00Z");
    const endDate = event.endDate ? new Date(event.endDate + "T23:59:59Z") : startDate;
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
};

const calculateDaysAssigned = (staffId: string, allEvents: RaceEvent[]): number => {
    return allEvents.reduce((total: number, event: RaceEvent) => {
        const allAssignedIds = new Set<string>(event.selectedStaffIds || []);
        STAFF_ROLES_CONFIG.flatMap(g => g.roles).forEach(roleInfo => {
            const roleKey = roleInfo.key as StaffRoleKey;
            (event[roleKey] || []).forEach(id => allAssignedIds.add(id));
        });

        if (allAssignedIds.has(staffId)) {
            return total + getEventDuration(event);
        }
        return total;
    }, 0);
};

interface GlobalPlanningTabProps {
  upcomingEvents: RaceEvent[];
  onAssign: (event: RaceEvent) => void;
}

const GlobalPlanningTab: React.FC<GlobalPlanningTabProps> = ({ upcomingEvents, onAssign }: GlobalPlanningTabProps) => {
  return (
      <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Assignation du Staff par Événement</h3>
          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-2">
              {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event: RaceEvent) => {
                      const staffSummary = STAFF_ROLES_CONFIG.flatMap(group => group.roles)
                          .map(roleInfo => {
                              const roleKey = roleInfo.key as StaffRoleKey;
                              const assignedIds = event[roleKey] || [];
                              if (assignedIds.length > 0) {
                                  const roleLabel = roleInfo.label.replace(/\(s\)/g, '').replace(/\(s/g, '').trim();
                                  return `${roleLabel}: ${assignedIds.length}`;
                              }
                              return null;
                          })
                          .filter(Boolean)
                          .join(' | ');

                      return (
                          <button
                              key={event.id}
                              onClick={() => onAssign(event)}
                              className="w-full text-left p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          >
                              <div className="flex justify-between items-start">
                                  <div>
                                      <p className="font-bold text-gray-900">{event.name}</p>
                                      <p className="text-xs text-gray-500">{new Date(event.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} - {event.location}</p>
                                  </div>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${EVENT_TYPE_COLORS[event.eventType]}`}>{event.eventType}</span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                                  <p><strong>Staff :</strong> {staffSummary || <span className="italic">Aucun staff assigné par rôle.</span>}</p>
                              </div>
                          </button>
                      );
                  })
              ) : (
                  <p className="text-center text-gray-500 italic py-8">Aucun événement à venir.</p>
              )}
          </div>
      </div>
  );
};

export const StaffSection: React.FC<StaffSectionProps> = ({
  staff,
  onSave,
  onDelete,
  effectivePermissions,
  raceEvents,
  eventStaffAvailabilities,
  eventBudgetItems,
  currentUser,
  team,
  performanceEntries,
  missions,
  teams,
  users,
  permissionRoles,
  vehicles,
}: StaffSectionProps) => {
  // Protection simplifiée - seulement staff et currentUser sont requis
  if (!staff || !currentUser) {
    return (
      <SectionWrapper title="Gestion du Staff">
        <div className="text-center p-8 bg-gray-50 rounded-lg border">
          <h3 className="text-xl font-semibold text-gray-700">Chargement...</h3>
          <p className="mt-2 text-gray-500">Initialisation des données...</p>
        </div>
      </SectionWrapper>
    );
  }

  // Vérification que staff est un tableau
  if (!Array.isArray(staff)) {
    return (
      <SectionWrapper title="Gestion du Staff">
        <div className="text-center p-8 bg-gray-50 rounded-lg border">
          <h3 className="text-xl font-semibold text-gray-700">Erreur de données</h3>
          <p className="mt-2 text-gray-500">Format des données staff invalide.</p>
        </div>
      </SectionWrapper>
    );
  }

  const { language } = useTranslations();
  
  // --- STATE FOR ALL TABS ---
  const [activeTab, setActiveTab] = useState<'details' | 'planning' | 'missionSearch' | 'myApplications' | 'postingsManagement' | 'search'>('details');
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void; } | null>(null);
  
  // State for Staff Details Tab
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<StaffRole | 'all'>('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState<StaffStatus | 'all'>('all');
  
  // State for Mission Management Tab
  const [isPostMissionModalOpen, setIsPostMissionModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [newMissionData, setNewMissionData] = useState<Omit<Mission, 'id' | 'teamId' | 'status' | 'applicants'>>(initialMissionFormState);
  const [isApplicantsModalOpen, setIsApplicantsModalOpen] = useState(false);
  const [missionForApplicants, setMissionForApplicants] = useState<Mission | null>(null);
  const [selectedMissionForDetails, setSelectedMissionForDetails] = useState<Mission | null>(null);
  const [viewingApplicant, setViewingApplicant] = useState<any | null>(null);
  
  // State for Assignment Modal
  const [assignmentModalEvent, setAssignmentModalEvent] = useState<RaceEvent | null>(null);
  const [modalAssignments, setModalAssignments] = useState<Partial<Record<StaffRoleKey, string[]>>>({});
  
  // Local state for data management
  const [localMissions, setLocalMissions] = useState<Mission[]>(missions || []);
  const [localStaff, setLocalStaff] = useState<StaffMember[]>(staff || []);
  const [localRaceEvents, setLocalRaceEvents] = useState<RaceEvent[]>(raceEvents || []);
  const [localEventStaffAvailabilities, setLocalEventStaffAvailabilities] = useState<EventStaffAvailability[]>(eventStaffAvailabilities || []);
  const [localPermissionRoles, setLocalPermissionRoles] = useState<any[]>([]);
  const [localVehicles, setLocalVehicles] = useState<Vehicle[]>(vehicles || []);

  const lightInputClass = `mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm bg-white text-gray-900 border-gray-300 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500`;
  const lightSelectClass = `mt-1 block w-full pl-3 pr-10 py-2 border rounded-md shadow-sm sm:text-sm bg-white text-gray-900 border-gray-300 focus:ring-blue-500 focus:border-blue-500`;

  // Synchronisation des données locales avec les props
  useEffect(() => {
    if (staff && Array.isArray(staff)) {
      setLocalStaff(staff);
    }
  }, [staff]);

  useEffect(() => {
    if (raceEvents && Array.isArray(raceEvents)) {
      setLocalRaceEvents(raceEvents);
    }
  }, [raceEvents]);

  useEffect(() => {
    if (missions && Array.isArray(missions)) {
      setLocalMissions(missions);
    }
  }, [missions]);

  useEffect(() => {
    if (vehicles && Array.isArray(vehicles)) {
      setLocalVehicles(vehicles);
    }
  }, [vehicles]);

  // Memo for details tab
  const filteredStaffMembers = useMemo(() => {
    if (!localStaff) return [];
    const filtered = localStaff.filter(member => {
      const nameMatch = `${member.firstName} ${member.lastName}`.toLowerCase().includes(staffSearchTerm.toLowerCase());
      const roleMatch = staffRoleFilter === 'all' || member.role === staffRoleFilter;
      const statusMatch = staffStatusFilter === 'all' || member.status === staffStatusFilter;
      return nameMatch && roleMatch && statusMatch;
    }).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    return filtered;
  }, [localStaff, staffSearchTerm, staffRoleFilter, staffStatusFilter]);

  const upcomingEvents = useMemo(() => {
    if (!localRaceEvents) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...localRaceEvents]
        .filter(event => new Date(event.endDate || event.date) >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [localRaceEvents]);

  const handleSaveStaff = async (staffToSave: StaffMember) => {
    try {
      console.log('handleSaveStaff appelé avec:', staffToSave);
      
      if (onSave) {
        await onSave(staffToSave);
        console.log('Staff sauvegardé avec succès');
        
        setTimeout(() => {
          setIsDetailModalOpen(false);
        }, 100);
      } else {
        console.error('onSave n\'est pas défini');
        alert('Erreur: fonction de sauvegarde non disponible');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du staff:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    if (!localStaff) return;
    const member = localStaff.find(s => s.id === staffId);
    if (!member) return;

    setConfirmAction({
      title: `Supprimer ${member.firstName} ${member.lastName}`,
      message: "Êtes-vous sûr de vouloir supprimer ce membre du staff ? Cette action est irréversible.",
      onConfirm: () => {
        setLocalStaff(prev => prev.filter(s => s.id !== staffId));
        if (onDelete) {
          onDelete(member);
        }
      }
    });
  };

  const handleOpenAssignmentModal = (event: RaceEvent) => {
    const initialAssignments: Partial<Record<StaffRoleKey, string[]>> = {};
    STAFF_ROLES_CONFIG.flatMap(g => g.roles).forEach(r => {
      initialAssignments[r.key as StaffRoleKey] = event[r.key as StaffRoleKey] || [];
    });
    setModalAssignments(initialAssignments);
    setAssignmentModalEvent(event);
  };

  const handleSaveAssignments = async (eventId: string, assignments: Partial<Record<StaffRoleKey, string[]>>) => {
    console.log('Sauvegarde des assignations pour l\'événement:', eventId, assignments);
    
    try {
      // 1. Mettre à jour l'événement localement
      setLocalRaceEvents(prevEvents => prevEvents.map(event => {
        if (event.id === eventId) {
          const updatedEvent = { ...event, ...assignments };
          
          // Mettre à jour selectedStaffIds avec tous les staff assignés
          const allAssignedStaff = new Set<string>();
          STAFF_ROLES_CONFIG.flatMap(g => g.roles).forEach(roleInfo => {
            const roleKey = roleInfo.key as StaffRoleKey;
            const assignedIds = assignments[roleKey] || [];
            assignedIds.forEach(id => allAssignedStaff.add(id));
          });
          
          updatedEvent.selectedStaffIds = Array.from(allAssignedStaff);
          console.log('Événement mis à jour:', updatedEvent);
          return updatedEvent;
        }
        return event;
      }));

      // 2. Synchronisation bidirectionnelle : mettre à jour les profils staff
      setLocalStaff(prevStaff => prevStaff.map(staffMember => {
        const isAssignedToThisEvent = Object.values(assignments).some(roleIds => 
          roleIds.includes(staffMember.id)
        );
        
        if (isAssignedToThisEvent) {
          const updatedStaffMember = { ...staffMember };
          if (!updatedStaffMember.assignedEvents) {
            updatedStaffMember.assignedEvents = [];
          }
          if (!updatedStaffMember.assignedEvents.includes(eventId)) {
            updatedStaffMember.assignedEvents = [...updatedStaffMember.assignedEvents, eventId];
          }
          return updatedStaffMember;
        } else {
          const updatedStaffMember = { ...staffMember };
          if (updatedStaffMember.assignedEvents) {
            updatedStaffMember.assignedEvents = updatedStaffMember.assignedEvents.filter(id => id !== eventId);
          }
          return updatedStaffMember;
        }
      }));

      // 3. Synchronisation bidirectionnelle : mettre à jour les profils véhicules
      if (vehicles && vehicles.length > 0) {
        setLocalVehicles(prevVehicles => prevVehicles.map(vehicle => {
          const isAssignedToThisEvent = assignmentModalEvent?.selectedVehicleIds?.includes(vehicle.id) || false;
          
          if (isAssignedToThisEvent) {
            const updatedVehicle = { ...vehicle };
            if (!updatedVehicle.assignedEvents) {
              updatedVehicle.assignedEvents = [];
            }
            if (!updatedVehicle.assignedEvents.includes(eventId)) {
              updatedVehicle.assignedEvents = [...updatedVehicle.assignedEvents, eventId];
            }
            return updatedVehicle;
          } else {
            const updatedVehicle = { ...vehicle };
            if (updatedVehicle.assignedEvents) {
              updatedVehicle.assignedEvents = updatedVehicle.assignedEvents.filter(id => id !== eventId);
            }
            return updatedVehicle;
          }
        }));
      }

      // 4. Fermer le modal
      setAssignmentModalEvent(null);
      setModalAssignments({});
      
      // 5. Afficher un message de confirmation
      alert('Assignations sauvegardées avec succès ! Synchronisation bidirectionnelle effectuée.');
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des assignations:', error);
      alert('Erreur lors de la sauvegarde des assignations. Veuillez réessayer.');
    }
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaffMember(member);
    setIsDetailModalOpen(true);
  };

  const renderDetailsTab = () => (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={staffSearchTerm}
            onChange={(e) => setStaffSearchTerm(e.target.value)}
            className={lightInputClass}
          />
          <select value={staffRoleFilter} onChange={(e) => setStaffRoleFilter(e.target.value as any)} className={lightSelectClass}>
            <option value="all">Tous les rôles</option>
            {Object.values(StaffRole).map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <select value={staffStatusFilter} onChange={(e) => setStaffStatusFilter(e.target.value as any)} className={lightSelectClass}>
            <option value="all">Tous les statuts</option>
            {Object.values(StaffStatus).map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaffMembers.map(member => {
            const daysAssigned = calculateDaysAssigned(member.id, localRaceEvents);
            return (
              <div key={member.id} className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col border">
                <div className="p-4 flex-grow">
                    <div className="flex items-center space-x-4 mb-3">
                        {member.photoUrl ? <img src={member.photoUrl} alt="" className="w-16 h-16 rounded-full object-cover"/> : <UserCircleIcon className="w-16 h-16 text-gray-400"/>}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">{member.firstName} {member.lastName}</h3>
                            <p className={`text-sm font-semibold px-2 py-0.5 mt-1 inline-block rounded-full ${STAFF_ROLE_COLORS[member.role] || STAFF_ROLE_COLORS[StaffRole.AUTRE]}`}>{member.customRole || member.role}</p>
                        </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                        <p><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STAFF_STATUS_COLORS[member.status]}`}>{member.status}</span></p>
                        {member.phone && <p className="flex items-center"><PhoneIcon className="w-4 h-4 mr-2 text-gray-400"/> {member.phone}</p>}
                        {member.email && <p className="flex items-center"><MailIcon className="w-4 h-4 mr-2 text-gray-400"/> {member.email}</p>}
                        {member.address?.city && <p className="flex items-center"><LocationMarkerIcon className="w-4 h-4 mr-2 text-gray-400"/> {member.address.city}</p>}
                        <div className="pt-2">
                            <p className="flex items-center font-semibold"><CalendarDaysIcon className="w-4 h-4 mr-2 text-gray-400"/> Jours de mission : {daysAssigned}</p>
                            {member.assignedEvents && member.assignedEvents.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs text-gray-500 mb-1">Événements assignés :</p>
                                    <div className="space-y-1">
                                        {member.assignedEvents.slice(0, 3).map(eventId => {
                                            const event = localRaceEvents.find(e => e.id === eventId);
                                            return event ? (
                                                <div key={eventId} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    {event.name} ({new Date(event.date).toLocaleDateString('fr-FR')})
                                                </div>
                                            ) : null;
                                        })}
                                        {member.assignedEvents.length > 3 && (
                                            <div className="text-xs text-gray-500">
                                                +{member.assignedEvents.length - 3} autres...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-3 bg-gray-50 border-t flex justify-end space-x-2">
                    <ActionButton onClick={() => openEditModal(member)} variant="secondary" size="sm" icon={<PencilIcon className="w-4 h-4"/>}>Modifier</ActionButton>
                    <ActionButton onClick={() => handleDeleteStaff(member.id)} variant="danger" size="sm" icon={<TrashIcon className="w-4 h-4"/>}>Supprimer</ActionButton>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );

  const renderPlanningTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Planning Global du Staff</h3>
        {upcomingEvents && upcomingEvents.length > 0 ? (
          <GlobalPlanningTab upcomingEvents={upcomingEvents} onAssign={handleOpenAssignmentModal} />
        ) : (
          <p className="text-center text-gray-500 italic py-8">Aucun événement à venir pour le planning.</p>
        )}
      </div>
    </div>
  );

  return (
    <SectionWrapper title="Gestion du Staff">
      <div className="space-y-6">
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Détails du Staff
            </button>
            <button
              onClick={() => setActiveTab('planning')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'planning'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Planning Global
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'planning' && renderPlanningTab()}

        {/* Add Staff Button */}
        <div className="flex justify-end">
          <ActionButton
            onClick={() => {
              setEditingStaffMember(null);
              setIsDetailModalOpen(true);
            }}
            icon={<PlusCircleIcon className="w-4 h-4" />}
          >
            Ajouter un Membre du Staff
          </ActionButton>
        </div>
      </div>

      {/* Staff Detail Modal */}
      {isDetailModalOpen && (
        <StaffDetailModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          staffMember={editingStaffMember}
          onSave={handleSaveStaff}
          allRaceEvents={raceEvents}
          performanceEntries={performanceEntries}
          daysAssigned={editingStaffMember ? calculateDaysAssigned(editingStaffMember.id, raceEvents || []) : 0}
        />
      )}

      {/* Assignment Modal */}
      {assignmentModalEvent && (
        <Modal isOpen={!!assignmentModalEvent} onClose={() => setAssignmentModalEvent(null)} title={`Assignation Staff et Véhicules: ${assignmentModalEvent.name}`}>
          {/* Message d'information sur le système de filtrage */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Système de filtrage automatique :</strong> Seuls les staff ayant le bon rôle peuvent être assignés à chaque poste. 
                  Par exemple, un mécanicien ne peut être assigné qu'au poste "Mécanicien".
                </p>
              </div>
            </div>
          </div>
          
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            {STAFF_ROLES_CONFIG.map(group => (
              <div key={group.group} className="mb-4">
                <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">{group.group}</h4>
                <div className="space-y-3">
                  {group.roles.map(roleInfo => {
                    const roleKey = roleInfo.key as StaffRoleKey;
                    const selectedForRole = modalAssignments[roleKey] || [];
                    
                    return (
                      <div key={roleKey}>
                        <label className="block text-sm font-medium text-gray-700">{roleInfo.label}</label>
                        <div className="mt-1 p-2 border rounded-md space-y-1 bg-gray-50 max-h-40 overflow-y-auto">
                          {/* Filtre pour ne montrer que les staff compatibles */}
                          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                            <strong>Rôle requis :</strong> {roleInfo.label} ({roleInfo.key})
                          </div>
                          
                          {localStaff && localStaff
                            .filter(member => member.role === roleInfo.key) // Seulement les staff avec le bon rôle
                            .map(member => {
                            // Vérifier la disponibilité (conflits d'événements)
                            const isUnavailable = localRaceEvents.some(otherEvent => {
                              if (otherEvent.id === assignmentModalEvent.id || !(otherEvent.selectedStaffIds || []).includes(member.id)) {
                                return false;
                              }
                              const currentEventStart = new Date(assignmentModalEvent.date + 'T00:00:00Z');
                              const currentEventEnd = new Date((assignmentModalEvent.endDate || assignmentModalEvent.date) + 'T23:59:59Z');
                              const otherEventStart = new Date(otherEvent.date + 'T00:00:00Z');
                              const otherEventEnd = new Date((otherEvent.endDate || otherEvent.date) + 'T23:59:59Z');
                              
                              return currentEventStart <= otherEventEnd && currentEventEnd >= otherEventStart;
                            });
                            
                            return (
                              <div key={member.id} className="flex items-center">
                                <input 
                                  type="checkbox" 
                                  id={`${roleKey}-${member.id}`}
                                  checked={selectedForRole.includes(member.id)}
                                  disabled={isUnavailable}
                                  onChange={() => {
                                    const newSelection = selectedForRole.includes(member.id)
                                      ? selectedForRole.filter(id => id !== member.id)
                                      : [...selectedForRole, member.id];
                                    setModalAssignments(prev => ({...prev, [roleKey]: newSelection}));
                                  }}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor={`${roleKey}-${member.id}`} className={`ml-2 text-sm ${isUnavailable ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {member.firstName} {member.lastName} ({member.role})
                                  {isUnavailable && (
                                    <span className="text-orange-500 font-medium"> - Non disponible (conflit d'événement)</span>
                                  )}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Section Véhicules */}
            {vehicles && vehicles.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Véhicules</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Véhicules assignés à l'événement</label>
                    <div className="mt-1 p-2 border rounded-md space-y-1 bg-gray-50 max-h-40 overflow-y-auto">
                      {vehicles.map(vehicle => {
                        const isAssignedToThisEvent = assignmentModalEvent.selectedVehicleIds?.includes(vehicle.id) || false;
                        const isUnavailable = localRaceEvents.some(otherEvent => {
                          if (otherEvent.id === assignmentModalEvent.id || !(otherEvent.selectedVehicleIds || []).includes(vehicle.id)) {
                            return false;
                          }
                          const currentEventStart = new Date(assignmentModalEvent.date + 'T00:00:00Z');
                          const currentEventEnd = new Date((assignmentModalEvent.endDate || assignmentModalEvent.date) + 'T23:59:59Z');
                          const otherEventStart = new Date(otherEvent.date + 'T00:00:00Z');
                          const otherEventEnd = new Date((otherEvent.endDate || otherEvent.date) + 'T23:59:59Z');
                          
                          return currentEventStart <= otherEventEnd && currentEventEnd >= otherEventStart;
                        });
                        
                        return (
                          <div key={vehicle.id} className="flex items-center">
                            <input 
                              type="checkbox" 
                              id={`vehicle-${vehicle.id}`}
                              checked={isAssignedToThisEvent}
                              disabled={isUnavailable}
                              onChange={() => {
                                const currentVehicleIds = assignmentModalEvent.selectedVehicleIds || [];
                                const newVehicleIds = isAssignedToThisEvent
                                  ? currentVehicleIds.filter(id => id !== vehicle.id)
                                  : [...currentVehicleIds, vehicle.id];
                                
                                // Mettre à jour l'événement localement
                                setLocalRaceEvents(prevEvents => prevEvents.map(event => 
                                  event.id === assignmentModalEvent.id 
                                    ? { ...event, selectedVehicleIds: newVehicleIds }
                                    : event
                                ));
                                
                                // Mettre à jour assignmentModalEvent
                                setAssignmentModalEvent(prev => prev ? { ...prev, selectedVehicleIds: newVehicleIds } : null);
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={`vehicle-${vehicle.id}`} className={`ml-2 text-sm ${isUnavailable ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {vehicle.name} ({vehicle.licensePlate}) {isUnavailable && "(Non dispo.)"}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-4 pt-3 border-t">
              <ActionButton variant="secondary" onClick={() => setAssignmentModalEvent(null)}>Annuler</ActionButton>
              <ActionButton onClick={() => handleSaveAssignments(assignmentModalEvent.id, modalAssignments)}>Sauvegarder</ActionButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
          title={confirmAction.title}
          message={confirmAction.message}
        />
      )}
    </SectionWrapper>
  );
};

export default StaffSection;
