import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Timetable, DaySchedule } from '../types';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  teacherName: string;
  email: string;
  onUploadSuccess: () => void;
}

const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({ isOpen, onClose, uid, teacherName, email, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
      
      const newSchedule: DaySchedule[] = [
        { dayOfWeek: '월', slots: [] },
        { dayOfWeek: '화', slots: [] },
        { dayOfWeek: '수', slots: [] },
        { dayOfWeek: '목', slots: [] },
        { dayOfWeek: '금', slots: [] }
      ];

      for (let r = 1; r < Math.min(json.length, 9); r++) {
        const row = json[r];
        if (!row || row.length === 0) continue;
        
        const periodStr = String(row[0] || '');
        const period = parseInt(periodStr.replace(/[^0-9]/g, '')) || r;

        for (let col = 1; col <= 5; col++) {
          const cellValue = String(row[col] || '').trim();
          if (cellValue && cellValue !== 'undefined') {
            const match = cellValue.match(/(.+?)(?:\((.+?)\))?/);
            const subject = match ? match[1].trim() : cellValue;
            const gradeClass = match && match[2] ? match[2].trim() : '';

            newSchedule[col - 1].slots.push({
              period,
              subject,
              gradeClass
            });
          }
        }
      }

      const timetable: Timetable = {
        id: uid,
        teacherName,
        email,
        schedule: newSchedule
      };

      await setDoc(doc(db, 'timetables', uid), timetable);
      
      alert('시간표 엑셀 업로드 및 동기화가 성공적으로 완료되었습니다.');
      onUploadSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert('엑셀 파일을 파싱하는 중 오류가 발생했습니다. 양식을 확인해주세요.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-brand-50">
          <h2 className="text-lg font-bold text-brand-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-600" />
            엑셀 시간표 연동 (업로드)
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            엑셀 파일(.xlsx)을 업로드하여 내 시간표를 한 번에 설정할 수 있습니다. <br/>
            <strong>양식:</strong> 첫 행은 타이틀 헤더(월/화/수/목/금), 첫 열은 교시 번호, 내용 셀에는 <code className="bg-slate-100 px-1 rounded text-brand-600 font-semibold">과목(학년-반)</code> 형식으로 작성해주세요. (예: <code>국어(1-3)</code>)
          </p>

          <div 
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-brand-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-brand-500 mx-auto mb-3" />
            {file ? (
              <p className="font-semibold text-brand-700 truncate px-4">{file.name}</p>
            ) : (
              <div>
                <p className="font-semibold text-slate-700">여기를 클릭하여 파일 선택</p>
                <p className="text-xs text-slate-500 mt-1">.xlsx 파일만 지원</p>
              </div>
            )}
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="px-6 py-2 bg-brand-600 text-white font-medium rounded-lg shadow-sm hover:bg-brand-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-brand-200 border-t-white rounded-full animate-spin"></div>}
            업로드 및 적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelUploadModal;
