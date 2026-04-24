import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import SettingsModal from './components/SettingsModal';
import { api } from './api';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaveError, setSettingsSaveError] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsError('');
    setIsSettingsLoading(true);
    try {
      const currentSettings = await api.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettingsError('Failed to load settings');
    } finally {
      setIsSettingsLoading(false);
    }
  }, []);

  // Load conversations + settings on mount
  useEffect(() => {
    loadConversations();
    loadSettings();
  }, [loadConversations, loadSettings]);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId, loadConversation]);

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, message_count: 0 },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  const handleOpenSettings = () => {
    setSettingsSaveError('');
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    if (isSettingsSaving) return;
    setIsSettingsOpen(false);
  };

  const handleSaveSettings = async (newSettings) => {
    setIsSettingsSaving(true);
    setSettingsSaveError('');
    try {
      const savedSettings = await api.updateSettings(newSettings);
      setSettings(savedSettings);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsSaveError('Failed to save settings');
    } finally {
      setIsSettingsSaving(false);
    }
  };

  const updateLastAssistantMessage = (updater) => {
    setCurrentConversation((prev) => {
      if (!prev?.messages?.length) return prev;
      const messages = [...prev.messages];
      const lastIndex = messages.length - 1;
      const lastMsg = messages[lastIndex];
      messages[lastIndex] = updater(lastMsg);
      return { ...prev, messages };
    });
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    try {
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(currentConversationId, content, (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            updateLastAssistantMessage((lastMsg) => {
              const loading = { ...(lastMsg.loading || {}) };
              loading.stage1 = true;
              return { ...lastMsg, loading };
            });
            break;

          case 'stage1_complete':
            updateLastAssistantMessage((lastMsg) => {
              const loading = { ...(lastMsg.loading || {}) };
              loading.stage1 = false;
              return { ...lastMsg, stage1: event.data, loading };
            });
            break;

          case 'stage2_start':
            updateLastAssistantMessage((lastMsg) => {
              const loading = { ...(lastMsg.loading || {}) };
              loading.stage2 = true;
              return { ...lastMsg, loading };
            });
            break;

          case 'stage2_complete':
            updateLastAssistantMessage((lastMsg) => {
              const loading = { ...(lastMsg.loading || {}) };
              loading.stage2 = false;
              return {
                ...lastMsg,
                stage2: event.data,
                metadata: event.metadata,
                loading,
              };
            });
            break;

          case 'stage3_start':
            updateLastAssistantMessage((lastMsg) => {
              const loading = { ...(lastMsg.loading || {}) };
              loading.stage3 = true;
              return { ...lastMsg, loading };
            });
            break;

          case 'stage3_complete':
            updateLastAssistantMessage((lastMsg) => {
              const loading = { ...(lastMsg.loading || {}) };
              loading.stage3 = false;
              return { ...lastMsg, stage3: event.data, loading };
            });
            break;

          case 'title_complete':
            // Reload conversations to get updated title
            loadConversations();
            break;

          case 'complete':
            // Stream complete, reload conversations list
            loadConversations();
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onOpenSettings={handleOpenSettings}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        isLoading={isSettingsLoading}
        isSaving={isSettingsSaving}
        error={settingsError || settingsSaveError}
        onClose={handleCloseSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
