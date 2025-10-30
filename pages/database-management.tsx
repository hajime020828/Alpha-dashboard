// pages/database-management.tsx
import { useState, useEffect, useCallback } from 'react';
import ProjectsTableViewer from '@/components/db/ProjectsTableViewer';
// インポート名を変更
import ChildOrderTableViewer from '@/components/db/ChildOrderTableViewer';
import AddProjectForm from '@/components/db/AddProjectForm';
// インポート名を変更
import AddChildOrderForm from '@/components/db/AddChildOrderForm';
// 型名を変更
import type { Project, ChildOrderRecord } from '@/lib/db';

const DatabaseManagementPage = () => {
  // state の型を変更
  const [selectedTable, setSelectedTable] = useState<'projects' | 'child_orders' | null>(null);
  // state の型を変更
  const [showAddForm, setShowAddForm] = useState<'projects' | 'child_orders' | null>(null);

  const [projectsKey, setProjectsKey] = useState(Date.now());
  const [childOrderKey, setChildOrderKey] = useState(Date.now()); // state 名を変更

  const [allProjectsForDropdown, setAllProjectsForDropdown] = useState<Pick<Project, 'ProjectID' | 'Ticker'>[]>([]);

  const fetchProjectListForDropdown = useCallback(async () => {
    try {
      const res = await fetch('/api/db/projects');
      if (res.ok) {
        const projectsData: Project[] = await res.json();
        setAllProjectsForDropdown(projectsData.map(p => ({ ProjectID: p.ProjectID, Ticker: p.Ticker })).filter(p => p.ProjectID));
      } else {
        console.error('Failed to fetch project list for dropdown');
        setAllProjectsForDropdown([]);
      }
    } catch (error) {
      console.error('Error fetching project list:', error);
      setAllProjectsForDropdown([]);
    }
  }, []);

  useEffect(() => {
    fetchProjectListForDropdown();
  }, [fetchProjectListForDropdown]);

  const handleProjectAdded = (newProject: Project) => {
    console.log('Project added:', newProject);
    setShowAddForm(null);
    setProjectsKey(Date.now());
    fetchProjectListForDropdown();
  };

  // 型名を変更
  const handleRecordAdded = (newRecord: Pick<ChildOrderRecord, 'ParentOrderId' | 'ExecQty' | 'AvgPx' | 'VwapPx' | 'Date'> & {rowid?: number}) => {
    console.log('Record added:', newRecord);
    setShowAddForm(null);
    setChildOrderKey(Date.now()); // state 更新関数名を変更
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">データベース管理</h1>

      <div className="mb-4">
        <label htmlFor="table-select" className="block text-sm font-medium text-gray-700 mr-2">
          表示・編集するテーブルを選択:
        </label>
        <select
          id="table-select"
          value={selectedTable || ''}
          onChange={(e) => {
            // state の型を変更
            setSelectedTable(e.target.value as 'projects' | 'child_orders' | null);
            setShowAddForm(null);
          }}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">-- テーブルを選択 --</option>
          <option value="projects">Projects</option>
           {/* value と表示名を変更 */}
          <option value="child_orders">Child Orders</option>
        </select>
      </div>

      {selectedTable && !showAddForm && (
        <div className="my-4">
          <button
            onClick={() => setShowAddForm(selectedTable)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
             {/* 表示テキストを変更 */}
            {selectedTable === 'projects' ? '新規プロジェクト追加' : '新規取引記録追加'}
          </button>
        </div>
      )}

      {showAddForm === 'projects' && (
        <div className="my-6 p-4 border rounded-md bg-gray-50 shadow">
          <AddProjectForm onProjectAdded={handleProjectAdded} />
          <button onClick={() => setShowAddForm(null)} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800">キャンセル</button>
        </div>
      )}
       {/* state の値と比較、コンポーネント名を変更 */}
      {showAddForm === 'child_orders' && (
        <div className="my-6 p-4 border rounded-md bg-gray-50 shadow">
           {/* コンポーネント名を変更 */}
          <AddChildOrderForm onRecordAdded={handleRecordAdded} projects={allProjectsForDropdown} />
          <button onClick={() => setShowAddForm(null)} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800">キャンセル</button>
        </div>
      )}

      {selectedTable === 'projects' && !showAddForm && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Projects テーブル</h2>
          <ProjectsTableViewer key={projectsKey} />
        </div>
      )}

       {/* state の値と比較、コンポーネント名、key を変更 */}
      {selectedTable === 'child_orders' && !showAddForm && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Child Orders テーブル</h2>
          <ChildOrderTableViewer key={childOrderKey} projectsForDropdown={allProjectsForDropdown} />
        </div>
      )}
       <p className="mt-6 p-4 bg-yellow-100 text-yellow-700 rounded-md text-sm">
        注意: データのバリデーションは基本的なもののみとなっています。
      </p>
    </div>
  );
};

export default DatabaseManagementPage;