

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
  onSaveRaceEvent?: (event: RaceEvent) => Promise<void>;
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
  onSaveRaceEvent,
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

  // Force la mise à jour des alertes quand les assignations changent
  useEffect(() => {
    console.log('ModalAssignments changé, recalcul des alertes...');
    console.log('Nouveau modalAssignments:', modalAssignments);
  }, [modalAssignments]);

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

  // Détection automatique des alertes et actions requises
  const alertsAndActions = useMemo(() => {
    if (!localRaceEvents || !localStaff) return [];
    
    const alerts = [];
    
    localRaceEvents.forEach(event => {
      // Vérifier si l'événement est à venir
      const eventDate = new Date(event.date);
      const today = new Date();
      if (eventDate < today) return; // Ignorer les événements passés
      
      // 1. Vérifier si un directeur sportif est assigné
      // Prendre en compte les assignations en cours (modalAssignments) ET les assignations sauvegardées
      const currentDSAssignments = modalAssignments.directeurSportifId || [];
      const savedDSAssignments = event.directeurSportifId || [];
      const hasDirecteurSportif = (currentDSAssignments.length > 0) || (savedDSAssignments.length > 0);
      
      if (!hasDirecteurSportif) {
        alerts.push({
          type: 'warning',
          message: `DS manquant pour ${event.name}`,
          eventId: event.id,
          eventName: event.name,
          action: 'assignDS',
          priority: 'high'
        });
      }
      
      // 2. Vérifier si des coureurs sont sélectionnés
      const hasRiders = event.selectedRiderIds && event.selectedRiderIds.length > 0;
      if (!hasRiders) {
        alerts.push({
          type: 'warning',
          message: `Aucun coureur sélectionné pour ${event.name}`,
          eventId: event.id,
          eventName: event.name,
          action: 'assignRiders',
          priority: 'medium'
        });
      }
      
      // 3. Vérifier si le staff minimum est assigné
      // Prendre en compte les assignations en cours ET sauvegardées
      const currentStaffAssignments = Object.values(modalAssignments).flat();
      const savedStaffAssignments = event.selectedStaffIds || [];
      const hasMinimumStaff = (currentStaffAssignments.length > 0) || 
                              (savedStaffAssignments.length > 0) ||
                              (event.directeurSportifId && event.directeurSportifId.length > 0) ||
                              (event.assistantId && event.assistantId.length > 0) ||
                              (event.mecanoId && event.mecanoId.length > 0);
      
      if (!hasMinimumStaff) {
        alerts.push({
          type: 'info',
          message: `Staff minimum non assigné pour ${event.name}`,
          eventId: event.id,
          eventName: event.name,
          action: 'assignStaff',
          priority: 'medium'
        });
      }
    });
    
    // Trier par priorité et date
    return alerts.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [localRaceEvents, localStaff, modalAssignments]); // Ajout de modalAssignments comme dépendance

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
        console.warn('⚠️ onSave n\'est pas défini - sauvegarde impossible');
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
      // 1. Mettre à jour l'événement localement avec TOUTES les assignations
      let updatedEvent: RaceEvent | null = null;
      
      setLocalRaceEvents(prevEvents => prevEvents.map(event => {
        if (event.id === eventId) {
          // Créer un événement mis à jour avec toutes les assignations
          const eventUpdated = { 
            ...event, 
            ...assignments,
            // Mettre à jour explicitement chaque propriété de rôle
            directeurSportifId: assignments.directeurSportifId || event.directeurSportifId || [],
            assistantId: assignments.assistantId || event.assistantId || [],
            mecanoId: assignments.mecanoId || event.mecanoId || [],
            entraineurId: assignments.entraineurId || event.entraineurId || [],
            respPerfId: assignments.respPerfId || event.respPerfId || []
          };
          
          // Mettre à jour selectedStaffIds avec tous les staff assignés
          const allAssignedStaff = new Set<string>();
          Object.values(assignments).forEach(roleIds => {
            if (Array.isArray(roleIds)) {
              roleIds.forEach(id => allAssignedStaff.add(id));
            }
          });
          
          eventUpdated.selectedStaffIds = Array.from(allAssignedStaff);
          console.log('🔄 Événement mis à jour avec toutes les assignations:', eventUpdated);
          
          // Stocker l'événement mis à jour pour la sauvegarde
          updatedEvent = eventUpdated;
          return eventUpdated;
        }
        return event;
      }));

      // 2. Synchronisation bidirectionnelle : mettre à jour les profils staff
      setLocalStaff(prevStaff => prevStaff.map(staffMember => {
        const isAssignedToThisEvent = Object.values(assignments).some(roleIds => 
          Array.isArray(roleIds) && roleIds.includes(staffMember.id)
        );
        
        if (isAssignedToThisEvent) {
          // Ajouter l'événement à la liste des événements du staff
          const updatedStaffMember = { ...staffMember };
          if (!updatedStaffMember.assignedEvents) {
            updatedStaffMember.assignedEvents = [];
          }
          if (!updatedStaffMember.assignedEvents.includes(eventId)) {
            updatedStaffMember.assignedEvents = [...updatedStaffMember.assignedEvents, eventId];
          }
          console.log(`Staff ${staffMember.firstName} ${staffMember.lastName} assigné à l'événement ${eventId}`);
          return updatedStaffMember;
        } else {
          // Retirer l'événement de la liste des événements du staff
          const updatedStaffMember = { ...staffMember };
          if (updatedStaffMember.assignedEvents) {
            updatedStaffMember.assignedEvents = updatedStaffMember.assignedEvents.filter(id => id !== eventId);
          }
          console.log(`Staff ${staffMember.firstName} ${staffMember.lastName} retiré de l'événement ${eventId}`);
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
            console.log(`Véhicule ${vehicle.name} assigné à l'événement ${eventId}`);
            return updatedVehicle;
          } else {
            const updatedVehicle = { ...vehicle };
            if (updatedVehicle.assignedEvents) {
              updatedVehicle.assignedEvents = updatedVehicle.assignedEvents.filter(id => id !== eventId);
            }
            console.log(`Véhicule ${vehicle.name} retiré de l'événement ${eventId}`);
            return updatedVehicle;
          }
        }));
      }

      // 4. Attendre que l'état soit mis à jour avant de sauvegarder
      console.log('⏳ Attente de la mise à jour de l\'état local...');
      
      // 5. Réinitialiser les assignations du modal pour forcer la mise à jour des alertes
      setModalAssignments({});
      
      // 6. Debug: Vérifier que les alertes se mettent à jour
      console.log('✅ Assignations sauvegardées localement !');
      console.log('Nouvelles assignations:', assignments);
      console.log('Synchronisation bidirectionnelle effectuée');
      
      // 7. Attendre un peu pour que l'état soit mis à jour, puis sauvegarder
      setTimeout(async () => {
        console.log('🔄 Démarrage de la sauvegarde Firebase...');
        
        // Récupérer l'événement mis à jour depuis l'état local
        const currentUpdatedEvent = localRaceEvents.find(e => e.id === eventId);
        console.log('🔍 Événement récupéré pour sauvegarde:', currentUpdatedEvent);
        
        if (currentUpdatedEvent && onSaveRaceEvent) {
          try {
            console.log('🚀 Lancement de la sauvegarde Firebase pour l\'événement:', currentUpdatedEvent.id);
            await onSaveRaceEvent(currentUpdatedEvent);
            console.log('✅ Événement sauvegardé avec succès en base de données');
          } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde Firebase de l\'événement:', error);
          }
        }
        
        // Continuer avec la sauvegarde des profils staff
        if (onSave) {
          try {
            console.log('🔄 Sauvegarde automatique des profils staff mis à jour...');
            
            // Récupérer tous les staff qui ont été modifiés
            const updatedStaffMembers = localStaff.filter(staffMember => {
              // Vérifier si le staff est assigné dans les nouvelles assignations
              const isAssignedToThisEvent = Object.values(assignments).some(roleIds => 
                Array.isArray(roleIds) && roleIds.includes(staffMember.id)
              );
              
              // Vérifier si le staff était déjà assigné à cet événement
              const wasAssignedToThisEvent = staffMember.assignedEvents?.includes(eventId) || false;
              
              // Détecter un changement (assignation ou désassignation)
              const hasChanged = isAssignedToThisEvent !== wasAssignedToThisEvent;
              
              if (hasChanged) {
                console.log(`🔄 Changement détecté pour ${staffMember.firstName} ${staffMember.lastName}:`, {
                  wasAssigned: wasAssignedToThisEvent,
                  isNowAssigned: isAssignedToThisEvent,
                  eventId: eventId
                });
              }
              
              return hasChanged;
            });
            
            console.log(`📝 ${updatedStaffMembers.length} profils staff à sauvegarder:`, updatedStaffMembers.map(s => `${s.firstName} ${s.lastName}`));
            
            // Sauvegarder chaque profil staff modifié
            for (const staffMember of updatedStaffMembers) {
              await onSave(staffMember);
              console.log(`✅ Profil ${staffMember.firstName} ${staffMember.lastName} sauvegardé`);
            }
            
            console.log('🎉 Tous les profils staff ont été sauvegardés avec succès !');
            
            // SAUVEGARDE AUTOMATIQUE DES VÉHICULES MODIFIÉS
            if (vehicles && vehicles.length > 0) {
              console.log('🚗 Sauvegarde automatique des profils véhicules mis à jour...');
              
              // Récupérer tous les véhicules qui ont été modifiés
              const updatedVehicles = vehicles.filter(vehicle => {
                const isAssignedToThisEvent = assignmentModalEvent?.selectedVehicleIds?.includes(vehicle.id) || false;
                const wasAssignedToThisEvent = vehicle.assignedEvents?.includes(eventId) || false;
                return isAssignedToThisEvent !== wasAssignedToThisEvent; // Changement détecté
              });
              
              if (updatedVehicles.length > 0) {
                console.log(`📝 ${updatedVehicles.length} véhicules à sauvegarder:`, updatedVehicles.map(v => `${v.name} (${v.licensePlate})`));
                
                // Ici vous pouvez appeler votre fonction de sauvegarde des véhicules
                // Par exemple: await saveVehicles(updatedVehicles);
                console.log('💾 Véhicules prêts pour sauvegarde en base de données');
              }
            }
          } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde des profils staff:', error);
            alert('⚠️ Erreur lors de la sauvegarde des profils staff. Vérifiez la console pour plus de détails.');
          }
        }
      }, 100); // Attendre 100ms pour que l'état soit mis à jour

      // 8. Notification de succès
      alert('✅ Assignations sauvegardées localement !\n\nSynchronisation bidirectionnelle effectuée :\n- Événement mis à jour\n- Profils staff mis à jour\n- Profils véhicules mis à jour\n\n💾 Sauvegarde Firebase en cours...');

      // 9. Fermer le modal et réinitialiser
      setAssignmentModalEvent(null);
      setModalAssignments({});
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des assignations:', error);
      alert('Erreur lors de la sauvegarde des assignations. Veuillez réessayer.');
    }
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaffMember(member);
    setIsDetailModalOpen(true);
  };
  const openAddNewMissionModal = () => {
    setEditingMission(null);
    setNewMissionData(initialMissionFormState);
    setIsPostMissionModalOpen(true);
  };

  const openEditMissionModal = (mission: Mission) => {
      setEditingMission(mission);
      setNewMissionData({
          ...mission,
          requirements: mission.requirements || [],
      });
      setIsPostMissionModalOpen(true);
  };

  const handleDeleteMission = (missionToDelete: Mission) => {
      setConfirmAction({
          title: `Supprimer l'annonce "${missionToDelete.title}"`,
          message: "Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible.",
          onConfirm: () => {
              setLocalMissions(prev => prev.filter(m => m.id !== missionToDelete.id));
          }
      });
  };
  
  const handleUpdateMissionStatus = (missionId: string, status: MissionStatus) => {
    setLocalMissions(prev => prev.map(m => m.id === missionId ? { ...m, status } : m));
  };

  const handleSaveMission = () => {
    if (!team) return;
    
    if (editingMission) {
        setLocalMissions(prev => prev.map(m => 
            m.id === editingMission.id 
            ? { ...m, ...newMissionData, id: editingMission.id, teamId: team.id } 
            : m
        ));
    } else {
        const newMission: Mission = {
            ...newMissionData,
            id: generateId(),
            teamId: team.id,
            status: MissionStatus.OPEN,
            applicants: []
        };
        setLocalMissions(prev => [...prev, newMission]);
    }
    setIsPostMissionModalOpen(false);
    setEditingMission(null);
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
                                            if (!event) return null;
                                            
                                            // Déterminer le rôle assigné pour cet événement
                                            let assignedRole = 'Staff';
                                            if (event.directeurSportifId?.includes(member.id)) assignedRole = 'Directeur Sportif';
                                            else if (event.assistantId?.includes(member.id)) assignedRole = 'Assistant';
                                            else if (event.mecanoId?.includes(member.id)) assignedRole = 'Mécanicien';
                                            else if (event.entraineurId?.includes(member.id)) assignedRole = 'Entraîneur';
                                            else if (event.respPerfId?.includes(member.id)) assignedRole = 'Resp. Performance';
                                            
                                            return (
                                                <div key={eventId} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    <div className="font-medium">{event.name}</div>
                                                    <div className="text-blue-600">{new Date(event.date).toLocaleDateString('fr-FR')}</div>
                                                    <div className="text-blue-500 font-semibold">{assignedRole}</div>
                                                </div>
                                            );
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
      {/* Section Alertes & Actions Requises */}
      {alertsAndActions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Alertes & Actions Requises</h3>
          <div className="space-y-3">
            {alertsAndActions.map((alert, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'warning' ? 'bg-red-50 border-red-400' :
                alert.type === 'info' ? 'bg-blue-50 border-blue-400' :
                'bg-yellow-50 border-yellow-400'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 ${
                      alert.type === 'warning' ? 'text-red-500' :
                      alert.type === 'info' ? 'text-blue-500' :
                      'text-yellow-500'
                    }`}>
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        alert.type === 'warning' ? 'text-red-800' :
                        alert.type === 'info' ? 'text-blue-800' :
                        'text-yellow-800'
                      }`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Priorité: {alert.priority === 'high' ? 'Élevée' : alert.priority === 'medium' ? 'Moyenne' : 'Faible'}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {alert.action === 'assignDS' && (
                      <ActionButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const event = localRaceEvents.find(e => e.id === alert.eventId);
                          if (event) {
                            setAssignmentModalEvent(event);
                            // Pré-sélectionner l'onglet directeur sportif
                            const initialAssignments = { directeurSportifId: event.directeurSportifId || [] };
                            setModalAssignments(initialAssignments);
                          }
                        }}
                      >
                        Assigner DS
                      </ActionButton>
                    )}
                    {alert.action === 'assignRiders' && (
                      <ActionButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          // Naviguer vers la section des effectifs pour assigner des coureurs
                          // Ici vous pouvez implémenter la navigation vers la section appropriée
                          alert('Navigation vers la section Effectifs pour assigner des coureurs');
                        }}
                      >
                        Assigner Coureurs
                      </ActionButton>
                    )}
                    {alert.action === 'assignStaff' && (
                      <ActionButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const event = localRaceEvents.find(e => e.id === alert.eventId);
                          if (event) {
                            setAssignmentModalEvent(event);
                          }
                        }}
                      >
                        Assigner Staff
                      </ActionButton>
                    )}
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const event = localRaceEvents.find(e => e.id === alert.eventId);
                        if (event) {
                          setAssignmentModalEvent(event);
                        }
                      }}
                    >
                      Voir
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  const renderSearchTab = () => (
    <StaffSearchTab
      allStaff={localStaff}
      raceEvents={localRaceEvents}
      teamAddress={team?.address}
      performanceEntries={performanceEntries}
    />
  );
  
  const renderMissionSearchTab = () => (
    <MissionSearchSection
      missions={missions}
      teams={teams}
      currentUser={currentUser}
      setMissions={setLocalMissions}
    />
  );

  const renderMyApplicationsTab = () => {
    if (!currentUser?.id || !Array.isArray(localMissions)) return <div className="text-center text-gray-500">Chargement des candidatures...</div>;
    const myApplications = localMissions.filter(m => m.applicants?.includes(currentUser.id));
    return (
        <div className="space-y-3">
            <h3 className="text-xl font-semibold">Mes Candidatures</h3>
            {myApplications.length > 0 ? myApplications.map(mission => (
                <div key={mission.id} className="p-3 bg-white rounded-md border flex justify-between items-center">
                    <div>
                        <p className="font-bold">{mission.title} - <span className="font-normal text-gray-600">{teams.find(t=>t.id === mission.teamId)?.name}</span></p>
                        <p className="text-sm text-gray-500">Statut: En attente</p>
                    </div>
                    <ActionButton variant="secondary" size="sm" onClick={() => setSelectedMissionForDetails(mission)}>Voir l'annonce</ActionButton>
                </div>
            )) : <p className="italic text-gray-500">Vous n'avez postulé à aucune mission.</p>}
        </div>
    );
  };
  
  const renderPostingsManagementTab = () => {
    if (!currentUser?.permissionRole || !Array.isArray(localMissions)) return <div className="text-center text-gray-500">Chargement des annonces...</div>;
    if (currentUser.permissionRole !== TeamRole.ADMIN && currentUser.permissionRole !== TeamRole.EDITOR) {
      return null;
    }
    const myTeamMissions = localMissions.filter(m => m.teamId === team?.id);
    const openMissions = myTeamMissions.filter(m => m.status === MissionStatus.OPEN).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const archivedMissions = myTeamMissions.filter(m => m.status !== MissionStatus.OPEN).sort((a,b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    
    const MissionListItem = ({ mission }: { mission: Mission}) => (
         <div key={mission.id} className="p-3 bg-white rounded-md border flex justify-between items-center flex-wrap gap-2">
             <div>
                <p className="font-bold">{mission.title} ({mission.role})</p>
                <p className="text-sm text-gray-500">Statut: {mission.status} - Du {new Date(mission.startDate+'T12:00:00Z').toLocaleDateString('fr-CA')} au {new Date(mission.endDate+'T12:00:00Z').toLocaleDateString('fr-CA')}</p>
             </div>
             <div className="flex-shrink-0 space-x-2">
                {mission.status === MissionStatus.OPEN ? (
                    <ActionButton onClick={() => handleUpdateMissionStatus(mission.id, MissionStatus.CLOSED)} variant="warning" size="sm">Clôturer</ActionButton>
                ) : (
                    <ActionButton onClick={() => handleUpdateMissionStatus(mission.id, MissionStatus.OPEN)} variant="primary" size="sm">Ré-ouvrir</ActionButton>
                )}
                <ActionButton onClick={() => openEditMissionModal(mission)} variant="secondary" size="sm" icon={<PencilIcon className="w-4 h-4"/>}/>
                <ActionButton onClick={() => handleDeleteMission(mission)} variant="danger" size="sm" icon={<TrashIcon className="w-4 h-4"/>}/>
                <ActionButton onClick={() => { setMissionForApplicants(mission); setIsApplicantsModalOpen(true); }}>
                    Voir Candidats ({mission.applicants?.length || 0})
                </ActionButton>
             </div>
         </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Annonces de Mon Équipe</h3>
                <ActionButton onClick={openAddNewMissionModal} icon={<PlusCircleIcon className="w-5 h-5"/>}>Publier une mission</ActionButton>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2 border-b pb-1">Annonces Actives</h4>
              <div className="space-y-3">
                {openMissions.length > 0 ? (
                  openMissions.map(m => <MissionListItem key={m.id} mission={m} />)
                ) : (
                  <p className="italic text-gray-500 p-3">Aucune annonce active.</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-700 mb-2 border-b pb-1">Annonces Archivées</h4>
              <div className="space-y-3">
                {archivedMissions.length > 0 ? (
                  archivedMissions.map(m => <MissionListItem key={m.id} mission={m} />)
                ) : (
                  <p className="italic text-gray-500 p-3">Aucune annonce archivée.</p>
                )}
              </div>
            </div>
        </div>
    );
  };

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
              {alertsAndActions.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {alertsAndActions.length}
                </span>
              )}
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
                                                     {/* Tous les staff peuvent être assignés à n'importe quel poste */}
                           <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                             <strong>Flexibilité :</strong> Tous les staff peuvent être assignés à ce poste
                           </div>
                           
                           {localStaff && localStaff
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

      {/* Mission Modals */}
      {missionForApplicants && (
        <Modal isOpen={isApplicantsModalOpen} onClose={() => setIsApplicantsModalOpen(false)} title={`Candidats pour : ${missionForApplicants.title}`}>
          {(missionForApplicants.applicants || []).length === 0 ? (
            <p className="italic text-gray-500 text-center py-4">Aucun candidat pour le moment.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto p-1">
              {(missionForApplicants.applicants || []).map(applicantId => {
                const applicantUser = users.find(u => u.id === applicantId);
                if (!applicantUser) {
                    return <div key={applicantId} className="p-2 bg-red-100 rounded-md">Profil candidat non trouvé (ID: {applicantId})</div>;
                }
                const staffProfileForApplicant = localStaff ? localStaff.find(s => s.email === applicantUser.email) : null || users.find(u => u.id === applicantId);

                const applicant = {
                    id: applicantUser.id,
                    photoUrl: (staffProfileForApplicant as StaffMember)?.photoUrl,
                    firstName: applicantUser.firstName,
                    lastName: applicantUser.lastName,
                    email: applicantUser.email,
                    phone: (staffProfileForApplicant as StaffMember)?.phone,
                    role: (staffProfileForApplicant as StaffMember)?.role || 'N/A',
                    address: (staffProfileForApplicant as StaffMember)?.address,
                    professionalSummary: (staffProfileForApplicant as StaffMember)?.professionalSummary || '',
                    skills: (staffProfileForApplicant as StaffMember)?.skills || [],
                    workHistory: (staffProfileForApplicant as StaffMember)?.workHistory || [],
                    education: (staffProfileForApplicant as StaffMember)?.education || [],
                };
                
                const ratings = performanceEntries.flatMap(pe => pe.staffRatings || []).filter(r => r.staffId === applicant.id && r.rating > 0);
                const averageRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
                
                return (
                    <button 
                        key={applicant.id}
                        onClick={() => setViewingApplicant(applicant)}
                        className="w-full text-left p-3 bg-gray-50 rounded-lg shadow-sm border hover:bg-gray-100 flex justify-between items-center transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {applicant.photoUrl ? (
                            <img src={applicant.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover"/>
                            ) : (
                            <UserCircleIcon className="w-10 h-10 text-gray-400" />
                            )}
                            <div>
                            <h4 className="font-semibold text-gray-800">{applicant.firstName} {applicant.lastName}</h4>
                            <p className="text-sm text-gray-600">{applicant.role}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            {averageRating > 0 && (
                            <div className="flex items-center text-yellow-500 font-bold">
                                <StarIcon className="w-5 h-5 mr-1" />
                                <span>{averageRating.toFixed(1)}</span>
                            </div>
                            )}
                            <p className="text-xs text-gray-500">({ratings.length} avis)</p>
                        </div>
                    </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {viewingApplicant && (
        <Modal isOpen={!!viewingApplicant} onClose={() => setViewingApplicant(null)} title={`Profil de ${viewingApplicant.firstName} ${viewingApplicant.lastName}`}>
            <div key={viewingApplicant.id} className="bg-white rounded-lg overflow-hidden">
                <div className="p-4">
                    <div className="flex items-start gap-4">
                        {viewingApplicant.photoUrl ? (
                            <img src={viewingApplicant.photoUrl} alt="" className="w-20 h-20 rounded-full object-cover"/>
                        ) : (
                            <UserCircleIcon className="w-20 h-20 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-xl font-bold text-gray-800">{viewingApplicant.firstName} {viewingApplicant.lastName}</h4>
                                    <p className="text-sm text-gray-600">{viewingApplicant.role}</p>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
                                {viewingApplicant.phone && <p className="flex items-center"><PhoneIcon className="w-4 h-4 mr-2 text-gray-400"/> {viewingApplicant.phone}</p>}
                                {viewingApplicant.email && <p className="flex items-center"><MailIcon className="w-4 h-4 mr-2 text-gray-400"/> <a href={`mailto:${viewingApplicant.email}`} className="text-blue-600 hover:underline">{viewingApplicant.email}</a></p>}
                                {viewingApplicant.address?.city && <p className="flex items-center"><LocationMarkerIcon className="w-4 h-4 mr-2 text-gray-400"/> {viewingApplicant.address.city}, {viewingApplicant.address.country}</p>}
                            </div>
                        </div>
                    </div>

                    {viewingApplicant.professionalSummary && (
                        <div className="mt-4 pt-3 border-t">
                            <h5 className="text-sm font-semibold text-gray-700">Résumé Professionnel (CV)</h5>
                            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{viewingApplicant.professionalSummary}</p>
                        </div>
                    )}
                    
                    {viewingApplicant.workHistory && viewingApplicant.workHistory.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <h5 className="text-sm font-semibold text-gray-700">Expériences</h5>
                            <ul className="list-disc list-inside mt-1 space-y-1 text-sm text-gray-600">
                                {viewingApplicant.workHistory.map(exp => (
                                    <li key={exp.id}>
                                        <strong>{exp.position}</strong> chez {exp.company} ({exp.startDate} - {exp.endDate || 'Actuel'})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {viewingApplicant.education && viewingApplicant.education.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <h5 className="text-sm font-semibold text-gray-700">Formations</h5>
                            <ul className="list-disc list-inside mt-1 space-y-1 text-sm text-gray-600">
                                {viewingApplicant.education.map(edu => (
                                    <li key={edu.id}>
                                        <strong>{edu.degree}</strong> - {edu.institution} ({edu.year})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {viewingApplicant.skills && viewingApplicant.skills.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <h5 className="text-sm font-semibold text-gray-700">Compétences</h5>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {viewingApplicant.skills.map(skill => (
                                    <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">{skill}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
      )}

      {selectedMissionForDetails && (
        <Modal isOpen={!!selectedMissionForDetails} onClose={() => setSelectedMissionForDetails(null)} title={selectedMissionForDetails.title}>
            <div className="space-y-4 text-gray-700">
                <p><strong>Équipe:</strong> {teams.find(t => t.id === selectedMissionForDetails.teamId)?.name}</p>
                <p><strong>Rôle:</strong> {selectedMissionForDetails.role}</p>
                <p><strong>Dates:</strong> Du {new Date(selectedMissionForDetails.startDate+'T12:00:00Z').toLocaleDateString('fr-CA')} au {new Date(selectedMissionForDetails.endDate+'T12:00:00Z').toLocaleDateString('fr-CA')}</p>
                <p><strong>Lieu:</strong> {selectedMissionForDetails.location}</p>
                <p><strong>Compensation:</strong> {selectedMissionForDetails.compensation} {selectedMissionForDetails.dailyRate ? `(${selectedMissionForDetails.dailyRate}€/jour)` : ''}</p>
                <div>
                    <strong className="font-semibold text-gray-800">Description:</strong>
                    <p className="mt-1 whitespace-pre-wrap">{selectedMissionForDetails.description}</p>
                </div>
                {selectedMissionForDetails.requirements && selectedMissionForDetails.requirements.length > 0 && (
                    <div>
                        <strong className="font-semibold text-gray-800">Prérequis:</strong>
                        <ul className="list-disc list-inside mt-1">
                            {selectedMissionForDetails.requirements.map((req, i) => <li key={i}>{req}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        </Modal>
      )}

      <Modal isOpen={isPostMissionModalOpen} onClose={() => setIsPostMissionModalOpen(false)} title={editingMission ? "Modifier la mission" : "Publier une nouvelle mission"}>
        <div className="space-y-3">
          <input type="text" placeholder="Titre de la mission" value={newMissionData.title} onChange={e => setNewMissionData(p => ({ ...p, title: e.target.value }))} className={lightInputClass}/>
          <select value={newMissionData.role} onChange={e => setNewMissionData(p => ({ ...p, role: e.target.value as StaffRole }))} className={lightSelectClass}>{Object.values(StaffRole).map(r => <option key={r} value={r}>{r}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={newMissionData.startDate} onChange={e => setNewMissionData(p => ({ ...p, startDate: e.target.value }))} className={lightInputClass}/>
            <input type="date" value={newMissionData.endDate} onChange={e => setNewMissionData(p => ({ ...p, endDate: e.target.value }))} className={lightInputClass}/>
          </div>
          <input type="text" placeholder="Lieu" value={newMissionData.location} onChange={e => setNewMissionData(p => ({ ...p, location: e.target.value }))} className={lightInputClass}/>
          <textarea placeholder="Description de la mission" value={newMissionData.description} onChange={e => setNewMissionData(p => ({ ...p, description: e.target.value }))} rows={3} className={lightInputClass}></textarea>
          <div>
            <label className="text-sm font-medium text-gray-700">Prérequis (un par ligne)</label>
            <textarea placeholder="Permis B obligatoire
Expérience appréciée" value={Array.isArray(newMissionData.requirements) ? newMissionData.requirements.join('\\n') : ''} onChange={e => setNewMissionData(p => ({ ...p, requirements: e.target.value.split('\\n') }))} className={lightInputClass} rows={3}></textarea>
          </div>
          <fieldset className="border p-3 rounded-md">
            <legend className="text-sm font-medium">Rémunération</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                    <label>Type de prestation</label>
                    <select value={newMissionData.compensationType} onChange={e => setNewMissionData(p => ({ ...p, compensationType: e.target.value as MissionCompensationType }))} className={lightSelectClass}>
                        {Object.values(MissionCompensationType).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                </div>
                {newMissionData.compensationType === MissionCompensationType.FREELANCE && (
                    <div>
                        <label>Tarif journalier (€)</label>
                        <input type="number" placeholder="150" value={newMissionData.dailyRate || ''} onChange={e => setNewMissionData(p => ({ ...p, dailyRate: e.target.value ? parseFloat(e.target.value) : undefined }))} className={lightInputClass}/>
                    </div>
                )}
            </div>
            <div className="mt-4">
                <label>Détails sur la compensation</label>
                <input type="text" placeholder="Ex: Logement et repas pris en charge" value={newMissionData.compensation} onChange={e => setNewMissionData(p => ({ ...p, compensation: e.target.value }))} className={lightInputClass}/>
            </div>
          </fieldset>
          <div className="flex justify-end"><ActionButton onClick={handleSaveMission}>{editingMission ? "Sauvegarder" : "Publier"}</ActionButton></div>
        </div>
      </Modal>

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
