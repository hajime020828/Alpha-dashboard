// components/db/ChildOrderTableViewer.tsx
import { useEffect, useState, useMemo } from 'react';
// Import the correct interfaces
import type { ChildOrderRecord, Project } from '@/lib/db';
// Import the correctly named edit form
import EditChildOrderForm from './EditChildOrderForm';

// Define the type for displayable records
interface DisplayableChildOrder extends Pick<ChildOrderRecord, 'ParentOrderId' | 'ExecQty' | 'AvgPx' | 'VwapPx' | 'Date'> {
  rowid: number; // ROWID is required
}

// Props interface for the component
interface ChildOrderTableViewerProps {
    projectsForDropdown: Pick<Project, 'ProjectID' | 'Ticker'>[]; // List of projects for the dropdown
}

const ChildOrderTableViewer: React.FC<ChildOrderTableViewerProps> = ({ projectsForDropdown }) => {
  const [allRecords, setAllRecords] = useState<DisplayableChildOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for filtering by ParentOrderId
  const [selectedParentOrderId, setSelectedParentOrderId] = useState<string>('');

  // State for managing the edit modal
  const [editingRecord, setEditingRecord] = useState<DisplayableChildOrder | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // State for managing the delete confirmation
  const [deletingRecordRowId, setDeletingRecordRowId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Function to fetch child order data from the API
  const fetchChildOrderData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from the correct API endpoint
      const res = await fetch('/api/db/child_orders');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          `API request failed with status ${res.status}: ${errorData.message || res.statusText}`
        );
      }
      const data: DisplayableChildOrder[] = await res.json();
      setAllRecords(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch child order records data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when the component mounts
  useEffect(() => {
    fetchChildOrderData();
  }, []);

  // Get unique ParentOrderIDs for the filter dropdown
  const uniqueParentOrderIDs = useMemo(() => {
    const ids = new Set(allRecords.map(record => record.ParentOrderId).filter(id => id !== null) as string[]);
    return Array.from(ids).sort();
  }, [allRecords]);

  // Filter records based on the selected ParentOrderId
  const filteredRecords = useMemo(() => {
    if (!selectedParentOrderId) {
      return allRecords; // Show all if no filter is selected
    }
    return allRecords.filter(record => String(record.ParentOrderId) === selectedParentOrderId);
  }, [allRecords, selectedParentOrderId]);

  // Handler to open the edit modal
  const handleEdit = (record: DisplayableChildOrder) => {
    setEditingRecord(record);
    setShowEditModal(true);
  };

  // Handler for when a record is successfully updated in the edit form
  const handleRecordUpdated = (updatedRecord: DisplayableChildOrder) => {
    // Update the record in the local state
    setAllRecords(prevRecords =>
      prevRecords.map(r => r.rowid === updatedRecord.rowid ? updatedRecord : r)
    );
    // Close the modal
    setShowEditModal(false);
    setEditingRecord(null);
  };

  // Handler to open the delete confirmation modal
  const handleDeleteClick = (rowId: number) => {
    setDeletingRecordRowId(rowId);
    setShowDeleteConfirm(true);
  };

  // Handler to confirm and execute the deletion
  const confirmDelete = async () => {
    if (deletingRecordRowId === null) return;
    setError(null); // Clear previous errors
    try {
      // Send DELETE request to the API
      const res = await fetch(`/api/db/child_orders?rowid=${deletingRecordRowId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete child order record');
      }
      // Remove the deleted record from local state
      setAllRecords(prev => prev.filter(r => r.rowid !== deletingRecordRowId));
      alert('取引記録が削除されました。'); // Success message
    } catch (err: any) {
      setError(err.message);
      alert(`削除エラー: ${err.message}`); // Error message
    } finally {
      // Close the confirmation modal
      setShowDeleteConfirm(false);
      setDeletingRecordRowId(null);
    }
  };

  // --- Helper Functions for Formatting ---
  const formatNullableNumber = (num: number | null | undefined, fractionDigits = 0) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits});
  }

  // Corrected function to handle non-string inputs (including numbers)
  const formatNullableString = (value: string | null | undefined | number) => {
    // Handle null or undefined
    if (value === null || value === undefined) {
      return 'N/A';
    }
    // Handle numbers
    if (typeof value === 'number') {
      return value.toString();
    }
    // Handle strings
    if (typeof value === 'string') {
      return value.trim() === '' ? 'N/A' : value;
    }
    // Handle other types (just in case)
    return 'N/A';
  }

  // --- Render Logic ---
  if (loading) return <p className="text-center text-gray-500">取引記録データを読み込み中...</p>;
  // Display error only if not showing a modal
  if (error && !showEditModal && !showDeleteConfirm) return <p className="text-center text-red-500 p-3 bg-red-50 rounded-md">エラー: {error}</p>;
  if (allRecords.length === 0 && !loading) return <p className="text-center text-gray-500">取引記録データが見つかりません。</p>;

  return (
    <>
      {/* Filter Dropdown */}
      <div className="mb-4">
        <label htmlFor="parent-order-id-filter" className="block text-sm font-medium text-gray-700 mr-2">
          ParentOrderId (ProjectID) で絞り込み:
        </label>
        <select
          id="parent-order-id-filter"
          value={selectedParentOrderId}
          onChange={(e) => setSelectedParentOrderId(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">すべてのParentOrderId</option>
          {uniqueParentOrderIDs.map(pid => (
            <option key={pid} value={pid}>{pid}</option>
          ))}
        </select>
      </div>

      {/* Message when filter yields no results */}
      {filteredRecords.length === 0 && selectedParentOrderId && !loading && (
        <p className="text-center text-gray-500 mt-4">選択されたParentOrderId ({selectedParentOrderId}) の取引記録は見つかりません。</p>
      )}

      {/* Records Table */}
      {filteredRecords.length > 0 && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
                {/* Updated Column Headers */}
                <th className="py-3 px-3 text-left">ROWID</th>
                <th className="py-3 px-3 text-left">ParentOrderId</th>
                <th className="py-3 px-3 text-right">Exec Qty</th>
                <th className="py-3 px-3 text-right">Avg Px</th>
                <th className="py-3 px-3 text-right">Vwap Px</th>
                <th className="py-3 px-3 text-left">Date</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {filteredRecords.map((record) => (
                <tr key={record.rowid} className="border-b border-gray-200 hover:bg-gray-100">
                  {/* Display data using correct field names */}
                  <td className="py-2 px-3 text-left whitespace-nowrap">{record.rowid}</td>
                  <td className="py-2 px-3 text-left whitespace-nowrap">{formatNullableString(record.ParentOrderId)}</td>
                  <td className="py-2 px-3 text-right">{formatNullableNumber(record.ExecQty, 0)}</td>
                  <td className="py-2 px-3 text-right">{formatNullableNumber(record.AvgPx, 2)}</td>
                  <td className="py-2 px-3 text-right">{formatNullableNumber(record.VwapPx, 2)}</td>
                  <td className="py-2 px-3 text-left whitespace-nowrap">{formatNullableString(record.Date)}</td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {/* Edit and Delete Buttons */}
                    <button
                        onClick={() => handleEdit(record)}
                        className="text-indigo-600 hover:text-indigo-900 mr-2 text-xs"
                    >
                        編集
                    </button>
                    <button
                        onClick={() => handleDeleteClick(record.rowid)}
                        className="text-red-600 hover:text-red-900 text-xs"
                    >
                        削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
          <div className="relative mx-auto p-5 border w-full max-w-xl md:max-w-2xl shadow-lg rounded-md bg-white">
            {/* Use the correct Edit Form component */}
            <EditChildOrderForm
              record={editingRecord}
              onRecordUpdated={handleRecordUpdated}
              onCancel={() => {
                setShowEditModal(false);
                setEditingRecord(null);
                setError(null); // Clear error when closing modal
              }}
              projects={projectsForDropdown} // Pass project list for dropdown
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingRecordRowId !== null && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="p-6 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-semibold text-gray-900">取引記録削除確認</h3>
            <p className="text-sm text-gray-600 mt-2">
              本当にこの取引記録 (ROWID: {deletingRecordRowId}) を削除しますか？この操作は取り消せません。
            </p>
            {/* Display error if deletion fails */}
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => { // Cancel button
                  setShowDeleteConfirm(false);
                  setDeletingRecordRowId(null);
                  setError(null); // Clear error on cancel
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete} // Confirm delete button
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                削除実行
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChildOrderTableViewer;