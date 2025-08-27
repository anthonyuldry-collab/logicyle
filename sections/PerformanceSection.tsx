import React, { useState, useMemo, useEffect } from 'react';
import { AppState, AppSection, TeamProduct, Rider, PowerProfile, RiderQualitativeProfile as RiderQualitativeProfileEnum, PerformanceEntry, RiderRating, RaceEvent, User, TeamRole, EventType, RiderEventStatus, ScoutingProfile, StaffRole, ContractType, Sex } from '../types';
import SectionWrapper from '../components/SectionWrapper';
import ActionButton from '../components/ActionButton';
import Modal from '../components/Modal';
import PlusCircleIcon from '../components/icons/PlusCircleIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { RIDER_QUALITATIVE_PROFILE_COLORS, COGGAN_CATEGORY_COLORS, POWER_PROFILE_REFERENCE_TABLES, riderProfileKeyToRefTableKeyMap, POWER_ANALYSIS_DURATIONS_CONFIG, PERFORMANCE_SCORE_WEIGHTS, COLLECTIVE_SCORE_PENALTY_THRESHOLD, COLLECTIVE_SCORE_PENALTY_MULTIPLIER, CATEGORY_ID_TO_SCALE_MAP, EVENT_CATEGORY_POINTS_TABLE, RIDER_LEVEL_CATEGORIES } from '../constants';
import TrophyIcon from '../components/icons/TrophyIcon';
import StarIcon from '../components/icons/StarIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import ChartBarIcon from '../components/icons/ChartBarIcon';
import PerformanceProjectTab from '../components/riderDetailTabs/PerformanceProjectTab';
import { ResultsTab } from '../components/riderDetailTabs/ResultsTab';
import EyeIcon from '../components/icons/EyeIcon';
import EyeSlashIcon from '../components/icons/EyeSlashIcon';
import UsersIcon from '../components/icons/UsersIcon';
import CakeIcon from '../components/icons/CakeIcon';
import { getAgeCategory } from '../utils/ageUtils';
import { getRiderCharacteristicSafe } from '../utils/riderUtils';
import { RiderComparisonChart, RiderRadarChart, PerformanceTrendsChart, RiderComparisonRadarChart, RiderComparisonSelector } from '../components/PerformanceCharts';

// Type definitions for the new section
type PerformancePoleTab = 'global' | 'powerAnalysis' | 'charts' | 'comparison' | 'nutritionProducts' | 'planning';
type RiderPerformanceTab = 'ppr' | 'project' | 'results';
type ObjectiveCode = 'bleu' | 'vert' | 'orange';
type PowerDisplayMode = 'watts' | 'wattsPerKg';
type PowerDuration = '1s' | '5s' | '30s' | '1min' | '3min' | '5min' | '12min' | '20min' | 'cp';

// Helper function for ID generation
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

// Initial state for the nutrition product form
const initialProductFormState: Omit<TeamProduct, 'id'> = {
  name: '',
  type: 'gel',
  brand: '',
  carbs: 0,
  glucose: undefined,
  fructose: undefined,
  caffeine: undefined,
  sodium: undefined,
  notes: ''
};

const calculateWkg = (power?: number, weight?: number): string => {
  if (typeof power === 'number' && typeof weight === 'number' && weight > 0) {
    return (power / weight).toFixed(1);
  }
  return "-";
};

// Configuration des durées de puissance pour le tri et l'affichage
const POWER_DURATIONS_CONFIG: { key: PowerDuration; label: string; powerKey: keyof PowerProfile; unit: string; color: string }[] = [
  { key: '1s', label: '1 Seconde', powerKey: 'power1s', unit: 'W', color: 'bg-red-500' },
  { key: '5s', label: '5 Secondes', powerKey: 'power5s', unit: 'W', color: 'bg-orange-500' },
  { key: '30s', label: '30 Secondes', powerKey: 'power30s', unit: 'W', color: 'bg-yellow-500' },
  { key: '1min', label: '1 Minute', powerKey: 'power1min', unit: 'W', color: 'bg-lime-500' },
  { key: '3min', label: '3 Minutes', powerKey: 'power3min', unit: 'W', color: 'bg-green-500' },
  { key: '5min', label: '5 Minutes', powerKey: 'power5min', unit: 'W', color: 'bg-teal-500' },
  { key: '12min', label: '12 Minutes', powerKey: 'power12min', unit: 'W', color: 'bg-blue-500' },
  { key: '20min', label: '20 Minutes', powerKey: 'power20min', unit: 'W', color: 'bg-indigo-500' },
  { key: 'cp', label: 'CP/FTP', powerKey: 'criticalPower', unit: 'W', color: 'bg-purple-500' }
];

// Fonction pour obtenir la valeur de puissance d'un rider
const getRiderPowerValue = (rider: Rider, duration: PowerDuration, mode: PowerDisplayMode): number => {
  const config = POWER_DURATIONS_CONFIG.find(c => c.key === duration);
  if (!config) return 0;
  
  const powerProfile = rider.powerProfileFresh;
  if (!powerProfile) return 0;
  
  const powerValue = powerProfile[config.powerKey] as number;
  if (typeof powerValue !== 'number' || isNaN(powerValue)) return 0;
  
  if (mode === 'wattsPerKg' && rider.weightKg) {
    return powerValue / rider.weightKg;
  }
  
  return powerValue;
};

// Fonction pour obtenir la couleur de performance basée sur la valeur
const getPerformanceColor = (value: number, duration: PowerDuration, mode: PowerDisplayMode): string => {
  // Seuils de performance (à ajuster selon vos critères)
  const thresholds = {
    '1s': { excellent: mode === 'wattsPerKg' ? 18 : 1000, veryGood: mode === 'wattsPerKg' ? 16 : 900, good: mode === 'wattsPerKg' ? 14 : 800 },
    '5s': { excellent: mode === 'wattsPerKg' ? 16 : 900, veryGood: mode === 'wattsPerKg' ? 14 : 800, good: mode === 'wattsPerKg' ? 12 : 700 },
    '30s': { excellent: mode === 'wattsPerKg' ? 12 : 700, veryGood: mode === 'wattsPerKg' ? 10 : 600, good: mode === 'wattsPerKg' ? 8 : 500 },
    '1min': { excellent: mode === 'wattsPerKg' ? 10 : 600, veryGood: mode === 'wattsPerKg' ? 8 : 500, good: mode === 'wattsPerKg' ? 6 : 400 },
    '3min': { excellent: mode === 'wattsPerKg' ? 8 : 500, veryGood: mode === 'wattsPerKg' ? 6 : 400, good: mode === 'wattsPerKg' ? 5 : 300 },
    '5min': { excellent: mode === 'wattsPerKg' ? 7 : 400, veryGood: mode === 'wattsPerKg' ? 5 : 300, good: mode === 'wattsPerKg' ? 4 : 250 },
    '12min': { excellent: mode === 'wattsPerKg' ? 6 : 350, veryGood: mode === 'wattsPerKg' ? 4 : 250, good: mode === 'wattsPerKg' ? 3 : 200 },
    '20min': { excellent: mode === 'wattsPerKg' ? 5 : 300, veryGood: mode === 'wattsPerKg' ? 4 : 250, good: mode === 'wattsPerKg' ? 3 : 200 },
    'cp': { excellent: mode === 'wattsPerKg' ? 5 : 300, veryGood: mode === 'wattsPerKg' ? 4 : 250, good: mode === 'wattsPerKg' ? 3 : 200 }
  };
  
  const threshold = thresholds[duration];
  if (value >= threshold.excellent) return 'bg-blue-500 text-white';
  if (value >= threshold.veryGood) return 'bg-green-500 text-white';
  if (value >= threshold.good) return 'bg-yellow-500 text-white';
  return 'bg-gray-500 text-white';
};

// Fonction pour obtenir le label de performance
const getPerformanceLabel = (value: number, duration: PowerDuration, mode: PowerDisplayMode): string => {
  const thresholds = {
    '1s': { excellent: mode === 'wattsPerKg' ? 18 : 1000, veryGood: mode === 'wattsPerKg' ? 16 : 900, good: mode === 'wattsPerKg' ? 14 : 800 },
    '5s': { excellent: mode === 'wattsPerKg' ? 16 : 900, veryGood: mode === 'wattsPerKg' ? 14 : 800, good: mode === 'wattsPerKg' ? 12 : 700 },
    '30s': { excellent: mode === 'wattsPerKg' ? 12 : 700, veryGood: mode === 'wattsPerKg' ? 10 : 600, good: mode === 'wattsPerKg' ? 8 : 500 },
    '1min': { excellent: mode === 'wattsPerKg' ? 10 : 600, veryGood: mode === 'wattsPerKg' ? 8 : 500, good: mode === 'wattsPerKg' ? 6 : 400 },
    '3min': { excellent: mode === 'wattsPerKg' ? 8 : 500, veryGood: mode === 'wattsPerKg' ? 6 : 400, good: mode === 'wattsPerKg' ? 5 : 300 },
    '5min': { excellent: mode === 'wattsPerKg' ? 7 : 400, veryGood: mode === 'wattsPerKg' ? 5 : 300, good: mode === 'wattsPerKg' ? 4 : 250 },
    '12min': { excellent: mode === 'wattsPerKg' ? 6 : 350, veryGood: mode === 'wattsPerKg' ? 4 : 250, good: mode === 'wattsPerKg' ? 3 : 200 },
    '20min': { excellent: mode === 'wattsPerKg' ? 5 : 300, veryGood: mode === 'wattsPerKg' ? 4 : 250, good: mode === 'wattsPerKg' ? 3 : 200 },
    'cp': { excellent: mode === 'wattsPerKg' ? 5 : 300, veryGood: mode === 'wattsPerKg' ? 4 : 250, good: mode === 'wattsPerKg' ? 3 : 200 }
  };
  
  const threshold = thresholds[duration];
  if (value >= threshold.excellent) return 'Excellent';
  if (value >= threshold.veryGood) return 'Très Bon';
  if (value >= threshold.good) return 'Bon';
  return 'Modéré';
};

// Composant principal du tableau de synthèse des performances
const PowerPerformanceTable: React.FC<{ riders: Rider[] }> = ({ riders }) => {
  const [displayMode, setDisplayMode] = useState<PowerDisplayMode>('wattsPerKg');
  const [sortBy, setSortBy] = useState<PowerDuration>('cp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [genderFilter, setGenderFilter] = useState<'all' | Sex>('all');
  const [ageFilter, setAgeFilter] = useState<'all' | string>('all');
  const [selectedDurations, setSelectedDurations] = useState<PowerDuration[]>(['1s']);

  // Filtrage des riders
  const filteredRiders = useMemo(() => {
    return riders.filter(rider => {
      const genderMatch = genderFilter === 'all' || rider.sex === genderFilter;
      const { category } = getAgeCategory(rider.birthDate);
      const ageMatch = ageFilter === 'all' || category === ageFilter;
      return genderMatch && ageMatch;
    });
  }, [riders, genderFilter, ageFilter]);

  // Tri des riders par performance
  const sortedRiders = useMemo(() => {
    return [...filteredRiders].sort((a, b) => {
      const aValue = getRiderPowerValue(a, sortBy, displayMode);
      const bValue = getRiderPowerValue(b, sortBy, displayMode);
      
      if (sortDirection === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });
  }, [filteredRiders, sortBy, sortDirection, displayMode]);

  // Gestion du tri
  const handleSort = (duration: PowerDuration) => {
    if (sortBy === duration) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(duration);
      setSortDirection('desc');
    }
};

  // Rendu du tableau
    return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* En-tête avec contrôles */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
        <h2 className="text-xl font-bold mb-2">Centre Stratégique des Performances</h2>
        <div className="flex flex-wrap gap-4 items-center">
          {/* Mode d'affichage */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Affichage:</span>
            <div className="flex bg-blue-500 rounded-lg p-1">
              <button
                onClick={() => setDisplayMode('watts')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  displayMode === 'watts' ? 'bg-white text-blue-600' : 'text-white hover:bg-blue-400'
                }`}
              >
                Watts
              </button>
              <button
                onClick={() => setDisplayMode('wattsPerKg')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  displayMode === 'wattsPerKg' ? 'bg-white text-blue-600' : 'text-white hover:bg-blue-400'
                }`}
              >
                W/kg
              </button>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Sexe:</span>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as 'all' | Sex)}
              className="px-2 py-1 rounded text-sm text-gray-800"
            >
              <option value="all">Tous</option>
              <option value={Sex.MALE}>Hommes</option>
              <option value={Sex.FEMALE}>Femmes</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Catégorie:</span>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="px-2 py-1 rounded text-sm text-gray-800"
            >
              <option value="all">Toutes</option>
              <option value="U15">U15</option>
              <option value="U17">U17</option>
              <option value="U19">U19</option>
              <option value="U23">U23</option>
              <option value="Senior">Senior</option>
            </select>
                    </div>

          {/* Sélection des durées - Une seule à la fois */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-black">Durée:</span>
            <div className="flex overflow-x-auto gap-1 max-w-xs">
              {POWER_DURATIONS_CONFIG.map(duration => (
                <button
                  key={duration.key}
                  onClick={() => {
                    setSelectedDurations([duration.key]);
                  }}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
                    selectedDurations.includes(duration.key)
                      ? 'bg-blue-500 text-white font-semibold'
                      : 'bg-gray-200 text-black hover:bg-gray-300'
                  }`}
                >
                  {duration.label}
                </button>
              ))}
            </div>
            </div>

          {/* Tri actuel */}
          <div className="text-sm">
            <span className="font-medium">Tri par:</span> {POWER_DURATIONS_CONFIG.find(c => c.key === sortBy)?.label} 
            <span className="ml-1">{sortDirection === 'desc' ? '↓' : '↑'}</span>
          </div>
        </div>
      </div>

      {/* Tableau des performances */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider z-10">
                Coureur
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Sexe
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Poids
              </th>
              {POWER_DURATIONS_CONFIG.filter(d => selectedDurations.includes(d.key)).map(duration => (
                <th key={duration.key} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort(duration.key)}
                    className={`group flex flex-col items-center space-y-1 hover:bg-gray-100 rounded p-1 transition-colors ${
                      sortBy === duration.key ? 'bg-blue-100' : ''
                    }`}
                  >
                    <span className="font-bold">{duration.label}</span>
                    <span className="text-xs text-gray-500">({duration.unit})</span>
                    {sortBy === duration.key && (
                      <span className="text-blue-600 font-bold">
                        {sortDirection === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedRiders.map(rider => (
              <tr key={rider.id} className="hover:bg-gray-50">
                {/* Informations du coureur */}
                <td className="sticky left-0 bg-white px-4 py-3 whitespace-nowrap z-10">
                  <div className="flex items-center space-x-3">
                    {rider.photoUrl ? (
                      <img src={rider.photoUrl} alt={rider.firstName} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-gray-600 font-medium text-sm">
                          {rider.firstName.charAt(0)}{rider.lastName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {rider.firstName} {rider.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {rider.qualitativeProfile || 'Profil N/A'}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Sexe */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    rider.sex === Sex.FEMALE ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {rider.sex === Sex.FEMALE ? 'F' : 'M'}
                  </span>
                </td>

                {/* Poids */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {rider.weightKg ? `${rider.weightKg} kg` : '-'}
                </td>

                {/* Performances de puissance */}
                {POWER_DURATIONS_CONFIG.filter(d => selectedDurations.includes(d.key)).map(duration => {
                  const powerValue = getRiderPowerValue(rider, duration.key, displayMode);
                  const performanceColor = getPerformanceColor(powerValue, duration.key, displayMode);
                  const performanceLabel = getPerformanceLabel(powerValue, duration.key, displayMode);
                  const unit = displayMode === 'wattsPerKg' ? 'W/kg' : 'W';
                  
                  return (
                    <td key={duration.key} className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="space-y-1">
                        {/* Valeur principale */}
                        <div className="text-lg font-bold text-gray-900">
                          {powerValue > 0 ? powerValue.toFixed(displayMode === 'wattsPerKg' ? 1 : 0) : '-'}
                        </div>
                        
                        {/* Unité */}
                        <div className="text-xs text-gray-500">{unit}</div>
                        
                        {/* Label de performance */}
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${performanceColor}`}>
                          {performanceLabel}
                        </div>
                    </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
                </div>
                
      {/* Légende des performances */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Excellent</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Très Bon</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Bon</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-500 rounded"></div>
            <span>Modéré</span>
          </div>
                        </div>
                    </div>
                </div>
  );
};

// Composant principal de la section des performances
export const PerformanceSection: React.FC<{ appState: AppState }> = ({ appState }) => {
  // Protection contre appState null/undefined
  if (!appState) {
    console.warn('⚠️ PerformanceSection: appState is null or undefined');
    return (
      <SectionWrapper title="Centre Stratégique des Performances">
        <div className="p-6 text-center text-gray-500">
          Chargement des données...
        </div>
      </SectionWrapper>
    );
  }
  const [activeTab, setActiveTab] = useState<PerformancePoleTab>('global');
  const [activeRiderTab, setActiveRiderTab] = useState<RiderPerformanceTab>('ppr');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [isRiderModalOpen, setIsRiderModalOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<PowerDisplayMode>('wattsPerKg');
  const [selectedDurations, setSelectedDurations] = useState<PowerDuration[]>(['1s']);

  const riders = appState.riders || [];

  const tabButtonStyle = (tabName: PerformancePoleTab) => 
    `px-4 py-2 font-medium text-sm rounded-t-lg whitespace-nowrap transition-colors duration-150 focus:outline-none ${
      activeTab === tabName 
        ? 'bg-white text-blue-600 border-b-2 border-blue-500 shadow-sm' 
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <SectionWrapper title="Centre Stratégique des Performances">
      {/* Onglets principaux réorganisés */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Tabs">
          <button onClick={() => setActiveTab('global')} className={tabButtonStyle('global')}>
            <UsersIcon className="w-4 h-4 inline mr-2" />
            Vue d'Ensemble
          </button>
          <button onClick={() => setActiveTab('powerAnalysis')} className={tabButtonStyle('powerAnalysis')}>
            <ChartBarIcon className="w-4 h-4 inline mr-2" />
            Analyse des Puissances
          </button>
          <button onClick={() => setActiveTab('charts')} className={tabButtonStyle('charts')}>
            <TrendingUpIcon className="w-4 h-4 inline mr-2" />
            Graphiques
          </button>
          <button onClick={() => setActiveTab('comparison')} className={tabButtonStyle('comparison')}>
            <ChartBarIcon className="w-4 h-4 inline mr-2" />
            Comparaison
          </button>
          <button onClick={() => setActiveTab('nutritionProducts')} className={tabButtonStyle('nutritionProducts')}>
            <TrophyIcon className="w-4 h-4 inline mr-2" />
            Produits Nutrition
          </button>
          <button onClick={() => setActiveTab('planning')} className={tabButtonStyle('planning')}>
            <StarIcon className="w-4 h-4 inline mr-2" />
            Planning
          </button>
        </nav>
            </div>

      {/* Contenu des onglets */}
      <div className="mt-6">
        {/* Vue d'Ensemble - Remise en premier */}
        {activeTab === 'global' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                🌟 Vue d'Ensemble des Performances
              </h3>
              <p className="text-indigo-700">
                Synthèse globale des performances de votre équipe. Analysez les tendances, 
                identifiez les forces et faiblesses collectives, et optimisez vos stratégies d'entraînement.
              </p>
            </div>
            
            {/* Statistiques globales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <UsersIcon className="w-6 h-6 text-blue-600" />
                  </div>
                        <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total Athlètes</p>
                    <p className="text-2xl font-bold text-gray-900">{riders.length}</p>
                  </div>
                    </div>
                </div>
                
              <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="flex items-center">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <span className="text-pink-600 font-bold text-lg">F</span>
                  </div>
                        <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Femmes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {riders.filter(r => r.sex === Sex.FEMALE).length}
                    </p>
                  </div>
                    </div>
                </div>
                
              <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-blue-600 font-bold text-lg">M</span>
                  </div>
                        <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Hommes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {riders.filter(r => r.sex === Sex.MALE).length}
                    </p>
                  </div>
                    </div>
                </div>
                
              <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUpIcon className="w-6 h-6 text-green-600" />
                  </div>
                        <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Moyenne CP</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {riders.length > 0 
                        ? (riders.reduce((sum, r) => {
                            const cp = r.powerProfileFresh?.criticalPower || 0;
                            return sum + cp;
                          }, 0) / riders.length).toFixed(0)
                        : '0'} W
                    </p>
                  </div>
                </div>
              </div>
                        </div>

            {/* Répartition par catégorie d'âge */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Catégorie d'Âge</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {['U15', 'U17', 'U19', 'U23', 'Senior'].map(category => {
                  const count = riders.filter(r => {
                    const { category: riderCategory } = getAgeCategory(r.birthDate);
                    return riderCategory === category;
                  }).length;
                  
                  return (
                    <div key={category} className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{count}</div>
                      <div className="text-sm text-gray-600">{category}</div>
                    </div>
                  );
                })}
                </div>
            </div>

            {/* Top performers par durée */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Performers par Durée</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {['1s'].map(duration => {
                  const topRider = riders.reduce((best, rider) => {
                    const value = getRiderPowerValue(rider, duration as PowerDuration, 'wattsPerKg');
                    const bestValue = getRiderPowerValue(best, duration as PowerDuration, 'wattsPerKg');
                    return value > bestValue ? rider : best;
                  });
                  
                  const topValue = getRiderPowerValue(topRider, duration as PowerDuration, 'wattsPerKg');

                                return (
                    <div key={duration} className="border rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        {POWER_DURATIONS_CONFIG.find(d => d.key === duration)?.label}
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {topValue > 0 ? topValue.toFixed(1) : '-'} W/kg
                      </div>
                      <div className="text-sm text-gray-500">
                        {topRider.firstName} {topRider.lastName}
                      </div>
                    </div>
                                );
                            })}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'powerAnalysis' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                🎯 Tableau de Synthèse - Toutes les Durées de Puissance
              </h3>
              <p className="text-blue-700">
                Analysez et comparez les performances de puissance de vos athlètes. 
                Triez par durée spécifique, filtrez par sexe et catégorie d'âge, 
                et basculez entre watts bruts et watts par kilo pour optimiser vos stratégies.
              </p>
            </div>
            
            <PowerPerformanceTable riders={riders} />
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-xl font-bold text-black mb-4">
                📊 Analyse Graphique des Performances
              </h3>

              
              {/* Contrôles simples */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-black">Affichage:</span>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setDisplayMode('watts')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          displayMode === 'watts' ? 'bg-blue-500 text-white' : 'text-black hover:bg-gray-200'
                        }`}
                      >
                        Watts
                      </button>
                      <button
                        onClick={() => setDisplayMode('wattsPerKg')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          displayMode === 'wattsPerKg' ? 'bg-blue-500 text-white' : 'text-black hover:bg-gray-200'
                        }`}
                      >
                        W/kg
                      </button>
                    </div>
                        </div>
                </div>
            </div>

              {/* Graphique principal uniquement */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-bold text-black mb-4 text-center">
                  Comparaison des Performances - Équipe Complète
                </h4>
                <RiderComparisonChart 
                  riders={riders} 
                  displayMode={displayMode} 
                  selectedDurations={selectedDurations} 
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-xl font-bold text-black mb-4">
                🔍 Comparaison des Performances
              </h3>
              <p className="text-black mb-6">
                Sélectionnez deux athlètes pour comparer leurs performances côte à côte.
              </p>
              
              {/* Sélecteur simple et fonctionnel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                  <label className="block text-sm font-medium text-black mb-2">Athlète 1</label>
                        <select 
                    className="w-full p-2 border border-gray-300 rounded-md text-black"
                            onChange={(e) => {
                                const rider = riders.find(r => r.id === e.target.value);
                      if (rider) console.log('Athlète 1 sélectionné:', rider.firstName);
                            }}
                        >
                    <option value="">Sélectionner un athlète</option>
                            {riders.map(rider => (
                                <option key={rider.id} value={rider.id}>
                                    {rider.firstName} {rider.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Athlète 2</label>
                  <select 
                    className="w-full p-2 border border-gray-300 rounded-md text-black"
                    onChange={(e) => {
                      const rider = riders.find(r => r.id === e.target.value);
                      if (rider) console.log('Athlète 2 sélectionné:', rider.firstName);
                    }}
                  >
                    <option value="">Sélectionner un athlète</option>
                    {riders.map(rider => (
                      <option key={rider.id} value={rider.id}>
                        {rider.firstName} {rider.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                </div>
                
              {/* Tableau de comparaison simple */}
                    <div className="mt-6">
                <h4 className="text-lg font-bold text-black mb-4">Comparaison des Puissances (W/kg)</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-black">Durée</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium text-black">Athlète 1</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium text-black">Athlète 2</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium text-black">Différence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {POWER_DURATIONS_CONFIG.map(duration => (
                        <tr key={duration.key}>
                          <td className="border border-gray-300 px-4 py-2 text-sm font-medium text-black">
                            {duration.label}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center text-sm text-black">
                            -
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center text-sm text-black">
                            -
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center text-sm text-black">
                            -
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                                    </div>
                <p className="text-sm text-gray-600 mt-2">
                  Sélectionnez deux athlètes pour voir la comparaison détaillée.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
        {activeTab === 'nutritionProducts' && (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Produits Nutrition</h3>
            <p className="text-gray-500">Fonctionnalité en cours de développement...</p>
                            </div>
                        )}
                        
        {activeTab === 'planning' && (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Planning des Performances</h3>
            <p className="text-gray-500">Fonctionnalité en cours de développement...</p>
                    </div>
                )}
            </div>

      {/* Modal de détail du rider */}
      {isRiderModalOpen && selectedRider && (
        <Modal isOpen={isRiderModalOpen} onClose={() => setIsRiderModalOpen(false)} title={`Profil de ${selectedRider.firstName} ${selectedRider.lastName}`}>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              {selectedRider.photoUrl ? (
                <img src={selectedRider.photoUrl} alt={selectedRider.firstName} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-lg">
                    {selectedRider.firstName.charAt(0)}{selectedRider.lastName.charAt(0)}
                  </span>
                </div>
            )}
              <div>
                <h3 className="text-lg font-semibold">{selectedRider.firstName} {selectedRider.lastName}</h3>
                <p className="text-gray-600">{selectedRider.qualitativeProfile || 'Profil N/A'}</p>
                </div>
            </div>
            
            {/* Onglets du rider */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveRiderTab('ppr')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeRiderTab === 'ppr'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Profil de Puissance
                </button>
                <button
                  onClick={() => setActiveRiderTab('project')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeRiderTab === 'project'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Projets
                </button>
                            <button
                  onClick={() => setActiveRiderTab('results')}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeRiderTab === 'results'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                  Résultats
                            </button>
                    </nav>
            </div>

            {/* Contenu des onglets du rider */}
            <div className="min-h-[400px]">
              {activeRiderTab === 'ppr' && (
                <PerformanceProjectTab
                  rider={selectedRider}
                  onSaveRider={() => {}}
                  isEditMode={false}
                  powerDurationsConfig={POWER_ANALYSIS_DURATIONS_CONFIG}
                  calculateWkg={calculateWkg}
                />
              )}
              {activeRiderTab === 'project' && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Gestion des projets en cours de développement...</p>
                </div>
              )}
              {activeRiderTab === 'results' && (
                <ResultsTab
                  rider={selectedRider}
                  raceEvents={appState.raceEvents || []}
                  riderEventSelections={appState.riderEventSelections || []}
                  performanceEntries={appState.performanceEntries || []}
                />
              )}
            </div>
          </div>
        </Modal>
      )}
        </SectionWrapper>
    );
};

// Export par défaut pour résoudre l'erreur d'import dans App.tsx
export default PerformanceSection;

