// components/db/AddChildOrderForm.tsx // ファイル名変更推奨
import { useState, FormEvent, useEffect } from 'react';
// インターフェース名を ChildOrderRecord に変更
import type { ChildOrderRecord, Project } from '@/lib/db';

interface AddChildOrderFormProps { // コンポーネント名に合わせて変更
  // 型名を ChildOrderRecord に変更、カラム名を更新
  onRecordAdded: (newRecord: Pick<ChildOrderRecord, 'ParentOrderId' | 'ExecQty' | 'AvgPx' | 'VwapPx' | 'Date'>) => void;
  projects: Pick<Project, 'ProjectID' | 'Ticker'>[]; // ProjectID は親の識別子として使用
}

const AddChildOrderForm: React.FC<AddChildOrderFormProps> = ({ onRecordAdded, projects }) => {
  // state のキー名を変更 (ProjectID -> ParentOrderId, FilledQty -> ExecQty, etc.)
  // StockCycle を削除
  const initialFormData = {
    ParentOrderId: projects.length > 0 ? projects[0].ProjectID || '' : '', // ProjectID を ParentOrderId にマップ
    ExecQty: '',
    AvgPx: '',
    VwapPx: '',
    Date: '',
  };
  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // projects が変更された場合、選択可能な ProjectID があればフォームの ParentOrderId を更新
    if (projects.length > 0 && !projects.find(p => p.ProjectID === formData.ParentOrderId)) {
      setFormData(prev => ({ ...prev, ParentOrderId: projects[0].ProjectID || '' }));
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  // StockCycle の自動入力ロジックを削除
  // useEffect(() => {
  //   ...
  // }, [formData.ParentOrderId, projects]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // name が ProjectID の場合 ParentOrderId にマッピングするか、
    // または select の name 属性を ParentOrderId に変更する（推奨）
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // payload のキー名を変更
    const payload = {
      ...formData,
      ExecQty: parseFloat(formData.ExecQty),
      AvgPx: parseFloat(formData.AvgPx),
      VwapPx: parseFloat(formData.VwapPx),
    };

    // バリデーションのキー名を変更
    if (isNaN(payload.ExecQty) || isNaN(payload.AvgPx) || isNaN(payload.VwapPx)) {
        setError("数量と価格は有効な数値を入力してください。");
        setIsLoading(false);
        return;
    }

    try {
      // API エンドポイントを変更
      const res = await fetch('/api/db/child_orders', { // エンドポイント変更
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultData = await res.json();
      if (!res.ok) {
        throw new Error(resultData.message || resultData.error || 'Failed to add child order record'); // メッセージ変更
      }
      setSuccess('取引記録が正常に追加されました。');
      onRecordAdded(resultData); // APIは新しい記録オブジェクトを返す想定
      setFormData(initialFormData); // フォームリセット
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const commonInputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const commonLabelClass = "block text-sm font-medium text-gray-700";

  return (
    // フォーム要素の name, id, htmlFor を変更
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-gray-50">
      <h3 className="text-lg font-medium leading-6 text-gray-900">新規取引記録追加</h3>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <p className="text-green-500 text-sm">{success}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {/* ProjectID -> ParentOrderId に変更 */}
          <label htmlFor="ParentOrderId_add" className={commonLabelClass}>Parent Order ID (Project ID) <span className="text-red-500">*</span></label>
          <select name="ParentOrderId" id="ParentOrderId_add" value={formData.ParentOrderId} onChange={handleChange} className={commonInputClass} required>
            <option value="">-- ProjectIDを選択 --</option>
            {projects.map(p => (
              // p.ProjectID は Project テーブルの ProjectID を指す
              <option key={p.ProjectID} value={p.ProjectID || ''}>{p.ProjectID} ({p.Ticker})</option>
            ))}
          </select>
        </div>
         {/* StockCycle フィールドを削除 */}
         {/* <div>
          <label htmlFor="StockCycle" className={commonLabelClass}>Stock Cycle (自動入力/編集可)</label>
          <input type="text" name="StockCycle" id="StockCycle" value={formData.StockCycle} onChange={handleChange} className={commonInputClass} placeholder="例: 7203 JT Equity"/>
        </div> */}
        <div>
          <label htmlFor="Date_add" className={commonLabelClass}>日付 <span className="text-red-500">*</span></label>
          <input type="date" name="Date" id="Date_add" value={formData.Date} onChange={handleChange} className={commonInputClass} required />
        </div>
        <div>
          {/* FilledQty -> ExecQty に変更 */}
          <label htmlFor="ExecQty_add" className={commonLabelClass}>約定数量 <span className="text-red-500">*</span></label>
          <input type="number" name="ExecQty" id="ExecQty_add" value={formData.ExecQty} onChange={handleChange} className={commonInputClass} required placeholder="例: 1000"/>
        </div>
        <div>
          {/* FilledAveragePrice -> AvgPx に変更 */}
          <label htmlFor="AvgPx_add" className={commonLabelClass}>約定平均価格 <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="AvgPx" id="AvgPx_add" value={formData.AvgPx} onChange={handleChange} className={commonInputClass} required placeholder="例: 1750.50"/>
        </div>
        <div>
          {/* ALL_DAY_VWAP -> VwapPx に変更 */}
          <label htmlFor="VwapPx_add" className={commonLabelClass}>当日VWAP <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="VwapPx" id="VwapPx_add" value={formData.VwapPx} onChange={handleChange} className={commonInputClass} required placeholder="例: 1752.00"/>
        </div>
      </div>
      <div>
        <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
          {isLoading ? '追加中...' : '取引記録追加'}
        </button>
      </div>
    </form>
  );
};

export default AddChildOrderForm; // エクスポート名を変更