import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is "data:<mime>;base64,<data>" — strip the prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  fileAttachmentSupported,
}) {
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleFileChange = async (e) => {
    setFileError('');
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length) {
      setFileError(`Files must be under ${MAX_FILE_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }

    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          mediaType: file.type,
          data: await readFileAsBase64(file),
        }))
      );
      setPendingFiles((prev) => [...prev, ...attachments]);
    } catch {
      setFileError('Failed to read file(s). Please try again.');
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input, pendingFiles);
      setInput('');
      setPendingFiles([]);
      setFileError('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>Welcome to LLM Council</h2>
          <p>Create a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <h2>Start a conversation</h2>
            <p>Ask a question to consult the LLM Council</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">You</div>
                  <div className="message-content">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="message-attachments">
                        {msg.attachments.map((att, i) => (
                          <span key={i} className="attachment-badge">
                            📎 {att.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">LLM Council</div>

                  {/* Stage 1 */}
                  {msg.loading?.stage1 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 1: Collecting individual responses...</span>
                    </div>
                  )}
                  {msg.stage1 && <Stage1 responses={msg.stage1} />}

                  {/* Stage 2 */}
                  {msg.loading?.stage2 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 2: Peer rankings...</span>
                    </div>
                  )}
                  {msg.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                    />
                  )}

                  {/* Stage 3 */}
                  {msg.loading?.stage3 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 3: Final synthesis...</span>
                    </div>
                  )}
                  {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Consulting the council...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {conversation.messages.length === 0 && (
        <form className="input-form" onSubmit={handleSubmit}>
          {pendingFiles.length > 0 && (
            <div className="pending-files">
              {pendingFiles.map((f, i) => (
                <span key={i} className="pending-file-chip">
                  📎 {f.name}
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => handleRemoveFile(i)}
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          {fileError && <div className="file-error">{fileError}</div>}
          <div className="input-row">
            {fileAttachmentSupported && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  className="file-input-hidden"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="attach-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach image or PDF"
                >
                  📎
                </button>
              </>
            )}
            <textarea
              className="message-input"
              placeholder="Ask your question... (Shift+Enter for new line, Enter to send)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={3}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim() || isLoading}
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
