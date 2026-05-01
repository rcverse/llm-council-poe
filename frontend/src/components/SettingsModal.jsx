import { useMemo, useState } from 'react';
import './SettingsModal.css';

const PROVIDER_HELP_TEXT = {
  poe: 'Poe uses an OpenAI-compatible endpoint and API key.',
  openrouter: 'OpenRouter remains the default provider.',
};

// Model name translation tables (mirrors backend/config.py)
const OPENROUTER_TO_POE = {
  'openai/gpt-5.5': 'GPT-5.5',
  'openai/gpt-5.1': 'GPT-5.1',
  'openai/gpt-4.1': 'GPT-4.1',
  'openai/gpt-4o': 'GPT-4o',
  'openai/gpt-4o-mini': 'GPT-4o-mini',
  'openai/o3': 'o3',
  'openai/o3-mini': 'o3-mini',
  'openai/o1': 'o1',
  'anthropic/claude-opus-4-6': 'claude-opus-4-6',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6',
  'anthropic/claude-opus-4-5': 'claude-opus-4-5',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5',
  'anthropic/claude-sonnet-4.5': 'claude-sonnet-4.5',
  'anthropic/claude-3-7-sonnet': 'claude-3-7-sonnet',
  'anthropic/claude-3-5-sonnet': 'claude-3-5-sonnet',
  'anthropic/claude-3-opus': 'claude-3-opus',
  'google/gemini-3-pro-preview': 'gemini-3-pro-preview',
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2-flash': 'gemini-2-flash',
  'x-ai/grok-4': 'grok-4',
  'x-ai/grok-3': 'grok-3',
  'x-ai/grok-3-mini': 'grok-3-mini',
};

const POE_TO_OPENROUTER = Object.fromEntries(
  Object.entries(OPENROUTER_TO_POE).map(([k, v]) => [v, k])
);

function translateModel(model, fromProvider, toProvider) {
  if (fromProvider === toProvider) return model;
  const map = fromProvider === 'openrouter' ? OPENROUTER_TO_POE : POE_TO_OPENROUTER;
  return map[model] ?? model;
}

function translateModels(modelsText, fromProvider, toProvider) {
  return modelsText
    .split('\n')
    .map((line) => translateModel(line.trim(), fromProvider, toProvider))
    .join('\n');
}

export default function SettingsModal({
  settings,
  isLoading,
  isSaving,
  error,
  onClose,
  onSave,
}) {
  const [provider, setProvider] = useState(settings?.llm_provider || 'openrouter');
  const [apiUrl, setApiUrl] = useState(settings?.llm_api_url || '');
  const [modelsText, setModelsText] = useState(
    (settings?.council_models || []).join('\n')
  );
  const [chairmanModel, setChairmanModel] = useState(settings?.chairman_model || '');
  const [apiKey, setApiKey] = useState('');
  const [validationError, setValidationError] = useState('');

  const providerHelp = useMemo(() => {
    return PROVIDER_HELP_TEXT[provider] || 'Use an OpenAI-compatible provider.';
  }, [provider]);

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    const oldProvider = provider;
    setProvider(newProvider);
    // Auto-translate model names when provider changes
    setModelsText((prev) => translateModels(prev, oldProvider, newProvider));
    setChairmanModel((prev) => translateModel(prev.trim(), oldProvider, newProvider));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const councilModels = modelsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (councilModels.length === 0) {
      setValidationError('Add at least one council model.');
      return;
    }

    if (!chairmanModel.trim()) {
      setValidationError('Chairman model is required.');
      return;
    }

    setValidationError('');
    await onSave({
      llm_provider: provider,
      llm_api_url: apiUrl.trim(),
      council_models: councilModels,
      chairman_model: chairmanModel.trim(),
      llm_api_key: apiKey.trim(),
    });
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Runtime Settings</h2>
          <button
            className="settings-close-btn"
            onClick={onClose}
            disabled={isSaving}
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="settings-loading">Loading settings...</div>
        ) : (
          <form className="settings-form" onSubmit={handleSubmit}>
            <label>
              Provider
              <select
                value={provider}
                onChange={handleProviderChange}
                disabled={isSaving}
              >
                <option value="openrouter">openrouter</option>
                <option value="poe">poe</option>
              </select>
            </label>

            <div className="settings-help">{providerHelp}</div>

            <label>
              API URL
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                disabled={isSaving}
                placeholder="https://.../v1/chat/completions"
              />
            </label>

            <label>
              Council Models (one per line)
              <textarea
                value={modelsText}
                onChange={(e) => setModelsText(e.target.value)}
                disabled={isSaving}
                rows={5}
              />
            </label>

            <label>
              Chairman Model
              <input
                type="text"
                value={chairmanModel}
                onChange={(e) => setChairmanModel(e.target.value)}
                disabled={isSaving}
              />
            </label>

            <label>
              API Key (optional update)
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isSaving}
                placeholder={
                  settings?.has_api_key
                    ? 'Configured (leave blank to keep current)'
                    : 'Enter API key'
                }
              />
            </label>

            {validationError && (
              <div className="settings-error">{validationError}</div>
            )}
            {error && <div className="settings-error">{error}</div>}

            <div className="settings-actions">
              <button type="button" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
