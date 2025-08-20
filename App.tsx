import React, { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME_ACCENT_COLOR,
  DEFAULT_THEME_PRIMARY_COLOR,
  getInitialGlobalState,
  getInitialTeamState,
} from "./constants";
import {
  AppSection,
  AppState,
  ChecklistTemplate,
  EquipmentItem,
  IncomeItem,
  PerformanceEntry,
  EventTransportLeg,
  EventAccommodation,
  EventRaceDocument,
  EventRadioEquipment,
  EventRadioAssignment,
  EventBudgetItem,
  EventChecklistItem,
  PeerRating,
  RaceEvent,
  Rider,
  RiderEventSelection,
  ScoutingProfile,
  StaffMember,
  StockItem,
  TeamProduct,
  TeamLevel,
  TeamMembershipStatus,
  TeamRole,
  TeamState,
  User,
  UserRole,
  Vehicle,
} from "./types";

// Firebase imports
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db } from "./firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import * as firebaseService from "./services/firebaseService";


import Sidebar from "./components/Sidebar";
import { LanguageProvider } from "./contexts/LanguageContext";
import EventDetailView from "./EventDetailView";
import { useTranslations } from "./hooks/useTranslations";
import AdminDossierSection from "./sections/AdminDossierSection";
import { AutomatedPerformanceProfileSection } from "./sections/AutomatedPerformanceProfileSection";
import CareerSection from "./sections/CareerSection";
import ChecklistSection from "./sections/ChecklistSection";
import { DashboardSection } from "./sections/DashboardSection";
import EquipmentSection from "./sections/EquipmentSection";
import { EventsSection } from "./sections/EventsSection";
import { FinancialSection } from "./sections/FinancialSection";
import LoginView from "./sections/LoginView";
import MissionSearchSection from "./sections/MissionSearchSection";
import { MyPerformanceSection } from "./sections/MyPerformanceSection";
import MyTripsSection from "./sections/MyTripsSection";
import NoTeamView from "./sections/NoTeamView";
import NutritionSection from "./sections/NutritionSection";
import PendingApprovalView from "./sections/PendingApprovalView";
import { PerformanceProjectSection } from "./sections/PerformanceProjectSection";
import { PerformancePoleSection } from "./sections/PerformanceSection";
import PermissionsSection from "./sections/PermissionsSection";
import RiderEquipmentSection from "./sections/RiderEquipmentSection";
import { RosterSection } from "./sections/RosterSection";
import ScoutingSection from "./sections/ScoutingSection";
import SettingsSection from "./sections/SettingsSection";
import SignupView, { SignupData } from "./sections/SignupView";
import StaffSection from "./sections/StaffSection";
import StocksSection from "./sections/StocksSection";
import UserManagementSection from "./sections/UserManagementSection";
import VehiclesSection from "./sections/VehiclesSection";

// Helper functions for dynamic theming
function getContrastYIQ(hexcolor: string): string {
  if (!hexcolor) return "#FFFFFF";
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) {
    hexcolor = hexcolor
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (hexcolor.length !== 6) return "#FFFFFF";

  const r = parseInt(hexcolor.substring(0, 2), 16);
  const g = parseInt(hexcolor.substring(2, 4), 16);
  const b = parseInt(hexcolor.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

function lightenDarkenColor(col: string, amt: number): string {
  if (!col) return "#000000";
  col = col.replace("#", "");
  if (col.length === 3) {
    col = col
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (col.length !== 6) return "#000000";

  let num = parseInt(col, 16);
  let r = (num >> 16) + amt;
  if (r > 255) r = 255;
  else if (r < 0) r = 0;
  let green = ((num >> 8) & 0x00ff) + amt;
  if (green > 255) green = 255;
  else if (green < 0) green = 0;
  let blue = (num & 0x0000ff) + amt;
  if (blue > 255) blue = 255;
  else if (blue < 0) blue = 0;

  const rHex = r.toString(16).padStart(2, "0");
  const gHex = green.toString(16).padStart(2, "0");
  const bHex = blue.toString(16).padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    ...getInitialGlobalState(),
    ...getInitialTeamState(),
    activeEventId: null,
    activeTeamId: null,
  });

  const [currentSection, setCurrentSection] = useState<AppSection>("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<
    "login" | "signup" | "app" | "pending" | "no_team"
  >("login");
  const [pendingSignupData, setPendingSignupData] = useState<SignupData | null>(null); // Nouvel état pour stocker les données d'inscription

  const [language, setLanguageState] = useState<"fr" | "en">("fr");

  const { t } = useTranslations();

  const loadDataForUser = useCallback(async (user: User) => {
    setIsLoading(true);
    const globalData = await firebaseService.getGlobalData();
    const userMemberships = (globalData.teamMemberships || []).filter(
      (m) => m.userId === user.id
    );
    const activeMembership = userMemberships.find(
      (m) => m.status === TeamMembershipStatus.ACTIVE
    );

    let teamData: Partial<TeamState> = getInitialTeamState();
    let finalActiveTeamId: string | null = null;

    if (activeMembership) {
      finalActiveTeamId = activeMembership.teamId;
      teamData = await firebaseService.getTeamData(finalActiveTeamId);
      setView("app");
    } else if (
      userMemberships.some((m) => m.status === TeamMembershipStatus.PENDING)
    ) {
      setView("pending");
    } else {
      setView("no_team");
    }

    setAppState({
      ...getInitialGlobalState(),
      ...getInitialTeamState(),
      ...globalData,
      ...teamData,
      activeEventId: null, // Reset event detail view on user/team change
      activeTeamId: finalActiveTeamId,
    });

    setLanguageState(teamData.language || "fr");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        setIsLoading(true);
        let userProfile = await firebaseService.getUserProfile(
          firebaseUser.uid
        );

        // If profile doesn't exist (e.g., first login after signup), create it. This makes the app more robust.
        if (!userProfile) {
          try {
            // Utiliser les données d'inscription stockées si disponibles
            if (pendingSignupData) {
              await firebaseService.createUserProfile(
                firebaseUser.uid,
                pendingSignupData
              );
              // Nettoyer les données temporaires après utilisation
              setPendingSignupData(null);
            } else {
              // Fallback pour les utilisateurs existants sans données d'inscription
              const { email } = firebaseUser;
              const firstName = email?.split("@")[0] || "Nouveau";
              const lastName = "Utilisateur";
              const newProfileData: SignupData = {
                email: email || "",
                firstName,
                lastName,
                password: "",
                userRole: UserRole.COUREUR, // Rôle par défaut pour les utilisateurs existants
              };
              await firebaseService.createUserProfile(
                firebaseUser.uid,
                newProfileData
              );
            }
            userProfile = await firebaseService.getUserProfile(
              firebaseUser.uid
            ); // Re-fetch the newly created profile
          } catch (profileError) {
            console.error(
              "Erreur lors de la création du profil utilisateur:",
              profileError
            );
            // Ne pas déconnecter l'utilisateur, mais afficher un message d'erreur
            alert(
              "Erreur lors de la création du profil. Veuillez contacter l'administrateur."
            );
          }
        }

        if (userProfile) {
          setCurrentUser(userProfile);
          await loadDataForUser(userProfile); // This will set loading to false
        } else {
          // This case should ideally not be reached if profile creation is successful.
          console.error(
            "Critical: Failed to create or retrieve user profile. Logging out."
          );
          signOut(auth); // Log out to prevent inconsistent state
        }
      } else {
        setCurrentUser(null);
        setAppState({
          ...getInitialGlobalState(),
          ...getInitialTeamState(),
          activeEventId: null,
          activeTeamId: null,
        });
        setView("login");
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadDataForUser]);

  const primaryColor =
    appState.themePrimaryColor || DEFAULT_THEME_PRIMARY_COLOR;
  const accentColor = appState.themeAccentColor || DEFAULT_THEME_ACCENT_COLOR;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--theme-primary-bg", primaryColor);
    root.style.setProperty(
      "--theme-primary-hover-bg",
      lightenDarkenColor(primaryColor, 20)
    );
    root.style.setProperty(
      "--theme-primary-text",
      getContrastYIQ(primaryColor)
    );
    root.style.setProperty("--theme-accent-color", accentColor);
    document.body.style.backgroundColor = lightenDarkenColor(primaryColor, -20);
  }, [primaryColor, accentColor]);

  // --- DATA HANDLERS ---
  const onSaveRider = useCallback(async (item: Rider) => {
    console.log('onSaveRider appelé avec:', item);
    
    if (!appState.activeTeamId) {
      console.error('Pas de activeTeamId');
      return;
    }
    
    try {
      console.log('Sauvegarde dans Firebase...');
      const savedId = await firebaseService.saveData(
        appState.activeTeamId,
        "riders",
        item
      );
      console.log('Rider sauvegardé avec ID:', savedId);
      
      const finalItem = { ...item, id: item.id || savedId };
      console.log('Item final:', finalItem);

      setAppState((prev: AppState) => {
        const collection = prev.riders;
        const exists = collection.some((i: Rider) => i.id === finalItem.id);
        const newCollection = exists
          ? collection.map((i: Rider) => (i.id === finalItem.id ? finalItem : i))
          : [...collection, finalItem];
        
        console.log('Nouvelle collection riders:', newCollection);
        return { ...prev, riders: newCollection };
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du rider:', error);
    }
  }, [appState.activeTeamId]);

  const onDeleteRider = useCallback(async (item: Rider) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "riders",
      item.id
    );

    setAppState((prev: AppState) => {
      const collection = prev.riders;
      return {
        ...prev,
        riders: collection.filter((i: Rider) => i.id !== item.id),
      };
    });
  }, [appState.activeTeamId]);

  const onSaveStaff = useCallback(async (item: StaffMember) => {
    console.log('onSaveStaff appelé avec:', item);
    
    if (!appState.activeTeamId) {
      console.error('Pas de activeTeamId');
      return;
    }
    
    try {
      const savedId = await firebaseService.saveData(
        appState.activeTeamId,
        "staff",
        item
      );
      console.log('Staff sauvegardé avec ID:', savedId);
      
      const finalItem = { ...item, id: item.id || savedId };
      console.log('Item final:', finalItem);

      setAppState((prev: AppState) => {
        const collection = prev.staff;
        const exists = collection.some((i: StaffMember) => i.id === finalItem.id);
        const newCollection = exists
          ? collection.map((i: StaffMember) => (i.id === finalItem.id ? finalItem : i))
          : [...collection, finalItem];
        
        console.log('Nouvelle collection staff:', newCollection);
        return { ...prev, staff: newCollection };
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du staff:', error);
    }
  }, [appState.activeTeamId]);

  const onDeleteStaff = useCallback(async (item: StaffMember) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "staff",
      item.id
    );

    setAppState((prev: AppState) => {
      const collection = prev.staff;
      return {
        ...prev,
        staff: collection.filter((i: StaffMember) => i.id !== item.id),
      };
    });
  }, [appState.activeTeamId]);

  const onSaveVehicle = useCallback(async (item: Vehicle) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "vehicles",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };

    setAppState((prev: AppState) => {
      const collection = prev.vehicles;
      const exists = collection.some((i: Vehicle) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: Vehicle) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, vehicles: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteVehicle = useCallback(async (item: Vehicle) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "vehicles",
      item.id
    );

    setAppState((prev: AppState) => {
      const collection = prev.vehicles;
      return {
        ...prev,
        vehicles: collection.filter((i: Vehicle) => i.id !== item.id),
      };
    });
  }, [appState.activeTeamId]);

  const onSaveEquipment = useCallback(async (item: EquipmentItem) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "equipment",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };

    setAppState((prev: AppState) => {
      const collection = prev.equipment;
      const exists = collection.some((i: EquipmentItem) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: EquipmentItem) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, equipment: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteEquipment = useCallback(async (item: EquipmentItem) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "equipment",
      item.id
    );

    setAppState((prev: AppState) => {
      const collection = prev.equipment;
      return {
        ...prev,
        equipment: collection.filter((i: EquipmentItem) => i.id !== item.id),
      };
    });
  }, [appState.activeTeamId]);

  const onSaveRaceEvent = useCallback(async (item: RaceEvent) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "raceEvents",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };

    setAppState((prev: AppState) => {
      const collection = prev.raceEvents;
      const exists = collection.some((i: RaceEvent) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: RaceEvent) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, raceEvents: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteRaceEvent = useCallback(async (item: RaceEvent) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "raceEvents",
      item.id
    );

    setAppState((prev: AppState) => {
      const collection = prev.raceEvents;
      return {
        ...prev,
        raceEvents: collection.filter((i: RaceEvent) => i.id !== item.id),
      };
    });
  }, [appState.activeTeamId]);

  // Handlers pour les autres types
  const onSavePerformanceEntry = useCallback(async (item: PerformanceEntry) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "performanceEntries",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };
    setAppState((prev: AppState) => {
      const collection = prev.performanceEntries;
      const exists = collection.some((i: PerformanceEntry) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: PerformanceEntry) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, performanceEntries: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeletePerformanceEntry = useCallback(async (item: PerformanceEntry) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "performanceEntries",
      item.id
    );
    setAppState((prev: AppState) => ({
      ...prev,
      performanceEntries: prev.performanceEntries.filter((i: PerformanceEntry) => i.id !== item.id),
    }));
  }, [appState.activeTeamId]);

  const onSaveIncomeItem = useCallback(async (item: IncomeItem) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "incomeItems",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };
    setAppState((prev: AppState) => {
      const collection = prev.incomeItems;
      const exists = collection.some((i: IncomeItem) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: IncomeItem) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, incomeItems: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteIncomeItem = useCallback(async (item: IncomeItem) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "incomeItems",
      item.id
    );
    setAppState((prev: AppState) => ({
      ...prev,
      incomeItems: prev.incomeItems.filter((i: IncomeItem) => i.id !== item.id),
    }));
  }, [appState.activeTeamId]);

  const onSaveBudgetItem = useCallback(async (item: EventBudgetItem) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "eventBudgetItems",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };
    setAppState((prev: AppState) => {
      const collection = prev.eventBudgetItems;
      const exists = collection.some((i: EventBudgetItem) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: EventBudgetItem) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, eventBudgetItems: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteBudgetItem = useCallback(async (item: EventBudgetItem) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "eventBudgetItems",
      item.id
    );
    setAppState((prev: AppState) => ({
      ...prev,
      eventBudgetItems: prev.eventBudgetItems.filter((i: EventBudgetItem) => i.id !== item.id),
    }));
  }, [appState.activeTeamId]);

  const onSaveScoutingProfile = useCallback(async (item: ScoutingProfile) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "scoutingProfiles",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };
    setAppState((prev: AppState) => {
      const collection = prev.scoutingProfiles;
      const exists = collection.some((i: ScoutingProfile) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: ScoutingProfile) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, scoutingProfiles: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteScoutingProfile = useCallback(async (item: ScoutingProfile) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "scoutingProfiles",
      item.id
    );
    setAppState((prev: AppState) => ({
      ...prev,
      scoutingProfiles: prev.scoutingProfiles.filter((i: ScoutingProfile) => i.id !== item.id),
    }));
  }, [appState.activeTeamId]);

  const onSaveStockItem = useCallback(async (item: StockItem) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "stockItems",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };
    setAppState((prev: AppState) => {
      const collection = prev.stockItems;
      const exists = collection.some((i: StockItem) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: StockItem) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, stockItems: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteStockItem = useCallback(async (item: StockItem) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "stockItems",
      item.id
    );
    setAppState((prev: AppState) => ({
      ...prev,
      stockItems: prev.stockItems.filter((i: StockItem) => i.id !== item.id),
    }));
  }, [appState.activeTeamId]);

  const onSaveChecklistTemplate = useCallback(async (item: ChecklistTemplate) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "checklistTemplates",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };
    setAppState((prev: AppState) => {
      const collection = prev.checklistTemplates;
      const exists = collection.some((i: ChecklistTemplate) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: ChecklistTemplate) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, checklistTemplates: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteChecklistTemplate = useCallback(async (item: ChecklistTemplate) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "checklistTemplates",
      item.id
    );
    setAppState((prev: AppState) => ({
      ...prev,
      checklistTemplates: prev.checklistTemplates.filter((i: ChecklistTemplate) => i.id !== item.id),
    }));
  }, [appState.activeTeamId]);

  // Handlers pour TeamProduct
  const onSaveTeamProduct = useCallback(async (item: TeamProduct) => {
    if (!appState.activeTeamId) return;
    const savedId = await firebaseService.saveData(
      appState.activeTeamId,
      "teamProducts",
      item
    );
    const finalItem = { ...item, id: item.id || savedId };
    setAppState((prev: AppState) => {
      const collection = prev.teamProducts;
      const exists = collection.some((i: TeamProduct) => i.id === finalItem.id);
      const newCollection = exists
        ? collection.map((i: TeamProduct) => (i.id === finalItem.id ? finalItem : i))
        : [...collection, finalItem];
      return { ...prev, teamProducts: newCollection };
    });
  }, [appState.activeTeamId]);

  const onDeleteTeamProduct = useCallback(async (item: TeamProduct) => {
    if (!appState.activeTeamId || !item.id) return;
    await firebaseService.deleteData(
      appState.activeTeamId,
      "teamProducts",
      item.id
    );
    setAppState((prev: AppState) => ({
      ...prev,
      teamProducts: prev.teamProducts.filter((i: TeamProduct) => i.id !== item.id),
    }));
  }, [appState.activeTeamId]);

  // Fonction utilitaire pour remplacer createBatchSetHandler
  const createBatchSetHandler = <T,>(
    collectionName: keyof TeamState
  ): React.Dispatch<React.SetStateAction<T[]>> =>
    (updater) => {
      setAppState((prev: AppState) => {
        const currentItems = prev[collectionName] as T[];
        const newItems =
          typeof updater === "function"
            ? (updater as (prevState: T[]) => T[])(currentItems)
            : updater;

        return { ...prev, [collectionName]: newItems };
      });
    };



  // --- AUTH & ONBOARDING HANDLERS ---

  const handleLogin = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true, message: "" };
    } catch (error: any) {
      // Gestion spécifique des erreurs Firebase Auth
      switch (error.code) {
        case "auth/user-not-found":
          return {
            success: false,
            message: "Aucun utilisateur trouvé avec cette adresse email.",
          };
        case "auth/wrong-password":
          return { success: false, message: "Mot de passe incorrect." };
        case "auth/invalid-email":
          return {
            success: false,
            message: "L'adresse email n'est pas valide.",
          };
        case "auth/user-disabled":
          return { success: false, message: "Ce compte a été désactivé." };
        case "auth/too-many-requests":
          return {
            success: false,
            message:
              "Trop de tentatives de connexion. Veuillez réessayer plus tard.",
          };
        case "auth/network-request-failed":
          return {
            success: false,
            message:
              "Erreur de connexion réseau. Vérifiez votre connexion internet.",
          };
        default:
          console.error("Erreur Firebase Auth:", error);
          return {
            success: false,
            message: "Erreur de connexion. Veuillez réessayer.",
          };
      }
    }
  };

  const handleRegister = async (
    data: SignupData
  ): Promise<{ success: boolean; message: string }> => {
    try {
      // Stocker les données d'inscription temporairement
      setPendingSignupData(data);
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      // The onAuthStateChanged listener will now handle creating the user profile.
      // This prevents race conditions and centralizes profile creation logic.
      return { success: true, message: "" };
    } catch (error: any) {
      // En cas d'erreur, nettoyer les données temporaires
      setPendingSignupData(null);
      if (error.code === "auth/email-already-in-use") {
        return {
          success: false,
          message: "Cette adresse email est déjà utilisée par un autre compte.",
        };
      }
      if (error.code === "auth/weak-password") {
        return { success: false, message: t("signupPasswordTooShort") };
      }
      if (error.code === "auth/invalid-email") {
        return { success: false, message: "L'adresse email n'est pas valide." };
      }
      return {
        success: false,
        message: `Erreur d'inscription: ${error.message}`,
      };
    }
  };

  const handleJoinTeamRequest = async (teamId: string) => {
    if (!currentUser) return;
    try {
      await firebaseService.requestToJoinTeam(
        currentUser.id,
        teamId,
        currentUser.userRole
      );
      setView("pending");
    } catch (error) {
      console.error("Failed to join team:", error);
      alert(t("errorJoinTeam"));
    }
  };

  const handleCreateTeam = async (teamData: {
    name: string;
    level: TeamLevel;
    country: string;
  }) => {
    if (!currentUser) return;
    try {
      // Forcer le rôle Manager lors de la création d'équipe
      await firebaseService.createTeamForUser(
        currentUser.id,
        teamData,
        UserRole.MANAGER // Forcer le rôle Manager
      );
      // Refresh user profile to pick up new roles (Admin/Manager)
      const refreshedProfile = await firebaseService.getUserProfile(currentUser.id);
      if (refreshedProfile) {
        setCurrentUser(refreshedProfile);
        await loadDataForUser(refreshedProfile);
      } else {
        await loadDataForUser(currentUser);
      }
    } catch (error) {
      console.error("Failed to create team:", error);
      alert(t("errorCreateTeam"));
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };



  const navigateTo = (section: AppSection, eventId?: string) => {
    if (section === "eventDetail" && eventId) {
      setAppState((prev: AppState) => ({ ...prev, activeEventId: eventId }));
    } else {
      setAppState((prev: AppState) => ({ ...prev, activeEventId: null }));
    }
    setCurrentSection(section);
  };

  if (isLoading) {
    return (
              <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
          {t("loading")}
        </div>
    );
  }

  const renderContent = () => {
    // Protection globale contre appState undefined
    if (!appState) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg border">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Chargement de l'application...</h3>
            <p className="text-gray-500 mb-4">Initialisation de l'état de l'application...</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      );
    }

    if (view === "login") {
      return (
        <LoginView
          onLogin={handleLogin}
          onSwitchToSignup={() => setView("signup")}
        />
      );
    }
    if (view === "signup") {
      return (
        <SignupView
          onRegister={handleRegister}
          onSwitchToLogin={() => setView("login")}
          teams={appState.teams}
        />
      );
    }
    if (view === "pending") {
      return <PendingApprovalView onLogout={handleLogout} />;
    }
    if (view === "no_team" && currentUser) {
      return (
        <NoTeamView
          currentUser={currentUser}
          teams={appState.teams}
          onJoinTeam={handleJoinTeamRequest}
          onCreateTeam={handleCreateTeam}
          onLogout={handleLogout}
        />
      );
    }

    if (view === "app" && currentUser && appState.activeTeamId) {
      // SOLUTION DE CONTOURNEMENT : Forcer les permissions Manager si l'utilisateur est Manager/Admin
      let effectivePermissions = firebaseService.getEffectivePermissions(
        currentUser,
        appState.permissions,
        appState.staff
      );
      
      // FORCER les permissions si l'utilisateur est Manager/Admin
      if (currentUser.userRole === 'Manager' || currentUser.permissionRole === 'Administrateur') {
        console.log('🔧 FORÇAGE des permissions Manager');
        effectivePermissions = {
          dashboard: ['view', 'edit'],
          events: ['view', 'edit'],
          financial: ['view', 'edit'],
          performance: ['view', 'edit'],
          staff: ['view', 'edit'],
          roster: ['view', 'edit'],
          vehicles: ['view', 'edit'],
          equipment: ['view', 'edit'],
          stocks: ['view', 'edit'],
          scouting: ['view', 'edit'],
          userManagement: ['view', 'edit'],
          permissions: ['view', 'edit'],
          checklist: ['view', 'edit'],
          settings: ['view', 'edit'],
          // Exclure les sections "Mon Espace"
        };
      }
      const activeEvent = appState.activeEventId
        ? appState.raceEvents.find((e) => e.id === appState.activeEventId)
        : null;
      const userTeams = appState.teams.filter((team) =>
        appState.teamMemberships.some(
          (m) =>
            m.teamId === team.id &&
            m.userId === currentUser.id &&
            m.status === TeamMembershipStatus.ACTIVE
        )
      );

      return (
        <LanguageProvider
          language={language}
          setLanguage={(lang) => {
            if (lang) setLanguageState(lang);
          }}
        >
          <div className="flex">
            {appState && (
              <Sidebar
                currentSection={currentSection}
                onSelectSection={navigateTo}
                teamLogoUrl={appState.teamLogoUrl}
                onLogout={handleLogout}
                currentUser={currentUser}
                effectivePermissions={effectivePermissions}
                staff={appState.staff}
                permissionRoles={appState.permissionRoles}
                userTeams={userTeams}
                currentTeamId={appState.activeTeamId}
                onTeamSwitch={() => {
                  /* TODO */
                }}
                isIndependent={false}
                onGoToLobby={() => setView("no_team")}
              />
            )}
            <main className="flex-grow ml-64 p-6 bg-gray-100 min-h-screen">

              
              {activeEvent ? (
                <EventDetailView
                  event={activeEvent}
                  eventId={activeEvent.id}
                  appState={appState as AppState}
                  navigateTo={navigateTo}
                  deleteRaceEvent={(eventId) => {
                    onDeleteRaceEvent({ id: eventId } as RaceEvent);
                    navigateTo("events");
                  }}
                  currentUser={currentUser}
                  setRaceEvents={createBatchSetHandler<RaceEvent>("raceEvents")}
                  setEventTransportLegs={createBatchSetHandler<EventTransportLeg>(
                    "eventTransportLegs"
                  )}
                  setEventAccommodations={createBatchSetHandler<EventAccommodation>(
                    "eventAccommodations"
                  )}
                  setEventDocuments={createBatchSetHandler<EventRaceDocument>(
                    "eventDocuments"
                  )}
                  setEventRadioEquipments={createBatchSetHandler<EventRadioEquipment>(
                    "eventRadioEquipments"
                  )}
                  setEventRadioAssignments={createBatchSetHandler<EventRadioAssignment>(
                    "eventRadioAssignments"
                  )}
                  setEventBudgetItems={createBatchSetHandler<EventBudgetItem>(
                    "eventBudgetItems"
                  )}
                  setEventChecklistItems={createBatchSetHandler<EventChecklistItem>(
                    "eventChecklistItems"
                  )}
                  setPerformanceEntries={createBatchSetHandler<PerformanceEntry>(
                    "performanceEntries"
                  )}
                  setPeerRatings={createBatchSetHandler<PeerRating>(
                    "peerRatings"
                  )}
                />
              ) : (
                <div>
                  {/* Protection globale contre l'état non initialisé */}
                  {(!appState || !appState.riders || !appState.staff || !appState.incomeItems || !appState.teams || !appState.teamMemberships) ? (
                    <div className="flex items-center justify-center min-h-screen bg-gray-50">
                      <div className="text-center p-8 bg-white rounded-lg shadow-lg border">
                        <h3 className="text-xl font-semibold text-gray-700 mb-4">Chargement de l'application...</h3>
                        <p className="text-gray-500 mb-4">Initialisation des données...</p>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {currentSection === "dashboard" && (
                    <DashboardSection
                      navigateTo={navigateTo}
                      currentUser={currentUser}
                      riders={appState.riders}
                      staff={appState.staff}
                      vehicles={appState.vehicles}
                      scoutingProfiles={appState.scoutingProfiles}
                      eventBudgetItems={appState.eventBudgetItems}
                      raceEvents={appState.raceEvents}
                      eventTransportLegs={appState.eventTransportLegs}
                      eventChecklistItems={appState.eventChecklistItems}
                      incomeItems={appState.incomeItems}
                      riderEventSelections={appState.riderEventSelections}
                    />
                  )}
                  {currentSection === "events" && (
                    <EventsSection
                      raceEvents={appState.raceEvents}
                      setRaceEvents={createBatchSetHandler<RaceEvent>(
                        "raceEvents"
                      )}
                      setEventDocuments={createBatchSetHandler<EventRaceDocument>(
                        "eventDocuments"
                      )}
                      navigateToEventDetail={(eventId) =>
                        navigateTo("eventDetail", eventId)
                      }
                      eventTransportLegs={appState.eventTransportLegs}
                      riderEventSelections={appState.riderEventSelections}
                      deleteRaceEvent={(eventId) =>
                        onDeleteRaceEvent({ id: eventId } as RaceEvent)
                      }
                      riders={appState.riders}
                      staff={appState.staff}
                      teamLevel={appState.teamLevel}
                      currentUser={currentUser}
                    />
                  )}
                  {currentSection === "roster" && appState.riders && (
                    <RosterSection
                      riders={appState.riders}
                      onSaveRider={onSaveRider}
                      onDeleteRider={onDeleteRider}
                      raceEvents={appState.raceEvents}
                      setRaceEvents={createBatchSetHandler<RaceEvent>("raceEvents")}
                      riderEventSelections={appState.riderEventSelections}
                      setRiderEventSelections={createBatchSetHandler<RiderEventSelection>("riderEventSelections")}
                      performanceEntries={appState.performanceEntries}
                      scoutingProfiles={appState.scoutingProfiles}
                      teamProducts={appState.teamProducts}
                      currentUser={currentUser}
                      appState={appState}
                    />
                  )}
                  {currentSection === "staff" && appState.staff && currentUser && (
                    <StaffSection
                      staff={appState.staff}
                      onSave={onSaveStaff}
                      onDelete={onDeleteStaff}
                      effectivePermissions={effectivePermissions}
                      raceEvents={appState.raceEvents}
                      eventStaffAvailabilities={appState.eventStaffAvailabilities}
                      eventBudgetItems={appState.eventBudgetItems}
                      currentUser={currentUser}
                      team={appState.teams.find(t => t.id === appState.activeTeamId)}
                      performanceEntries={appState.performanceEntries}
                      missions={appState.missions}
                      teams={appState.teams}
                      users={appState.users}
                      permissionRoles={appState.permissionRoles}
                    />
                  )}
                  {currentSection === "vehicles" && (
                    <VehiclesSection
                      vehicles={appState.vehicles}
                      onSave={onSaveVehicle}
                      onDelete={onDeleteVehicle}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "equipment" && (
                    <EquipmentSection
                      equipment={appState.equipment}
                      onSave={onSaveEquipment}
                      onDelete={onDeleteEquipment}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "performance" && appState.riders && currentUser && (
                    <PerformancePoleSection
                      appState={appState}
                      navigateTo={navigateTo}
                      setTeamProducts={createBatchSetHandler<TeamProduct>("teamProducts")}
                      setRiders={createBatchSetHandler<Rider>("riders")}
                      currentUser={currentUser}
                    />
                  )}
                  {currentSection === "settings" && (
                    <SettingsSection
                      appState={appState}
                      onSaveTeamSettings={async (settings) => {
                        if (appState.activeTeamId) {
                          await firebaseService.saveTeamSettings(
                            appState.activeTeamId,
                            settings
                          );
                          setAppState((prev) => ({ ...prev, ...settings }));
                        }
                      }}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "financial" && appState.incomeItems && appState.eventBudgetItems && (
                    <FinancialSection
                      incomeItems={appState.incomeItems}
                      budgetItems={appState.eventBudgetItems}
                      onSaveIncomeItem={onSaveIncomeItem}
                      onDeleteIncomeItem={onDeleteIncomeItem}
                      onSaveBudgetItem={onSaveBudgetItem}
                      onDeleteBudgetItem={onDeleteBudgetItem}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "scouting" && (
                    <ScoutingSection
                      scoutingProfiles={appState.scoutingProfiles}
                      onSaveScoutingProfile={onSaveScoutingProfile}
                      onDeleteScoutingProfile={onDeleteScoutingProfile}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "userManagement" && appState.users && appState.teamMemberships && (
                    <UserManagementSection
                      appState={appState}
                      currentTeamId={appState.activeTeamId || ''}
                      onApprove={async (membership) => {
                        try {
                          // Mettre à jour le statut de l'adhésion
                          const membershipRef = doc(db, 'teamMemberships', membership.id);
                          await updateDoc(membershipRef, {
                            status: TeamMembershipStatus.ACTIVE,
                            approvedAt: new Date().toISOString(),
                            approvedBy: currentUser.id
                          });

                          // Mettre à jour l'état local
                          setAppState(prev => ({
                            ...prev,
                            teamMemberships: prev.teamMemberships.map(m => 
                              m.id === membership.id 
                                ? { ...m, status: TeamMembershipStatus.ACTIVE, approvedAt: new Date().toISOString(), approvedBy: currentUser.id }
                                : m
                            )
                          }));

                          // Créer un profil utilisateur si nécessaire
                          const existingUser = appState.users.find(u => u.email === membership.email);
                          if (!existingUser) {
                            const newUser: User = {
                              id: generateId(),
                              email: membership.email,
                              firstName: membership.firstName || '',
                              lastName: membership.lastName || '',
                              userRole: UserRole.COUREUR,
                              teamId: membership.teamId,
                              permissionRole: TeamRole.MEMBER,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                              isActive: true
                            };
                            
                            await setDoc(doc(db, 'users', newUser.id), newUser);
                            setAppState(prev => ({
                              ...prev,
                              users: [...prev.users, newUser]
                            }));
                          }
                        } catch (error) {
                          console.error('Erreur lors de l\'approbation:', error);
                          alert('Erreur lors de l\'approbation de l\'adhésion');
                        }
                      }}
                      onDeny={async (membership) => {
                        try {
                          if (window.confirm(`Refuser l'adhésion de ${membership.email} ?`)) {
                            // Supprimer l'adhésion refusée
                            const membershipRef = doc(db, 'teamMemberships', membership.id);
                            await deleteDoc(membershipRef);

                            // Mettre à jour l'état local
                            setAppState(prev => ({
                              ...prev,
                              teamMemberships: prev.teamMemberships.filter(m => m.id !== membership.id)
                            }));
                          }
                        } catch (error) {
                          console.error('Erreur lors du refus:', error);
                          alert('Erreur lors du refus de l\'adhésion');
                        }
                      }}
                      onInvite={async (email, teamId) => {
                        try {
                          // Vérifier si l'utilisateur existe déjà
                          const existingUser = appState.users.find(u => u.email === email);
                          if (existingUser) {
                            alert('Un utilisateur avec cet email existe déjà');
                            return;
                          }

                          // Créer une nouvelle adhésion en attente
                          const newMembership: TeamMembership = {
                            id: generateId(),
                            email,
                            teamId,
                            status: TeamMembershipStatus.PENDING,
                            requestedAt: new Date().toISOString(),
                            requestedBy: currentUser.id,
                            firstName: '',
                            lastName: '',
                            message: ''
                          };

                          // Sauvegarder dans Firestore
                          await addDoc(collection(db, 'teamMemberships'), newMembership);

                          // Mettre à jour l'état local
                          setAppState(prev => ({
                            ...prev,
                            teamMemberships: [...prev.teamMemberships, newMembership]
                          }));

                          alert(`Invitation envoyée à ${email}`);
                        } catch (error) {
                          console.error('Erreur lors de l\'invitation:', error);
                          alert('Erreur lors de l\'envoi de l\'invitation');
                        }
                      }}
                      onRemove={async (userId, teamId) => {
                        try {
                          const user = appState.users.find(u => u.id === userId);
                          if (!user) return;

                          if (window.confirm(`Retirer ${user.firstName} ${user.lastName} de l'équipe ?`)) {
                            // Supprimer l'adhésion
                            const membership = appState.teamMemberships.find(m => m.userId === userId && m.teamId === teamId);
                            if (membership) {
                              await deleteDoc(doc(db, 'teamMemberships', membership.id));
                            }

                            // Mettre à jour l'utilisateur
                            const userRef = doc(db, 'users', userId);
                            await updateDoc(userRef, {
                              teamId: null,
                              permissionRole: null,
                              updatedAt: new Date().toISOString()
                            });

                            // Mettre à jour l'état local
                            setAppState(prev => ({
                              ...prev,
                              users: prev.users.map(u => 
                                u.id === userId 
                                  ? { ...u, teamId: null, permissionRole: null }
                                  : u
                              ),
                              teamMemberships: prev.teamMemberships.filter(m => m.id !== membership?.id)
                            }));
                          }
                        } catch (error) {
                          console.error('Erreur lors de la suppression:', error);
                          alert('Erreur lors de la suppression du membre');
                        }
                      }}
                      onUpdateRole={async (userId, teamId, newUserRole) => {
                        try {
                          // Mettre à jour le rôle utilisateur
                          const userRef = doc(db, 'users', userId);
                          await updateDoc(userRef, {
                            userRole: newUserRole,
                            updatedAt: new Date().toISOString()
                          });

                          // Mettre à jour l'état local
                          setAppState(prev => ({
                            ...prev,
                            users: prev.users.map(u => 
                              u.id === userId 
                                ? { ...u, userRole: newUserRole }
                                : u
                            )
                          }));

                          alert('Rôle utilisateur mis à jour avec succès');
                        } catch (error) {
                          console.error('Erreur lors de la mise à jour du rôle:', error);
                          alert('Erreur lors de la mise à jour du rôle');
                        }
                      }}
                      onUpdatePermissionRole={async (userId, newPermissionRole) => {
                        try {
                          // Mettre à jour le rôle de permission
                          const userRef = doc(db, 'users', userId);
                          await updateDoc(userRef, {
                            permissionRole: newPermissionRole,
                            updatedAt: new Date().toISOString()
                          });

                          // Mettre à jour l'état local
                          setAppState(prev => ({
                            ...prev,
                            users: prev.users.map(u => 
                              u.id === userId 
                                ? { ...u, permissionRole: newPermissionRole }
                                : u
                            )
                          }));

                          alert('Rôle de permission mis à jour avec succès');
                        } catch (error) {
                          console.error('Erreur lors de la mise à jour des permissions:', error);
                          alert('Erreur lors de la mise à jour des permissions');
                        }
                      }}
                      onUpdateUserCustomPermissions={async (userId, newEffectivePermissions) => {
                        const userDocRef = doc(db, "users", userId);
                        await setDoc(
                          userDocRef,
                          { customPermissions: newEffectivePermissions },
                          { merge: true }
                        );
                        setAppState((prev) => ({
                          ...prev,
                          users: prev.users.map((u) =>
                            u.id === userId
                              ? { ...u, customPermissions: newEffectivePermissions }
                              : u
                          ),
                        }));
                      }}
                      onTransferUser={async (userId, fromTeamId, toTeamId) => {
                        try {
                          const user = appState.users.find(u => u.id === userId);
                          if (!user) return;

                          if (window.confirm(`Transférer ${user.firstName} ${user.lastName} vers l'autre équipe ?`)) {
                            // Mettre à jour l'utilisateur
                            const userRef = doc(db, 'users', userId);
                            await updateDoc(userRef, {
                              teamId: toTeamId,
                              updatedAt: new Date().toISOString()
                            });

                            // Supprimer l'ancienne adhésion
                            const oldMembership = appState.teamMemberships.find(m => m.userId === userId && m.teamId === fromTeamId);
                            if (oldMembership) {
                              await deleteDoc(doc(db, 'teamMemberships', oldMembership.id));
                            }

                            // Créer la nouvelle adhésion
                            const newMembership: TeamMembership = {
                              id: generateId(),
                              userId,
                              email: user.email,
                              teamId: toTeamId,
                              status: TeamMembershipStatus.ACTIVE,
                              requestedAt: new Date().toISOString(),
                              requestedBy: currentUser.id,
                              firstName: user.firstName,
                              lastName: user.lastName,
                              message: 'Transfert automatique'
                            };

                            await addDoc(collection(db, 'teamMemberships'), newMembership);

                            // Mettre à jour l'état local
                            setAppState(prev => ({
                              ...prev,
                              users: prev.users.map(u => 
                                u.id === userId 
                                  ? { ...u, teamId: toTeamId }
                                  : u
                              ),
                              teamMemberships: [
                                ...prev.teamMemberships.filter(m => m.id !== oldMembership?.id),
                                newMembership
                              ]
                            }));

                            alert('Utilisateur transféré avec succès');
                          }
                        } catch (error) {
                          console.error('Erreur lors du transfert:', error);
                          alert('Erreur lors du transfert de l\'utilisateur');
                        }
                      }}
                    />
                  )}
                  {currentSection === "permissions" && (
                    <PermissionsSection
                      permissions={appState.permissions}
                      permissionRoles={appState.permissionRoles}
                      onSavePermissions={async (permissions) => {
                        const permissionsDocRef = doc(
                          db,
                          "permissions",
                          "default"
                        );
                        await setDoc(permissionsDocRef, permissions);
                        setAppState((prev) => ({ ...prev, permissions }));
                      }}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "career" && (
                    <CareerSection
                      riders={appState.riders}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "nutrition" && (
                    <NutritionSection
                      rider={appState.riders.find((r) => r.email === currentUser.email)}
                      setRiders={createBatchSetHandler<Rider>("riders")}
                      teamProducts={appState.teamProducts}
                      setTeamProducts={createBatchSetHandler<TeamProduct>("teamProducts")}
                    />
                  )}
                  {currentSection === "riderEquipment" && (
                    <RiderEquipmentSection
                      riders={appState.riders}
                      equipment={appState.equipment}
                      currentUser={currentUser}
                      setRiders={createBatchSetHandler<Rider>("riders")}
                    />
                  )}
                  {currentSection === "adminDossier" && (
                    <AdminDossierSection
                      riders={appState.riders}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "myTrips" && (
                    <MyTripsSection
                      riders={appState.riders}
                      staff={appState.staff}
                      eventTransportLegs={appState.eventTransportLegs}
                      raceEvents={appState.raceEvents}
                      currentUser={currentUser}
                    />
                  )}
                  {currentSection === "stocks" && appState.stockItems && (
                    <StocksSection
                      stockItems={appState.stockItems}
                      onSaveStockItem={onSaveStockItem}
                      onDeleteStockItem={onDeleteStockItem}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "checklist" && (
                    <ChecklistSection
                      checklistTemplates={appState.checklistTemplates}
                      onSaveChecklistTemplate={onSaveChecklistTemplate}
                      onDeleteChecklistTemplate={onDeleteChecklistTemplate}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "myPerformance" && (
                    <MyPerformanceSection
                      rider={appState.riders.find((r) => r.email === currentUser.email)}
                      setRiders={createBatchSetHandler<Rider>("riders")}
                    />
                  )}
                  {currentSection === "missionSearch" && (
                    <MissionSearchSection
                      riders={appState.riders}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "automatedPerformanceProfile" && (
                    <AutomatedPerformanceProfileSection
                      rider={appState.riders.find((r) => r.email === currentUser.email)}
                    />
                  )}
                  {currentSection === "performanceProject" && (
                    <PerformanceProjectSection
                      rider={appState.riders.find((r) => r.email === currentUser.email)}
                      setRiders={createBatchSetHandler<Rider>("riders")}
                    />
                  )}
                    </>
                  )}
                </div>
              )}
            </main>
          </div>
        </LanguageProvider>
      );
    }
    return null; // Should not be reached if logic is correct
  };

  return <>{renderContent()}</>;
};

export default App;

