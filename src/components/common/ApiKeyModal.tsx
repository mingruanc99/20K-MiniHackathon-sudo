// src/components/common/ApiKeyModal.tsx
import React, { useState, useEffect } from 'react';
import { apiKeyService } from '../../services/llm/apiKeyService';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  X,
  Loader2,
  Trash2
} from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = apiKeyService.getApiKey();
      setApiKey(current);
      if (current) {
        setStatusMsg({ type: 'info', text: 'Đã phát hiện API Key đang được lưu trữ trong trình duyệt.' });
      } else {
        setStatusMsg(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập Gemini API Key trước khi kiểm tra.' });
      return;
    }

    setValidating(true);
    setStatusMsg(null);
    const res = await apiKeyService.validateKey(apiKey);
    setValidating(false);

    if (res.valid) {
      setStatusMsg({ type: 'success', text: res.message });
    } else {
      setStatusMsg({ type: 'error', text: res.message });
    }
  };

  const handleSave = () => {
    if (!apiKey.trim()) {
      apiKeyService.setApiKey('');
      setStatusMsg({ type: 'info', text: 'Đã xóa API Key.' });
      onSaved?.('');
      onClose();
      return;
    }

    apiKeyService.setApiKey(apiKey.trim());
    onSaved?.(apiKey.trim());
    onClose();
  };

  const handleClear = () => {
    setApiKey('');
    apiKeyService.setApiKey('');
    setStatusMsg({ type: 'info', text: 'Đã xóa API Key.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <KeyRound className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Cấu hình Gemini API Key</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Online LLM
                </span>
              </h3>
              <p className="text-xs text-indigo-200">Ứng dụng hoạt động 100% bằng mô hình trực tuyến của Google</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-800 mb-1">Thực thi hoàn toàn bằng LLM Online:</p>
              Toàn bộ tiến trình phân tích toàn bài giảng, phân rã khái niệm, lọc nhiễu, lập kế hoạch sư phạm và sinh lời giảng tự nhiên đều do trực tiếp mô hình **Google Gemini (2.5 / 2.0 / 1.5 Flash)** xử lý trực tuyến.
            </div>
          </div>

          {/* Key Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Google Gemini API Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-800 font-normal normal-case flex items-center gap-1 hover:underline text-[11px]"
              >
                <span>Lấy key miễn phí tại AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </label>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setStatusMsg(null);
                }}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-20 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-hidden"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition rounded"
                  title={showKey ? 'Ẩn' : 'Hiện'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {apiKey && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded"
                    title="Xóa Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Key được bảo mật lưu trữ trong LocalStorage trên trình duyệt của bạn và chỉ gửi trực tiếp tới máy chủ Google Gemini.
            </p>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : statusMsg.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-800'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMsg.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={validating || !apiKey.trim()}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {validating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Đang kiểm tra...</span>
              </>
            ) : (
              <span>Kiểm tra kết nối</span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              Lưu & Kích hoạt Online
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
