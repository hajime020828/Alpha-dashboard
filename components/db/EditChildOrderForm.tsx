// components/db/EditChildOrderForm.tsx // ファイル名変更推奨
import { useState, FormEvent, useEffect } from 'react';
// インターフェース名を ChildOrderRecord に変更
import type { ChildOrderRecord, Project } from '@/lib/db';

// 型名を変更し、カラム名を更新
interface DisplayableChildOrderForEdit extends Pick<ChildOrderRecord, 'ParentOrderId' | 'ExecQty' | 'AvgPx' | 'VwapPx' | 'Date'> {
  rowid: number;
}

interface EditChildOrderFormProps { // コンポーネント名に合わせて変更
  record: DisplayableChildOrderForEdit;
  onRecordUpdated: (updatedRecord: DisplayableChildOrderForEdit) => void;
  onCancel: () => void;
  projects: Pick<Project, 'ProjectID' | 'Ticker'>[]; // ProjectID は親の識別子として使用
}

const EditChildOrderForm: React.FC<EditChildOrderFormProps> = ({ record, onRecordUpdated, onCancel, projects }) => {
  const [formData, setFormData] = useState<DisplayableChildOrderForEdit>(record);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFormData(record);
  }, [record]);

  // StockCycle の自動入力ロジックを削除
  // useEffect(() => {
  //   ...
  // }, [formData.ParentOrderId, projects, formData.StockCycle]);

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
      ExecQty: parseFloat(String(formData.ExecQty)),
      AvgPx: parseFloat(String(formData.AvgPx)),
      VwapPx: parseFloat(String(formData.VwapPx)),
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultData = await res.json();
      if (!res.ok) {
        throw new Error(resultData.message || resultData.error || 'Failed to update child order record'); // メッセージ変更
      }
      setSuccess('取引記録が正常に更新されました。');
      onRecordUpdated(resultData as DisplayableChildOrderForEdit);
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
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-lg bg-white shadow-lg">
      <h3 className="text-xl font-semibold leading-6 text-gray-900">取引記録編集 (ROWID: {record.rowid})</h3>
      {error && <p className="text-red-500 text-sm p-2 bg-red-50 rounded">{error}</p>}
      {success && <p className="text-green-500 text-sm p-2 bg-green-50 rounded">{success}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {/* ProjectID -> ParentOrderId に変更 */}
          <label htmlFor={`edit_co_ParentOrderId_${record.rowid}`} className={commonLabelClass}>Parent Order ID (Project ID) <span className="text-red-500">*</span></label>
          <select name="ParentOrderId" id={`edit_co_ParentOrderId_${record.rowid}`} value={formData.ParentOrderId || ''} onChange={handleChange} className={commonInputClass} required>
            <option value="">-- ProjectIDを選択 --</option>
            {projects.map(p => (
              // p.ProjectID は Project テーブルの ProjectID を指す
              <option key={p.ProjectID} value={p.ProjectID || ''}>{p.ProjectID} ({p.Ticker})</option>
            ))}
          </select>
        </div>
         {/* StockCycle フィールドを削除 */}
         {/* <div> ... </div> */}
        <div>
          <label htmlFor={`edit_co_Date_${record.rowid}`} className={commonLabelClass}>日付 <span className="text-red-500">*</span></label>
          <input type="date" name="Date" id={`edit_co_Date_${record.rowid}`} value={formData.Date} onChange={handleChange} className={commonInputClass} required />
        </div>
        <div>
          {/* FilledQty -> ExecQty に変更 */}
          <label htmlFor={`edit_co_ExecQty_${record.rowid}`} className={commonLabelClass}>約定数量 <span className="text-red-500">*</span></label>
          <input type="number" name="ExecQty" id={`edit_co_ExecQty_${record.rowid}`} value={formData.ExecQty} onChange={handleChange} className={commonInputClass} required placeholder="例: 1000"/>
        </div>
        <div>
          {/* FilledAveragePrice -> AvgPx に変更 */}
          <label htmlFor={`edit_co_AvgPx_${record.rowid}`} className={commonLabelClass}>約定平均価格 <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="AvgPx" id={`edit_co_AvgPx_${record.rowid}`} value={formData.AvgPx} onChange={handleChange} className={commonInputClass} required placeholder="例: 1750.50"/>
        </div>
        <div>
          {/* ALL_DAY_VWAP -> VwapPx に変更 */}
          <label htmlFor={`edit_co_VwapPx_${record.rowid}`} className={commonLabelClass}>当日VWAP <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="VwapPx" id={`edit_co_VwapPx_${record.rowid}`} value={formData.VwapPx} onChange={handleChange} className={commonInputClass} required placeholder="例: 1752.00"/>
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
         <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          キャンセル
        </button>
        <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
          {isLoading ? '更新中...' : '取引記録更新'}
        </button>
      </div>
    </form>
  );
};

export default EditChildOrderForm; // エクスポート名を変更