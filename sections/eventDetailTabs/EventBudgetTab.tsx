import React, { useState, useMemo } from 'react';
import { RaceEvent, AppState, EventBudgetItem, EventRaceDocument, BudgetItemCategory } from '../../types';
import ActionButton from '../../components/ActionButton';
import Modal from '../../components/Modal';
import PlusCircleIcon from '../../components/icons/PlusCircleIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import TrashIcon from '../../components/icons/TrashIcon';
import InformationCircleIcon from '../../components/icons/InformationCircleIcon';

interface EventBudgetTabProps {
  event: RaceEvent;
  eventId: string;
  appState: AppState;
  setEventBudgetItems: React.Dispatch<React.SetStateAction<EventBudgetItem[]>>;
}

const initialBudgetFormStateFactory = (eventId: string): Omit<EventBudgetItem, 'id'> => ({
  eventId: eventId,
  category: BudgetItemCategory.FRAIS_DIVERS,
  description: '',
  estimatedCost: 0,
  actualCost: undefined,
  notes: '',
  proofDocumentId: undefined,
});

export default function EventBudgetTab({ 
  event, 
  eventId, 
  appState, 
  setEventBudgetItems 
}: EventBudgetTabProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Omit<EventBudgetItem, 'id'> | EventBudgetItem>(initialBudgetFormStateFactory(eventId));
  const [isEditing, setIsEditing] = useState(false);

  const budgetItemsForEvent = useMemo(() => {
    return appState.eventBudgetItems.filter(item => item.eventId === eventId);
  }, [appState.eventBudgetItems, eventId]);

  const documentsForEvent = useMemo(() => {
    return appState.eventDocuments.filter(doc => doc.eventId === eventId);
  }, [appState.eventDocuments, eventId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setCurrentItem(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? parseFloat(value) || (name === 'actualCost' && value === '' ? undefined : 0) : value 
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalItemInput = {...currentItem};
    if (finalItemInput.actualCost === undefined || isNaN(Number(finalItemInput.actualCost)) || String(finalItemInput.actualCost).trim() === '') {
        finalItemInput.actualCost = undefined;
    } else {
        finalItemInput.actualCost = Number(finalItemInput.actualCost);
    }
    
    const itemToSave: EventBudgetItem = {
        ...(finalItemInput as Omit<EventBudgetItem, 'id'>),
        eventId: eventId,
        id: (finalItemInput as EventBudgetItem).id || Date.now().toString() + Math.random().toString(36).substring(2,9),
    };

    setEventBudgetItems(prevEventItems => {
      if (isEditing) {
        return prevEventItems.map(item => item.id === itemToSave.id ? itemToSave : item);
      } else {
        return [...prevEventItems, itemToSave];
      }
    });
    
    setIsModalOpen(false);
  };

  const openAddModal = () => {
    setCurrentItem(initialBudgetFormStateFactory(eventId));
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: EventBudgetItem) => {
    setCurrentItem(item);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (itemId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet élément du budget ?")) {
      setEventBudgetItems(prevEventItems => prevEventItems.filter(item => item.id !== itemId));
    }
  };
  
  const totalEstimated = budgetItemsForEvent.reduce((sum, item) => sum + item.estimatedCost, 0);
  const totalActual = budgetItemsForEvent.reduce((sum, item) => sum + (item.actualCost || 0), 0);

  // Calculs sectorisés pour l'analyse des sources de dépenses
  const budgetAnalysis = useMemo(() => {
    const categoryTotals = Object.values(BudgetItemCategory).map(category => {
      const items = budgetItemsForEvent.filter(item => item.category === category);
      const estimated = items.reduce((sum, item) => sum + item.estimatedCost, 0);
      const actual = items.reduce((sum, item) => sum + (item.actualCost || 0), 0);
      const percentage = totalEstimated > 0 ? (estimated / totalEstimated) * 100 : 0;
      
      return {
        category,
        estimated,
        actual,
        percentage,
        itemCount: items.length,
        items
      };
    }).filter(cat => cat.estimated > 0 || cat.actual > 0);

    // Trier par montant estimé décroissant
    categoryTotals.sort((a, b) => b.estimated - a.estimated);

    return {
      categoryTotals,
      totalEstimated,
      totalActual,
      variance: totalActual > 0 ? totalActual - totalEstimated : 0,
      variancePercentage: totalEstimated > 0 ? ((totalActual - totalEstimated) / totalEstimated) * 100 : 0
    };
  }, [budgetItemsForEvent, totalEstimated, totalActual]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-700">Budget pour {event.name}</h3>
        <ActionButton onClick={openAddModal} icon={<PlusCircleIcon className="w-5 h-5"/>}>
          Ajouter Ligne
        </ActionButton>
      </div>

      {/* Analyse sectorisée du budget */}
      {budgetItemsForEvent.length > 0 && (
        <div className="mb-8 bg-gray-50 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Analyse Sectorisée du Budget
          </h4>
          
          {/* Résumé global */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-600">Budget Estimé</div>
              <div className="text-2xl font-bold text-blue-600">{budgetAnalysis.totalEstimated.toFixed(2)} €</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-600">Budget Réel</div>
              <div className="text-2xl font-bold text-green-600">
                {budgetAnalysis.totalActual > 0 ? `${budgetAnalysis.totalActual.toFixed(2)} €` : 'N/A'}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-600">Écart</div>
              <div className={`text-2xl font-bold ${budgetAnalysis.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {budgetAnalysis.variance !== 0 ? `${budgetAnalysis.variance.toFixed(2)} €` : '0 €'}
                {budgetAnalysis.variancePercentage !== 0 && (
                  <span className="text-sm ml-2">
                    ({budgetAnalysis.variancePercentage > 0 ? '+' : ''}{budgetAnalysis.variancePercentage.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Répartition par catégorie */}
          <div className="space-y-3">
            <h5 className="text-md font-medium text-gray-700 mb-3">Répartition par Catégorie</h5>
            {budgetAnalysis.categoryTotals.map((categoryData) => (
              <div key={categoryData.category} className="bg-white p-4 rounded-lg border">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h6 className="font-medium text-gray-800">{categoryData.category}</h6>
                      <div className="text-sm text-gray-500">
                        {categoryData.itemCount} élément{categoryData.itemCount > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {categoryData.percentage.toFixed(1)}% du budget total
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-semibold text-gray-800">
                      {categoryData.estimated.toFixed(2)} €
                    </div>
                    {categoryData.actual > 0 && (
                      <div className="text-sm text-gray-600">
                        Réel: {categoryData.actual.toFixed(2)} €
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Barre de progression */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(categoryData.percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {budgetItemsForEvent.length === 0 ? (
        <p className="text-gray-500 italic">Aucune ligne budgétaire ajoutée pour cet événement.</p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Estimé (€)</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Réel (€)</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Justificatif</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgetItemsForEvent.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors`}>
                  <td className="py-3 px-3 whitespace-nowrap text-gray-700">{item.category}</td>
                  <td className="py-3 px-3 whitespace-nowrap font-medium text-gray-800">{item.description}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-gray-700 text-right">{item.estimatedCost.toFixed(2)}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-gray-700 text-right">{item.actualCost !== undefined ? item.actualCost.toFixed(2) : '-'}</td>
                  <td className="py-3 px-3 text-gray-700 max-w-xs truncate" title={item.notes || ''}>
                    {item.notes && item.notes.length > 25 && <InformationCircleIcon className="w-4 h-4 inline mr-1 text-blue-500" />}
                    {item.notes}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-xs">
                    {item.proofDocumentId ? (
                        (() => {
                            const doc = documentsForEvent.find(d => d.id === item.proofDocumentId);
                            return doc ? (
                                <a href={doc.fileLinkOrPath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {doc.name}
                                </a>
                            ) : (
                                <span className="text-red-500 italic">Document non trouvé</span>
                            );
                        })()
                    ) : (
                        '-'
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-right space-x-1">
                    <ActionButton onClick={() => openEditModal(item)} variant="secondary" size="sm" icon={<PencilIcon className="w-3 h-3"/>}><span className="sr-only">Modifier</span></ActionButton>
                    <ActionButton onClick={() => handleDelete(item.id)} variant="danger" size="sm" icon={<TrashIcon className="w-3 h-3"/>}><span className="sr-only">Supprimer</span></ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr>
                <td colSpan={2} className="py-3 px-3 text-right text-sm font-bold text-gray-700">TOTAL</td>
                <td className="py-3 px-3 text-right text-sm font-bold text-gray-700">{totalEstimated.toFixed(2)} €</td>
                <td className="py-3 px-3 text-right text-sm font-bold text-gray-700">{totalActual > 0 || budgetItemsForEvent.some(i => i.actualCost !== undefined) ? totalActual.toFixed(2) + ' €' : '-'}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? "Modifier Ligne Budgétaire" : "Ajouter Ligne Budgétaire"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="categoryModal" className="block text-sm font-medium text-gray-700">Catégorie</label>
            <select name="category" id="categoryModal" value={(currentItem as EventBudgetItem).category} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
              {Object.values(BudgetItemCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="descriptionModal" className="block text-sm font-medium text-gray-700">Description</label>
            <input type="text" name="description" id="descriptionModal" value={(currentItem as EventBudgetItem).description} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="estimatedCostModal" className="block text-sm font-medium text-gray-700">Coût Estimé (€)</label>
              <input type="number" name="estimatedCost" id="estimatedCostModal" value={(currentItem as EventBudgetItem).estimatedCost} onChange={handleInputChange} step="0.01" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="actualCostModal" className="block text-sm font-medium text-gray-700">Coût Réel (€) (optionnel)</label>
              <input type="number" name="actualCost" id="actualCostModal" value={(currentItem as EventBudgetItem).actualCost === undefined ? '' : (currentItem as EventBudgetItem).actualCost} onChange={handleInputChange} step="0.01" placeholder="Laisser vide si N/A" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="notesModal" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea name="notes" id="notesModal" value={(currentItem as EventBudgetItem).notes || ''} onChange={handleInputChange} rows={2} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="proofDocumentIdModal" className="block text-sm font-medium text-gray-700">Justificatif (Document)</label>
            <select
                name="proofDocumentId"
                id="proofDocumentIdModal"
                value={(currentItem as EventBudgetItem).proofDocumentId || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
                <option value="">Aucun justificatif lié</option>
                {documentsForEvent.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <ActionButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Annuler</ActionButton>
            <ActionButton type="submit">{isEditing ? "Sauvegarder" : "Ajouter"}</ActionButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
