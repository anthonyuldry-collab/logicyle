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



// Composant de monitoring collectif (Vue Globale)
const GlobalMonitoringTab: React.FC<{ riders: Rider[] }> = ({ riders }) => {
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const [riderTab, setRiderTab] = useState<RiderPerformanceTab>('ppr');

    // Calcul des statistiques collectives
    const collectiveStats = useMemo(() => {
        const totalRiders = riders.length;
        
        // Calcul de l'âge moyen
        const ridersWithAge = riders.filter(r => r.birthDate);
        const totalAge = ridersWithAge.reduce((sum, r) => {
            if (r.birthDate) {
                const birthYear = new Date(r.birthDate).getFullYear();
                const currentYear = new Date().getFullYear();
                return sum + (currentYear - birthYear);
            }
            return sum;
        }, 0);
        const avgAge = ridersWithAge.length > 0 ? Math.round(totalAge / ridersWithAge.length) : 0;
        
        // Statistiques de puissance moyennes (supprimées 5s et 20min)
        const ridersWithPower = riders.filter(r => r.powerProfileFresh && r.weightKg);
        
        // Répartition par profil qualitatif
        const profileDistribution = riders.reduce((acc, r) => {
            const profile = r.qualitativeProfile || RiderQualitativeProfileEnum.AUTRE;
            acc[profile] = (acc[profile] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Calcul des vraies statistiques basées sur les résultats des coureurs de l'année en cours
        const currentYear = new Date().getFullYear();
        let top10Count = 0;
        let top5Count = 0;
        let podiumCount = 0;
        let victoriesCount = 0;

        riders.forEach(rider => {
            if (rider.resultsHistory && Array.isArray(rider.resultsHistory)) {
                rider.resultsHistory.forEach(result => {
                    // Vérifier que le résultat est de l'année en cours
                    const resultDate = new Date(result.date);
                    if (resultDate.getFullYear() === currentYear) {
                        const rank = typeof result.rank === 'string' ? parseInt(result.rank.replace(/\D/g, ''), 10) : result.rank;
                        
                        if (!isNaN(rank) && rank > 0) {
                            if (rank === 1) victoriesCount++;
                            if (rank <= 3) podiumCount++;
                            if (rank <= 5) top5Count++;
                            if (rank <= 10) top10Count++;
                        }
                    }
                });
            }
        });

        return {
            totalRiders,
            avgAge,
            profileDistribution,
            top10Count,
            top5Count,
            podiumCount,
            victoriesCount
        };
    }, [riders]);

    return (
        <div className="space-y-6">
            {/* Statistiques collectives */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <UsersIcon className="w-8 h-8 text-blue-600" />
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Total Coureurs</p>
                            <p className="text-2xl font-bold text-gray-900">{collectiveStats.totalRiders}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <CakeIcon className="w-8 h-8 text-green-600" />
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Âge Moyen</p>
                            <p className="text-2xl font-bold text-gray-900">{collectiveStats.avgAge} ans</p>
                        </div>
                    </div>
                </div>
                

            </div>

            {/* Statistiques de performance */}
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Statistiques de Performance</h3>
                <p className="text-sm text-gray-600 mb-4">📊 Basé sur les résultats de l'année {new Date().getFullYear()}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <TrophyIcon className="w-8 h-8 text-yellow-500" />
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Top 10</p>
                            <p className="text-2xl font-bold text-gray-900">{collectiveStats.top10Count}</p>
                            <p className="text-xs text-gray-400">Résultats ≤ 10ème place</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <StarIcon className="w-8 h-8 text-blue-500" />
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Top 5</p>
                            <p className="text-2xl font-bold text-gray-900">{collectiveStats.top5Count}</p>
                            <p className="text-xs text-gray-400">Résultats ≤ 5ème place</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <TrophyIcon className="w-8 h-8 text-orange-500" />
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Podium</p>
                            <p className="text-2xl font-bold text-gray-900">{collectiveStats.podiumCount}</p>
                            <p className="text-xs text-gray-400">1ère, 2ème, 3ème place</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <TrophyIcon className="w-8 h-8 text-green-500" />
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Victoires</p>
                            <p className="text-2xl font-bold text-gray-900">{collectiveStats.victoriesCount}</p>
                            <p className="text-xs text-gray-400">1ère place uniquement</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Détail des résultats de l'année en cours */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Détail des Résultats {new Date().getFullYear()}</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coureur</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Victoires</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Podiums</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top 5</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top 10</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Courses</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {riders.map(rider => {
                                const currentYear = new Date().getFullYear();
                                let riderWins = 0;
                                let riderPodiums = 0;
                                let riderTop5 = 0;
                                let riderTop10 = 0;
                                let totalRaces = 0;

                                if (rider.resultsHistory && Array.isArray(rider.resultsHistory)) {
                                    rider.resultsHistory.forEach(result => {
                                        const resultDate = new Date(result.date);
                                        if (resultDate.getFullYear() === currentYear) {
                                            totalRaces++;
                                            const rank = typeof result.rank === 'string' ? parseInt(result.rank.replace(/\D/g, ''), 10) : result.rank;
                                            
                                            if (!isNaN(rank) && rank > 0) {
                                                if (rank === 1) riderWins++;
                                                if (rank <= 3) riderPodiums++;
                                                if (rank <= 5) riderTop5++;
                                                if (rank <= 10) riderTop10++;
                                            }
                                        }
                                    });
                                }

                                return (
                                    <tr key={rider.id} className={totalRaces > 0 ? 'bg-green-50' : 'bg-gray-50'}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {rider.firstName} {rider.lastName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-bold text-green-600">{riderWins}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-bold text-orange-600">{riderPodiums}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-bold text-blue-600">{riderTop5}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-bold text-yellow-600">{riderTop10}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-bold">{totalRaces}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Répartition par profil qualitatif */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition par Profil Qualitatif</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(collectiveStats.profileDistribution).map(([profile, count]) => (
                        <div key={profile} className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-600">{profile}</p>
                            <p className="text-2xl font-bold text-gray-900">{count}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sélection d'un coureur pour analyse détaillée */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Analyse Détaillée d'un Coureur</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner un Coureur</label>
                        <select 
                            value={selectedRider?.id || ''} 
                            onChange={(e) => {
                                const rider = riders.find(r => r.id === e.target.value);
                                setSelectedRider(rider || null);
                            }}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Choisir un coureur...</option>
                            {riders.map(rider => (
                                <option key={rider.id} value={rider.id}>
                                    {rider.firstName} {rider.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {selectedRider && (
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setRiderTab('ppr')}
                                className={`px-3 py-2 text-sm font-medium rounded-md ${
                                    riderTab === 'ppr' 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                PPR
                            </button>
                            <button
                                onClick={() => setRiderTab('project')}
                                className={`px-3 py-2 text-sm font-medium rounded-md ${
                                    riderTab === 'project' 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                Projet
                            </button>
                            <button
                                onClick={() => setRiderTab('results')}
                                className={`px-3 py-2 text-sm font-medium rounded-md ${
                                    riderTab === 'results' 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                Résultats
                            </button>
                        </div>
                    )}
                </div>
                
                {selectedRider && (
                    <div className="mt-6">
                        {riderTab === 'ppr' && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-800 mb-3">Profil de Puissance - {selectedRider.firstName} {selectedRider.lastName}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <p className="text-sm text-gray-600">5s</p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {selectedRider.powerProfileFresh?.power5s || 'N/A'}W
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {calculateWkg(selectedRider.powerProfileFresh?.power5s, selectedRider.weightKg)} W/kg
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-gray-600">1min</p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {selectedRider.powerProfileFresh?.power1min || 'N/A'}W
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {calculateWkg(selectedRider.powerProfileFresh?.power1min, selectedRider.weightKg)} W/kg
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-gray-600">5min</p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {selectedRider.powerProfileFresh?.power5min || 'N/A'}W
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {calculateWkg(selectedRider.powerProfileFresh?.power5min, selectedRider.weightKg)} W/kg
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-gray-600">20min</p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {selectedRider.powerProfileFresh?.power20min || 'N/A'}W
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {calculateWkg(selectedRider.powerProfileFresh?.power20min, selectedRider.weightKg)} W/kg
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {riderTab === 'project' && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-800 mb-3">Projet Performance - {selectedRider.firstName} {selectedRider.lastName}</h4>
                                <p className="text-gray-600">Interface de projet performance à implémenter</p>
                            </div>
                        )}
                        
                        {riderTab === 'results' && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-800 mb-3">Résultats - {selectedRider.firstName} {selectedRider.lastName}</h4>
                                <p className="text-gray-600">Interface des résultats à implémenter</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Composant d'analyse de puissance avec tableau de synthèse complet
const PowerAnalysisTab: React.FC<{ riders: Rider[] }> = ({ riders }) => {
    const [sexFilter, setSexFilter] = useState<'all' | Sex>('all');
    
    const getPowerCategory = (power: number, weight: number, sex: Sex, duration: keyof PowerProfile): string => {
        const wkg = power / weight;
        const refTable = sex === Sex.MALE ? POWER_PROFILE_REFERENCE_TABLES.men : POWER_PROFILE_REFERENCE_TABLES.women;
        
        for (const category of refTable) {
            const refValue = category[duration] as number;
            if (wkg >= refValue) {
                return category.category;
            }
        }
        return "Inf. Novice";
    };

    const getPowerColor = (category: string): string => {
        return COGGAN_CATEGORY_COLORS[category] || 'bg-gray-200 text-gray-700';
    };

    // Filtrage des coureurs par sexe
    const filteredRiders = useMemo(() => {
        if (sexFilter === 'all') return riders;
        return riders.filter(rider => rider.sex === sexFilter);
    }, [riders, sexFilter]);

    // Calcul des statistiques globales de puissance pour toutes les durées
    const powerStats = useMemo(() => {
        const ridersWithPower = filteredRiders.filter(r => r.powerProfileFresh && r.weightKg);
        
        if (ridersWithPower.length === 0) return null;

        // Calcul des moyennes pour toutes les durées
        const durationStats = POWER_ANALYSIS_DURATIONS_CONFIG.map(duration => {
            const avgPower = ridersWithPower.reduce((sum, r) => 
                sum + (r.powerProfileFresh?.[duration.key] || 0), 0) / ridersWithPower.length;
            
            const avgWkg = ridersWithPower.reduce((sum, r) => {
                const power = r.powerProfileFresh?.[duration.key] || 0;
                const weight = r.weightKg || 1;
                return sum + (power / weight);
            }, 0) / ridersWithPower.length;

            return {
                duration: duration.key,
                label: duration.label,
                unit: duration.unit,
                avgPower: Math.round(avgPower),
                avgWkg: avgWkg.toFixed(1)
            };
        });

        return {
            totalRiders: ridersWithPower.length,
            durationStats
        };
    }, [filteredRiders]);

    return (
        <div className="space-y-4">
            {/* Filtres et statistiques en haut */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Filtre par sexe */}
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Filtrer par sexe</label>
                    <select 
                        value={sexFilter} 
                        onChange={(e) => setSexFilter(e.target.value as 'all' | Sex)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Tous</option>
                        <option value={Sex.MALE}>Hommes</option>
                        <option value={Sex.FEMALE}>Femmes</option>
                    </select>
                </div>
                
                {/* Statistiques compactes */}
                {powerStats && (
                    <>
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-500">Total Coureurs</p>
                                <p className="text-xl font-bold text-gray-900">{powerStats.totalRiders}</p>
                            </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-500">Durées Analysées</p>
                                <p className="text-xl font-bold text-gray-900">{powerStats.durationStats.length}</p>
                            </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-500">Puissance Max Moy</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {Math.max(...powerStats.durationStats.map(d => d.avgPower))}W
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-500">W/kg Max Moy</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {Math.max(...powerStats.durationStats.map(d => parseFloat(d.avgWkg))).toFixed(1)} W/kg
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            {/* Tableau de synthèse compact */}
            <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                    <h4 className="text-lg font-semibold text-gray-800">Tableau de Synthèse - Toutes les Durées de Puissance</h4>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                                    Coureur
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                                    Sexe
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                                    Poids
                                </th>
                                {POWER_ANALYSIS_DURATIONS_CONFIG.map(duration => (
                                    <th key={duration.key} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                                        <div className="flex flex-col">
                                            <span>{duration.label}</span>
                                            <span className="text-xs text-gray-400">({duration.unit})</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredRiders
                                .filter(rider => rider.powerProfileFresh && rider.weightKg)
                                .map((rider) => {
                                    const weight = rider.weightKg;
                                    const sex = rider.sex || Sex.MALE;
                                    
                                    if (!weight) return null;
                                    
                                    return (
                                        <tr key={rider.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                                                {rider.firstName} {rider.lastName}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 border-r">
                                                {sex === Sex.MALE ? 'H' : 'F'}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r">
                                                {weight} kg
                                            </td>
                                            {POWER_ANALYSIS_DURATIONS_CONFIG.map(duration => {
                                                const power = rider.powerProfileFresh?.[duration.key];
                                                if (!power) {
                                                    return (
                                                        <td key={duration.key} className="px-2 py-2 whitespace-nowrap text-sm text-gray-400 border-r text-center">
                                                            -
                                                        </td>
                                                    );
                                                }
                                                
                                                const wkg = power / weight;
                                                const category = getPowerCategory(power, weight, sex, duration.key);
                                                const colorClass = getPowerColor(category);
                                                
                                                return (
                                                    <td key={duration.key} className="px-2 py-2 whitespace-nowrap border-r text-center">
                                                        <div className="flex flex-col items-center space-y-1">
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {power} W
                                                            </span>
                                                            <span className="text-xs text-gray-600">
                                                                {wkg.toFixed(1)} W/kg
                                                            </span>
                                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                                                                {category}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Légende en bas de page */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Légende des Niveaux de Puissance</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(COGGAN_CATEGORY_COLORS).map(([category, colorClass]) => (
                        <div key={category} className="flex items-center space-x-2">
                            <div className={`w-4 h-4 rounded-full ${colorClass.split(' ')[0]}`}></div>
                            <span className="text-sm text-gray-700">{category}</span>
                        </div>
                    ))}
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
                return <GlobalMonitoringTab riders={riders} />;
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

