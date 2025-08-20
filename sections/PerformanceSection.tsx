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

// Type definitions for the new section
type PerformancePoleTab = 'global' | 'powerAnalysis' | 'nutritionProducts' | 'planning';
type RiderPerformanceTab = 'ppr' | 'project' | 'results';
type ObjectiveCode = 'bleu' | 'vert' | 'orange';

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

const getAgeCategory = (birthDate?: string): { category: string; age: number | null } => {
    if (!birthDate || typeof birthDate !== 'string') {
        return { category: 'N/A', age: null };
    }
    
    // Use Date.parse for more flexible parsing, then create a Date object.
    const birthTime = Date.parse(birthDate);
    if (isNaN(birthTime)) {
        return { category: 'N/A', age: null };
    }
    
    const birth = new Date(birthTime);
    const today = new Date();
    
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    if (age < 0 || age > 120) { // Sanity check
        return { category: 'N/A', age: null };
    }

    let category = 'Senior';
    if (age <= 14) category = 'U15';
    else if (age <= 16) category = 'U17';
    else if (age <= 18) category = 'U19';
    else if (age <= 22) category = 'U23';
    
    return { category, age };
};

const calculateWkg = (power?: number, weight?: number): string => {
  if (typeof power === 'number' && typeof weight === 'number' && weight > 0) {
    return (power / weight).toFixed(1);
  }
  return "-";
};

const gcf = (a: number, b: number): number => {
    return b === 0 ? a : gcf(b, a % b);
};

const calculateRatio = (glucose?: number, fructose?: number): { display: string; value: string } => {
    if (glucose === undefined || fructose === undefined || fructose <= 0) {
        if (glucose && glucose > 0) return { display: '> 2:1', value: `${glucose}:0` };
        return { display: 'N/A', value: 'N/A' };
    }
    if (glucose <= 0) {
      return { display: '0:1', value: `0:${fructose}` };
    }

    const ratioValue = glucose / fructose;
    const commonDivisor = gcf(glucose, fructose);
    const simplifiedRatio = `${glucose / commonDivisor}:${fructose / commonDivisor}`;

    if (ratioValue > 2) {
        return { display: `> 2:1`, value: simplifiedRatio };
    } else if (ratioValue > 1.5) {
        return { display: `2:1`, value: simplifiedRatio };
    } else if (ratioValue > 1) {
        return { display: `1.5:1`, value: simplifiedRatio };
    } else if (ratioValue > 0.5) {
        return { display: `1:1`, value: simplifiedRatio };
    } else {
        return { display: `1:2`, value: simplifiedRatio };
    }
};

// Composant de légende des couleurs de puissance
const PowerColorLegend: React.FC = () => {
    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">Légende des Niveaux de Puissance</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(COGGAN_CATEGORY_COLORS).map(([category, colorClass]) => (
                    <div key={category} className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full ${colorClass.split(' ')[0]}`}></div>
                        <span className="text-sm text-gray-700">{category}</span>
                    </div>
                ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                    <strong>Note :</strong> Les référentiels de puissance s'adaptent automatiquement au sexe du coureur 
                    (Homme/Femme) pour des comparaisons précises selon les standards internationaux.
                </p>
            </div>
        </div>
    );
};

// Composant d'analyse de puissance avec changement de référentiel
const PowerAnalysisTab: React.FC<{ riders: Rider[] }> = ({ riders }) => {
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<keyof PowerProfile>('power20min');

    const durationConfig = POWER_ANALYSIS_DURATIONS_CONFIG.find(d => d.key === selectedDuration);

    const getPowerCategory = (power: number, weight: number, sex: Sex): string => {
        const wkg = power / weight;
        const refTable = sex === Sex.MALE ? POWER_PROFILE_REFERENCE_TABLES.men : POWER_PROFILE_REFERENCE_TABLES.women;
        
        for (const category of refTable) {
            const refValue = category[selectedDuration] as number;
            if (wkg >= refValue) {
                return category.category;
            }
        }
        return "Inf. Novice";
    };

    const getPowerColor = (category: string): string => {
        return COGGAN_CATEGORY_COLORS[category] || 'bg-gray-200 text-gray-700';
    };

    return (
        <div className="space-y-6">
            <PowerColorLegend />
            
            <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Analyse de Puissance par Durée</h4>
                
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Durée d'effort
                    </label>
                    <select 
                        value={selectedDuration} 
                        onChange={(e) => setSelectedDuration(e.target.value as keyof PowerProfile)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        {POWER_ANALYSIS_DURATIONS_CONFIG.map(duration => (
                            <option key={duration.key} value={duration.key}>
                                {duration.label} ({duration.unit})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Coureur
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Sexe
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Puissance ({durationConfig?.unit})
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    W/kg
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Niveau
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {riders.map(rider => {
                                const power = rider.powerProfileFresh?.[selectedDuration];
                                const weight = rider.weightKg;
                                const sex = rider.sex || Sex.MALE;
                                
                                if (!power || !weight) return null;
                                
                                const wkg = power / weight;
                                const category = getPowerCategory(power, weight, sex);
                                const colorClass = getPowerColor(category);
                                
                                return (
                                    <tr key={rider.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {rider.firstName} {rider.lastName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {sex === Sex.MALE ? 'Homme' : 'Femme'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {power} W
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {wkg.toFixed(1)} W/kg
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                                                {category}
                                            </span>
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
};

// Interface des props
interface PerformancePoleSectionProps {
    appState: AppState;
    navigateTo: (section: AppSection, eventId?: string) => void;
    setTeamProducts: React.Dispatch<React.SetStateAction<TeamProduct[]>>;
    setRiders: React.Dispatch<React.SetStateAction<Rider[]>>;
    currentUser: User;
}

// Composant principal
const PerformancePoleSection: React.FC<PerformancePoleSectionProps> = ({ 
    appState, 
    navigateTo, 
    setTeamProducts, 
    setRiders, 
    currentUser 
}) => {
    const [activeTab, setActiveTab] = useState<PerformancePoleTab>('global');
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const [riderTab, setRiderTab] = useState<RiderPerformanceTab>('ppr');

    const riders = appState.riders || [];
    const teamProducts = appState.teamProducts || [];

    const tabs: { id: PerformancePoleTab; label: string; icon: React.ReactNode }[] = [
        { id: 'global', label: 'Vue Globale', icon: <ChartBarIcon className="w-5 h-5" /> },
        { id: 'powerAnalysis', label: 'Analyse Puissance', icon: <TrendingUpIcon className="w-5 h-5" /> },
        { id: 'nutritionProducts', label: 'Produits Nutrition', icon: <CakeIcon className="w-5 h-5" /> },
        { id: 'planning', label: 'Planning', icon: <TrophyIcon className="w-5 h-5" /> }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'global':
                return (
                    <div className="space-y-6">
                        <PowerColorLegend />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistiques Globales</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Coureurs</span>
                                        <span className="font-semibold">{riders.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Hommes</span>
                                        <span className="font-semibold">{riders.filter(r => r.sex === Sex.MALE).length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Femmes</span>
                                        <span className="font-semibold">{riders.filter(r => r.sex === Sex.FEMALE).length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'powerAnalysis':
                return <PowerAnalysisTab riders={riders} />;
            case 'nutritionProducts':
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800">Produits de Nutrition</h3>
                            <ActionButton onClick={() => {}} icon={<PlusCircleIcon className="w-5 h-5" />}>
                                Ajouter un Produit
                            </ActionButton>
                        </div>
                        {/* Contenu des produits de nutrition */}
                    </div>
                );
            case 'planning':
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-800">Planning des Performances</h3>
                        {/* Contenu du planning */}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <SectionWrapper title="Pôle Performance">
            <div className="space-y-6">
                {/* Onglets principaux */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center space-x-2">
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                </div>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Contenu de l'onglet actif */}
                {renderTabContent()}
            </div>
        </SectionWrapper>
    );
};

export default PerformancePoleSection;
