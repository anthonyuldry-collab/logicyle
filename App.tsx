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

import FirebaseDebug from "./components/FirebaseDebug";
import Sidebar from "./components/Sidebar";
import { LanguageProvider } from "./contexts/LanguageContext";
import EventDetailView from "./EventDetailView";
import { useTranslations } from "./hooks/useTranslations";
import AdminDossierSection from "./sections/AdminDossierSection";
import { AutomatedPerformanceProfileSection } from "./sections/AutomatedPerformanceProfileSection";
import CareerSection from "./sections/CareerSection";
import { ChecklistSection } from "./sections/ChecklistSection";
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
import { ScoutingSection } from "./sections/ScoutingSection";
import SettingsSection from "./sections/SettingsSection";
import SignupView, { SignupData } from "./sections/SignupView";
import { StaffSection } from "./sections/StaffSection";
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
  const createSaveHandler = <T extends { id?: string }>(
    collectionName: keyof TeamState
  ) =>
    useCallback(
      async (item: T) => {
        if (!appState.activeTeamId) return;
        const savedId = await firebaseService.saveData(
          appState.activeTeamId,
          collectionName as string,
          item
        );
        const finalItem = { ...item, id: item.id || savedId };

        setAppState((prev) => {
          const collection = prev[collectionName] as T[];
          const exists = collection.some((i) => i.id === finalItem.id);
          const newCollection = exists
            ? collection.map((i) => (i.id === finalItem.id ? finalItem : i))
            : [...collection, finalItem];
          return { ...prev, [collectionName]: newCollection };
        });
      },
      [appState.activeTeamId]
    );

  const createDeleteHandler = <T extends { id?: string }>(
    collectionName: keyof TeamState
  ) =>
    useCallback(
      async (item: T) => {
        if (!appState.activeTeamId || !item.id) return;
        await firebaseService.deleteData(
          appState.activeTeamId,
          collectionName as string,
          item.id
        );

        setAppState((prev) => {
          const collection = prev[collectionName] as T[];
          return {
            ...prev,
            [collectionName]: collection.filter((i) => i.id !== item.id),
          };
        });
      },
      [appState.activeTeamId]
    );

  const createBatchSetHandler =
    <T,>(
      collectionName: keyof TeamState
    ): React.Dispatch<React.SetStateAction<T[]>> =>
    (updater) => {
      setAppState((prev) => {
        const currentItems = prev[collectionName] as T[];
        const newItems =
          typeof updater === "function"
            ? (updater as (prevState: T[]) => T[])(currentItems)
            : updater;

        return { ...prev, [collectionName]: newItems };
      });
    };

  const onSaveRider = createSaveHandler<Rider>("riders");
  const onDeleteRider = createDeleteHandler<Rider>("riders");
  const onSaveStaff = createSaveHandler<StaffMember>("staff");
  const onDeleteStaff = createDeleteHandler<StaffMember>("staff");
  const onSaveVehicle = createSaveHandler<Vehicle>("vehicles");
  const onDeleteVehicle = createDeleteHandler<Vehicle>("vehicles");
  const onSaveEquipment = createSaveHandler<EquipmentItem>("equipment");
  const onDeleteEquipment = createDeleteHandler<EquipmentItem>("equipment");
  const onSaveRaceEvent = createSaveHandler<RaceEvent>("raceEvents");
  const onDeleteRaceEvent = createDeleteHandler<RaceEvent>("raceEvents");

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
      setAppState((prev) => ({ ...prev, activeEventId: eventId }));
    } else {
      setAppState((prev) => ({ ...prev, activeEventId: null }));
    }
    setCurrentSection(section);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        {t("loading")}
        <FirebaseDebug />
      </div>
    );
  }

  const renderContent = () => {
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
      const effectivePermissions = firebaseService.getEffectivePermissions(
        currentUser,
        appState.permissions,
        appState.staff
      );
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
            <main className="flex-grow ml-64 p-6 bg-gray-100 min-h-screen">
              {/* Debug temporaire pour voir le problème */}
              {currentUser && (
                <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">🚨 Debug - Problème de Permissions</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Email:</strong> {currentUser.email}</p>
                      <p><strong>Rôle Utilisateur:</strong> {currentUser.userRole}</p>
                      <p><strong>Rôle Permission:</strong> {currentUser.permissionRole}</p>
                      <p><strong>Team ID:</strong> {currentUser.teamId || 'Aucun'}</p>
                    </div>
                    <div>
                      <p><strong>Test de Logique:</strong></p>
                      <div className="text-xs bg-white p-2 rounded border">
                        <div><strong>Valeurs exactes :</strong></div>
                        <div>userRole: "{currentUser.userRole}" (type: {typeof currentUser.userRole})</div>
                        <div>permissionRole: "{currentUser.permissionRole}" (type: {typeof currentUser.permissionRole})</div>
                        <div>teamId: "{currentUser.teamId}" (type: {typeof currentUser.teamId})</div>
                        <hr className="my-1" />
                        <div><strong>Tests de comparaison :</strong></div>
                        <div>userRole === 'MANAGER': {currentUser.userRole === 'MANAGER' ? '✅ OUI' : '❌ NON'}</div>
                        <div>userRole === 'Manager': {currentUser.userRole === 'Manager' ? '✅ OUI' : '❌ NON'}</div>
                        <div>userRole.toLowerCase().includes('manager'): {currentUser.userRole?.toLowerCase().includes('manager') ? '✅ OUI' : '❌ NON'}</div>
                        <div>permissionRole === 'ADMIN': {currentUser.permissionRole === 'ADMIN' ? '✅ OUI' : '❌ NON'}</div>
                        <div>permissionRole === 'Administrateur': {currentUser.permissionRole === 'Administrateur' ? '✅ OUI' : '❌ NON'}</div>
                        <div>permissionRole.toLowerCase().includes('admin'): {currentUser.permissionRole?.toLowerCase().includes('admin') ? '✅ OUI' : '❌ NON'}</div>
                        <hr className="my-1" />
                        <div><strong>Condition finale :</strong></div>
                        <div>Condition activée: {(currentUser.userRole?.toLowerCase().includes('manager') || currentUser.permissionRole?.toLowerCase().includes('admin') || currentUser.userRole === 'MANAGER' || currentUser.permissionRole === 'ADMIN' || currentUser.userRole === 'Manager' || currentUser.permissionRole === 'Administrateur') ? '✅ OUI' : '❌ NON'}</div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            // Trouver votre équipe
                            const userTeam = appState.teams.find(team => 
                              appState.teamMemberships.some(m => 
                                m.teamId === team.id && m.userId === currentUser.id
                              )
                            );
                            if (userTeam) {
                              // Mettre à jour votre profil avec le teamId
                              await firebaseService.updateUserProfile(currentUser.id, {
                                ...currentUser,
                                teamId: userTeam.id
                              });
                              // Recharger les données
                              const updatedUser = { ...currentUser, teamId: userTeam.id };
                              setCurrentUser(updatedUser);
                              await loadDataForUser(updatedUser);
                              alert('TeamId mis à jour ! Rechargez la page.');
                            } else {
                              alert('Aucune équipe trouvée pour cet utilisateur.');
                            }
                          } catch (error) {
                            alert('Erreur lors de la mise à jour: ' + error);
                          }
                        }}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        🔧 Réparer le TeamId
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
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
                  {currentSection === "roster" && (
                    <RosterSection
                      riders={appState.riders}
                      onSave={onSaveRider}
                      onDelete={onDeleteRider}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "staff" && (
                    <StaffSection
                      staff={appState.staff}
                      onSave={onSaveStaff}
                      onDelete={onDeleteStaff}
                      effectivePermissions={effectivePermissions}
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
                  {currentSection === "performance" && (
                    <PerformancePoleSection
                      riders={appState.riders}
                      performanceEntries={appState.performanceEntries}
                      onSavePerformanceEntry={createSaveHandler<PerformanceEntry>(
                        "performanceEntries"
                      )}
                      onDeletePerformanceEntry={createDeleteHandler<PerformanceEntry>(
                        "performanceEntries"
                      )}
                      effectivePermissions={effectivePermissions}
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
                  {currentSection === "financial" && (
                    <FinancialSection
                      incomeItems={appState.incomeItems}
                      budgetItems={appState.budgetItems}
                      onSaveIncomeItem={createSaveHandler<IncomeItem>(
                        "incomeItems"
                      )}
                      onDeleteIncomeItem={createDeleteHandler<IncomeItem>(
                        "incomeItems"
                      )}
                      onSaveBudgetItem={createSaveHandler<EventBudgetItem>(
                        "eventBudgetItems"
                      )}
                      onDeleteBudgetItem={createDeleteHandler<EventBudgetItem>(
                        "eventBudgetItems"
                      )}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "scouting" && (
                    <ScoutingSection
                      scoutingProfiles={appState.scoutingProfiles}
                      onSaveScoutingProfile={createSaveHandler<ScoutingProfile>(
                        "scoutingProfiles"
                      )}
                      onDeleteScoutingProfile={createDeleteHandler<ScoutingProfile>(
                        "scoutingProfiles"
                      )}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "userManagement" && (
                    <UserManagementSection
                      users={appState.users}
                      teamMemberships={appState.teamMemberships}
                      onUpdateUserPermissions={async (userId, permissions) => {
                        const userDocRef = doc(db, "users", userId);
                        await setDoc(
                          userDocRef,
                          { customPermissions: permissions },
                          { merge: true }
                        );
                        setAppState((prev) => ({
                          ...prev,
                          users: prev.users.map((u) =>
                            u.id === userId
                              ? { ...u, customPermissions: permissions }
                              : u
                          ),
                        }));
                      }}
                      effectivePermissions={effectivePermissions}
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
                  {currentSection === "stocks" && (
                    <StocksSection
                      stockItems={appState.stockItems}
                      onSaveStockItem={createSaveHandler<StockItem>(
                        "stockItems"
                      )}
                      onDeleteStockItem={createDeleteHandler<StockItem>(
                        "stockItems"
                      )}
                      effectivePermissions={effectivePermissions}
                    />
                  )}
                  {currentSection === "checklist" && (
                    <ChecklistSection
                      checklistTemplates={appState.checklistTemplates}
                      onSaveChecklistTemplate={createSaveHandler<ChecklistTemplate>(
                        "checklistTemplates"
                      )}
                      onDeleteChecklistTemplate={createDeleteHandler<ChecklistTemplate>(
                        "checklistTemplates"
                      )}
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
                </div>
              )}
            </main>
            <FirebaseDebug />
          </div>
        </LanguageProvider>
      );
    }
    return null; // Should not be reached if logic is correct
  };

  const riderForCurrentUser = appState.riders.find(
    (r) => r.email === currentUser?.email
  );

  return <>{renderContent()}</>;
};

export default App;

