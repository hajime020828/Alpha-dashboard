// pages/calendar.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views, SlotInfo } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ja from 'date-fns/locale/ja';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { Project, CalendarEventDb } from '@/lib/db';
import useSWR, { mutate } from 'swr'; // mutate をインポート

// --- SWR fetcher ---
const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) {
        throw new Error('データの取得に失敗しました。');
    }
    return res.json();
});

// --- date-fns のロケール設定 ---
const locales = {
  'ja-JP': ja,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { locale: ja }),
  getDay,
  locales,
});

// --- カレンダーに表示するイベントの共通型 ---
interface DisplayEvent {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resourceType: 'project' | 'custom';
  resource: Project | CalendarEventDb; 
}

// --- 【修正】モーダルのための型 (日付/時刻を文字列で保持) ---
interface EventModalState {
  isOpen: boolean;
  id: number | null; // 編集対象のID (null の場合は新規追加)
  title: string;
  allDay: boolean;
  // ▼▼▼ 日付と時刻を文字列で管理 ▼▼▼
  startDate: string; // "yyyy-MM-dd"
  startTime: string; // "HH:mm"
  endDate: string;   // "yyyy-MM-dd"
  endTime: string;   // "HH:mm"
}

const CalendarPage = () => {
  // SWR (変更なし)
  const { data: projects, error: projectsError } = useSWR<Project[]>('/api/db/projects', fetcher);
  const { data: customEventsDb, error: customEventsError } = useSWR<CalendarEventDb[]>('/api/calendar-events', fetcher);
  
  // --- 【修正】モーダルの初期状態 ---
  const [modalState, setModalState] = useState<EventModalState>({
    isOpen: false,
    id: null,
    title: '',
    allDay: false,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
  });
  
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // マージ処理 (変更なし)
  const allEvents: DisplayEvent[] = useMemo(() => {
    // ... (プロジェクトイベントのマッピング - 変更なし) ...
    const projectEvents: DisplayEvent[] = (projects || [])
      .filter(p => p.Start_Date && p.End_Date)
      .map(project => {
        const startDate = new Date(project.Start_Date.replace(/-/g, '/'));
        const endDate = new Date(project.End_Date.replace(/-/g, '/'));
        const inclusiveEndDate = new Date(endDate);
        inclusiveEndDate.setDate(endDate.getDate() + 1); 

        return {
          id: `proj-${project.internal_id}`,
          title: `[P] ${project.Name} (${project.ProjectID || 'N/A'})`,
          start: startDate,
          end: inclusiveEndDate,
          allDay: true,
          resourceType: 'project' as const,
          resource: project,
        };
      });
    // ... (カスタムイベントのマッピング - 変更なし) ...
    const customEvents: DisplayEvent[] = (customEventsDb || [])
      .map(event => ({
        id: `cust-${event.id}`,
        title: event.title,
        start: new Date(event.start_date),
        end: new Date(event.end_date),
        allDay: event.allDay === 1,
        resourceType: 'custom' as const,
        resource: event,
      }));

    return [...projectEvents, ...customEvents];
  }, [projects, customEventsDb]);


  // --- 【修正】カレンダーの空きスロット選択 (日付/時刻入力に対応) ---
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    const { start, end } = slotInfo;
    
    // 終日スロット (日付のみ) をクリック/ドラッグしたか判定
    const isAllDayClick = slotInfo.action === 'click' && slotInfo.slots.length > 1;
    const isAllDayDrag = slotInfo.action === 'select' && 
                         start.getHours() === 0 && start.getMinutes() === 0 &&
                         (end.getHours() === 0 && end.getMinutes() === 0);
    
    const allDay = isAllDayClick || isAllDayDrag;
    
    // 終日の場合、終了日はRBCの仕様（翌日0時）からユーザー表示用（当日）に戻す
    let adjustedEnd = end;
    if (isAllDayDrag && start < end) {
        adjustedEnd = new Date(end.getTime() - (24 * 60 * 60 * 1000));
    }
    if (isAllDayClick) {
        adjustedEnd = start;
    }

    setModalState({
      isOpen: true,
      id: null,
      title: '',
      allDay: allDay,
      // ▼▼▼ 日付/時刻の文字列として設定 ▼▼▼
      startDate: format(start, 'yyyy-MM-dd'),
      startTime: allDay ? '09:00' : format(start, 'HH:mm'), // 終日ならデフォルト9時
      endDate: format(adjustedEnd, 'yyyy-MM-dd'),
      endTime: allDay ? '17:00' : format(adjustedEnd, 'HH:mm'), // 終日ならデフォルト17時
      // ▲▲▲ --- ▲▲▲
    });
    setApiError(null);
  }, []);

  // --- 【修正】既存イベントクリック (日付/時刻入力に対応) ---
  const handleSelectEvent = useCallback((event: DisplayEvent) => {
    if (event.resourceType === 'project') {
      if ((event.resource as Project).ProjectID) {
        window.location.href = `/projects/${(event.resource as Project).ProjectID}`;
      }
      return;
    }

    if (event.resourceType === 'custom') {
      const dbEvent = event.resource as CalendarEventDb;
      
      let modalEndDate = event.end;
      // 終日イベントの場合、RBCの終了日(翌日0時)から表示用(当日)に-1日する
      if (event.allDay) {
          modalEndDate = new Date(event.end.getTime() - (24 * 60 * 60 * 1000));
      }

      setModalState({
        isOpen: true,
        id: dbEvent.id,
        title: dbEvent.title,
        allDay: event.allDay,
        // ▼▼▼ 日付/時刻の文字列として設定 ▼▼▼
        startDate: format(event.start, 'yyyy-MM-dd'),
        startTime: format(event.start, 'HH:mm'),
        endDate: format(modalEndDate, 'yyyy-MM-dd'),
        endTime: format(modalEndDate, 'HH:mm'),
        // ▲▲▲ --- ▲▲▲
      });
      setApiError(null);
    }
  }, []);

  // --- 【修正】モーダルを閉じる (stateリセット) ---
  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      id: null,
      title: '',
      allDay: false,
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
    });
    setApiError(null);
    setIsLoading(false);
  };

  // --- 【修正】保存 (新規/編集) ハンドラ (日付/時刻文字列から Date を再構築) ---
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalState.title.trim()) {
      setApiError("タイトルを入力してください。");
      return;
    }
    
    setIsLoading(true);
    setApiError(null);

    let startDateTime: Date;
    let endDateTime: Date;

    try {
      // フォームの文字列入力から Date オブジェクトを再構築
      if (modalState.allDay) {
        // 終日イベント
        startDateTime = parse(modalState.startDate, 'yyyy-MM-dd', new Date());
        let exclusiveEndDate = parse(modalState.endDate, 'yyyy-MM-dd', new Date());
        exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1); // 終日の終了日は翌日0時
        endDateTime = exclusiveEndDate;
      } else {
        // 時刻指定イベント
        startDateTime = parse(`${modalState.startDate}T${modalState.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
        endDateTime = parse(`${modalState.endDate}T${modalState.endTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
      }

      // パース失敗チェック
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          throw new Error("日付または時刻の形式が無効です。 (例: 2025-10-30, 14:30)");
      }
      // 順序チェック
      if (endDateTime < startDateTime) {
          throw new Error("終了日時は開始日時より後に設定してください。");
      }

    } catch (parseError: any) {
      setApiError(parseError.message);
      setIsLoading(false);
      return;
    }

    // APIに送るデータ
    const eventData = {
      id: modalState.id,
      title: modalState.title,
      start: startDateTime.toISOString(), // ISO文字列で送信
      end: endDateTime.toISOString(),     // ISO文字列で送信
      allDay: modalState.allDay,
    };

    const isEditing = eventData.id !== null;
    const url = '/api/calendar-events';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '予定の保存に失敗しました。');
      }

      handleCloseModal();
      mutate('/api/calendar-events'); // SWRキャッシュを再検証
      
    } catch (err: any) {
      setApiError(err.message || '不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 削除ハンドラ (変更なし)
  const handleDeleteEvent = async () => {
    if (modalState.id === null) return;
    if (!window.confirm(`「${modalState.title}」を削除してもよろしいですか？`)) return;

    setIsLoading(true);
    setApiError(null);

    try {
      const res = await fetch(`/api/calendar-events?id=${modalState.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '削除に失敗しました。');
      }
      handleCloseModal();
      mutate('/api/calendar-events');
    } catch (err: any) {
      setApiError(err.message || '不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // モーダル内のフォーム入力ハンドラ
  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setModalState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };


  // --- JSX (レンダリング) ---

  if (projectsError || customEventsError) {
    return <p className="text-center text-red-500">
        データの読み込みに失敗しました: {projectsError?.message || customEventsError?.message}
    </p>;
  }
  if (!projects || customEventsDb === undefined) {
    return <p className="text-center text-gray-500">データを読み込み中...</p>;
  }
  
  const commonInputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const commonLabelClass = "block text-sm font-medium text-gray-700";

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">プロジェクトカレンダー</h1>
      <p className="mb-2 text-sm text-gray-600">プロジェクト期間の表示、または日付/時間をドラッグして予定を追加・編集できます。</p>
      
      {/* --- メインカレンダー --- */}
      <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '80vh' }}>
        <Calendar
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          culture="ja-JP"
          messages={{
            next: "次",
            previous: "前",
            today: "今日",
            month: "月",
            week: "週",
            day: "日",
            agenda: "予定一覧",
            date: "日付",
            time: "時間",
            event: "イベント",
          }}
          onSelectEvent={handleSelectEvent} // 修正
          selectable={true} 
          onSelectSlot={handleSelectSlot}
          fixedWeekCount={true} 
          dayPropGetter={(date) => {
             const day = date.getDay();
             if (day === 0 || day === 6) {
                 return { style: { backgroundColor: '#f9f9f9' } };
             }
             return {};
          }}
          eventPropGetter={(event) => {
            let style = {
              backgroundColor: '#3174ad', // カスタムイベント
              borderRadius: '5px',
              opacity: 0.8,
              color: 'white',
              border: '0px',
              display: 'block',
              cursor: 'pointer',
            };
            if (event.resourceType === 'project') {
              style.backgroundColor = (event.resource as Project).Side === 'BUY' ? '#10B981' : '#EF4444';
            }
            return { style };
          }}
        />
      </div>

      {/* --- 【修正】予定追加・編集モーダル --- */}
      {modalState.isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 overflow-y-auto"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg my-8" // 少し幅を広げる
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">
              {modalState.id ? '予定の編集' : '新規予定追加'}
            </h3>
            
            <form onSubmit={handleSaveEvent} className="space-y-4">
              {/* タイトル */}
              <div>
                <label htmlFor="eventTitle" className={commonLabelClass}>
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="eventTitle"
                  name="title"
                  value={modalState.title}
                  onChange={handleModalChange}
                  className={commonInputClass}
                  placeholder="例: 田中様 MTG"
                  autoFocus
                />
              </div>

              {/* 終日チェック */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allDay"
                  name="allDay"
                  checked={modalState.allDay}
                  onChange={handleModalChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="allDay" className="ml-2 block text-sm text-gray-900">
                  終日
                </label>
              </div>

              {/* 開始日時 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className={commonLabelClass}>開始日</label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={modalState.startDate}
                    onChange={handleModalChange}
                    className={commonInputClass}
                    required
                  />
                </div>
                {/* 終日でなければ時間も表示 */}
                {!modalState.allDay && (
                  <div>
                    <label htmlFor="startTime" className={commonLabelClass}>開始時刻</label>
                    <input
                      type="time"
                      id="startTime"
                      name="startTime"
                      value={modalState.startTime}
                      onChange={handleModalChange}
                      className={commonInputClass}
                      required
                    />
                  </div>
                )}
              </div>

              {/* 終了日時 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="endDate" className={commonLabelClass}>終了日</label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={modalState.endDate}
                    onChange={handleModalChange}
                    className={commonInputClass}
                    required
                  />
                </div>
                {/* 終日でなければ時間も表示 */}
                {!modalState.allDay && (
                  <div>
                    <label htmlFor="endTime" className={commonLabelClass}>終了時刻</label>
                    <input
                      type="time"
                      id="endTime"
                      name="endTime"
                      value={modalState.endTime}
                      onChange={handleModalChange}
                      className={commonInputClass}
                      required
                    />
                  </div>
                )}
              </div>
              
              {apiError && (
                <p className="text-red-500 text-sm">{apiError}</p>
              )}

              {/* ボタンエリア */}
              <div className="flex justify-between items-center pt-4">
                <div>
                  {modalState.id !== null && (
                    <button
                      type="button"
                      onClick={handleDeleteEvent}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '削除中...' : '削除'}
                    </button>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
              
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CalendarPage;