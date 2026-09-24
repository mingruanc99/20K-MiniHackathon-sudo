// src/components/common/ApiKeyModal.tsx
import React, { useState, useEffect } from 'react';
import {
  apiKeyService,
  PROVIDERS,
  LLMProviderType,
  ProviderMetadata
} from '../../services/llm/apiKeyService';
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
  Trash2,
  Check,
  Cpu,
  Zap,
  Globe
} from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState<LLMProviderType>('gemini');
  const [selectedActiveProvider, setSelectedActiveProvider] = useState<LLMProviderType>('gemini');
  const [keys, setKeys] = useState<Record<LLMProviderType, string>>({
    gemini: '',
    claude: '',
    openai: '',
    openrouter: ''
  });
  const [models, setModels] = useState<Record<LLMProviderType, string>>({
    gemini: PROVIDERS.gemini.defaultModel,
    claude: PROVIDERS.claude.defaultModel,
    openai: PROVIDERS.openai.defaultModel,
    openrouter: PROVIDERS.openrouter.defaultModel
  });
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentProvider = apiKeyService.getActiveProvider();
      setSelectedActiveProvider(currentProvider);
      setActiveTab(currentProvider);

      setKeys({
        gemini: apiKeyService.getApiKey('gemini'),
        claude: apiKeyService.getApiKey('claude'),
        openai: apiKeyService.getApiKey('openai'),
        openrouter: apiKeyService.getApiKey('openrouter')
      });

      setModels({
        gemini: apiKeyService.getActiveModel('gemini'),
        claude: apiKeyService.getActiveModel('claude'),
        openai: apiKeyService.getActiveModel('openai'),
        openrouter: apiKeyService.getActiveModel('openrouter')
      });

      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProviderMeta: ProviderMetadata = PROVIDERS[activeTab];
  const currentKey = keys[activeTab] || '';
  const currentModel = models[activeTab] || currentProviderMeta.defaultModel;
  const isTabActiveProvider = selectedActiveProvider === activeTab;

  const handleKeyChange = (val: string) => {
    setKeys((prev) => ({ ...prev, [activeTab]: val }));
    setStatusMsg(null);
  };

  const handleModelChange = (modelId: string) => {
    setModels((prev) => ({ ...prev, [activeTab]: modelId }));
    apiKeyService.setActiveModel(activeTab, modelId);
    setStatusMsg({
      type: 'info',
      text: `Đã chọn mô hình ${modelId} cho ${currentProviderMeta.name}.`
    });
  };

  const handleTestConnection = async () => {
    if (!currentKey.trim()) {
      setStatusMsg({
        type: 'error',
        text: `Vui lòng nhập API Key cho ${currentProviderMeta.name} trước khi kiểm tra.`
      });
      return;
    }

    setValidating(true);
    setStatusMsg(null);
    const res = await apiKeyService.validateKey(activeTab, currentKey, currentModel);
    setValidating(false);

    if (res.valid) {
      setStatusMsg({ type: 'success', text: res.message });
    } else {
      setStatusMsg({ type: 'error', text: res.message });
    }
  };

  const handleSaveAndActivate = () => {
    // 1. Save all keys to storage
    Object.keys(keys).forEach((p) => {
      const prov = p as LLMProviderType;
      apiKeyService.setApiKey(prov, keys[prov]);
      apiKeyService.setActiveModel(prov, models[prov]);
    });

    // 2. Set active provider
    apiKeyService.setActiveProvider(selectedActiveProvider);

    onSaved?.(keys[selectedActiveProvider]);
    onClose();
  };

  const handleClearKey = () => {
    handleKeyChange('');
    apiKeyService.setApiKey(activeTab, '');
    setStatusMsg({ type: 'info', text: `Đã xóa API Key của ${currentProviderMeta.name}.` });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <KeyRound className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Cấu hình AI Engine & API Key</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Multi-Provider
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Linh hoạt chuyển đổi giữa Gemini, Claude, OpenAI hoặc OpenRouter khi bị quá tải
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2 overflow-x-auto">
          {(Object.keys(PROVIDERS) as LLMProviderType[]).map((pId) => {
            const p = PROVIDERS[pId];
            const isSelected = activeTab === pId;
            const isLive = selectedActiveProvider === pId;

            return (
              <button
                key={pId}
                onClick={() => {
                  setActiveTab(pId);
                  setStatusMsg(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold border-t border-x transition relative shrink-0 ${
                  isSelected
                    ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs font-bold'
                    : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.name.split(' ')[0]}</span>
                {isLive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" title="Đang kích hoạt chạy" />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Active Provider Selector Banner */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{currentProviderMeta.icon}</span>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>{currentProviderMeta.name}</span>
                  {isTabActiveProvider ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> Đang dùng chính
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">
                      Dự phòng
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{currentProviderMeta.description}</p>
              </div>
            </div>

            {!isTabActiveProvider && (
              <button
                type="button"
                onClick={() => {
                  setSelectedActiveProvider(activeTab);
                  setStatusMsg({
                    type: 'info',
                    text: `Đã chọn ${currentProviderMeta.name} làm AI Engine chính.`
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition shrink-0"
              >
                Kích hoạt Engine này
              </button>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span>Mô hình thực thi ({currentProviderMeta.name})</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {currentProviderMeta.models.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    currentModel === m.id
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name={`model_${activeTab}`}
                    value={m.id}
                    checked={currentModel === m.id}
                    onChange={() => handleModelChange(m.id)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">{m.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{m.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>API Key cho {currentProviderMeta.name}</span>
              </label>
              <a
                href={currentProviderMeta.keyHelpUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-800 font-medium normal-case flex items-center gap-1 hover:underline text-[11px]"
              >
                <span>{currentProviderMeta.keyHelpLabel}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={currentKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={currentProviderMeta.keyPlaceholder}
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
                {currentKey && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded"
                    title="Xóa Key này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Mã khóa được lưu trữ an toàn trong LocalStorage của trình duyệt này và gọi trực tiếp tới endpoint của nhà cung cấp.
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
            disabled={validating || !currentKey.trim()}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {validating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Đang kiểm tra kết nối...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Kiểm tra kết nối</span>
              </>
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
              onClick={handleSaveAndActivate}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Lưu & Kích hoạt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
