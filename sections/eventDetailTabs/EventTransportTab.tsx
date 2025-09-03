import React, { useMemo, useState } from "react";
import ActionButton from "../../components/ActionButton";
import Modal from "../../components/Modal";
import ChevronDownIcon from "../../components/icons/ChevronDownIcon";
import PencilIcon from "../../components/icons/PencilIcon";
import PlusCircleIcon from "../../components/icons/PlusCircleIcon";
import TrashIcon from "../../components/icons/TrashIcon";

import { saveData, deleteData } from "../../services/firebaseService";
import {
  AppState,
  BudgetItemCategory,
  EventBudgetItem,
  EventTransportLeg,
  RaceEvent,
  StaffMember,
  StaffStatus,
  TransportDirection,
  TransportMode,
  TransportStop,
  TransportStopType,
  Vehicle,
  VehicleType,
} from "../../types";

interface EventTransportTabProps {
  event: RaceEvent;
  eventId: string;
  appState: AppState;
  setEventTransportLegs: React.Dispatch<
    React.SetStateAction<EventTransportLeg[]>
  >;
  setEventBudgetItems: React.Dispatch<React.SetStateAction<EventBudgetItem[]>>;
}

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

const initialTransportFormStateFactory = (
  eventId: string
): Omit<EventTransportLeg, "id"> => ({
  eventId: eventId,
  direction: TransportDirection.ALLER,
  mode: TransportMode.MINIBUS,
  departureDate: "",
  departureTime: "",
  departureLocation: "",
  arrivalDate: "",
  arrivalTime: "",
  arrivalLocation: "",
  details: "",
  personName: "", // Will be auto-generated
  isAuroreFlight: false,
  occupants: [],
  assignedVehicleId: undefined,
  driverId: undefined,
  intermediateStops: [],
});

const lightInputBaseClasses =
  "bg-white text-gray-900 border-gray-300 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500";
const lightInputClasses = `mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm ${lightInputBaseClasses}`;
const lightSelectClasses = `mt-1 block w-full pl-3 pr-10 py-2 border rounded-md shadow-sm sm:text-sm ${lightInputBaseClasses}`;

const datesOverlap = (
  startAStr?: string,
  endAStr?: string,
  startBStr?: string,
  endBStr?: string
): boolean => {
  if (!startAStr || !startBStr) return false;

  const sA = new Date(startAStr + "T00:00:00Z");
  const eA = endAStr
    ? new Date(endAStr + "T23:59:59Z")
    : new Date(startAStr + "T23:59:59Z");
  const sB = new Date(startBStr + "T00:00:00Z");
  const eB = endBStr
    ? new Date(endBStr + "T23:59:59Z")
    : new Date(startBStr + "T23:59:59Z");

  return sA <= eB && eA >= sB;
};

const checkVehicleAvailability = (
  vehicle: Vehicle,
  checkStartDate: string | undefined,
  checkEndDate: string | undefined,
  allGlobalTransportLegs: EventTransportLeg[],
  currentLegIdToExclude?: string
): { status: "available" | "maintenance" | "assigned"; reason: string } => {
  if (!checkStartDate) return { status: "available", reason: "" };

  // Check for maintenance
  if (vehicle.nextMaintenanceDate) {
    if (
      datesOverlap(
        checkStartDate,
        checkEndDate,
        vehicle.nextMaintenanceDate,
        vehicle.nextMaintenanceDate
      )
    ) {
      return { status: "maintenance", reason: "(Indisponible - Entretien)" };
    }
  }

  // Check for assignment
  for (const leg of allGlobalTransportLegs) {
    if (leg.id === currentLegIdToExclude) continue;
    if (leg.assignedVehicleId === vehicle.id) {
      if (
        datesOverlap(
          checkStartDate,
          checkEndDate,
          leg.departureDate,
          leg.arrivalDate
        )
      ) {
        return { status: "assigned", reason: "(Indisponible - Assigné)" };
      }
    }
  }
  return { status: "available", reason: "" };
};

export const EventTransportTab: React.FC<EventTransportTabProps> = ({
  event,
  eventId,
  appState,
  setEventTransportLegs,
  setEventBudgetItems,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTransportLeg, setCurrentTransportLeg] = useState<
    Omit<EventTransportLeg, "id"> | EventTransportLeg
  >(initialTransportFormStateFactory(eventId));
  const [isEditing, setIsEditing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const transportLegsForEvent = useMemo(() => {
    return appState.eventTransportLegs.filter((leg) => leg.eventId === eventId);
  }, [appState.eventTransportLegs, eventId]);

  const allAvailablePeople = useMemo(() => {
    const eventParticipantIds = new Set([
      ...(event.selectedRiderIds || []),
      ...(event.selectedStaffIds || []),
    ]);

    const allPeople = [
      ...appState.riders.map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        type: "rider" as "rider" | "staff",
        isParticipant: eventParticipantIds.has(r.id),
      })),
      ...appState.staff.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        type: "staff" as "rider" | "staff",
        isParticipant: eventParticipantIds.has(s.id),
      })),
    ];

    // Sort participants first, then by name
    return allPeople.sort((a, b) => {
      if (a.isParticipant !== b.isParticipant) {
        return a.isParticipant ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    appState.riders,
    appState.staff,
    event.selectedRiderIds,
    event.selectedStaffIds,
  ]);

  const calculateVehicleBudgetItems = (
    legsForEvent: EventTransportLeg[]
  ): EventBudgetItem[] => {
    const budgetItems: EventBudgetItem[] = [];
    legsForEvent.forEach((leg) => {
      const vehicle = leg.assignedVehicleId
        ? appState.vehicles.find((v) => v.id === leg.assignedVehicleId)
        : undefined;
      if (
        vehicle?.estimatedDailyCost &&
        vehicle.estimatedDailyCost > 0 &&
        leg.departureDate
      ) {
        const startDate = new Date(leg.departureDate + "T12:00:00Z");
        const endDate = leg.arrivalDate
          ? new Date(leg.arrivalDate + "T12:00:00Z")
          : startDate;
        const durationInDays = Math.max(
          1,
          Math.round(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1
        );
        const totalCost = vehicle.estimatedDailyCost * durationInDays;

        budgetItems.push({
          id: `auto-vehicle-${leg.id}`,
          eventId: eventId,
          category: BudgetItemCategory.VOITURE_EQUIPE,
          description: `Coût estimé: ${vehicle.name}`,
          estimatedCost: totalCost,
          notes: `Auto-généré: ${durationInDays} jours @ ${vehicle.estimatedDailyCost}€/jour.`,
          isAutoGenerated: true,
          sourceVehicleId: vehicle.id,
        });
      }
    });
    return budgetItems;
  };

  const calculateVacataireBudgetItems = (
    legsForEvent: EventTransportLeg[]
  ): EventBudgetItem[] => {
    const vacataireCosts = new Map<
      string,
      { minDate: Date; maxDate: Date; staff: StaffMember }
    >();
    const allStaffInEvent = appState.staff.filter((s) =>
      event.selectedStaffIds.includes(s.id)
    );

    allStaffInEvent.forEach((staffMember) => {
      if (
        staffMember?.status === StaffStatus.VACATAIRE &&
        staffMember.dailyRate
      ) {
        const staffLegs = legsForEvent.filter((leg) =>
          leg.occupants.some(
            (occ) => occ.id === staffMember.id && occ.type === "staff"
          )
        );

        if (staffLegs.length > 0) {
          let minDate: Date | null = null;
          let maxDate: Date | null = null;

          staffLegs.forEach((leg) => {
            const depDate = leg.departureDate
              ? new Date(leg.departureDate + "T12:00:00Z")
              : null;
            const arrDate = leg.arrivalDate
              ? new Date(leg.arrivalDate + "T12:00:00Z")
              : depDate;

            if (depDate) {
              if (!minDate || depDate < minDate) minDate = depDate;
            }
            if (arrDate) {
              if (!maxDate || arrDate > maxDate) maxDate = arrDate;
            }
          });

          if (minDate && maxDate) {
            vacataireCosts.set(staffMember.id, {
              minDate,
              maxDate,
              staff: staffMember,
            });
          }
        }
      }
    });

    const budgetItems: EventBudgetItem[] = [];
    vacataireCosts.forEach((data, staffId) => {
      const durationDays = Math.max(
        1,
        Math.round(
          (data.maxDate.getTime() - data.minDate.getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      );
      const totalCost = durationDays * data.staff.dailyRate!;
      budgetItems.push({
        id: `auto-vacataire-${eventId}-${staffId}`,
        eventId: eventId,
        category: BudgetItemCategory.SALAIRES,
        description: `Prestation vacataire: ${data.staff.firstName} ${data.staff.lastName}`,
        estimatedCost: totalCost,
        actualCost: totalCost,
        notes: `Auto-généré: ${durationDays} jours @ ${data.staff.dailyRate}€/jour. Basé sur les dates de transport.`,
        isAutoGenerated: true,
        sourceStaffId: staffId,
      });
    });
    return budgetItems;
  };

  const updateCostsForEvent = (allLegsForEvent: EventTransportLeg[]) => {
    const vacataireBudgetItems = calculateVacataireBudgetItems(allLegsForEvent);
    const vehicleBudgetItems = calculateVehicleBudgetItems(allLegsForEvent);

    setEventBudgetItems((prevBudget) => {
      const manualBudgetItemsForEvent = prevBudget.filter(
        (item) => item.eventId === eventId && !item.isAutoGenerated
      );
      const otherEventsBudgetItems = prevBudget.filter(
        (item) => item.eventId !== eventId
      );

      return [
        ...otherEventsBudgetItems,
        ...manualBudgetItemsForEvent,
        ...vacataireBudgetItems,
        ...vehicleBudgetItems,
      ];
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "departureDate" || name === "arrivalDate") {
      setCurrentTransportLeg((prev) => ({
        ...prev,
        [name]: value === "" ? undefined : value,
      }));
      return;
    }

    if (name === "assignedVehicleId") {
      const vehicleId = value;
      const vehicle = appState.vehicles.find((v) => v.id === vehicleId);

      let newMode = (currentTransportLeg as EventTransportLeg).mode;
      if (vehicleId === "perso") {
        newMode = TransportMode.VOITURE_PERSO;
      } else if (vehicle) {
        if (
          [VehicleType.MINIBUS, VehicleType.VOITURE, VehicleType.BUS].includes(
            vehicle.vehicleType
          )
        ) {
          newMode = TransportMode.MINIBUS;
        } else {
          newMode = TransportMode.AUTRE;
        }
      }

      // Vérifier la capacité du nouveau véhicule
      const currentOccupants = (currentTransportLeg as EventTransportLeg).occupants?.length || 0;
      let maxCapacity = Infinity;
      
      if (vehicle && vehicle.seats) {
        maxCapacity = vehicle.seats;
      } else if (vehicleId === "perso") {
        maxCapacity = 5;
      }
      
      // Si le nouveau véhicule a une capacité insuffisante, demander confirmation
      if (maxCapacity !== Infinity && currentOccupants > maxCapacity) {
        const confirmMessage = `Le véhicule sélectionné a une capacité de ${maxCapacity} personne${maxCapacity > 1 ? 's' : ''}, mais ${currentOccupants} occupant${currentOccupants > 1 ? 's' : ''} ${currentOccupants > 1 ? 'sont' : 'est'} déjà sélectionné${currentOccupants > 1 ? 's' : ''}. Voulez-vous continuer et ajuster les occupants ?`;
        
        if (!window.confirm(confirmMessage)) {
          return; // Annuler le changement de véhicule
        }
        
        // Réduire le nombre d'occupants à la capacité maximale
        const updatedOccupants = (currentTransportLeg as EventTransportLeg).occupants?.slice(0, maxCapacity) || [];
        
        setCurrentTransportLeg((prev) => ({
          ...(prev as EventTransportLeg),
          mode: newMode,
          assignedVehicleId: value === "" ? undefined : value,
          driverId: vehicle?.driverId || undefined,
          occupants: updatedOccupants,
        }));
        return;
      }

      setCurrentTransportLeg((prev) => ({
        ...(prev as EventTransportLeg),
        mode: newMode,
        assignedVehicleId: value === "" ? undefined : value,
        driverId: vehicle?.driverId || undefined,
      }));
      return;
    }

    setCurrentTransportLeg((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleOccupantChange = (
    personId: string,
    personType: "rider" | "staff"
  ) => {
    setCurrentTransportLeg((prev) => {
      const updated = structuredClone(prev);
      if (!updated.occupants) updated.occupants = [];
      const isSelected = updated.occupants.some(
        (occ) => occ.id === personId && occ.type === personType
      );

      if (isSelected) {
        // Retirer l'occupant
        updated.occupants = updated.occupants.filter(
          (occ) => !(occ.id === personId && occ.type === personType)
        );
      } else {
        // Vérifier la capacité du véhicule avant d'ajouter
        const vehicle = updated.assignedVehicleId 
          ? appState.vehicles.find(v => v.id === updated.assignedVehicleId)
          : null;
        
        let maxCapacity = Infinity; // Capacité illimitée par défaut
        
        if (vehicle && vehicle.seats) {
          maxCapacity = vehicle.seats;
        } else if (updated.assignedVehicleId === "perso") {
          maxCapacity = 5; // Capacité par défaut pour véhicule personnel
        }
        
        // Vérifier si on peut ajouter un occupant
        if (updated.occupants.length >= maxCapacity) {
          alert(`Impossible d'ajouter plus d'occupants. Capacité maximale du véhicule : ${maxCapacity} personne${maxCapacity > 1 ? 's' : ''}.`);
          return prev; // Ne pas modifier l'état
        }
        
        updated.occupants.push({ id: personId, type: personType });
      }
      return updated;
    });
  };

  const handleAddStop = () => {
    const newStop: TransportStop = {
      id: generateId(),
      location: "",
      date: event.date,
      time: "",
      stopType: TransportStopType.WAYPOINT,
      persons: [],
      notes: "",
      isTimingCritical: false,
      estimatedDuration: 0,
    };
    setCurrentTransportLeg((prev) => {
      const updated = structuredClone(prev);
      if (!updated.intermediateStops) updated.intermediateStops = [];
      updated.intermediateStops.push(newStop);
      return updated;
    });
  };

  const handleRemoveStop = (stopId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette étape ?")) {
      setCurrentTransportLeg((prev) => {
        const updated = structuredClone(prev);
        updated.intermediateStops = (updated.intermediateStops || []).filter(
          (stop) => stop.id !== stopId
        );
        return updated;
      });
    }
  };

  const handleStopChange = (
    index: number,
    field: keyof Omit<TransportStop, "id" | "persons">,
    value: string
  ) => {
    setCurrentTransportLeg((prev) => {
      const updated = structuredClone(prev);
      if (updated.intermediateStops && updated.intermediateStops[index]) {
        (updated.intermediateStops[index] as any)[field] = value;
      }
      return updated;
    });
  };

  const handleStopPersonChange = (
    stopIndex: number,
    personId: string,
    personType: "rider" | "staff"
  ) => {
    setCurrentTransportLeg((prev) => {
      const updated = structuredClone(prev);
      const stop = updated.intermediateStops?.[stopIndex];
      if (stop) {
        if (!stop.persons) stop.persons = [];
        const personIndex = stop.persons.findIndex(
          (p: any) => p.id === personId && p.type === personType
        );
        if (personIndex > -1) {
          stop.persons.splice(personIndex, 1);
        } else {
          stop.persons.push({ id: personId, type: personType });
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let legData = { ...currentTransportLeg };

    // Ensure empty dates are undefined
    if (legData.departureDate === "") legData.departureDate = undefined;
    if (legData.arrivalDate === "") legData.arrivalDate = undefined;

    const legToSave: EventTransportLeg = {
      ...(legData as Omit<EventTransportLeg, "id">),
      eventId: eventId,
      id: (legData as EventTransportLeg).id || generateId(),
    };

    try {
      // Sauvegarder dans Firebase si on a un teamId
      if (appState.activeTeamId) {
        const savedId = await saveData(
          appState.activeTeamId,
          "eventTransportLegs",
          legToSave
        );
        legToSave.id = savedId;
        console.log('✅ Trajet sauvegardé dans Firebase avec l\'ID:', savedId);
      } else {
        console.warn('⚠️ Aucun teamId actif, sauvegarde locale uniquement');
      }

      // Mettre à jour l'état local APRÈS la sauvegarde réussie
      setEventTransportLegs((prevLegs) => {
      if (isEditing) {
          // Mode édition : remplacer le trajet existant
          return prevLegs.map((leg) =>
          leg.id === legToSave.id ? legToSave : leg
        );
      } else {
          // Mode création : ajouter le nouveau trajet
          return [...prevLegs, legToSave];
      }
      });

      // Update budget items after the state update
      setTimeout(() => {
        const legsForThisEvent = appState.eventTransportLegs.filter(
          (leg) => leg.eventId === eventId
        );
        const updatedLegsForEvent = isEditing 
          ? legsForThisEvent.map((leg) => leg.id === legToSave.id ? legToSave : leg)
          : [...legsForThisEvent, legToSave];
        updateCostsForEvent(updatedLegsForEvent);
      }, 0);

    setIsModalOpen(false);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du trajet:', error);
      alert('Erreur lors de la sauvegarde du trajet. Veuillez réessayer.');
    }
  };

  const openAddModal = () => {
    setCurrentTransportLeg(initialTransportFormStateFactory(eventId));
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (leg: EventTransportLeg) => {
    setCurrentTransportLeg(structuredClone(leg));
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (legId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce trajet ?")) {
      try {
        // Supprimer de Firebase si on a un teamId
        if (appState.activeTeamId) {
          await deleteData(
            appState.activeTeamId,
            "eventTransportLegs",
            legId
          );
          console.log('✅ Trajet supprimé de Firebase avec l\'ID:', legId);
        } else {
          console.warn('⚠️ Aucun teamId actif, suppression locale uniquement');
        }

        // Mettre à jour l'état local
      setEventTransportLegs((prevLegs) => {
        const updatedLegs = prevLegs.filter((leg) => leg.id !== legId);
        const legsForThisEvent = updatedLegs.filter(
          (leg) => leg.eventId === eventId
        );
        updateCostsForEvent(legsForThisEvent);
        return updatedLegs;
      });
      } catch (error) {
        console.error('❌ Erreur lors de la suppression du trajet:', error);
        alert('Erreur lors de la suppression du trajet. Veuillez réessayer.');
      }
    }
  };

  const toggleRowExpansion = (legId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(legId)) {
        newSet.delete(legId);
      } else {
        newSet.add(legId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString?: string, timeString?: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(`${dateString}T${timeString || "00:00:00"}`);
      if (isNaN(date.getTime())) return "Date invalide";
      const options: Intl.DateTimeFormatOptions = {
        weekday: "short",
        day: "numeric",
        month: "short",
      };
      let formatted = date.toLocaleDateString("fr-FR", options);
      if (timeString) {
        formatted += ` à ${timeString}`;
      }
      return formatted;
    } catch {
      return "Date Invalide";
    }
  };

  const renderTransportTable = (legs: EventTransportLeg[], title: string) => (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-gray-700 mb-3">{title}</h3>
      {legs.length === 0 ? (
        <p className="text-gray-500 italic">Aucun trajet planifié.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trajet
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Départ
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arrivée
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Occupants
                </th>
                <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {legs.map((leg) => {
                const vehicle = appState.vehicles.find(
                  (v) => v.id === leg.assignedVehicleId
                );
                const driver = appState.staff.find(
                  (s) => s.id === leg.driverId
                );
                const isExpanded = expandedRows.has(leg.id);
                return (
                  <React.Fragment key={leg.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3">
                        <button
                          onClick={() => toggleRowExpansion(leg.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <ChevronDownIcon
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-900">
                        <div>{vehicle ? vehicle.name : leg.mode}</div>
                        <div className="text-xs text-gray-500">{leg.mode}</div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        <div className="font-semibold">
                          {formatDate(leg.departureDate, leg.departureTime)}
                        </div>
                        <div>De: {leg.departureLocation}</div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        <div className="font-semibold">
                          {formatDate(leg.arrivalDate, leg.arrivalTime)}
                        </div>
                        <div>À: {leg.arrivalLocation}</div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        {leg.occupants.length} pers.
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right space-x-2">
                        <ActionButton
                          onClick={() => openEditModal(leg)}
                          variant="secondary"
                          size="sm"
                          icon={<PencilIcon className="w-4 h-4" />}
                        />
                        <ActionButton
                          onClick={() => handleDelete(leg.id)}
                          variant="danger"
                          size="sm"
                          icon={<TrashIcon className="w-4 h-4" />}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <h5 className="font-semibold mb-1">
                                Détails Véhicule
                              </h5>
                              <p>
                                <strong>Véhicule:</strong>{" "}
                                {vehicle?.name || "N/A"}
                              </p>
                              <p>
                                <strong>Conducteur:</strong>{" "}
                                {driver
                                  ? `${driver.firstName} ${driver.lastName}`
                                  : "N/A"}
                              </p>
                              <p>
                                <strong>Places:</strong> {leg.occupants.length}{" "}
                                / {vehicle?.seats || "∞"}
                              </p>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-1">
                                Occupants ({leg.occupants.length})
                              </h5>
                              <ul className="list-disc list-inside max-h-24 overflow-y-auto">
                                {leg.occupants.map((occ) => {
                                  const person =
                                    occ.type === "rider"
                                      ? appState.riders.find(
                                          (p) => p.id === occ.id
                                        )
                                      : appState.staff.find(
                                          (p) => p.id === occ.id
                                        );
                                  return (
                                    <li key={occ.id + occ.type}>
                                      {person
                                        ? `${person.firstName} ${person.lastName}`
                                        : "Inconnu"}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div className="md:col-span-1">
                              <h5 className="font-semibold mb-1">
                                Étapes & Notes
                              </h5>
                              {leg.intermediateStops && leg.intermediateStops.length > 0 ? (
                                <div className="space-y-1 mb-2">
                                  {leg.intermediateStops.map((stop, index) => (
                                    <div key={stop.id} className="text-xs bg-gray-100 p-2 rounded">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-1 py-0.5 rounded text-xs ${
                                          stop.stopType === TransportStopType.AIRPORT_ARRIVAL ? 'bg-purple-100 text-purple-800' :
                                          stop.stopType === TransportStopType.AIRPORT_DEPARTURE ? 'bg-purple-200 text-purple-900' :
                                          stop.stopType === TransportStopType.TRAIN_STATION_ARRIVAL ? 'bg-orange-100 text-orange-800' :
                                          stop.stopType === TransportStopType.TRAIN_STATION_DEPARTURE ? 'bg-orange-200 text-orange-900' :
                                          stop.stopType === TransportStopType.MEETING_POINT ? 'bg-yellow-100 text-yellow-800' :
                                          stop.stopType === TransportStopType.HOME_PICKUP ? 'bg-teal-100 text-teal-800' :
                                          stop.stopType === TransportStopType.HOME_DROPOFF ? 'bg-teal-200 text-teal-900' :
                                          stop.stopType === TransportStopType.PICKUP ? 'bg-blue-100 text-blue-800' :
                                          stop.stopType === TransportStopType.DROPOFF ? 'bg-green-100 text-green-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {stop.stopType}
                                        </span>
                                        {stop.isTimingCritical && (
                                          <span className="text-red-600 text-xs">⏰ Critique</span>
                                        )}
                                        {stop.isPickupRequired && (
                                          <span className="text-green-600 text-xs">🚨 Récupération</span>
                                        )}
                                        {stop.isDropoffRequired && (
                                          <span className="text-red-600 text-xs">🚨 Dépose</span>
                                        )}
                                        {stop.reminderMinutes && stop.reminderMinutes > 0 && (
                                          <span className="text-blue-600 text-xs">🔔 -{stop.reminderMinutes}min</span>
                                        )}
                                      </div>
                                      <div className="text-gray-600">
                                        <div className="font-medium">{stop.location}</div>
                                        {stop.address && (
                                          <div className="text-xs text-gray-500">{stop.address}</div>
                                        )}
                                        <div className="text-sm">
                                          {stop.time}
                                          {stop.estimatedDuration && stop.estimatedDuration > 0 && (
                                            <span className="text-gray-500"> ({stop.estimatedDuration}min)</span>
                                          )}
                                        </div>
                                        {stop.contactPerson && (
                                          <div className="text-xs text-gray-500">
                                            Contact: {stop.contactPerson}
                                            {stop.contactPhone && ` - ${stop.contactPhone}`}
                                          </div>
                                        )}
                                      </div>
                                      {stop.notes && (
                                        <div className="text-gray-500 italic text-xs">
                                          {stop.notes}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">Aucune étape</p>
                              )}
                              <p className="text-sm">
                                <strong>Notes:</strong>{" "}
                                {leg.details || "Aucune"}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const allerLegs = transportLegsForEvent
    .filter((leg) => leg.direction === TransportDirection.ALLER)
    .sort((a, b) =>
      (a.departureDate || "").localeCompare(b.departureDate || "")
    );
  const retourLegs = transportLegsForEvent
    .filter((leg) => leg.direction === TransportDirection.RETOUR)
    .sort((a, b) =>
      (a.departureDate || "").localeCompare(b.departureDate || "")
    );
  const jourJLegs = transportLegsForEvent
    .filter((leg) => leg.direction === TransportDirection.JOUR_J)
    .sort((a, b) =>
      (a.departureTime || "").localeCompare(b.departureTime || "")
    );

  return (
    <div className="space-y-8">
      {/* En-tête avec bouton d'ajout global */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Plan de Transport</h2>
          <p className="text-gray-600">Organisation des déplacements pour {event.name}</p>
        </div>
        <ActionButton
          onClick={openAddModal}
          icon={<PlusCircleIcon className="w-5 h-5" />}
        >
          Ajouter un Trajet
        </ActionButton>
      </div>

      {/* Section Aller */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-200 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">✈️</span>
              <div>
                <h3 className="text-xl font-semibold text-blue-800">Trajets Aller</h3>
                <p className="text-blue-600 text-sm">Départ vers l'événement - Billets d'avion et récupérations</p>
              </div>
            </div>
            <div className="text-sm text-blue-600">
              {allerLegs.length} trajet{allerLegs.length > 1 ? 's' : ''} planifié{allerLegs.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="p-6">
          {allerLegs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">✈️</span>
              <p>Aucun trajet aller planifié</p>
              <p className="text-sm">Ajoutez des trajets pour organiser les départs</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allerLegs.map((leg) => (
                <div key={leg.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-lg">
                          {leg.mode === TransportMode.VOL ? '✈️' : '🚗'}
                        </span>
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {leg.mode === TransportMode.VOL ? 'Vol' : 'Transport terrestre'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {formatDate(leg.departureDate, leg.departureTime)} → {formatDate(leg.arrivalDate, leg.arrivalTime)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">📍 Trajet</h5>
                          <p className="text-sm text-gray-600">
                            <strong>Départ:</strong> {leg.departureLocation}<br/>
                            <strong>Arrivée:</strong> {leg.arrivalLocation}
                          </p>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">👥 Participants</h5>
                          <div className="text-sm text-gray-600">
                            {leg.occupants.length > 0 ? (
                              <ul className="space-y-1">
                                {leg.occupants.map((occ) => {
                                  const person = occ.type === "rider" 
                                    ? appState.riders.find(r => r.id === occ.id)
                                    : appState.staff.find(s => s.id === occ.id);
                                  return (
                                    <li key={occ.id + occ.type} className="flex items-center space-x-2">
                                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                      <span>{person ? `${person.firstName} ${person.lastName}` : 'Inconnu'}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-gray-400">Aucun participant assigné</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {leg.mode === TransportMode.VOL && leg.details && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <h5 className="font-medium text-blue-800 mb-1">🎫 Détails du vol</h5>
                          <p className="text-sm text-blue-700">{leg.details}</p>
                        </div>
                      )}

                      {leg.intermediateStops && leg.intermediateStops.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-gray-700 mb-2">🚌 Récupérations/Déposes</h5>
                          <div className="space-y-2">
                            {leg.intermediateStops.map((stop) => (
                              <div key={stop.id} className="flex items-center space-x-2 text-sm bg-gray-50 p-2 rounded">
                                <span className="text-gray-500">{stop.time}</span>
                                <span className="font-medium">{stop.location}</span>
                                <span className="text-gray-500">({stop.stopType})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <ActionButton
                        onClick={() => openEditModal(leg)}
                        variant="secondary"
                        size="sm"
                        icon={<PencilIcon className="w-4 h-4" />}
                      />
                      <ActionButton
                        onClick={() => handleDelete(leg.id)}
                        variant="danger"
                        size="sm"
                        icon={<TrashIcon className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section Jour J */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="bg-green-50 px-6 py-4 border-b border-green-200 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🏁</span>
              <div>
                <h3 className="text-xl font-semibold text-green-800">Transport Jour J</h3>
                <p className="text-green-600 text-sm">Déplacements le jour de l'événement</p>
              </div>
            </div>
            <div className="text-sm text-green-600">
              {jourJLegs.length} trajet{jourJLegs.length > 1 ? 's' : ''} planifié{jourJLegs.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="p-6">
          {jourJLegs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">🏁</span>
              <p>Aucun transport jour J planifié</p>
              <p className="text-sm">Ajoutez des trajets pour organiser les déplacements du jour</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jourJLegs.map((leg) => (
                <div key={leg.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-lg">🚗</span>
                        <div>
                          <h4 className="font-semibold text-gray-800">Transport Jour J</h4>
                          <p className="text-sm text-gray-600">
                            {leg.departureTime} → {leg.arrivalTime}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">📍 Trajet</h5>
                          <p className="text-sm text-gray-600">
                            <strong>Départ:</strong> {leg.departureLocation}<br/>
                            <strong>Arrivée:</strong> {leg.arrivalLocation}
                          </p>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">🚗 Véhicule</h5>
                          <div className="text-sm text-gray-600">
                            {leg.assignedVehicleId ? (
                              <div>
                                <p><strong>Véhicule:</strong> {
                                  leg.assignedVehicleId === 'perso' ? 'Véhicule personnel' :
                                  appState.vehicles.find(v => v.id === leg.assignedVehicleId)?.name || 'Inconnu'
                                }</p>
                                {leg.driverId && (
                                  <p><strong>Conducteur:</strong> {
                                    appState.staff.find(s => s.id === leg.driverId)?.firstName + ' ' +
                                    appState.staff.find(s => s.id === leg.driverId)?.lastName
                                  }</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-400">Aucun véhicule assigné</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <h5 className="font-medium text-gray-700 mb-2">👥 Passagers</h5>
                        <div className="text-sm text-gray-600">
                          {leg.occupants.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {leg.occupants.map((occ) => {
                                const person = occ.type === "rider" 
                                  ? appState.riders.find(r => r.id === occ.id)
                                  : appState.staff.find(s => s.id === occ.id);
                                return (
                                  <span key={occ.id + occ.type} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                                    {person ? `${person.firstName} ${person.lastName}` : 'Inconnu'}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-gray-400">Aucun passager assigné</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <ActionButton
                        onClick={() => openEditModal(leg)}
                        variant="secondary"
                        size="sm"
                        icon={<PencilIcon className="w-4 h-4" />}
                      />
                      <ActionButton
                        onClick={() => handleDelete(leg.id)}
                        variant="danger"
                        size="sm"
                        icon={<TrashIcon className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section Retour */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="bg-orange-50 px-6 py-4 border-b border-orange-200 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🏠</span>
              <div>
                <h3 className="text-xl font-semibold text-orange-800">Trajets Retour</h3>
                <p className="text-orange-600 text-sm">Retour après l'événement - Déposes et vols retour</p>
              </div>
            </div>
            <div className="text-sm text-orange-600">
              {retourLegs.length} trajet{retourLegs.length > 1 ? 's' : ''} planifié{retourLegs.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="p-6">
          {retourLegs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">🏠</span>
              <p>Aucun trajet retour planifié</p>
              <p className="text-sm">Ajoutez des trajets pour organiser les retours</p>
            </div>
          ) : (
            <div className="space-y-4">
              {retourLegs.map((leg) => (
                <div key={leg.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-lg">
                          {leg.mode === TransportMode.VOL ? '✈️' : '🚗'}
                        </span>
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {leg.mode === TransportMode.VOL ? 'Vol retour' : 'Transport terrestre'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {formatDate(leg.departureDate, leg.departureTime)} → {formatDate(leg.arrivalDate, leg.arrivalTime)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">📍 Trajet</h5>
                          <p className="text-sm text-gray-600">
                            <strong>Départ:</strong> {leg.departureLocation}<br/>
                            <strong>Arrivée:</strong> {leg.arrivalLocation}
                          </p>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">👥 Participants</h5>
                          <div className="text-sm text-gray-600">
                            {leg.occupants.length > 0 ? (
                              <ul className="space-y-1">
                                {leg.occupants.map((occ) => {
                                  const person = occ.type === "rider" 
                                    ? appState.riders.find(r => r.id === occ.id)
                                    : appState.staff.find(s => s.id === occ.id);
                                  return (
                                    <li key={occ.id + occ.type} className="flex items-center space-x-2">
                                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                      <span>{person ? `${person.firstName} ${person.lastName}` : 'Inconnu'}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-gray-400">Aucun participant assigné</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {leg.mode === TransportMode.VOL && leg.details && (
                        <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                          <h5 className="font-medium text-orange-800 mb-1">🎫 Détails du vol retour</h5>
                          <p className="text-sm text-orange-700">{leg.details}</p>
                        </div>
                      )}

                      {leg.intermediateStops && leg.intermediateStops.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-gray-700 mb-2">🚌 Déposes</h5>
                          <div className="space-y-2">
                            {leg.intermediateStops.map((stop) => (
                              <div key={stop.id} className="flex items-center space-x-2 text-sm bg-gray-50 p-2 rounded">
                                <span className="text-gray-500">{stop.time}</span>
                                <span className="font-medium">{stop.location}</span>
                                <span className="text-gray-500">({stop.stopType})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <ActionButton
                        onClick={() => openEditModal(leg)}
                        variant="secondary"
                        size="sm"
                        icon={<PencilIcon className="w-4 h-4" />}
                      />
                      <ActionButton
                        onClick={() => handleDelete(leg.id)}
                        variant="danger"
                        size="sm"
                        icon={<TrashIcon className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={isEditing ? "Modifier Trajet" : "Ajouter un Trajet"}
        >
          <form
            onSubmit={handleSubmit}
            className="space-y-4 max-h-[85vh] overflow-y-auto p-2 -m-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Direction */}
              <div>
                <label htmlFor="direction" className="block text-sm font-medium text-gray-700">
                  Direction
                </label>
                <select
                  name="direction"
                  id="direction"
                  value={(currentTransportLeg as EventTransportLeg).direction}
                  onChange={handleInputChange}
                  className={lightSelectClasses}
                >
                  {(Object.values(TransportDirection) as TransportDirection[]).map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode de transport */}
              <div>
                <label htmlFor="mode" className="block text-sm font-medium text-gray-700">
                  Mode de transport
                </label>
                <select
                  name="mode"
                  id="mode"
                  value={(currentTransportLeg as EventTransportLeg).mode}
                  onChange={handleInputChange}
                  className={lightSelectClasses}
                >
                  {(Object.values(TransportMode) as TransportMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Véhicule assigné */}
            <div>
              <label htmlFor="assignedVehicleId" className="block text-sm font-medium text-gray-700">
                Véhicule assigné
              </label>
              <select
                name="assignedVehicleId"
                id="assignedVehicleId"
                value={(currentTransportLeg as EventTransportLeg).assignedVehicleId || ""}
                onChange={handleInputChange}
                className={lightSelectClasses}
              >
                <option value="">Sélectionner un véhicule...</option>
                <option value="perso">Véhicule personnel</option>
                {appState.vehicles.map((vehicle) => {
                  const availability = checkVehicleAvailability(
                    vehicle,
                    (currentTransportLeg as EventTransportLeg).departureDate,
                    (currentTransportLeg as EventTransportLeg).arrivalDate,
                    appState.eventTransportLegs,
                    (currentTransportLeg as EventTransportLeg).id
                  );
                  return (
                    <option
                      key={vehicle.id}
                      value={vehicle.id}
                      disabled={availability.status !== "available"}
                    >
                      {vehicle.name} {availability.reason}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Dates et lieux */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Départ
                </label>
                <input
                  type="date"
                  name="departureDate"
                  value={(currentTransportLeg as EventTransportLeg).departureDate || ""}
                  onChange={handleInputChange}
                  className={lightInputClasses}
                />
                <input
                  type="time"
                  name="departureTime"
                  value={(currentTransportLeg as EventTransportLeg).departureTime || ""}
                  onChange={handleInputChange}
                  className={lightInputClasses}
                />
                <input
                  type="text"
                  name="departureLocation"
                  value={(currentTransportLeg as EventTransportLeg).departureLocation || ""}
                  onChange={handleInputChange}
                  placeholder="Lieu de départ"
                  className={lightInputClasses}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arrivée
                </label>
                <input
                  type="date"
                  name="arrivalDate"
                  value={(currentTransportLeg as EventTransportLeg).arrivalDate || ""}
                  onChange={handleInputChange}
                  className={lightInputClasses}
                />
                <input
                  type="time"
                  name="arrivalTime"
                  value={(currentTransportLeg as EventTransportLeg).arrivalTime || ""}
                  onChange={handleInputChange}
                  className={lightInputClasses}
                />
                <input
                  type="text"
                  name="arrivalLocation"
                  value={(currentTransportLeg as EventTransportLeg).arrivalLocation || ""}
                  onChange={handleInputChange}
                  placeholder="Lieu d'arrivée"
                  className={lightInputClasses}
                />
              </div>
            </div>

            {/* Sélection des occupants */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Occupants
                </label>
                {(() => {
                  const vehicle = (currentTransportLeg as EventTransportLeg).assignedVehicleId 
                    ? appState.vehicles.find(v => v.id === (currentTransportLeg as EventTransportLeg).assignedVehicleId)
                    : null;
                  const currentOccupants = (currentTransportLeg as EventTransportLeg).occupants?.length || 0;
                  let maxCapacity = Infinity;
                  
                  if (vehicle && vehicle.seats) {
                    maxCapacity = vehicle.seats;
                  } else if ((currentTransportLeg as EventTransportLeg).assignedVehicleId === "perso") {
                    maxCapacity = 5;
                  }
                  
                  return (
                    <div className="text-xs text-gray-600">
                      <span className={`font-medium ${currentOccupants >= maxCapacity ? 'text-red-600' : 'text-gray-600'}`}>
                        {currentOccupants}
                      </span>
                      {maxCapacity !== Infinity && (
                        <span className="text-gray-500"> / {maxCapacity}</span>
                      )}
                      {maxCapacity !== Infinity && currentOccupants >= maxCapacity && (
                        <span className="text-red-600 font-medium ml-1">(Plein)</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                <div className="space-y-2">
                  {allAvailablePeople.map((person) => {
                    const isSelected = (currentTransportLeg as EventTransportLeg).occupants?.some(
                      (occ) => occ.id === person.id && occ.type === person.type
                    ) || false;
                    
                    const vehicle = (currentTransportLeg as EventTransportLeg).assignedVehicleId 
                      ? appState.vehicles.find(v => v.id === (currentTransportLeg as EventTransportLeg).assignedVehicleId)
                      : null;
                    const currentOccupants = (currentTransportLeg as EventTransportLeg).occupants?.length || 0;
                    let maxCapacity = Infinity;
                    
                    if (vehicle && vehicle.seats) {
                      maxCapacity = vehicle.seats;
                    } else if ((currentTransportLeg as EventTransportLeg).assignedVehicleId === "perso") {
                      maxCapacity = 5;
                    }
                    
                    const isDisabled = !isSelected && currentOccupants >= maxCapacity;
                    
                    return (
                      <label
                        key={`${person.id}-${person.type}`}
                        className={`flex items-center space-x-2 text-sm ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleOccupantChange(person.id, person.type)}
                          disabled={isDisabled}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className={`${person.isParticipant ? "font-semibold text-blue-700" : "text-gray-600"} ${isDisabled ? 'text-gray-400' : ''}`}>
                          {person.name} ({person.type === "rider" ? "Coureur" : "Staff"})
                          {person.isParticipant && " - Participant"}
                          {isDisabled && !isSelected && (
                            <span className="text-red-500 text-xs ml-1">(Véhicule plein)</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Étapes intermédiaires */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Étapes intermédiaires
                </label>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const newStop: TransportStop = {
                        id: generateId(),
                        location: "",
                        date: event.date,
                        time: "",
                        stopType: TransportStopType.AIRPORT_ARRIVAL,
                        persons: [],
                        notes: "",
                        isTimingCritical: true,
                        estimatedDuration: 30,
                        isPickupRequired: true,
                        reminderMinutes: 15,
                      };
                      setCurrentTransportLeg((prev) => {
                        const updated = structuredClone(prev);
                        if (!updated.intermediateStops) updated.intermediateStops = [];
                        updated.intermediateStops.push(newStop);
                        return updated;
                      });
                    }}
                  >
                    ✈️ Arrivée aéroport
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const newStop: TransportStop = {
                        id: generateId(),
                        location: "",
                        date: event.date,
                        time: "",
                        stopType: TransportStopType.TRAIN_STATION_ARRIVAL,
                        persons: [],
                        notes: "",
                        isTimingCritical: true,
                        estimatedDuration: 20,
                        isPickupRequired: true,
                        reminderMinutes: 10,
                      };
                      setCurrentTransportLeg((prev) => {
                        const updated = structuredClone(prev);
                        if (!updated.intermediateStops) updated.intermediateStops = [];
                        updated.intermediateStops.push(newStop);
                        return updated;
                      });
                    }}
                  >
                    🚂 Arrivée gare
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const newStop: TransportStop = {
                        id: generateId(),
                        location: "",
                        address: "",
                        date: event.date,
                        time: "",
                        stopType: TransportStopType.MEETING_POINT,
                        persons: [],
                        notes: "",
                        isTimingCritical: false,
                        estimatedDuration: 10,
                        isPickupRequired: true,
                        reminderMinutes: 5,
                      };
                      setCurrentTransportLeg((prev) => {
                        const updated = structuredClone(prev);
                        if (!updated.intermediateStops) updated.intermediateStops = [];
                        updated.intermediateStops.push(newStop);
                        return updated;
                      });
                    }}
                  >
                    📍 Lieu de rendez-vous
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const newStop: TransportStop = {
                        id: generateId(),
                        location: "",
                        address: "",
                        date: event.date,
                        time: "",
                        stopType: TransportStopType.HOME_PICKUP,
                        persons: [],
                        notes: "",
                        isTimingCritical: false,
                        estimatedDuration: 5,
                        isPickupRequired: true,
                        reminderMinutes: 5,
                      };
                      setCurrentTransportLeg((prev) => {
                        const updated = structuredClone(prev);
                        if (!updated.intermediateStops) updated.intermediateStops = [];
                        updated.intermediateStops.push(newStop);
                        return updated;
                      });
                    }}
                  >
                    🏠 Récupération domicile
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddStop}
                  >
                    + Étape personnalisée
                  </ActionButton>
                </div>
              </div>
              <div className="space-y-3">
                {(currentTransportLeg as EventTransportLeg).intermediateStops?.map((stop, index) => (
                  <div key={stop.id} className="border border-gray-300 rounded-md p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <input
                        type="text"
                        value={stop.location}
                        onChange={(e) => handleStopChange(index, "location", e.target.value)}
                        placeholder="Lieu (ex: Aéroport Tours)"
                        className={lightInputClasses}
                      />
                      <input
                        type="date"
                        value={stop.date}
                        onChange={(e) => handleStopChange(index, "date", e.target.value)}
                        className={lightInputClasses}
                      />
                      <input
                        type="time"
                        value={stop.time}
                        onChange={(e) => handleStopChange(index, "time", e.target.value)}
                        className={lightInputClasses}
                      />
                      <select
                        value={stop.stopType}
                        onChange={(e) => handleStopChange(index, "stopType", e.target.value)}
                        className={lightSelectClasses}
                      >
                        <option value={TransportStopType.PICKUP}>Récupération</option>
                        <option value={TransportStopType.DROPOFF}>Dépose</option>
                        <option value={TransportStopType.WAYPOINT}>Étape intermédiaire</option>
                        <option value={TransportStopType.AIRPORT_ARRIVAL}>Arrivée aéroport</option>
                        <option value={TransportStopType.AIRPORT_DEPARTURE}>Départ aéroport</option>
                        <option value={TransportStopType.TRAIN_STATION_ARRIVAL}>Arrivée gare</option>
                        <option value={TransportStopType.TRAIN_STATION_DEPARTURE}>Départ gare</option>
                        <option value={TransportStopType.HOTEL_PICKUP}>Récupération hôtel</option>
                        <option value={TransportStopType.HOTEL_DROPOFF}>Dépose hôtel</option>
                        <option value={TransportStopType.RACE_START}>Départ course</option>
                        <option value={TransportStopType.RACE_FINISH}>Arrivée course</option>
                        <option value={TransportStopType.MEETING_POINT}>Lieu de rendez-vous</option>
                        <option value={TransportStopType.HOME_PICKUP}>Récupération domicile</option>
                        <option value={TransportStopType.HOME_DROPOFF}>Dépose domicile</option>
                        <option value={TransportStopType.TRAIN_PICKUP}>Récupération gare</option>
                        <option value={TransportStopType.TRAIN_DROPOFF}>Dépose gare</option>
                        <option value={TransportStopType.AIRPORT_PICKUP}>Récupération aéroport</option>
                        <option value={TransportStopType.AIRPORT_DROPOFF}>Dépose aéroport</option>
                      </select>
                    </div>

                    {/* Adresse précise pour les lieux de rendez-vous */}
                    {(stop.stopType === TransportStopType.MEETING_POINT || 
                      stop.stopType === TransportStopType.HOME_PICKUP || 
                      stop.stopType === TransportStopType.HOME_DROPOFF) && (
                      <div className="mb-3">
                        <input
                          type="text"
                          value={stop.address || ""}
                          onChange={(e) => handleStopChange(index, "address", e.target.value)}
                          placeholder="Adresse précise (ex: 123 Rue de la Paix, 37000 Tours)"
                          className={lightInputClasses}
                        />
                      </div>
                    )}

                    {/* Informations de contact */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        value={stop.contactPerson || ""}
                        onChange={(e) => handleStopChange(index, "contactPerson", e.target.value)}
                        placeholder="Personne de contact"
                        className={lightInputClasses}
                      />
                      <input
                        type="tel"
                        value={stop.contactPhone || ""}
                        onChange={(e) => handleStopChange(index, "contactPhone", e.target.value)}
                        placeholder="Téléphone de contact"
                        className={lightInputClasses}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={stop.isTimingCritical || false}
                          onChange={(e) => handleStopChange(index, "isTimingCritical", e.target.checked.toString())}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          Horaires critiques (avion/train)
                        </label>
                      </div>
                      <input
                        type="number"
                        value={stop.estimatedDuration || 0}
                        onChange={(e) => handleStopChange(index, "estimatedDuration", e.target.value)}
                        placeholder="Durée estimée (min)"
                        className={lightInputClasses}
                      />
                      <input
                        type="number"
                        value={stop.reminderMinutes || 0}
                        onChange={(e) => handleStopChange(index, "reminderMinutes", e.target.value)}
                        placeholder="Rappel (min avant)"
                        className={lightInputClasses}
                      />
                    </div>

                    {/* Options de récupération/dépose obligatoires */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={stop.isPickupRequired || false}
                          onChange={(e) => handleStopChange(index, "isPickupRequired", e.target.checked.toString())}
                          className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          🚨 Récupération obligatoire
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={stop.isDropoffRequired || false}
                          onChange={(e) => handleStopChange(index, "isDropoffRequired", e.target.checked.toString())}
                          className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          🚨 Dépose obligatoire
                        </label>
                      </div>
                    </div>

                    <textarea
                      value={stop.notes || ""}
                      onChange={(e) => handleStopChange(index, "notes", e.target.value)}
                      placeholder="Notes (ex: Terminal 2, porte 15, numéro de vol...)"
                      className={`${lightInputClasses} mb-3`}
                      rows={2}
                    />

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          stop.stopType === TransportStopType.AIRPORT_ARRIVAL ? 'bg-purple-100 text-purple-800' :
                          stop.stopType === TransportStopType.AIRPORT_DEPARTURE ? 'bg-purple-200 text-purple-900' :
                          stop.stopType === TransportStopType.PICKUP ? 'bg-blue-100 text-blue-800' :
                          stop.stopType === TransportStopType.DROPOFF ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {stop.stopType}
                        </span>
                        {stop.isTimingCritical && (
                          <span className="ml-2 px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                            ⏰ Critique
                          </span>
                        )}
                      </div>
                      <ActionButton
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveStop(stop.id)}
                      >
                        Supprimer
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Détails */}
            <div>
              <label htmlFor="details" className="block text-sm font-medium text-gray-700">
                Détails (N° vol, répartition, prix, etc.)
              </label>
              <textarea
                name="details"
                id="details"
                value={(currentTransportLeg as EventTransportLeg).details || ""}
                onChange={handleInputChange}
                rows={3}
                className={lightInputClasses}
              />
            </div>

            {/* Vol spécial Aurore */}
            {(currentTransportLeg as EventTransportLeg).mode === TransportMode.VOL && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isAuroreFlight"
                  id="isAuroreFlight"
                  checked={(currentTransportLeg as EventTransportLeg).isAuroreFlight || false}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isAuroreFlight" className="ml-2 block text-sm text-gray-900">
                  Ceci est le vol spécial d'Aurore (nécessite infos retour/prix)
                </label>
              </div>
            )}

            {/* Boutons d'action */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <ActionButton
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Annuler
              </ActionButton>
              <ActionButton type="submit">
                {isEditing ? "Sauvegarder" : "Ajouter"}
              </ActionButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
