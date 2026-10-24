// ============================================================================
// CodeRAG Assistant — Frontend Application Controller
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    activeRepoId: null,
    provider: localStorage.getItem('coderag_provider') || 'gemini',
    apiKey: localStorage.getItem('coderag_apikey') || '',
    activeFilePath: null,
    isIngesting: false,
    isQuerying: false
  };

  // DOM Elements
  const ingestForm = document.getElementById('ingest-form');
  const repoUrlInput = document.getElementById('repo-url-input');
  const cloneBtn = document.getElementById('clone-btn');
  const cloneSpinner = document.getElementById('clone-spinner');
  const zipDropzone = document.getElementById('zip-dropzone');
  const zipFileInput = document.getElementById('zip-file-input');
  const repoStatusBadge = document.getElementById('repo-status-badge');
  const activeRepoName = document.getElementById('active-repo-name');
  const repoSelectorList = document.getElementById('repo-selector-list');
  const reposCountBadge = document.getElementById('repos-count-badge');
  const statsSection = document.getElementById('stats-section');
  const statFiles = document.getElementById('stat-files');
  const statChunks = document.getElementById('stat-chunks');
  const languagesContainer = document.getElementById('languages-container');
  const fileTreeContainer = document.getElementById('file-tree-container');
  const chatMessages = document.getElementById('chat-messages');
  const queryForm = document.getElementById('query-form');
  const queryInput = document.getElementById('query-input');
  const sendBtn = document.getElementById('send-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const queryTimer = document.getElementById('query-timer');
  const viewerFilePath = document.getElementById('viewer-file-path');
  const viewerLangBadge = document.getElementById('viewer-lang-badge');
  const codeViewerContainer = document.getElementById('code-viewer-container');
  const codeDisplay = document.getElementById('code-display');
  const codeEmptyState = document.querySelector('.code-empty-state');
  const codeLineNumbers = document.getElementById('code-line-numbers');
  const codeLinesContent = document.getElementById('code-lines-content');
  const copyCodeBtn = document.getElementById('copy-code-btn');
  
  // Settings Modal Elements
  const settingsModal = document.getElementById('settings-modal');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const providerSelect = document.getElementById('provider-select');
  const apiKeyInput = document.getElementById('api-key-input');

  // Initialize Settings Inputs
  providerSelect.value = state.provider;
  apiKeyInput.value = state.apiKey;

  // ==========================================================================
  // Initialization & Repositories Fetching
  // ==========================================================================

  async function loadIndexedRepositories() {
    try {
      const res = await fetch('/api/repos');
      if (!res.ok) return;
      const repos = await res.json();
      reposCountBadge.textContent = repos.length;

      if (repos.length === 0) {
        repoSelectorList.innerHTML = `<div class="empty-state">No repositories indexed yet.</div>`;
        return;
      }

      repoSelectorList.innerHTML = '';
      repos.forEach(repoId => {
        const item = document.createElement('div');
        item.className = `repo-item ${state.activeRepoId === repoId ? 'active' : ''}`;
        item.innerHTML = `
          <span>${escapeHtml(repoId.replace(/_/g, '/'))}</span>
          <span class="badge">active</span>
        `;
        item.addEventListener('click', () => switchActiveRepository(repoId));
        repoSelectorList.appendChild(item);
      });

      if (!state.activeRepoId && repos.length > 0) {
        switchActiveRepository(repos[0]);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    }
  }

  async function switchActiveRepository(repoId) {
    state.activeRepoId = repoId;
    activeRepoName.textContent = repoId.replace(/_/g, '/');
    const dot = repoStatusBadge.querySelector('.status-dot');
    dot.className = 'status-dot connected';

    document.querySelectorAll('.repo-item').forEach(el => {
      el.classList.toggle('active', el.textContent.includes(repoId.replace(/_/g, '/')));
    });

    loadFileTree(repoId);
  }

  async function loadFileTree(repoId) {
    try {
      fileTreeContainer.innerHTML = '<div class="empty-state">Loading file structure...</div>';
      const res = await fetch(`/api/repos/${repoId}/tree`);
      if (!res.ok) throw new Error('Tree not found');
      const tree = await res.json();

      fileTreeContainer.innerHTML = '';
      if (!tree || tree.length === 0) {
        fileTreeContainer.innerHTML = '<div class="empty-state">No files available.</div>';
        return;
      }

      function renderNodes(nodes, container) {
        nodes.forEach(node => {
          const nodeEl = document.createElement('div');
          nodeEl.className = 'tree-node';

          if (node.is_dir) {
            nodeEl.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>${escapeHtml(node.name)}</span>
            `;
            const childrenWrapper = document.createElement('div');
            childrenWrapper.className = 'tree-folder-children';
            nodeEl.addEventListener('click', (e) => {
              e.stopPropagation();
              childrenWrapper.style.display = childrenWrapper.style.display === 'none' ? 'block' : 'none';
            });
            container.appendChild(nodeEl);
            container.appendChild(childrenWrapper);
            if (node.children) renderNodes(node.children, childrenWrapper);
          } else {
            nodeEl.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>${escapeHtml(node.name)}</span>
            `;
            nodeEl.addEventListener('click', (e) => {
              e.stopPropagation();
              document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('file-active'));
              nodeEl.classList.add('file-active');
              openFileInViewer(node.path);
            });
            container.appendChild(nodeEl);
          }
        });
      }

      renderNodes(tree, fileTreeContainer);
    } catch (err) {
      fileTreeContainer.innerHTML = `<div class="empty-state">Failed to load tree: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ==========================================================================
  // Ingest Repository Actions
  // ==========================================================================

  ingestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = repoUrlInput.value.trim();
    if (!url) return;
    await performIngest({ repo_url: url });
  });

  document.querySelectorAll('.sample-repo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      repoUrlInput.value = chip.dataset.url;
      performIngest({ repo_url: chip.dataset.url });
    });
  });

  async function performIngest(payload) {
    if (state.isIngesting) return;
    state.isIngesting = true;
    setIngestLoading(true);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: payload.repo_url,
          provider: state.provider,
          api_key: state.apiKey
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Ingestion failed');
      }

      const data = await res.json();
      state.activeRepoId = data.repo_id;

      // Update telemetry
      statsSection.style.display = 'block';
      statFiles.textContent = data.total_files;
      statChunks.textContent = data.total_chunks;
      languagesContainer.innerHTML = '';
      Object.entries(data.languages).forEach(([lang, count]) => {
        const pill = document.createElement('span');
        pill.className = 'lang-pill';
        pill.textContent = `${lang} (${count})`;
        languagesContainer.appendChild(pill);
      });

      await loadIndexedRepositories();
      appendAssistantMessage(
        `### Repository Ingested Successfully!\n\n` +
        `Indexed **${data.total_files}** source files into **${data.total_chunks}** syntax-aware code chunks.\n` +
        `You can now ask questions about architecture, authentication, routing, and workflows!`
      );
    } catch (err) {
      appendAssistantMessage(`### Ingestion Error\n\nFailed to index repository: **${escapeHtml(err.message)}**`);
    } finally {
      state.isIngesting = false;
      setIngestLoading(false);
    }
  }

  function setIngestLoading(isLoading) {
    cloneBtn.disabled = isLoading;
    cloneSpinner.style.display = isLoading ? 'block' : 'none';
    const btnText = cloneBtn.querySelector('.btn-text');
    btnText.textContent = isLoading ? 'Cloning & Parsing...' : 'Clone & Build Index';
  }

  // ==========================================================================
  // ZIP Dropzone Upload
  // ==========================================================================

  zipDropzone.addEventListener('click', () => zipFileInput.click());
  zipDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zipDropzone.classList.add('drag-over');
  });
  zipDropzone.addEventListener('dragleave', () => zipDropzone.classList.remove('drag-over'));
  zipDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    zipDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleZipUpload(e.dataTransfer.files[0]);
    }
  });

  zipFileInput.addEventListener('change', () => {
    if (zipFileInput.files.length > 0) {
      handleZipUpload(zipFileInput.files[0]);
    }
  });

  async function handleZipUpload(file) {
    if (!file.name.endsWith('.zip')) {
      alert('Please upload a .zip archive');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('provider', state.provider);
    if (state.apiKey) formData.append('api_key', state.apiKey);

    try {
      setIngestLoading(true);
      const res = await fetch('/api/upload-zip', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Zip upload failed');
      }
      const data = await res.json();
      state.activeRepoId = data.repo_id;
      statsSection.style.display = 'block';
      statFiles.textContent = data.total_files;
      statChunks.textContent = data.total_chunks;
      await loadIndexedRepositories();
      appendAssistantMessage(`### Zip Archive Ingested\nExtracted and indexed **${data.total_chunks}** code chunks.`);
    } catch (err) {
      appendAssistantMessage(`### Upload Error\n${escapeHtml(err.message)}`);
    } finally {
      setIngestLoading(false);
    }
  }

  // ==========================================================================
  // Chat & Query Engine
  // ==========================================================================

  queryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitQuery();
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  });

  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      queryInput.value = chip.textContent.trim();
      submitQuery();
    });
  });

  async function submitQuery() {
    const query = queryInput.value.trim();
    if (!query || state.isQuerying) return;

    if (!state.activeRepoId) {
      appendAssistantMessage('**Please ingest or select a repository first** using the panel on the left.');
      return;
    }

    appendUserMessage(query);
    queryInput.value = '';
    state.isQuerying = true;
    sendBtn.disabled = true;

    const thinkingMsg = appendThinkingMessage();
    const startTime = performance.now();

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_id: state.activeRepoId,
          query: query,
          top_k: 6,
          provider: state.provider,
          api_key: state.apiKey
        })
      });

      thinkingMsg.remove();

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Query failed');
      }

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);
      queryTimer.textContent = `Retrieved in ${data.query_time_ms}ms • Model: ${data.provider_used}`;

      appendAssistantMessage(data.answer, data.citations, data.confidence);
    } catch (err) {
      thinkingMsg.remove();
      appendAssistantMessage(`### Query Error\nFailed to get response: **${escapeHtml(err.message)}**`);
    } finally {
      state.isQuerying = false;
      sendBtn.disabled = false;
    }
  }

  function appendUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'message user-message';
    el.innerHTML = `
      <div class="message-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div class="message-content">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendThinkingMessage() {
    const el = document.createElement('div');
    el.className = 'message assistant-message';
    el.innerHTML = `
      <div class="message-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </div>
      <div class="message-content">
        <p style="color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
          <span class="spinner" style="display:inline-block;"></span>
          Executing Hybrid Retrieval (BM25 + Semantic Search) & synthesizing answer...
        </p>
      </div>
    `;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return el;
  }

  function appendAssistantMessage(markdown, citations = [], confidence = null) {
    const el = document.createElement('div');
    el.className = 'message assistant-message';

    let citationsHtml = '';
    if (citations && citations.length > 0) {
      citationsHtml = `
        <div class="citations-wrapper">
          <div class="citations-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>Verified Source Citations (${citations.length})</span>
          </div>
          <div class="citations-pills">
            ${citations.map(c => {
              const start = c.start_line || 1;
              const end = c.end_line || start;
              const rangeText = (start !== end) ? `:L${start}-L${end}` : `:L${start}`;
              return `
                <button class="citation-pill" data-file="${escapeHtml(c.file_path)}" data-start="${start}" data-end="${end}" title="Click to inspect ${escapeHtml(c.file_path)} in code viewer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                  <span class="citation-path">${escapeHtml(c.file_path)}</span>
                  <span class="citation-lines">${rangeText}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    const isWarning = confidence && (confidence.includes('Not Found') || confidence.includes('Low'));
    const confidenceBadge = confidence ? `
      <div class="message-meta-header">
        <span class="confidence-badge ${isWarning ? 'warning' : 'verified'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isWarning 
              ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' 
              : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'}
          </svg>
          <span>${escapeHtml(confidence)}</span>
        </span>
        <button class="copy-answer-btn" title="Copy full response to clipboard">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    ` : '';

    el.innerHTML = `
      <div class="message-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </div>
      <div class="message-content">
        ${confidenceBadge}
        <div class="markdown-body">${renderMarkdown(markdown)}</div>
        ${citationsHtml}
      </div>
    `;

    // Copy full response handler
    const copyAnsBtn = el.querySelector('.copy-answer-btn');
    if (copyAnsBtn) {
      copyAnsBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(markdown).then(() => {
          copyAnsBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Copied!</span>
          `;
          setTimeout(() => {
            copyAnsBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            `;
          }, 1800);
        });
      });
    }

    // Attach copy button and language tag to each <pre> code block
    el.querySelectorAll('.markdown-body pre').forEach(pre => {
      if (!pre.querySelector('.code-block-header')) {
        const code = pre.querySelector('code');
        const langMatch = code ? code.className.match(/language-([a-zA-Z0-9_\-]+)/) : null;
        const lang = langMatch ? langMatch[1] : (pre.dataset.lang || 'code');
        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `
          <span class="code-lang-label">${lang}</span>
          <button class="copy-snippet-btn" title="Copy code snippet">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        `;
        pre.insertBefore(header, pre.firstChild);
        const copyBtn = header.querySelector('.copy-snippet-btn');
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rawCode = code ? code.textContent : pre.textContent;
          navigator.clipboard.writeText(rawCode.trim()).then(() => {
            copyBtn.innerHTML = `
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Copied!</span>
            `;
            setTimeout(() => {
              copyBtn.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              `;
            }, 1800);
          });
        });
      }
    });

    // Attach click listeners to citations
    el.querySelectorAll('.citation-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const file = pill.dataset.file;
        const start = parseInt(pill.dataset.start, 10);
        const end = parseInt(pill.dataset.end, 10);
        openFileInViewer(file, start, end);
      });
    });

    // Make any inline code file references inside markdown clickable too
    el.querySelectorAll('.markdown-body :not(pre) > code').forEach(codeEl => {
      const text = codeEl.textContent.trim().replace(/^\[|\]$/g, '').trim();
      const match = text.match(/^([\w\-_.\/]+\.[a-zA-Z0-9]+)(?::(?:L)?(\d+)(?:-(?:L)?(\d+))?)?$/);
      if (match) {
        const filePath = match[1];
        const start = match[2] ? parseInt(match[2], 10) : 1;
        const end = match[3] ? parseInt(match[3], 10) : start;
        codeEl.classList.add('inline-citation-link');
        codeEl.title = `Click to inspect ${filePath}:${start}-${end} in code viewer`;
        codeEl.addEventListener('click', (e) => {
          e.stopPropagation();
          openFileInViewer(filePath, start, end);
        });
      }
    });

    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  clearChatBtn.addEventListener('click', () => {
    chatMessages.innerHTML = `
      <div class="welcome-banner" id="welcome-banner">
        <div class="welcome-header">
          <span class="welcome-badge">SYSTEM READY</span>
          <h2 class="welcome-title">Codebase Retrieval & Architecture Engine</h2>
        </div>
        <p class="welcome-lead">Grounded software intelligence engine with hybrid AST syntax chunking and verified line citations.</p>
        <div class="welcome-steps-grid">
          <div class="welcome-step">
            <span class="step-num">01</span>
            <div class="step-content">
              <strong>Index Repository</strong>
              <span>Paste any public GitHub URL or drop a local project zip.</span>
            </div>
          </div>
          <div class="welcome-step">
            <span class="step-num">02</span>
            <div class="step-content">
              <strong>Hybrid Retrieval</strong>
              <span>BM25 lexical matching combined with dense vector embeddings.</span>
            </div>
          </div>
          <div class="welcome-step">
            <span class="step-num">03</span>
            <div class="step-content">
              <strong>Inspect Citations</strong>
              <span>Click any line citation to jump directly to code in the inspector.</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  // ==========================================================================
  // Live Code Viewer & Line Highlighting
  // ==========================================================================

  async function openFileInViewer(filePath, startLine = null, endLine = null) {
    if (!state.activeRepoId) return;
    state.activeFilePath = filePath;
    viewerFilePath.textContent = filePath;

    try {
      const res = await fetch(`/api/repos/${state.activeRepoId}/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('File could not be loaded');
      const data = await res.json();

      viewerLangBadge.textContent = data.language;
      codeEmptyState.style.display = 'none';
      codeDisplay.style.display = 'flex';

      const lines = data.content.split('\n');
      codeLineNumbers.innerHTML = '';
      codeLinesContent.innerHTML = '';

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const numSpan = document.createElement('div');
        numSpan.textContent = lineNum;
        codeLineNumbers.appendChild(numSpan);

        const lineSpan = document.createElement('span');
        lineSpan.textContent = line + '\n';

        if (startLine && endLine && lineNum >= startLine && lineNum <= endLine) {
          lineSpan.className = 'code-line-highlight';
          numSpan.style.color = 'var(--accent-primary)';
          numSpan.style.fontWeight = 'bold';
        }

        codeLinesContent.appendChild(lineSpan);
      });

      // Scroll to target start line
      if (startLine) {
        const targetNumber = codeLineNumbers.children[startLine - 1];
        if (targetNumber) {
          targetNumber.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        codeViewerContainer.scrollTop = 0;
      }
    } catch (err) {
      alert(`Could not open file: ${err.message}`);
    }
  }

  copyCodeBtn.addEventListener('click', () => {
    if (!codeLinesContent.textContent) return;
    navigator.clipboard.writeText(codeLinesContent.textContent).then(() => {
      const originalText = viewerLangBadge.textContent;
      viewerLangBadge.textContent = 'Copied!';
      setTimeout(() => viewerLangBadge.textContent = originalText, 1500);
    });
  });

  // ==========================================================================
  // Settings Modal Handlers
  // ==========================================================================

  openSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
  closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
  cancelSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');

  saveSettingsBtn.addEventListener('click', () => {
    state.provider = providerSelect.value;
    state.apiKey = apiKeyInput.value.trim();
    localStorage.setItem('coderag_provider', state.provider);
    localStorage.setItem('coderag_apikey', state.apiKey);
    settingsModal.style.display = 'none';
    appendAssistantMessage(`Model settings updated: Provider set to **${state.provider}**.`);
  });

  // ==========================================================================
  // Helpers
  // ==========================================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function renderMarkdown(md) {
    if (!md) return '';

    // Step 1: Normalize all line endings (CRLF -> LF)
    let cleanMd = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Priority 1: Use full marked.js parser if available
    if (typeof marked !== 'undefined') {
      try {
        if (typeof marked.parse === 'function') {
          return marked.parse(cleanMd, { gfm: true, breaks: true });
        } else if (typeof marked === 'function') {
          return marked(cleanMd);
        }
      } catch (err) {
        console.warn('Marked parse error, using fallback:', err);
      }
    }

    // Priority 2: Robust multi-level Markdown Fallback Parser
    let html = escapeHtml(cleanMd);

    // Code blocks with syntax language tags
    html = html.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/gm, (match, lang, code) => {
      const language = lang || 'text';
      return `<pre data-lang="${language}"><code class="language-${language}">${code.trim()}</code></pre>`;
    });

    // Headers h1 to h6
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>')
               .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
               .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
               .replace(/^### (.*$)/gim, '<h3>$1</h3>')
               .replace(/^## (.*$)/gim, '<h2>$1</h2>')
               .replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold, Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
               .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/gim, '');

    // Ordered lists
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Paragraph line breaks
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<\/p>/g, '')
               .replace(/<p>\s*(<h[1-6]>.*?<\/h[1-6]>)\s*<\/p>/g, '$1')
               .replace(/<p>\s*(<pre[\s\S]*?<\/pre>)\s*<\/p>/g, '$1')
               .replace(/<p>\s*(<ul>[\s\S]*?<\/ul>)\s*<\/p>/g, '$1')
               .replace(/<p>\s*(<blockquote>[\s\S]*?<\/blockquote>)\s*<\/p>/g, '$1');

    return html;
  }

  // Load indexed repos on startup
  loadIndexedRepositories();
});
