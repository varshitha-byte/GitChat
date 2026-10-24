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
          <div class="citations-title">Verified Source Citations (Click to View):</div>
          <div class="citations-pills">
            ${citations.map(c => `
              <button class="citation-pill" data-file="${escapeHtml(c.file_path)}" data-start="${c.start_line}" data-end="${c.end_line}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                ${escapeHtml(c.file_path)}:L${c.start_line}-L${c.end_line}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="message-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </div>
      <div class="message-content">
        ${renderMarkdown(markdown)}
        ${citationsHtml}
      </div>
    `;

    // Attach click listeners to citations
    el.querySelectorAll('.citation-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const file = pill.dataset.file;
        const start = parseInt(pill.dataset.start, 10);
        const end = parseInt(pill.dataset.end, 10);
        openFileInViewer(file, start, end);
      });
    });

    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  clearChatBtn.addEventListener('click', () => {
    chatMessages.innerHTML = `
      <div class="message assistant-message welcome-message">
        <div class="message-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </div>
        <div class="message-content">
          <p>Conversation cleared. Ready for new questions!</p>
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
    // Format headers
    let html = md.replace(/^### (.*$)/gim, '<h3>$1</h3>')
                 .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                 .replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Format bold & code
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Format code blocks
    html = html.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/gm, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
    });

    // Format inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Format markdown links into clickable elements
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Format newlines
    html = html.replace(/\n\n/g, '<br><br>');
    return html;
  }

  // Load indexed repos on startup
  loadIndexedRepositories();
});
